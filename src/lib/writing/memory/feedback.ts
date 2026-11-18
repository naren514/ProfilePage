import { and, desc, eq, inArray, isNotNull, ne, sql, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { writingAiUsage, writingDocuments, writingSuggestions } from "@/lib/db/schema";
import { htmlToPlainText } from "@/lib/content/sanitize";

// Feedback is what the author did with AI suggestions. It's evidence for
// proposing style changes, never a rule by itself.

export const LEARNING_STATUSES = ["accepted", "modified", "rejected"] as const;

export async function listFeedback(filter: { status?: string; styleId?: string; limit?: number } = {}) {
  const conditions: SQL[] = [ne(writingSuggestions.status, "pending")];
  if (filter.status) conditions.push(eq(writingSuggestions.status, filter.status as never));
  if (filter.styleId) conditions.push(eq(writingSuggestions.styleId, filter.styleId));
  const rows = await db
    .select({ s: writingSuggestions, documentTitle: writingDocuments.title })
    .from(writingSuggestions)
    .leftJoin(writingDocuments, eq(writingDocuments.id, writingSuggestions.documentId))
    .where(and(...conditions))
    .orderBy(desc(writingSuggestions.resolvedAt), desc(writingSuggestions.createdAt))
    .limit(filter.limit ?? 200);
  return rows.map(({ s, documentTitle }) => ({
    id: s.id,
    documentId: s.documentId,
    documentTitle: documentTitle ?? "",
    operation: s.operation,
    instruction: s.instruction,
    styleId: s.styleId,
    styleVersion: s.styleVersion,
    status: s.status,
    reason: s.reason,
    original: htmlToPlainText(s.originalHtml),
    proposal: htmlToPlainText(s.proposalHtml),
    final: s.finalHtml ? htmlToPlainText(s.finalHtml) : null,
    model: s.model,
    createdAt: s.createdAt,
    resolvedAt: s.resolvedAt,
  }));
}

export type FeedbackItem = Awaited<ReturnType<typeof listFeedback>>[number];

/** Delete one feedback record (the AI usage row stays for cost history, unlinked). */
export async function deleteFeedback(id: string): Promise<boolean> {
  await db.update(writingAiUsage).set({ suggestionId: null }).where(eq(writingAiUsage.suggestionId, id));
  return (await db.delete(writingSuggestions).where(eq(writingSuggestions.id, id)).returning({ id: writingSuggestions.id })).length > 0;
}

/** Delete all feedback. Pending suggestions (still on screen) are kept. */
export async function clearFeedback(): Promise<number> {
  await db.update(writingAiUsage).set({ suggestionId: null }).where(isNotNull(writingAiUsage.suggestionId));
  const rows = await db.delete(writingSuggestions).where(ne(writingSuggestions.status, "pending")).returning({ id: writingSuggestions.id });
  return rows.length;
}

/** Feedback usable as learning evidence, per style. */
export async function feedbackCounts(): Promise<Record<string, number>> {
  const rows = await db
    .select({ styleId: writingSuggestions.styleId, n: sql<string>`count(*)` })
    .from(writingSuggestions)
    .where(inArray(writingSuggestions.status, [...LEARNING_STATUSES]))
    .groupBy(writingSuggestions.styleId);
  const out: Record<string, number> = {};
  for (const r of rows) out[r.styleId ?? "none"] = Number(r.n);
  return out;
}

/** Recent accepted, edited and rejected suggestions for a style, for the learning workflow. */
export async function learningEvidence(styleId: string, limit = 40) {
  return (await listFeedback({ styleId, limit: 200 }))
    .filter((f) => (LEARNING_STATUSES as readonly string[]).includes(f.status))
    .slice(0, limit);
}
