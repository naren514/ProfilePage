import { and, desc, gte, inArray, isNull, or, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { certifications, readingCandidates, writingDocuments, writingIdeas } from "@/lib/db/schema";
import { similarDocuments } from "./taste";

// Groups of related articles the author kept recently: the raw material for
// post ideas ("you've read four pieces on platform teams this month").
// Deterministic and free; the idea miner agent then picks the strongest and
// words them.

export interface ClusterArticle {
  key: string;
  url: string;
  title: string;
  publisher: string;
  note: string;
}

export interface ReadingCluster {
  /** The words the articles share most. */
  label: string[];
  articles: ClusterArticle[];
}

const text = (a: ClusterArticle) => `${a.title} ${a.title} ${a.note}`;

/** Group articles: each unassigned article seeds a group of the ones close to it (at least two per group). */
export function clusterArticles(articles: ClusterArticle[], opts: { min?: number; maxSize?: number } = {}): ReadingCluster[] {
  const { min = 0.16, maxSize = 6 } = opts;
  const taken = new Set<string>();
  const clusters: ReadingCluster[] = [];
  for (const seed of articles) {
    if (taken.has(seed.key)) continue;
    const rest = articles.filter((a) => a.key !== seed.key && !taken.has(a.key));
    const close = similarDocuments(text(seed), rest.map((a) => ({ item: a, text: text(a) })), { limit: maxSize - 1, min });
    if (close.length === 0) continue;
    const members = [seed, ...close.map((m) => m.item)];
    members.forEach((m) => taken.add(m.key));
    const counts = new Map<string, number>();
    for (const m of close) for (const t of m.terms) counts.set(t, (counts.get(t) ?? 0) + 1);
    clusters.push({ label: Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t]) => t), articles: members });
  }
  return clusters.sort((a, b) => b.articles.length - a.articles.length);
}

/**
 * Drop groups that an existing idea, draft or post already covers: most of
 * the articles already back an idea, or the theme reads like an existing title.
 */
export function dropCovered(clusters: ReadingCluster[], existingTitles: string[], max = 0.3, usedKeys: Set<string> = new Set()): ReadingCluster[] {
  return clusters.filter((c) => {
    if (c.articles.filter((a) => usedKeys.has(a.key)).length * 2 >= c.articles.length) return false;
    if (existingTitles.length === 0) return true;
    const about = c.articles.map((a) => a.title).join(" ");
    return similarDocuments(about, existingTitles.map((t) => ({ item: t, text: t })), { limit: 1, min: max }).length === 0;
  });
}

/** The author's kept reading from the last `days` days. */
export async function recentKeptReading(days = 30): Promise<ClusterArticle[]> {
  const since = new Date(Date.now() - days * 86_400_000);
  const [items, candidates] = await Promise.all([
    db
      .select({ id: certifications.id, url: certifications.articleUrl, title: certifications.articleTitle, source: certifications.source, note: certifications.note, quote: certifications.quote, excerpt: certifications.excerpt, tags: certifications.tags })
      .from(certifications)
      .where(and(inArray(certifications.status, ["inbox", "published"]), gte(certifications.savedAt, since)))
      .orderBy(desc(certifications.savedAt))
      .limit(150),
    // Picked for a list, or added to the week by the author
    db
      .select({ id: readingCandidates.id, url: readingCandidates.url, title: readingCandidates.title, publisher: readingCandidates.publisher, excerpt: readingCandidates.excerpt, topic: readingCandidates.topic })
      .from(readingCandidates)
      .where(and(gte(readingCandidates.createdAt, since), or(eq(readingCandidates.status, "picked"), and(eq(readingCandidates.status, "active"), isNull(readingCandidates.runId)))))
      .limit(100),
  ]);
  const seen = new Set<string>();
  const out: ClusterArticle[] = [];
  for (const i of items) {
    if (!i.url || seen.has(i.url)) continue;
    seen.add(i.url);
    out.push({ key: `reading:${i.id}`, url: i.url, title: i.title, publisher: i.source, note: [i.note, i.quote, i.excerpt, i.tags.join(" ")].filter(Boolean).join(" ").slice(0, 1200) });
  }
  for (const c of candidates) {
    if (seen.has(c.url)) continue;
    seen.add(c.url);
    out.push({ key: `candidate:${c.id}`, url: c.url, title: c.title, publisher: c.publisher, note: [c.excerpt, c.topic].filter(Boolean).join(" ").slice(0, 1200) });
  }
  return out;
}

/** Titles of what the author already has in the works or published, and the articles existing ideas came from. */
export async function existingWriting(): Promise<{ titles: string[]; usedKeys: Set<string> }> {
  const [ideas, docs] = await Promise.all([
    db.select({ content: writingIdeas.content, sources: writingIdeas.sources }).from(writingIdeas).where(inArray(writingIdeas.status, ["new", "converted"])).limit(300),
    db.select({ title: writingDocuments.title }).from(writingDocuments).limit(300),
  ]);
  return {
    titles: [...ideas.map((i) => i.content.slice(0, 300)), ...docs.map((d) => d.title)].filter((t) => t.trim().length > 3),
    usedKeys: new Set(ideas.flatMap((i) => (i.sources ?? []).map((src) => src.key))),
  };
}

export async function readingClusters(limit = 6): Promise<ReadingCluster[]> {
  const [articles, existing] = await Promise.all([recentKeptReading(), existingWriting()]);
  return dropCovered(clusterArticles(articles), existing.titles, 0.3, existing.usedKeys).slice(0, limit);
}
