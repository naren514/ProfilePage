import { createHash } from "crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { writingDocuments, writingSources } from "@/lib/db/schema";
import { apiError } from "@/lib/http/errors";
import { readingLibrary, relatedReading } from "@/lib/reading/related";
import { idSchema, json, parseBody, writingRoute } from "@/lib/writing/api";

export const dynamic = "force-dynamic";

async function doc(id: string) {
  const [row] = await db.select({ id: writingDocuments.id, title: writingDocuments.title, excerpt: writingDocuments.excerpt, bodyText: writingDocuments.bodyText }).from(writingDocuments).where(eq(writingDocuments.id, id)).limit(1);
  return row ?? null;
}

/** Articles from the author's reading that relate to this post, and which are already sources. */
export async function GET(_request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return writingRoute(async () => {
    if (!idSchema.safeParse(params.id).success) return apiError("NOT_FOUND", "Post not found", 404);
    const d = await doc(params.id);
    if (!d) return apiError("NOT_FOUND", "Post not found", 404);
    const matches = await relatedReading(`${d.title} ${d.title} ${d.excerpt} ${d.bodyText.slice(0, 20000)}`, 5);
    const added = matches.length ? await db.select({ url: writingSources.url }).from(writingSources).where(eq(writingSources.documentId, d.id)) : [];
    const have = new Set(added.map((a) => a.url));
    return json({
      items: matches.map((m) => ({ ...m.item, score: Math.round(m.score * 100) / 100, terms: m.terms, added: have.has(m.item.url) })),
    });
  });
}

/** Add one of them to the post's source library (once). */
export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return writingRoute(async () => {
    if (!idSchema.safeParse(params.id).success) return apiError("NOT_FOUND", "Post not found", 404);
    const body = await parseBody(request, z.object({ key: z.string().regex(/^(reading|candidate):[0-9a-f-]{36}$/) }));
    if ("error" in body) return body.error;
    const d = await doc(params.id);
    if (!d) return apiError("NOT_FOUND", "Post not found", 404);
    const ref = (await readingLibrary()).find((r) => r.key === body.data.key);
    if (!ref) return apiError("NOT_FOUND", "That article isn't in your reading any more", 404);
    const [exists] = await db.select({ id: writingSources.id }).from(writingSources).where(and(eq(writingSources.documentId, d.id), eq(writingSources.url, ref.url))).limit(1);
    if (!exists) {
      await db.insert(writingSources).values({
        documentId: d.id,
        url: ref.url,
        title: ref.title,
        publisher: ref.publisher,
        excerpt: ref.note.slice(0, 2000),
        contentHash: createHash("sha256").update(ref.url + ref.note).digest("hex"),
        query: "From your reading",
        provider: "reading",
      });
    }
    return json({ ok: true, added: !exists });
  });
}
