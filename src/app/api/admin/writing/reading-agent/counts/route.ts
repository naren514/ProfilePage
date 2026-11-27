import { and, count, eq, gte } from "drizzle-orm";
import { db } from "@/lib/db";
import { certifications, readingFeedItems, writingAgentRuns, writingTriggers } from "@/lib/db/schema";
import { activeCandidates, savedThisWeek } from "@/lib/reading/shortlist";
import { json, writingRoute } from "@/lib/writing/api";

export const dynamic = "force-dynamic";

/** The numbers on the Reading tabs: new to discover, in the inbox, this week, and whether a list waits for approval. */
export async function GET() {
  return writingRoute(async () => {
    const since = new Date(Date.now() - 14 * 86_400_000);
    const [discover, inbox, shortlist, saved, weekly] = await Promise.all([
      db.select({ n: count() }).from(readingFeedItems).where(and(eq(readingFeedItems.status, "new"), gte(readingFeedItems.createdAt, since))),
      db.select({ n: count() }).from(certifications).where(eq(certifications.status, "inbox")),
      activeCandidates(),
      savedThisWeek(),
      db.select({ runId: writingTriggers.lastRunId }).from(writingTriggers).where(eq(writingTriggers.key, "reading-weekly-list")),
    ]);
    const runId = weekly[0]?.runId;
    const waiting = runId
      ? (await db.select({ n: count() }).from(writingAgentRuns).where(and(eq(writingAgentRuns.id, runId), eq(writingAgentRuns.status, "WAITING_FOR_APPROVAL"))))[0]?.n > 0
      : false;
    return json({ discover: discover[0]?.n ?? 0, inbox: inbox[0]?.n ?? 0, week: shortlist.length + saved.length, waiting });
  });
}
