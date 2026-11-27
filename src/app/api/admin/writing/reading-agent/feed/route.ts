import { and, desc, gte, inArray, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { readingCandidates, readingFeedItems } from "@/lib/db/schema";
import { getReadingAgentConfig } from "@/lib/reading/agent-config";
import { feedItemTaste, loadProfile } from "@/lib/reading/taste";
import { json, writingRoute } from "@/lib/writing/api";

export const dynamic = "force-dynamic";

/** How strong a taste match has to be to be highlighted as recommended. */
const RECOMMENDED_AT = 0.6;

/**
 * The Feed: new articles from the author's sources (last 14 days, not
 * hidden), best match first, with the agent's shortlist picks marked.
 */
export async function GET() {
  return writingRoute(async () => {
    const since = new Date(Date.now() - 14 * 86_400_000);
    const rows = await db
      .select()
      .from(readingFeedItems)
      .where(and(gte(readingFeedItems.createdAt, since), ne(readingFeedItems.status, "hidden")))
      .orderBy(desc(readingFeedItems.publishedAt))
      .limit(300);
    const config = await getReadingAgentConfig();
    const profile = await loadProfile(config.topics);
    const keys = rows.map((r) => r.urlNormalized);
    const candidates = keys.length
      ? await db
          .select({ key: readingCandidates.urlNormalized, status: readingCandidates.status, score: readingCandidates.score, reason: readingCandidates.reason, runId: readingCandidates.runId })
          .from(readingCandidates)
          .where(inArray(readingCandidates.urlNormalized, keys))
      : [];
    const byKey = new Map(candidates.map((c) => [c.key, c]));
    const items = rows
      .map((r) => {
        const taste = feedItemTaste(profile, r);
        const c = byKey.get(r.urlNormalized);
        const agentPick = Boolean(c && c.runId && c.status !== "dropped");
        return {
          id: r.id,
          url: r.url,
          title: r.title,
          summary: r.summary,
          source: r.sourceName,
          topic: r.topic,
          publishedAt: r.publishedAt,
          taste: Math.round(taste * 100) / 100,
          recommended: agentPick || taste >= RECOMMENDED_AT,
          // What has happened to it: on the shortlist (by the agent or the author), saved or published
          state: c && c.status !== "dropped" ? (c.status === "picked" ? "picked" : "shortlisted") : r.status === "saved" || r.status === "published" ? r.status : "new",
          agentReason: agentPick ? c!.reason : null,
          agentScore: agentPick ? Number(c!.score) : null,
        };
      })
      .sort((a, b) => Number(b.recommended) - Number(a.recommended) || b.taste - a.taste);
    return json({ items, topics: config.topics });
  });
}
