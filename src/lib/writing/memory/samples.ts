import { and, arrayContains, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { writingDocuments, writingSamples, type WritingSample } from "@/lib/db/schema";
import { buildTsQuery } from "./keywords";

export const sampleInputSchema = z.object({
  content: z.string().trim().min(20, "A sample should be at least a sentence or two").max(6000),
  label: z.string().trim().max(120).default(""),
  note: z.string().trim().max(500).default(""),
  sourceDocumentId: z.string().uuid().nullable().optional(),
  styleIds: z.array(z.string().uuid()).max(20).default([]),
});

export const sampleUpdateSchema = z.object({
  label: z.string().trim().max(120).optional(),
  note: z.string().trim().max(500).optional(),
  styleIds: z.array(z.string().uuid()).max(20).optional(),
  enabled: z.boolean().optional(),
});

export async function listSamples(filter: { q?: string; styleId?: string } = {}): Promise<WritingSample[]> {
  const conditions: SQL[] = [];
  if (filter.q?.trim()) {
    const pattern = `%${filter.q.trim().replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    conditions.push(or(ilike(writingSamples.content, pattern), ilike(writingSamples.label, pattern), ilike(writingSamples.sourceTitle, pattern))!);
  }
  if (filter.styleId) conditions.push(arrayContains(writingSamples.styleIds, [filter.styleId]));
  return db
    .select()
    .from(writingSamples)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(writingSamples.createdAt))
    .limit(300);
}

/** Samples are only ever added by the author's explicit action. */
export async function createSample(input: z.infer<typeof sampleInputSchema>): Promise<WritingSample> {
  let sourceTitle = "";
  if (input.sourceDocumentId) {
    const [doc] = await db.select({ title: writingDocuments.title }).from(writingDocuments).where(eq(writingDocuments.id, input.sourceDocumentId)).limit(1);
    sourceTitle = doc?.title || "Untitled";
  }
  const [sample] = await db
    .insert(writingSamples)
    .values({ ...input, sourceDocumentId: input.sourceDocumentId ?? null, sourceTitle })
    .returning();
  return sample;
}

export async function updateSample(id: string, input: z.infer<typeof sampleUpdateSchema>): Promise<WritingSample | null> {
  const [sample] = await db.update(writingSamples).set({ ...input, updatedAt: new Date() }).where(eq(writingSamples.id, id)).returning();
  return sample ?? null;
}

export async function deleteSample(id: string): Promise<boolean> {
  return (await db.delete(writingSamples).where(eq(writingSamples.id, id)).returning({ id: writingSamples.id })).length > 0;
}

/**
 * The enabled samples for a style that are most relevant to some text, by
 * full-text rank (recent ones when nothing matches). Samples linked to no
 * style count for every style.
 */
export async function relevantSamples(params: { styleId: string | null; text: string; limit?: number }) {
  const limit = params.limit ?? 2;
  const styleCondition = params.styleId
    ? sql`(${writingSamples.styleIds} = '{}' or ${params.styleId}::uuid = any(${writingSamples.styleIds}))`
    : sql`${writingSamples.styleIds} = '{}'`;
  const query = buildTsQuery(params.text);
  const columns = { id: writingSamples.id, label: writingSamples.label, sourceTitle: writingSamples.sourceTitle, content: writingSamples.content };
  const where = and(eq(writingSamples.enabled, true), styleCondition);
  const rows = query
    ? await db
        .select(columns)
        .from(writingSamples)
        .where(where)
        .orderBy(desc(sql`ts_rank(to_tsvector('english', ${writingSamples.content}), to_tsquery('english', ${query}))`), desc(writingSamples.createdAt))
        .limit(limit)
    : // Nothing to match against: the most recent samples
      await db.select(columns).from(writingSamples).where(where).orderBy(desc(writingSamples.createdAt)).limit(limit);
  return rows.map((r) => ({ id: r.id, title: r.label || (r.sourceTitle ? `From "${r.sourceTitle}"` : "Writing sample"), text: r.content }));
}
