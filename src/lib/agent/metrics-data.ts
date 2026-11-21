import { and, gte, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { writingAgentEvents, writingAgentRuns, writingApprovals } from "@/lib/db/schema";
import { computeAgentMetrics, type AgentMetrics } from "./metrics";

/** The PRD's agent metrics over the last `days` days. */
export async function agentMetrics(days = 90): Promise<AgentMetrics> {
  const since = new Date(Date.now() - days * 86_400_000);
  const runs = await db
    .select({
      id: writingAgentRuns.id,
      workflow: writingAgentRuns.workflow,
      status: writingAgentRuns.status,
      origin: writingAgentRuns.origin,
      state: writingAgentRuns.state,
    })
    .from(writingAgentRuns)
    .where(gte(writingAgentRuns.createdAt, since))
    .limit(5000);
  if (runs.length === 0) return computeAgentMetrics([], [], []);
  const ids = runs.map((r) => r.id);
  const [events, approvals] = await Promise.all([
    db
      .select({ runId: writingAgentEvents.runId, type: writingAgentEvents.type })
      .from(writingAgentEvents)
      .where(and(inArray(writingAgentEvents.runId, ids), inArray(writingAgentEvents.type, ["budget_exceeded", "tool_error", "loop_detected"]))),
    db
      .select({ runId: writingApprovals.runId, createdAt: writingApprovals.createdAt, decision: writingApprovals.decision })
      .from(writingApprovals)
      .where(inArray(writingApprovals.runId, ids)),
  ]);
  return computeAgentMetrics(runs, events, approvals);
}
