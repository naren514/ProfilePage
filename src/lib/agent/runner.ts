import { and, desc, eq, isNull, lt, or, sql } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { atomic, db } from "@/lib/db";
import {
  writingAgentEvents,
  writingAgentRuns,
  writingAiUsage,
  writingApprovals,
  writingDocuments,
  type RunOrigin,
  type RunUsage,
  type WritingAgentRun,
} from "@/lib/db/schema";
import { getProvider, LLMError, type Usage } from "@/lib/llm";
import { generateJson } from "@/lib/llm/json";
import { estimateMessages } from "@/lib/llm/openai-compatible";
import { pgErrorInfo } from "@/lib/http/errors";
import { documentSections } from "@/lib/writing/content";
import { checkBudget, costUsd, getAiSettings, monthToDate, type AiSettings } from "@/lib/writing/ai/settings";
import { resolveStyle, styleExamples } from "@/lib/writing/ai/styles";
import { addUsage, assertWithinRunBudget, BudgetExceeded, defaultRunBudget, EMPTY_USAGE } from "./budget";
import { SearchError, tavilySearch } from "./tavily";
import type { DocumentContext, StepContext, WorkflowDef } from "./types";
import { WORKFLOWS, type WorkflowId } from "./workflows";

const TERMINAL = new Set(["COMPLETED", "FAILED", "CANCELLED"]);
const LOCK_STALE_MS = 3 * 60 * 1000;

export class RunRejected extends Error {
  constructor(public code: "VALIDATION_FAILED" | "NOT_FOUND" | "AI_DISABLED" | "AI_BUDGET_EXCEEDED" | "EDIT_CONFLICT", message: string, public status: number) {
    super(message);
  }
}

class Cancelled extends Error {}

export async function logEvent(runId: string, type: string, message: string, payload?: Record<string, unknown>) {
  await db.insert(writingAgentEvents).values({ runId, type, message, payload: payload ?? null });
}

function workflowOf(run: Pick<WritingAgentRun, "workflow">): WorkflowDef {
  const wf = WORKFLOWS[run.workflow as WorkflowId];
  if (!wf) throw new Error(`Unknown workflow ${run.workflow}`);
  return wf;
}

