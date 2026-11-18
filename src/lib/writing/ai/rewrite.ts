import { and, eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { atomic, db } from "@/lib/db";
import { writingAiUsage, writingDocuments, writingSuggestions } from "@/lib/db/schema";
import { sanitizePostHtml, htmlToPlainText } from "@/lib/content/sanitize";
import { estimateTokens, getProvider, LLMError, type ChatMessage, type Usage } from "@/lib/llm";
import { estimateMessages } from "@/lib/llm/openai-compatible";
import { OPERATIONS, OPERATION_IDS, type OperationId } from "./operations";
import { buildRewriteMessages, cleanProposal, LIMITS, PROMPT_VERSION } from "./prompts";
import { checkBudget, costUsd, getAiSettings, monthToDate } from "./settings";
import { resolveStyle, styleExamples } from "./styles";

export const rewriteRequestSchema = z.object({
  documentId: z.string().uuid(),
  baseRevision: z.number().int().min(1),
  operation: z.enum(OPERATION_IDS as [OperationId, ...OperationId[]]),
  instruction: z.string().trim().max(LIMITS.instructionChars).optional(),
  /** Overrides the post's style for this one request. */
  styleId: z.string().uuid().optional(),
  passageKind: z.enum(["inline", "blocks"]),
  passageHtml: z.string().min(1).max(LIMITS.passageChars * 3),
  contextBefore: z.string().max(20_000).default(""),
  contextAfter: z.string().max(20_000).default(""),
});

export type RewriteRequest = z.infer<typeof rewriteRequestSchema>;

/** Problems detected before any model call, returned as a normal JSON error. */
export class RewriteRejected extends Error {
  constructor(public code: "VALIDATION_FAILED" | "NOT_FOUND" | "AI_DISABLED" | "AI_BUDGET_EXCEEDED", message: string, public status: number) {
    super(message);
  }
}

export interface ContextSummary {
  model: string;
  tier: string;
  operation: string;
  promptVersion: string;
  style: { id: string; name: string; version: number } | null;
  examples: string[];
  passageWords: number;
  contextBeforeWords: number;
  contextAfterWords: number;
  maxOutputTokens: number;
  /** The exact messages sent to the model (FR-AI-001: inspectable context). */
  messages: ChatMessage[];
}

const words = (text: string) => (text.trim() ? text.trim().split(/\s+/).length : 0);

/** Validate, check budget and build the prompt. Throws RewriteRejected. */
export async function prepareRewrite(input: RewriteRequest) {
  const passageText = htmlToPlainText(input.passageHtml);
  if (!passageText.trim()) throw new RewriteRejected("VALIDATION_FAILED", "Select some text first.", 400);
  if (passageText.length > LIMITS.passageChars) {
    throw new RewriteRejected("VALIDATION_FAILED", "That selection is too long. Select up to about 2,000 words at a time.", 400);
  }
  if (input.operation === "custom" && !input.instruction) {
    throw new RewriteRejected("VALIDATION_FAILED", "Say what you'd like changed.", 400);
  }

  const [doc] = await db
    .select({ id: writingDocuments.id, title: writingDocuments.title, styleId: writingDocuments.styleId })
    .from(writingDocuments)
    .where(eq(writingDocuments.id, input.documentId))
    .limit(1);
  if (!doc) throw new RewriteRejected("NOT_FOUND", "This document doesn't exist.", 404);

  const settings = await getAiSettings();
  if (!settings.enabled) throw new RewriteRejected("AI_DISABLED", "AI is turned off in AI settings.", 403);

  const style = await resolveStyle(input.styleId ?? doc.styleId);
  const examples = style ? await styleExamples(style, `${passageText}\n${input.contextBefore.slice(-600)}`) : [];
  const op = OPERATIONS[input.operation];
  const model = settings.models[op.tier];

  const messages = buildRewriteMessages({
    operation: input.operation,
    instruction: input.instruction,
    style: style ? { name: style.name, description: style.description, rules: style.rules } : null,
    examples,
    documentTitle: doc.title,
    contextBefore: input.contextBefore,
    passageKind: input.passageKind,
    passageHtml: sanitizePostHtml(input.passageHtml),
    contextAfter: input.contextAfter,
  });

  const inputTokens = estimateMessages(messages);
  const maxOutputTokens = Math.min(6000, Math.max(400, Math.ceil(estimateTokens(input.passageHtml) * op.outputFactor) + 200));
  const { spentUsd } = await monthToDate();
  const budget = checkBudget(settings, spentUsd, costUsd(settings, model, inputTokens, maxOutputTokens));
  if (!budget.ok) throw new RewriteRejected("AI_BUDGET_EXCEEDED", budget.message, 402);

  const summary: ContextSummary = {
    model,
    tier: op.tier,
    operation: op.label,
    promptVersion: PROMPT_VERSION,
    style: style ? { id: style.id, name: style.name, version: style.version } : null,
    examples: examples.map((e) => e.title),
    passageWords: words(passageText),
    contextBeforeWords: words(input.contextBefore.slice(-LIMITS.contextChars)),
    contextAfterWords: words(input.contextAfter.slice(0, LIMITS.contextChars)),
    maxOutputTokens,
    messages,
  };
  return { settings, model, messages, maxOutputTokens, summary, style };
}

async function recordUsage(params: {
  settings: Awaited<ReturnType<typeof getAiSettings>>;
  model: string;
  operation: string;
  usage: Usage;
  suggestion?: typeof writingSuggestions.$inferInsert;
}) {
  const cost = costUsd(params.settings, params.model, params.usage.inputTokens, params.usage.outputTokens);
  const usageRow = db.insert(writingAiUsage).values({
    operation: params.operation,
    provider: "openai",
    model: params.model,
    inputTokens: params.usage.inputTokens,
    outputTokens: params.usage.outputTokens,
    costUsd: cost.toFixed(6),
    estimated: !params.usage.reported,
    suggestionId: params.suggestion?.id,
  });
  if (params.suggestion) await atomic([db.insert(writingSuggestions).values(params.suggestion), usageRow]);
  else await usageRow;
  return cost;
}

function sse(event: string, data: unknown): Uint8Array {
  return new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

/**
 * Stream a rewrite proposal as server-sent events:
 *   meta  { suggestionId, context }   what is being sent, before the model replies
 *   delta { text }                    proposal text as it arrives
 *   done  { suggestionId, proposalHtml, usage, costUsd }
 *   error { code, message }
 * Nothing is applied to the document; the editor shows the proposal for review.
 */
export function streamRewrite(
  input: RewriteRequest,
  prepared: Awaited<ReturnType<typeof prepareRewrite>>,
  requestSignal: AbortSignal
): ReadableStream<Uint8Array> {
  const suggestionId = uuidv4();
  const abort = new AbortController();
  requestSignal.addEventListener("abort", () => abort.abort());
  let partial = "";
  let finished = false;

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(sse(event, data));
        } catch {
          // client went away
        }
      };
      send("meta", { suggestionId, context: prepared.summary });
      try {
        const provider = getProvider();
        let result = null;
        for await (const event of provider.stream({
          model: prepared.model,
          messages: prepared.messages,
          maxOutputTokens: prepared.maxOutputTokens,
          signal: abort.signal,
          timeoutMs: 90_000,
        })) {
          if (event.type === "delta") {
            partial += event.text;
            send("delta", { text: event.text });
          } else {
            result = event.result;
          }
        }
        if (!result) throw new LLMError("provider_error", "The AI returned no response.");
        const proposalHtml = sanitizePostHtml(cleanProposal(result.text, input.passageKind));
        if (!htmlToPlainText(proposalHtml).trim()) throw new LLMError("provider_error", "The AI returned an empty suggestion. Try again.");
        const cost = await recordUsage({
          settings: prepared.settings,
          model: prepared.model,
          operation: input.operation,
          usage: result.usage,
          suggestion: {
            id: suggestionId,
            documentId: input.documentId,
            baseRevision: input.baseRevision,
            operation: input.operation,
            instruction: input.instruction ?? null,
            styleId: prepared.style?.id ?? null,
            styleVersion: prepared.style?.version ?? null,
            originalHtml: sanitizePostHtml(input.passageHtml),
            proposalHtml,
            provider: "openai",
            model: result.model || prepared.model,
            promptVersion: PROMPT_VERSION,
            inputTokens: result.usage.inputTokens,
            outputTokens: result.usage.outputTokens,
          },
        });
        finished = true;
        send("done", {
          suggestionId,
          proposalHtml,
          truncated: result.finishReason === "length",
          usage: result.usage,
          costUsd: cost,
        });
      } catch (error) {
        // A cancelled or failed stream still cost something: record an estimate
        if (!finished) {
          await recordUsage({
            settings: prepared.settings,
            model: prepared.model,
            operation: input.operation,
            usage: { inputTokens: estimateMessages(prepared.messages), outputTokens: estimateTokens(partial), reported: false },
          }).catch((err) => console.error("Couldn't record AI usage:", err));
        }
        const llm = error instanceof LLMError ? error : null;
        if (llm?.kind !== "cancelled") console.error("Rewrite failed:", error);
        send("error", {
          code: llm?.kind ?? "provider_error",
          message: llm?.message ?? "The AI request failed. Your text is unchanged.",
        });
      } finally {
        try {
          controller.close();
        } catch {
          // already closed
        }
      }
    },
    cancel() {
      abort.abort();
    },
  });
}

export const resolveSuggestionSchema = z.object({
  status: z.enum(["accepted", "modified", "rejected", "stale", "cancelled"]),
  finalHtml: z.string().max(200_000).optional(),
  /** Why it was rejected or edited, in the author's words (optional). */
  reason: z.string().trim().max(300).optional(),
});

/** Record what the author did with a suggestion. Only pending suggestions change. */
export async function resolveSuggestion(id: string, documentId: string | null, input: z.infer<typeof resolveSuggestionSchema>) {
  const conditions = [eq(writingSuggestions.id, id), eq(writingSuggestions.status, "pending")];
  if (documentId) conditions.push(eq(writingSuggestions.documentId, documentId));
  const [row] = await db
    .update(writingSuggestions)
    .set({
      status: input.status,
      finalHtml: input.status === "accepted" || input.status === "modified" ? sanitizePostHtml(input.finalHtml ?? "") || null : null,
      reason: input.reason || null,
      resolvedAt: new Date(),
    })
    .where(and(...conditions))
    .returning({ id: writingSuggestions.id });
  return Boolean(row);
}
