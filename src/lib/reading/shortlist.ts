import { and, asc, desc, eq, gte, inArray, isNull, lt, ne, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { certifications, readingCandidates, readingWeeklyLists, type ReadingCandidate } from "@/lib/db/schema";
import { normalizeUrl, parseArticleUrl } from "./url";

// The weekly reading list's shortlist (agent PRD A3). The nightly agent adds
// candidates with a score and a reason; at most SHORTLIST_MAX stay active (the
// lowest score makes room). A URL is only ever suggested once, and never if it
// is already on the reading list.

export const SHORTLIST_MAX = 15;
/** Candidates older than this drop off the shortlist. */
export const CANDIDATE_TTL_DAYS = 14;
export const RUBRIC_PARTS = ["relevance", "depth", "credibility", "recency"] as const;
export type RubricPart = (typeof RUBRIC_PARTS)[number];

/** ISO-8601 week of a date, e.g. "2026-W48". */
export function isoWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day); // Thursday decides the year
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** Monday and Sunday of an ISO week ("2026-W48"), as UTC dates. */
export function weekRange(week: string): { start: Date; end: Date } | null {
  const m = week.match(/^(\d{4})-W(\d{2})$/);
  if (!m) return null;
  const jan4 = new Date(Date.UTC(Number(m[1]), 0, 4));
  const start = new Date(jan4.getTime() - ((jan4.getUTCDay() || 7) - 1) * 86_400_000 + (Number(m[2]) - 1) * 7 * 86_400_000);
  return { start, end: new Date(start.getTime() + 6 * 86_400_000) };
}

/** "Nov 23 – 29, 2026" for an ISO week. */
export function weekLabel(week: string): string {
  const r = weekRange(week);
  if (!r) return week;
  const fmt = (d: Date, o: Intl.DateTimeFormatOptions) => d.toLocaleDateString("en-US", { timeZone: "UTC", ...o });
  const sameMonth = r.start.getUTCMonth() === r.end.getUTCMonth();
  return `${fmt(r.start, { month: "short", day: "numeric" })} – ${sameMonth ? fmt(r.end, { day: "numeric" }) : fmt(r.end, { month: "short", day: "numeric" })}, ${r.end.getUTCFullYear()}`;
}

/** The week a list made on `now` covers: the week that has just ended (lists are made early Monday). */
export function listWeekFor(now: Date): string {
  return isoWeek(new Date(now.getTime() - 3 * 86_400_000));
}

/** Overall score from the rubric parts (each 0–10), rounded to 0.1. */
export function overallScore(scores: Partial<Record<RubricPart, number>>): number {
  const parts = RUBRIC_PARTS.map((p) => Math.min(10, Math.max(0, Number(scores[p] ?? 0))));
  // Relevance counts double: a deep piece off-topic isn't a pick
  const total = parts[0] * 2 + parts[1] + parts[2] + parts[3];
  return Math.round((total / 5) * 10) / 10;
}

export type AddOutcome =
  | { status: "added"; candidate: ReadingCandidate; dropped: ReadingCandidate | null }
  | { status: "updated"; candidate: ReadingCandidate }
  | { status: "rejected"; reason: string };

export interface CandidateInput {
  url: string;
  title: string;
  publisher: string;
  publishedDate?: string | null;
  topic: string;
  excerpt: string;
  scores: Partial<Record<RubricPart, number>>;
  reason: string;
  readInFull: boolean;
  runId?: string | null;
}

export async function activeCandidates(now = new Date()): Promise<ReadingCandidate[]> {
  const since = new Date(now.getTime() - CANDIDATE_TTL_DAYS * 86_400_000);
  return db
    .select()
    .from(readingCandidates)
    .where(and(eq(readingCandidates.status, "active"), gte(readingCandidates.createdAt, since)))
    .orderBy(desc(readingCandidates.score), asc(readingCandidates.createdAt));
}

/**
 * Add a candidate (or rescore one already on the shortlist). Keeps at most
 * SHORTLIST_MAX active: a new candidate that beats the lowest replaces it, one
 * that doesn't is rejected.
 */