function approvalsFrom(state: Record<string, unknown>): Record<string, Record<string, unknown>> {
  const out: Record<string, Record<string, unknown>> = {};
  for (const [key, value] of Object.entries(state)) {
    if (key.startsWith("approval:") && value && typeof value === "object") out[key.slice(9)] = value as Record<string, unknown>;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Create / read
// ---------------------------------------------------------------------------

export async function createRun(params: {
  workflow: string;
  documentId?: string | null;
  ideaId?: string | null;
  input: unknown;
  createdBy: string;
  /** How the run started (default: a click). */
  origin?: RunOrigin;
}): Promise<WritingAgentRun> {
  const wf = WORKFLOWS[params.workflow as WorkflowId];
  if (!wf) throw new RunRejected("VALIDATION_FAILED", "Unknown workflow.", 400);
  const parsed = wf.inputSchema.safeParse(params.input ?? {});
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new RunRejected("VALIDATION_FAILED", issue ? `${issue.path.join(".")}: ${issue.message}` : "Invalid input.", 400);
  }
  if (wf.needsDocument && !params.documentId) throw new RunRejected("VALIDATION_FAILED", "This workflow needs a document.", 400);

  const settings = await getAiSettings();
  if (!settings.enabled) throw new RunRejected("AI_DISABLED", "AI is turned off in Styles & AI.", 403);

  const [run] = await db
    .insert(writingAgentRuns)
    .values({
      workflow: wf.id,
      documentId: params.documentId ?? null,
      ideaId: params.ideaId ?? null,
      input: parsed.data as Record<string, unknown>,
      state: {},
      budget: defaultRunBudget(settings.runBudgetUsd),
      usage: EMPTY_USAGE,
      origin: params.origin ?? "manual",
      createdBy: params.createdBy,
    })
    .returning();
  await logEvent(run.id, "created", `Started: ${wf.label}`, { input: parsed.data });
  return run;
}

export async function getRun(id: string): Promise<WritingAgentRun | null> {
  const [run] = await db.select().from(writingAgentRuns).where(eq(writingAgentRuns.id, id)).limit(1);
  return run ?? null;
}

export async function listEvents(runId: string) {
  return db
    .select()
    .from(writingAgentEvents)
    .where(eq(writingAgentEvents.runId, runId))
    .orderBy(writingAgentEvents.createdAt)
    .limit(500);
}

export async function listRuns(filter: { documentId?: string; limit?: number } = {}) {
  const rows = await db
    .select({
      run: writingAgentRuns,
      documentTitle: writingDocuments.title,
    })
    .from(writingAgentRuns)
    .leftJoin(writingDocuments, eq(writingDocuments.id, writingAgentRuns.documentId))
    .where(filter.documentId ? eq(writingAgentRuns.documentId, filter.documentId) : undefined)
    .orderBy(desc(writingAgentRuns.createdAt))
    .limit(filter.limit ?? 50);
  return rows.map(({ run, documentTitle }) => ({ ...presentRun(run), documentTitle }));
}

/** What the browser sees: no lock internals. */
export function presentRun(run: WritingAgentRun) {
  const wf = WORKFLOWS[run.workflow as WorkflowId];
  const { lockToken: _lock, lockedAt: _locked, ...rest } = run;
  return {
    ...rest,
    workflowLabel: wf?.label ?? run.workflow,
    steps: wf ? wf.steps.map((s, i) => ({ id: s.id, label: s.label, done: i < run.currentStep })) : [],
    working: Boolean(run.lockToken && run.lockedAt && Date.now() - run.lockedAt.getTime() < LOCK_STALE_MS),
  };
}

// ---------------------------------------------------------------------------
// Step context
// ---------------------------------------------------------------------------

async function loadDocument(documentId: string | null): Promise<{ doc: DocumentContext | null; styleId: string | null }> {
  if (!documentId) return { doc: null, styleId: null };
  const [row] = await db.select().from(writingDocuments).where(eq(writingDocuments.id, documentId)).limit(1);
  if (!row) return { doc: null, styleId: null };
  return {
    doc: { id: row.id, title: row.title, excerpt: row.excerpt, text: row.bodyText, outline: documentSections(row.bodyJson) },
    styleId: row.styleId,
  };
}

function usageCost(settings: AiSettings, model: string, usage: Usage) {
  return costUsd(settings, model, usage.inputTokens, usage.outputTokens);
}

async function buildContext(
  run: WritingAgentRun,
  wf: WorkflowDef,
  settings: AiSettings,
  signal: AbortSignal,
  usageRef: { current: RunUsage }
): Promise<StepContext> {
  const { doc, styleId } = await loadDocument(run.documentId);
  const style = await resolveStyle((run.input.styleId as string | undefined) ?? styleId);
  const examples = style ? await styleExamples(style, doc?.text ?? String(run.input.idea ?? run.input.question ?? "")) : [];
  const provider = getProvider();

  const guardMonthly = async (worstCaseUsd: number) => {
    const { spentUsd } = await monthToDate();
    const check = checkBudget(settings, spentUsd, worstCaseUsd);
    if (!check.ok) throw new BudgetExceeded(check.message);
  };
  const ensureNotCancelled = () => {
    if (signal.aborted) throw new Cancelled("Cancelled.");
  };

  return {
    run,
    input: run.input,
    state: run.state,
    approvals: approvalsFrom(run.state),
    document: doc,
    style: style ? { name: style.name, description: style.description, rules: style.rules } : null,
    examples,
    signal,
    async json({ label, tier, system, user, schema, maxOutputTokens }) {
      ensureNotCancelled();
      const model = settings.models[tier];
      const messages = [
        { role: "system" as const, content: system },
        { role: "user" as const, content: user },
      ];
      // Up to two attempts (one repair round)
      const worst = 2 * costUsd(settings, model, estimateMessages(messages), maxOutputTokens);
      assertWithinRunBudget(usageRef.current, run.budget, { modelCall: true, worstCaseUsd: worst }, run.createdAt);
      await guardMonthly(worst);
      const started = Date.now();
      try {
        const result = await generateJson(provider, { model, messages, maxOutputTokens, signal, timeoutMs: 120_000 }, schema);
        const cost = usageCost(settings, model, result.usage);
        usageRef.current = addUsage(usageRef.current, {
          modelCalls: result.attempts,
          inputTokens: result.usage.inputTokens,
          outputTokens: result.usage.outputTokens,
          costUsd: cost,
        });
        await db.insert(writingAiUsage).values({
          operation: `agent:${wf.id}`,
          provider: provider.id,
          model,
          inputTokens: result.usage.inputTokens,
          outputTokens: result.usage.outputTokens,
          costUsd: cost.toFixed(6),
          estimated: !result.usage.reported,
        });
        await logEvent(run.id, "model_call", label, {
          model: result.model || model,
          tier,
          attempts: result.attempts,
          inputTokens: result.usage.inputTokens,
          outputTokens: result.usage.outputTokens,
          costUsd: cost,
          ms: Date.now() - started,
        });
        return result.data;
      } catch (error) {
        const partial = (error as { usage?: Usage }).usage ?? {
          inputTokens: estimateMessages(messages),
          outputTokens: 0,
          reported: false,
        };
        const cost = usageCost(settings, model, partial);
        usageRef.current = addUsage(usageRef.current, { modelCalls: 1, inputTokens: partial.inputTokens, outputTokens: partial.outputTokens, costUsd: cost });
        await db.insert(writingAiUsage).values({
          operation: `agent:${wf.id}`,
          provider: provider.id,
          model,
          inputTokens: partial.inputTokens,
          outputTokens: partial.outputTokens,
          costUsd: cost.toFixed(6),
          estimated: true,
        });
        if (error instanceof LLMError && error.kind === "cancelled") throw new Cancelled("Cancelled.");
        throw error;
      }
    },
    async search(query: string) {
      ensureNotCancelled();
      if (!wf.tools.includes("web.search")) throw new Error(`Tool web.search isn't allowed in ${wf.id}`);
      assertWithinRunBudget(usageRef.current, run.budget, { toolCall: true, worstCaseUsd: settings.searchPriceUsd }, run.createdAt);
      await guardMonthly(settings.searchPriceUsd);
      const started = Date.now();
      try {
        const results = await tavilySearch(query, { maxResults: 5, signal });
        usageRef.current = addUsage(usageRef.current, { toolCalls: 1, costUsd: settings.searchPriceUsd });
        await db.insert(writingAiUsage).values({
          operation: "tool:web.search",
          provider: "tavily",
          model: "search",
          costUsd: settings.searchPriceUsd.toFixed(6),
        });
        await logEvent(run.id, "tool_call", `Searched: ${query}`, {
          tool: "web.search",
          query,
          results: results.length,
          urls: results.map((r) => r.url),
          ms: Date.now() - started,
        });
        return results;
      } catch (error) {
        if (error instanceof SearchError && error.kind === "cancelled") throw new Cancelled("Cancelled.");
        await logEvent(run.id, "tool_error", `Search failed: ${query}`, { message: error instanceof Error ? error.message : String(error) });
        throw error;
      }
    },
    async log(message, payload) {
      await logEvent(run.id, "note", message, payload);
    },
  };
}

// ---------------------------------------------------------------------------
// Advance
// ---------------------------------------------------------------------------

async function finish(
  run: WritingAgentRun,
  lockToken: string | null,
  patch: Partial<typeof writingAgentRuns.$inferInsert>,
  event: { type: string; message: string; payload?: Record<string, unknown> }
) {
  const conditions = [eq(writingAgentRuns.id, run.id)];
  if (lockToken) conditions.push(eq(writingAgentRuns.lockToken, lockToken));
  await atomic([
    db
      .update(writingAgentRuns)
      .set({ ...patch, lockToken: null, lockedAt: null, updatedAt: new Date() })
      .where(and(...conditions)),
    db.insert(writingAgentEvents).values({ runId: run.id, type: event.type, message: event.message, payload: event.payload ?? null }),
  ]);
}

/**
 * Execute the next step, if the run is ready for one and no other request is
 * already running it. Returns the run as it stands afterwards. Calling this
 * repeatedly (e.g. after a page refresh) is safe: a step only runs once.
 */
export async function advanceRun(id: string): Promise<WritingAgentRun | null> {
  const run = await getRun(id);
  if (!run) return null;
  if (TERMINAL.has(run.status) || run.status === "WAITING_FOR_APPROVAL") return run;
  const wf = workflowOf(run);

  if (run.cancelRequested) {
    await finish(run, null, { status: "CANCELLED", finishedAt: new Date() }, { type: "cancelled", message: "Cancelled before the next step started." });
    return getRun(id);
  }

  // Claim the step (compare-and-swap on the step number and lock age)
  const token = uuidv4();
  const staleBefore = new Date(Date.now() - LOCK_STALE_MS);
  const [claimed] = await db
    .update(writingAgentRuns)
    .set({ lockToken: token, lockedAt: new Date(), status: "RUNNING", updatedAt: new Date() })
    .where(
      and(
        eq(writingAgentRuns.id, id),
        eq(writingAgentRuns.currentStep, run.currentStep),
        sql`${writingAgentRuns.status} in ('CREATED', 'RUNNING')`,
        or(isNull(writingAgentRuns.lockToken), lt(writingAgentRuns.lockedAt, staleBefore))
      )
    )
    .returning();
  if (!claimed) return getRun(id);

  const stepIndex = claimed.currentStep;
  const step = wf.steps[stepIndex];
  if (!step) {
    await finish(claimed, token, { status: "COMPLETED", result: wf.result(claimed.state, approvalsFrom(claimed.state)), finishedAt: new Date() }, { type: "completed", message: "Finished." });
    return getRun(id);
  }

  const settings = await getAiSettings();
  const abort = new AbortController();
  // Notice a cancel request while a step is running
  const poll = setInterval(async () => {
    try {
      const [row] = await db
        .select({ cancel: writingAgentRuns.cancelRequested })
        .from(writingAgentRuns)
        .where(eq(writingAgentRuns.id, id))
        .limit(1);
      if (row?.cancel) abort.abort();
    } catch {
      // ignore polling errors
    }
  }, 1500);
  const usageRef = { current: claimed.usage };
  const stepStarted = Date.now();
  const activeMs = () => claimed.activeMs + (Date.now() - stepStarted);
  await logEvent(id, "step_started", step.label, { step: step.id, index: stepIndex });

  try {
    const ctx = await buildContext(claimed, wf, settings, abort.signal, usageRef);
    const outcome = await step.run(ctx);
    if (abort.signal.aborted) throw new Cancelled("Cancelled.");
    const state = { ...claimed.state, [step.id]: outcome.output };
    const isLast = stepIndex === wf.steps.length - 1;
    if (outcome.approval) {
      await finish(
        claimed,
        token,
        {
          state,
          usage: usageRef.current,
          activeMs: activeMs(),
          currentStep: stepIndex + 1,
          status: "WAITING_FOR_APPROVAL",
          pendingApproval: { stepIndex, ...outcome.approval },
        },
        { type: "approval_requested", message: outcome.approval.title, payload: { step: step.id, kind: outcome.approval.kind } }
      );
    } else if (isLast) {
      await finish(
        claimed,
        token,
        { state, usage: usageRef.current, activeMs: activeMs(), currentStep: stepIndex + 1, status: "COMPLETED", result: wf.result(state, approvalsFrom(state)), finishedAt: new Date() },
        { type: "completed", message: `${step.label}: done. Finished.`, payload: { step: step.id } }
      );
    } else {
      await finish(
        claimed,
        token,
        { state, usage: usageRef.current, activeMs: activeMs(), currentStep: stepIndex + 1, status: "RUNNING" },
        { type: "step_completed", message: `${step.label}: done`, payload: { step: step.id } }
      );
    }
  } catch (error) {
    const cancelled = error instanceof Cancelled || abort.signal.aborted;
    const budget = error instanceof BudgetExceeded;
    // Database and other internal errors are logged, not shown verbatim
    const internal = Boolean(pgErrorInfo(error).code) || (error instanceof Error && error.message.startsWith("Failed query"));
    const message = cancelled
      ? "Cancelled. Results from finished steps are kept; the interrupted step produced nothing."
      : internal
        ? "Something went wrong in this step (the details are in the server log). Try again, and if it keeps happening, check the logs."
        : error instanceof Error
          ? error.message
          : "The step failed.";
    if (!cancelled && !budget) console.error(`Agent run ${id} step ${step.id} failed:`, error);
    await finish(
      claimed,
      token,
      { usage: usageRef.current, activeMs: activeMs(), status: cancelled ? "CANCELLED" : "FAILED", error: cancelled ? null : message, finishedAt: new Date() },
      { type: cancelled ? "cancelled" : budget ? "budget_exceeded" : "failed", message, payload: { step: step.id } }
    );
  } finally {
    clearInterval(poll);
  }
  return getRun(id);
}

// ---------------------------------------------------------------------------
// Approvals and cancel
// ---------------------------------------------------------------------------

export type ApprovalAction = "approve" | "regenerate" | "decline";

/**
 * Record the author's decision at a checkpoint. Only the logged-in author can
 * call this; the model can never approve anything itself.
 */
export async function decideRun(
  id: string,
  params: { action: ApprovalAction; stepIndex: number; decision?: Record<string, unknown>; idempotencyKey: string },
  user: string
): Promise<WritingAgentRun | null> {
  const run = await getRun(id);
  if (!run) return null;

  const [already] = await db.select().from(writingApprovals).where(eq(writingApprovals.idempotencyKey, params.idempotencyKey)).limit(1);
  if (already) return run;

  const pending = run.pendingApproval;
  if (run.status !== "WAITING_FOR_APPROVAL" || !pending || pending.stepIndex !== params.stepIndex) {
    throw new RunRejected("EDIT_CONFLICT", "This checkpoint has already been decided or has moved on.", 409);
  }
  const wf = workflowOf(run);
  const decision = params.decision ?? {};

  const approvalRow = db.insert(writingApprovals).values({
    runId: id,
    stepIndex: pending.stepIndex,
    kind: pending.kind,
    decision: { action: params.action, ...decision },
    approvedBy: user,
    idempotencyKey: params.idempotencyKey,
  });

  try {
    if (params.action === "decline") {
      await atomic([
        approvalRow,
        db
          .update(writingAgentRuns)
          .set({ status: "CANCELLED", pendingApproval: null, finishedAt: new Date(), updatedAt: new Date() })
          .where(and(eq(writingAgentRuns.id, id), eq(writingAgentRuns.status, "WAITING_FOR_APPROVAL"))),
        db.insert(writingAgentEvents).values({ runId: id, type: "declined", message: `${pending.title}: declined by ${user}` }),
      ]);
    } else if (params.action === "regenerate") {
      // Run the step that produced the proposal again
      await atomic([
        approvalRow,
        db
          .update(writingAgentRuns)
          .set({ status: "RUNNING", pendingApproval: null, currentStep: pending.stepIndex, updatedAt: new Date() })
          .where(and(eq(writingAgentRuns.id, id), eq(writingAgentRuns.status, "WAITING_FOR_APPROVAL"))),
        db.insert(writingAgentEvents).values({ runId: id, type: "regenerate", message: `${pending.title}: asked for new options` }),
      ]);
    } else {
      const state = { ...run.state, [`approval:${pending.kind}`]: decision };
      const done = run.currentStep >= wf.steps.length;
      await atomic([
        approvalRow,
        db
          .update(writingAgentRuns)
          .set({
            state,
            pendingApproval: null,
            status: done ? "COMPLETED" : "RUNNING",
            ...(done ? { result: wf.result(state, approvalsFrom(state)), finishedAt: new Date() } : {}),
            updatedAt: new Date(),
          })
          .where(and(eq(writingAgentRuns.id, id), eq(writingAgentRuns.status, "WAITING_FOR_APPROVAL"))),
        db.insert(writingAgentEvents).values({ runId: id, type: "approved", message: `${pending.title}: approved by ${user}`, payload: { decision } }),
      ]);
    }
  } catch (error) {
    if (pgErrorInfo(error).code === "23505") return getRun(id); // same approval sent twice
    throw error;
  }
  return getRun(id);
}

export async function cancelRun(id: string, user: string): Promise<WritingAgentRun | null> {
  const run = await getRun(id);
  if (!run) return null;
  if (TERMINAL.has(run.status)) return run;
  const lockedNow = run.lockToken && run.lockedAt && Date.now() - run.lockedAt.getTime() < LOCK_STALE_MS;
  if (lockedNow) {
    // A step is running: ask it to stop; it notices within a couple of seconds
    await db.update(writingAgentRuns).set({ cancelRequested: true, updatedAt: new Date() }).where(eq(writingAgentRuns.id, id));
    await logEvent(id, "cancel_requested", `Cancel requested by ${user}`);
  } else {
    await atomic([
      db
        .update(writingAgentRuns)
        .set({ cancelRequested: true, status: "CANCELLED", pendingApproval: null, finishedAt: new Date(), updatedAt: new Date() })
        .where(eq(writingAgentRuns.id, id)),
      db.insert(writingAgentEvents).values({ runId: id, type: "cancelled", message: `Cancelled by ${user}` }),
    ]);
  }
  return getRun(id);
}

