import { inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { writingAgentRuns, writingTriggers } from "@/lib/db/schema";
import { getReadingAgentConfig, readingAgentConfigSchema, saveReadingAgentConfig } from "@/lib/reading/agent-config";
import { activeCandidates, savedThisWeek, weeklyLists } from "@/lib/reading/shortlist";
import { ensureDefaultTriggers } from "@/lib/agent/triggers";
import { describeSchedule } from "@/lib/agent/schedule";
import { json, parseBody, writingRoute } from "@/lib/writing/api";

export const dynamic = "force-dynamic";

const READING_TRIGGERS = ["reading-scout-nightly", "reading-weekly-list"];

/** Topics and sources, the current shortlist, past lists and the two schedules. */
export async function GET() {
  return writingRoute(async () => {
    await ensureDefaultTriggers();
    const [config, shortlist, saved, lists, triggers] = await Promise.all([
      getReadingAgentConfig(),
      activeCandidates(),
      savedThisWeek(),
      weeklyLists(),
      db.select().from(writingTriggers).where(inArray(writingTriggers.key, READING_TRIGGERS)),
    ]);
    // The real state of each trigger's latest run (waiting for you, running, done)
    const runIds = triggers.map((t) => t.lastRunId).filter((id): id is string => Boolean(id));
    const runs = runIds.length ? await db.select({ id: writingAgentRuns.id, status: writingAgentRuns.status }).from(writingAgentRuns).where(inArray(writingAgentRuns.id, runIds)) : [];
    const statusOf = new Map(runs.map((r) => [r.id, r.status]));
    return json({
      config,
      shortlist,
      savedThisWeek: saved.length,
      lists,
      triggers: triggers.map((t) => ({ id: t.id, key: t.key, name: t.name, enabled: t.enabled, scheduleText: t.schedule ? describeSchedule(t.schedule) : null, lastStatus: (t.lastRunId && statusOf.get(t.lastRunId)) || t.lastStatus, lastRunId: t.lastRunId, nextRunAt: t.nextRunAt })),
    });
  });
}

export async function PUT(request: Request) {
  return writingRoute(async (user) => {
    const body = await parseBody(request, readingAgentConfigSchema);
    if ("error" in body) return body.error;
    const config = { ...body.data, topics: Array.from(new Set(body.data.topics.map((t) => t.trim()))) };
    if (config.minPicks > config.maxPicks) config.minPicks = config.maxPicks;
    await saveReadingAgentConfig(config, user.email ?? "admin");
    return json({ config });
  });
}
