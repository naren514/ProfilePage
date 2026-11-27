import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { certifications, readingCandidates } from "@/lib/db/schema";
import { similarDocuments, type SimilarMatch } from "./taste";

// The author's own reading that relates to a text (a draft, a question):
// articles they saved or published, and ones picked for a weekly list.
// Plain TF-IDF, so it's free and instant.

export interface ReadingRef {
  /** "reading:<id>" or "candidate:<id>" */
  key: string;
  url: string;
  title: string;
  publisher: string;
  note: string;
  status: string;
}

export async function readingLibrary(limit = 400): Promise<ReadingRef[]> {
  const [items, picked] = await Promise.all([
    db
      .select({ id: certifications.id, url: certifications.articleUrl, title: certifications.articleTitle, source: certifications.source, note: certifications.note, excerpt: certifications.excerpt, quote: certifications.quote, tags: certifications.tags, status: certifications.status })
      .from(certifications)
      .where(inArray(certifications.status, ["inbox", "published"]))
      .orderBy(desc(certifications.savedAt))
      .limit(limit),
    db
      .select({ id: readingCandidates.id, url: readingCandidates.url, title: readingCandidates.title, publisher: readingCandidates.publisher, excerpt: readingCandidates.excerpt, reason: readingCandidates.reason, topic: readingCandidates.topic, status: readingCandidates.status })
      .from(readingCandidates)
      .where(inArray(readingCandidates.status, ["active", "picked"]))
      .limit(200),
  ]);
  const seen = new Set<string>();
  const out: ReadingRef[] = [];
  for (const i of items) {
    if (!i.url || seen.has(i.url)) continue;
    seen.add(i.url);
    out.push({ key: `reading:${i.id}`, url: i.url, title: i.title, publisher: i.source, note: [i.note, i.quote, i.excerpt, i.tags.join(" ")].filter(Boolean).join(" "), status: i.status });
  }
  for (const c of picked) {
    if (seen.has(c.url)) continue;
    seen.add(c.url);
    out.push({ key: `candidate:${c.id}`, url: c.url, title: c.title, publisher: c.publisher, note: [c.excerpt, c.reason, c.topic].filter(Boolean).join(" "), status: c.status === "picked" ? "picked" : "shortlisted" });
  }
  return out;
}

const textOf = (r: ReadingRef) => `${r.title} ${r.title} ${r.note}`;

export async function relatedReading(text: string, limit = 5): Promise<Array<SimilarMatch<ReadingRef>>> {
  if (text.trim().split(/\s+/).length < 3) return [];
  const library = await readingLibrary();
  return similarDocuments(text, library.map((r) => ({ item: r, text: textOf(r) })), { limit, min: 0.1 });
}

export async function readingItemById(id: string) {
  const [row] = await db.select().from(certifications).where(and(eq(certifications.id, id))).limit(1);
  return row ?? null;
}
