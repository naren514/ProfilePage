import { and, desc, eq, inArray, isNull, ne, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { certifications, readingCandidates, readingFeedItems, type ReadingFeedItem } from "@/lib/db/schema";

// "More like what I keep" (agent PRD A3, discovery): rank new feed articles
// by how close their words are to what the author saved and picked, and how
// far from what they removed. Plain TF-IDF cosine similarity: free, fast,
// predictable and testable. The AI only reads the top few closely.

const STOP = new Set(
  "the and for are but not you all any can had her was one our out has have this that with from they will what when where which who your about into than then them there these those their been more most some such only over also just like very much many make made how why its it's our we us of to in on at by is be as an or if so do does did a i he she it no yes up new now get got via vs per".split(" ")
);

export function tokens(text: string): string[] {
  return (text.toLowerCase().normalize("NFKD").match(/[a-z][a-z0-9'-]{2,}/g) ?? [])
    .map((w) => w.replace(/'s$|'$/, "").replace(/(ies)$/, "y").replace(/([^s])s$/, "$1"))
    .filter((w) => w.length > 2 && !STOP.has(w));
}

type Vec = Map<string, number>;

function termFreq(words: string[]): Vec {
  const v: Vec = new Map();
  for (const w of words) v.set(w, (v.get(w) ?? 0) + 1);
  return v;
}

function norm(v: Vec) {
  let s = 0;
  v.forEach((x) => (s += x * x));
  return Math.sqrt(s);
}

function cosine(a: Vec, b: Vec): number {
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return 0;
  let dot = 0;
  const [small, big] = a.size < b.size ? [a, b] : [b, a];
  small.forEach((x, k) => {
    const y = big.get(k);
    if (y) dot += x * y;
  });
  return dot / (na * nb);
}

export interface TasteProfile {
  idf: Map<string, number>;
  positive: Vec;
  negative: Vec;
  topics: Map<string, Vec>;
  /** 0–1: how much to trust the author's history (grows with what they've kept). */
  historyWeight: number;
}

/** Build the profile from texts the author kept (positive) and removed (negative). */
export function buildProfile(input: { positives: string[]; negatives: string[]; candidates: string[]; topics: string[] }): TasteProfile {
  const docs = [...input.positives, ...input.negatives, ...input.candidates].map((t) => new Set(tokens(t)));
  const df = new Map<string, number>();
  for (const d of docs) d.forEach((w) => df.set(w, (df.get(w) ?? 0) + 1));
  const n = Math.max(1, docs.length);
  const idf = new Map<string, number>();
  df.forEach((c, w) => idf.set(w, Math.log(1 + n / c)));
  const weigh = (text: string): Vec => {
    const tf = termFreq(tokens(text));
    const v: Vec = new Map();
    tf.forEach((c, w) => v.set(w, (1 + Math.log(c)) * (idf.get(w) ?? Math.log(1 + n))));
    return v;
  };
  const centroid = (texts: string[]): Vec => {
    const v: Vec = new Map();
    for (const t of texts) {
      const d = weigh(t);
      const len = norm(d) || 1;
      d.forEach((x, k) => v.set(k, (v.get(k) ?? 0) + x / len));
    }
    return v;
  };
  return {
    idf,
    positive: centroid(input.positives),
    negative: centroid(input.negatives),
    topics: new Map(input.topics.map((t) => [t.toLowerCase(), weigh(t)])),
    historyWeight: Math.min(1, input.positives.length / 3),
  };
}

export function weighText(profile: TasteProfile, text: string): Vec {
  const tf = termFreq(tokens(text));
  const v: Vec = new Map();
  const fallback = Math.log(1 + 2);
  tf.forEach((c, w) => v.set(w, (1 + Math.log(c)) * (profile.idf.get(w) ?? fallback)));
  return v;
}

/**
 * 0–1: how well an article fits. Close to what the author keeps, away from
 * what they removed, plus a little for naming its topic.
 */
export function tasteScore(profile: TasteProfile, text: string, topic = ""): number {
  const v = weighText(profile, text);
  const like = cosine(v, profile.positive);
  const dislike = cosine(v, profile.negative);
  const onTopic = topic ? cosine(v, profile.topics.get(topic.toLowerCase()) ?? new Map()) : 0;
  const raw = like * 2 * profile.historyWeight - dislike * 1.2 + onTopic * 0.5;
  return Math.max(0, Math.min(1, 0.35 + raw));
}

const itemText = (i: { title: string; summary: string; topic?: string }) => `${i.title} ${i.title} ${i.summary} ${i.topic ?? ""}`;

/** The author's history: what they saved or published, picked for a list, or removed from the shortlist. */
export async function loadProfile(topics: string[]): Promise<TasteProfile> {
  const [saved, picked, removed] = await Promise.all([
    db
      .select({ title: certifications.articleTitle, note: certifications.note, tags: certifications.tags, excerpt: certifications.excerpt })
      .from(certifications)
      .where(and(inArray(certifications.status, ["inbox", "published"]), or(isNull(certifications.savedVia), ne(certifications.savedVia, "agent"))))
      .orderBy(desc(certifications.savedAt))
      .limit(200),
    db.select({ title: readingCandidates.title, excerpt: readingCandidates.excerpt, topic: readingCandidates.topic }).from(readingCandidates).where(eq(readingCandidates.status, "picked")).limit(200),
    db.select({ title: readingCandidates.title, excerpt: readingCandidates.excerpt, topic: readingCandidates.topic }).from(readingCandidates).where(eq(readingCandidates.status, "dropped")).limit(200),
  ]);
  const candidates = await db.select({ title: readingFeedItems.title, summary: readingFeedItems.summary }).from(readingFeedItems).where(eq(readingFeedItems.status, "new")).limit(500);
  return buildProfile({
    positives: [...saved.map((s) => `${s.title} ${s.title} ${s.note ?? ""} ${s.excerpt ?? ""} ${s.tags.join(" ")}`), ...picked.map((p) => `${p.title} ${p.excerpt} ${p.topic}`)],
    negatives: removed.map((r) => `${r.title} ${r.excerpt}`),
    candidates: candidates.map((c) => `${c.title} ${c.summary}`),
    topics,
  });
}

/** New feed articles, best first, optionally for one topic. */
export async function rankedFeedItems(profile: TasteProfile, opts: { topic?: string; limit: number }): Promise<Array<ReadingFeedItem & { taste: number }>> {
  const rows = await db.select().from(readingFeedItems).where(eq(readingFeedItems.status, "new")).limit(500);
  const wanted = opts.topic?.toLowerCase();
  return rows
    .filter((r) => !wanted || r.topic.toLowerCase() === wanted)
    .map((r) => {
      const ageDays = r.publishedAt ? (Date.now() - r.publishedAt.getTime()) / 86_400_000 : 3;
      const fresh = Math.max(0, 1 - ageDays / 14) * 0.1;
      return { ...r, taste: Math.min(1, tasteScore(profile, itemText(r), r.topic) + fresh) };
    })
    .sort((a, b) => b.taste - a.taste)
    .slice(0, opts.limit);
}
