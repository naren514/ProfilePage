import { and, desc, eq, gte, inArray, isNotNull, isNull, lt, lte, ne, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { writingAgentEvents, writingAgentRuns, writingTriggerFires, writingTriggers, type AgentEventName, type WritingTrigger } from "@/lib/db/schema";
import { getAiSettings } from "@/lib/writing/ai/settings";
import { MAX_WAIT_DAYS } from "./budget";
import { enqueueRun } from "./driver";
import { createRun, logEvent, RunRejected } from "./runner";
import { nextRunAt, renderTemplate, startOfLocalDay } from "./schedule";

// Triggers start agent runs from a schedule or an event (agent PRD A1, plan §3.3).
// Every firing is recorded with a unique (trigger, fire key), so a duplicate
// cron call, a retried request or a repeated event never starts a second run.

const LOCK_STALE_MS = 3 * 60 * 1000;
const ORPHAN_AFTER_MS = 10 * 60 * 1000;

/** Built-in triggers, created once (disabled) so the author can switch them on. */
export const DEFAULT_TRIGGERS: Array<Omit<typeof writingTriggers.$inferInsert, "id">> = [
  {
    key: "nightly-digest",
    name: "Nightly reading digest",
    description: "Reads what you saved to your reading list since the last digest, suggests topics, writes a short brief and adds the strongest pieces to your ideas inbox. Private: nothing is published.",
    kind: "cron",
    schedule: "0 2 * * *",
    workflow: "digest",
    goalTemplate: "Summarize what I saved since the last digest and add strong pieces to my ideas inbox.",
    inputTemplate: {},
    autonomyLevel: "L1",
    dailyBudgetUsd: "0.5",
  },
  {
    key: "digest-on-save",
    name: "Digest each article I save",
    description: "Right after you save an article to your reading list, suggests its topics and adds it to your ideas inbox if it's worth writing about. Private.",
    kind: "event",
    event: "reading.saved",
    workflow: "digest",
    goalTemplate: "Read the article I just saved, suggest topics, and add it to my ideas if it's strong.",
    inputTemplate: { itemIds: ["{{itemId}}"] },
    autonomyLevel: "L1",
    dailyBudgetUsd: "0.25",
  },
  {
    key: "fact-check-on-publish",
    name: "Fact-check when I open Publish",
    description: "When you open the Publish dialog, researches the post's main factual claims and waits for you to choose findings. Runs once per version of the post.",
    kind: "event",
    event: "publish.opened",
    workflow: "research",
    goalTemplate: "Check the main factual claims in this post before it's published.",
    inputTemplate: { question: "Check the main factual claims in this post and say what reliable sources support, dispute or can't confirm." },
    autonomyLevel: "L1",
    dailyBudgetUsd: "1.0",
  },
];

export async function ensureDefaultTriggers(now = new Date()) {
  for (const t of DEFAULT_TRIGGERS) {
    await db
      .insert(writingTriggers)
      .values({ ...t, nextRunAt: t.kind === "cron" && t.schedule ? nextRunAt(t.schedule, t.timezone ?? "America/Los_Angeles", now) : null })
      .onConflictDoNothing({ target: writingTriggers.key });
  }
}

export async function listTriggers() {
  return db.select().from(writingTriggers).orderBy(writingTriggers.createdAt);
}

export async function getTrigger(id: string) {
  const [t] = await db.select().from(writingTriggers).where(eq(writingTriggers.id, id)).limit(1);
  return t ?? null;
}

/** Spend today (in the trigger's time zone) by runs this trigger started. */
export async function spentToday(trigger: WritingTrigger, now = new Date()): Promise<number> {
  const since = startOfLocalDay(trigger.timezone, now);
  const [row] = await db
    .select({ spent: sql<string>`coalesce(sum((${writingAgentRuns.usage}->>'costUsd')::numeric), 0)` })
    .from(writingAgentRuns)
    .where(and(eq(writingAgentRuns.triggerId, trigger.id), gte(writingAgentRuns.createdAt, since)));
  return Number(row?.spent ?? 0);
}

export type FireOutcome =
  | { status: "started"; runId: string }
  | { status: "duplicate" }
  | { status: "skipped"; reason: string };

/**
 * Start a run for this trigger, at most once per fire key. Returns why it
 * didn't start when it didn't (duplicate, paused, over today's cap, invalid).
 */
export async function fireTrigger(
  trigger: WritingTrigger,
  params: { fireKey: string; origin: "cron" | "event" | "manual"; vars?: Record<string, string>; documentId?: string | null; now?: Date }
): Promise<FireOutcome> {
  const now = params.now ?? new Date();
  const [fire] = await db
    .insert(writingTriggerFires)
    .values({ triggerId: trigger.id, fireKey: params.fireKey })
    .onConflictDoNothing()
    .returning({ id: writingTriggerFires.id });
  if (!fire) return { status: "duplicate" };

  const skip = async (reason: string): Promise<FireOutcome> => {
    await db.update(writingTriggerFires).set({ outcome: `skipped: ${reason}` }).where(eq(writingTriggerFires.id, fire.id));
    await db.update(writingTriggers).set({ lastFiredAt: now, lastStatus: `skipped: ${reason}`, updatedAt: now }).where(eq(writingTriggers.id, trigger.id));
    return { status: "skipped", reason };
  };

  const settings = await getAiSettings();
  if (!settings.enabled) return skip("AI is turned off");
  if (!settings.agentsEnabled) return skip("agents are paused");
  const spent = await spentToday(trigger, now);
  const cap = Number(trigger.dailyBudgetUsd);
  if (spent >= cap) return skip(`today's budget for this trigger is used ($${spent.toFixed(2)} of $${cap.toFixed(2)})`);

  const vars = { now: now.toISOString(), ...(params.vars ?? {}) };
  try {
    const run = await createRun({
      workflow: trigger.workflow,
      documentId: params.documentId ?? null,
      input: renderTemplate(trigger.inputTemplate ?? {}, vars),
      createdBy: `trigger:${trigger.key ?? trigger.id}`,
      origin: params.origin,
      triggerId: trigger.id,
      autonomyLevel: trigger.autonomyLevel,
    });
    // A run's own cap can't exceed what's left of the trigger's day
    const remaining = Math.max(0, cap - spent);
    if (remaining < run.budget.maxCostUsd) {
      await db
        .update(writingAgentRuns)
        .set({ budget: { ...run.budget, maxCostUsd: Math.round(remaining * 10000) / 10000 } })
        .where(eq(writingAgentRuns.id, run.id));
    }
    await db.update(writingTriggerFires).set({ runId: run.id }).where(eq(writingTriggerFires.id, fire.id));
    await db.update(writingTriggers).set({ lastFiredAt: now, lastRunId: run.id, lastStatus: "RUNNING", updatedAt: now }).where(eq(writingTriggers.id, trigger.id));
    await logEvent(run.id, "trigger", `Started by "${trigger.name}"`, { triggerId: trigger.id, fireKey: params.fireKey, origin: params.origin });
    return { status: "started", runId: run.id };
  } catch (error) {
    if (error instanceof RunRejected) return skip(error.message);
    await skip("couldn't start (see the server log)");
    throw error;
  }
}

/** Cron triggers whose next run time has come. */
export async function dueTriggers(now = new Date()) {
  return db
    .select()
    .from(writingTriggers)
    .where(and(eq(writingTriggers.enabled, true), eq(writingTriggers.kind, "cron"), isNotNull(writingTriggers.nextRunAt), lte(writingTriggers.nextRunAt, now)));
}

/** Fire every due cron trigger once and move its schedule on. */
export async function fireDueTriggers(now = new Date()) {
  const out: Array<{ trigger: string; outcome: FireOutcome }> = [];
  for (const t of await dueTriggers(now)) {
    // One fire per scheduled slot: a late or repeated tick reuses the same key
    const slot = t.nextRunAt!.toISOString();
    let outcome: FireOutcome;
    try {
      outcome = await fireTrigger(t, { fireKey: `cron:${slot}`, origin: "cron", vars: { slot }, now });
    } catch (error) {
      console.error(`Trigger ${t.name} failed to fire:`, error);
      outcome = { status: "skipped", reason: "error" };
    }
    // Skip missed slots: the next run is the first one after now
    await db
      .update(writingTriggers)
      .set({ nextRunAt: t.schedule ? nextRunAt(t.schedule, t.timezone, now) : null, updatedAt: now })
      .where(eq(writingTriggers.id, t.id));
    out.push({ trigger: t.name, outcome });
  }
  return out;
}

/**
 * Something happened in the app (an article saved, Publish opened). Starts
 * a run for each enabled trigger on that event, once per `key`. Never throws:
 * the action that emitted the event must not fail because of an agent.
 */
export async function emitEvent(name: AgentEventName, payload: { key: string; documentId?: string | null; vars?: Record<string, string> }) {
  try {
    const triggers = await db
      .select()
      .from(writingTriggers)
      .where(and(eq(writingTriggers.enabled, true), eq(writingTriggers.kind, "event"), eq(writingTriggers.event, name)));
    const results: FireOutcome[] = [];
    for (const t of triggers) {
      results.push(await fireTrigger(t, { fireKey: `${name}:${payload.key}`, origin: "event", documentId: payload.documentId, vars: payload.vars }));
    }
    return results;
  } catch (error) {
    // Before setup has run, or the database hiccupped: log and carry on
    console.error(`Agent event ${name} wasn't handled:`, error);
    return [];
  }
}

/** Record how each trigger's latest run ended; count consecutive failures (alerts in A4). */
export async function refreshTriggerOutcomes() {
  const triggers = await db.select().from(writingTriggers).where(isNotNull(writingTriggers.lastRunId));
  if (triggers.length === 0) return;
  const runs = await db
    .select({ id: writingAgentRuns.id, status: writingAgentRuns.status })
    .from(writingAgentRuns)
    .where(inArray(writingAgentRuns.id, triggers.map((t) => t.lastRunId!)));
  const statusOf = new Map(runs.map((r) => [r.id, r.status]));
  for (const t of triggers) {
    const status = statusOf.get(t.lastRunId!);
    if (!status || status === t.lastStatus) continue;
    const failures = status === "FAILED" ? t.consecutiveFailures + 1 : status === "COMPLETED" ? 0 : t.consecutiveFailures;
    await db.update(writingTriggers).set({ lastStatus: status, consecutiveFailures: failures, updatedAt: new Date() }).where(eq(writingTriggers.id, t.id));
  }
}

/**
 * Recovery: re-enqueue server-driven runs nobody is executing (a lost queue
 * message, a crashed function), and expire runs that waited too long for the author.
 */
export async function sweepRuns(now = new Date()) {
  const idleBefore = new Date(now.getTime() - ORPHAN_AFTER_MS);
  const staleLock = new Date(now.getTime() - LOCK_STALE_MS);
  const orphans = await db
    .select({ id: writingAgentRuns.id })
    .from(writingAgentRuns)
    .where(
      and(
        inArray(writingAgentRuns.status, ["CREATED", "RUNNING"]),
        ne(writingAgentRuns.driver, "browser"),
        lt(writingAgentRuns.updatedAt, idleBefore),
        or(isNull(writingAgentRuns.lockToken), lt(writingAgentRuns.lockedAt, staleLock))
      )
    )
    .limit(50);
  for (const r of orphans) {
    await logEvent(r.id, "resumed", "Picked up again by the scheduler after a pause.");
    await enqueueRun(r.id, "sweep").catch((e) => console.error(`Couldn't re-enqueue run ${r.id}:`, e));
  }

  const expiredBefore = new Date(now.getTime() - MAX_WAIT_DAYS * 86_400_000);
  const expired = await db
    .update(writingAgentRuns)
    .set({ status: "CANCELLED", pendingApproval: null, error: `Expired: waited more than ${MAX_WAIT_DAYS} days for a decision.`, finishedAt: now, updatedAt: now })
    .where(and(eq(writingAgentRuns.status, "WAITING_FOR_APPROVAL"), lt(writingAgentRuns.updatedAt, expiredBefore)))
    .returning({ id: writingAgentRuns.id });
  for (const r of expired) {
    await db.insert(writingAgentEvents).values({ runId: r.id, type: "expired", message: `Cancelled: no decision for ${MAX_WAIT_DAYS} days.` });
  }
  return { resumed: orphans.length, expired: expired.length };
}

/** The scheduler tick (Vercel Cron → /api/cron/agent). */
export async function agentTick(now = new Date()) {
  await ensureDefaultTriggers(now);
  await refreshTriggerOutcomes();
  const fired = await fireDueTriggers(now);
  const swept = await sweepRuns(now);
  return { at: now.toISOString(), fired, ...swept };
}

/** Recent firings of one trigger, newest first (for the Automations page). */
export async function triggerHistory(triggerId: string, limit = 10) {
  return db
    .select({ fireKey: writingTriggerFires.fireKey, runId: writingTriggerFires.runId, outcome: writingTriggerFires.outcome, createdAt: writingTriggerFires.createdAt, status: writingAgentRuns.status })
    .from(writingTriggerFires)
    .leftJoin(writingAgentRuns, eq(writingAgentRuns.id, writingTriggerFires.runId))
    .where(eq(writingTriggerFires.triggerId, triggerId))
    .orderBy(desc(writingTriggerFires.createdAt))
    .limit(limit);
}
