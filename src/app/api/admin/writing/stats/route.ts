import { agentMetrics } from "@/lib/agent/metrics-data";
import { studioStats } from "@/lib/writing/stats";
import { json, writingRoute } from "@/lib/writing/api";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return writingRoute(async () => {
    const url = new URL(request.url);
    const days = Math.min(Math.max(Number(url.searchParams.get("days")) || 30, 1), 365);
    const agentDays = Math.min(Math.max(Number(url.searchParams.get("agentDays")) || 90, 1), 365);
    const [stats, agent] = await Promise.all([studioStats(days), agentMetrics(agentDays)]);
    return json({ ...stats, agent: { days: agentDays, ...agent } });
  });
}
