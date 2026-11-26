import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { certifications, readingCandidates, readingWeeklyLists, type ReadingWeeklyList, type WeeklyPick } from "@/lib/db/schema";
import { syncEntityToRAG } from "@/lib/rag/sync";
import { cleanTags } from "@/lib/topics";
import { cleanUrl, normalizeUrl, parseArticleUrl } from "./url";

// Publishing an approved weekly reading list (agent PRD A3, site.publish_reading_list).
// Only the runner calls this, after the author approves; the model never can.
// Safe to repeat: one list per week, and each article is added to the reading
// list once (by its normalized URL).

export interface PublishInput {
  week: string;
  title: string;
  intro: string;
  picks: WeeklyPick[];
  runId: string;
}

export async function publishWeeklyList(input: PublishInput): Promise<{ list: ReadingWeeklyList; created: boolean }> {
  const [created] = await db
    .insert(readingWeeklyLists)
    .values({ week: input.week, title: input.title, intro: input.intro, picks: input.picks, runId: input.runId })
    .onConflictDoNothing({ target: readingWeeklyLists.week })
    .returning();
  if (!created) {
    const [existing] = await db.select().from(readingWeeklyLists).where(eq(readingWeeklyLists.week, input.week)).limit(1);
    return { list: existing, created: false };
  }

  const today = new Date().toISOString().slice(0, 10);
  for (const pick of input.picks) {
    const tags = cleanTags(pick.topic ? [pick.topic] : []);
    if (pick.readingItemId) {
      // An article the author saved: publish it, keeping their own note if they wrote one
      const [item] = await db.select().from(certifications).where(eq(certifications.id, pick.readingItemId)).limit(1);
      if (!item) continue;
      const [updated] = await db
        .update(certifications)
        .set({ status: "published", isPublished: true, note: item.note || pick.line, tags: item.tags.length ? item.tags : tags })
        .where(eq(certifications.id, item.id))
        .returning();
      await syncEntityToRAG("certification", updated).catch(() => {});
      continue;
    }
    const parsed = parseArticleUrl(pick.url);
    if (!parsed) continue;
    const [row] = await db
      .insert(certifications)
      .values({
        articleTitle: pick.title,
        source: pick.publisher || parsed.hostname.replace(/^www\./, ""),
        articleUrl: cleanUrl(parsed),
        urlNormalized: normalizeUrl(parsed),
        note: pick.line,
        publishedDate: today,
        status: "published",
        isPublished: true,
        savedVia: "agent",
        savedAt: new Date(),
        tags,
      })
      .onConflictDoNothing()
      .returning();
    if (row) await syncEntityToRAG("certification", row).catch(() => {});
  }
  const candidateIds = input.picks.map((p) => p.candidateId).filter((id): id is string => Boolean(id));
  if (candidateIds.length) await db.update(readingCandidates).set({ status: "picked", updatedAt: new Date() }).where(inArray(readingCandidates.id, candidateIds));
  return { list: created, created: true };
}
