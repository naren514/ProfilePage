import { ensureDefaultTriggers, listTriggers, spentToday } from "@/lib/agent/triggers";
import { describeSchedule } from "@/lib/agent/schedule";
import { getAiSettings } from "@/lib/writing/ai/settings";
import { json, writingRoute } from "@/lib/writing/api";

export const dynamic = "force-dynamic";

/** Every trigger with its schedule in words and today's spend. */
export async function GET() {
  return writingRoute(async () => {
    await ensureDefaultTriggers();
    const [triggers, settings] = await Promise.all([listTriggers(), getAiSettings()]);
    const rows = await Promise.all(
      triggers.map(async (t) => ({ ...t, scheduleText: t.schedule ? describeSchedule(t.schedule) : null, spentTodayUsd: await spentToday(t) }))
    );
    return json({ triggers: rows, agentsEnabled: settings.agentsEnabled, cronConfigured: Boolean(process.env.CRON_SECRET) });
  });
}
