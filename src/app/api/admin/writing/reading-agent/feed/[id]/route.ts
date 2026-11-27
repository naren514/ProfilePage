import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { readingFeedItems } from "@/lib/db/schema";
import { apiError } from "@/lib/http/errors";
import { ReadingInputError, saveArticle } from "@/lib/reading/items";
import { addCandidate } from "@/lib/reading/shortlist";
import { getReadingAgentConfig } from "@/lib/reading/agent-config";
import { feedItemTaste, loadProfile } from "@/lib/reading/taste";
import { idSchema, json, parseBody, writingRoute } from "@/lib/writing/api";

export const dynamic = "force-dynamic";
// Saving reads the article and suggests a note
export const maxDuration = 30;

/**
 * What the author does with a feed article: put it on this week's
 * shortlist, save it to the reading inbox, publish it, or hide it (hidden
 * articles teach the ranking what not to show).
 */
export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return writingRoute(async () => {
    if (!idSchema.safeParse(params.id).success) return apiError("NOT_FOUND", "Article not found", 404);
    const body = await parseBody(request, z.object({ action: z.enum(["shortlist", "save", "publish", "hide", "unhide"]) }));
    if ("error" in body) return body.error;
    const [item] = await db.select().from(readingFeedItems).where(eq(readingFeedItems.id, params.id)).limit(1);
    if (!item) return apiError("NOT_FOUND", "Article not found", 404);
    const { action } = body.data;

    if (action === "hide" || action === "unhide") {
      await db.update(readingFeedItems).set({ status: action === "hide" ? "hidden" : "new" }).where(eq(readingFeedItems.id, item.id));
      return json({ ok: true, state: action === "hide" ? "hidden" : "new" });
    }

    if (action === "shortlist") {
      const config = await getReadingAgentConfig();
      const taste = feedItemTaste(await loadProfile(config.topics), item);
      // The author chose it: score it well, and say so
      const s = Math.max(7, Math.round(taste * 10));
      const outcome = await addCandidate({
        url: item.url,
        title: item.title,
        publisher: item.sourceName,
        publishedDate: item.publishedAt ? item.publishedAt.toISOString().slice(0, 10) : null,
        topic: item.topic,
        excerpt: item.summary,
        scores: { relevance: Math.max(s, 8), depth: s, credibility: s, recency: s },
        reason: "You added it from the feed.",
        readInFull: false,
        runId: null,
      });
      if (outcome.status === "rejected") return apiError("VALIDATION_FAILED", `Not added: ${outcome.reason}.`, 409);
      await db.update(readingFeedItems).set({ status: "offered" }).where(eq(readingFeedItems.id, item.id));
      return json({ ok: true, state: "shortlisted" });
    }

    // Save to the reading inbox, or publish straight away (your own note only; none yet)
    let saved;
    try {
      ({ item: saved } = await saveArticle({ url: item.url, title: item.title, publish: action === "publish", tags: item.topic ? [item.topic] : null, via: "admin" }));
    } catch (error) {
      if (error instanceof ReadingInputError) return apiError("VALIDATION_FAILED", error.message, 400);
      throw error;
    }
    await db.update(readingFeedItems).set({ status: action === "publish" ? "published" : "saved" }).where(eq(readingFeedItems.id, item.id));
    return json({ ok: true, state: action === "publish" ? "published" : "saved", readingItemId: saved.id });
  });
}