export async function addCandidate(input: CandidateInput, now = new Date()): Promise<AddOutcome> {
  const parsed = parseArticleUrl(input.url);
  if (!parsed) return { status: "rejected", reason: "not a web address" };
  const key = normalizeUrl(parsed);
  const score = overallScore(input.scores);

  const [onList] = await db.select({ id: certifications.id }).from(certifications).where(eq(certifications.urlNormalized, key)).limit(1);
  if (onList) return { status: "rejected", reason: "already on your reading list" };

  const [existing] = await db.select().from(readingCandidates).where(eq(readingCandidates.urlNormalized, key)).limit(1);
  if (existing) {
    if (existing.status !== "active") return { status: "rejected", reason: existing.status === "picked" ? "already picked for a weekly list" : "you removed it from the shortlist before" };
    const [updated] = await db
      .update(readingCandidates)
      .set({ score: score.toFixed(2), scores: input.scores as Record<string, number>, reason: input.reason, readInFull: existing.readInFull || input.readInFull, topic: input.topic || existing.topic, updatedAt: now })
      .where(eq(readingCandidates.id, existing.id))
      .returning();
    return { status: "updated", candidate: updated };
  }

  const active = await activeCandidates(now);
  let dropped: ReadingCandidate | null = null;
  if (active.length >= SHORTLIST_MAX) {
    const lowest = active[active.length - 1];
    if (Number(lowest.score) >= score) return { status: "rejected", reason: `the shortlist is full (${SHORTLIST_MAX}) and its lowest score is ${Number(lowest.score).toFixed(1)}` };
    [dropped] = await db.update(readingCandidates).set({ status: "dropped", reason: `${lowest.reason} (replaced by a higher-scoring find)`, updatedAt: now }).where(eq(readingCandidates.id, lowest.id)).returning();
  }
  const [candidate] = await db
    .insert(readingCandidates)
    .values({
      url: parsed.toString(),
      urlNormalized: key,
      title: input.title.slice(0, 300),
      publisher: input.publisher.slice(0, 120),
      publishedDate: input.publishedDate ?? null,
      topic: input.topic.slice(0, 60),
      excerpt: input.excerpt.slice(0, 1500),
      score: score.toFixed(2),
      scores: input.scores as Record<string, number>,
      reason: input.reason.slice(0, 500),
      readInFull: input.readInFull,
      runId: input.runId ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing({ target: readingCandidates.urlNormalized })
    .returning();
  if (!candidate) return { status: "rejected", reason: "already suggested" };
  return { status: "added", candidate, dropped };
}

export async function setCandidateStatus(id: string, status: "active" | "dropped" | "picked") {
  const [row] = await db.update(readingCandidates).set({ status, updatedAt: new Date() }).where(eq(readingCandidates.id, id)).returning();
  return row ?? null;
}

/** Articles the author saved themselves in the last week (they can go on the list too). */
export async function savedThisWeek(now = new Date()) {
  const since = new Date(now.getTime() - 7 * 86_400_000);
  return db
    .select({ id: certifications.id, title: certifications.articleTitle, url: certifications.articleUrl, publisher: certifications.source, note: certifications.note, tags: certifications.tags, status: certifications.status })
    .from(certifications)
    // The author's own saves only: not articles an earlier weekly list added
    .where(and(gte(certifications.savedAt, since), inArray(certifications.status, ["inbox", "published"]), or(isNull(certifications.savedVia), ne(certifications.savedVia, "agent"))))
    .orderBy(desc(certifications.savedAt))
    .limit(20);
}

export async function weeklyLists(limit = 20) {
  return db.select().from(readingWeeklyLists).orderBy(desc(readingWeeklyLists.week)).limit(limit);
}

export async function weeklyList(week: string) {
  const [row] = await db.select().from(readingWeeklyLists).where(eq(readingWeeklyLists.week, week)).limit(1);
  return row ?? null;
}

/** Old candidates expire; keeps the table from growing forever. */
export async function expireCandidates(now = new Date()) {
  const before = new Date(now.getTime() - CANDIDATE_TTL_DAYS * 86_400_000);
  await db.update(readingCandidates).set({ status: "dropped", updatedAt: now }).where(and(eq(readingCandidates.status, "active"), lt(readingCandidates.createdAt, before)));
}
