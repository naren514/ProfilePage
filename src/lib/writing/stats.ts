import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { writingAgentRuns, writingAiUsage, writingSuggestions } from "@/lib/db/schema";

/** Health of the Studio's AI features over the last `days` days (PRD §16 observability). */
export async function studioStats(days = 30) {
  const since = new Date(Date.now() - days * 86_400_000);

  const [usageByOp, usageByDay, suggestionCounts, runCounts, durations, failures] = await Promise.all([
    db
      .select({
        operation: writingAiUsage.operation,
        requests: sql<string>`count(*)`,
        costUsd: sql<string>`coalesce(sum(${writingAiUsage.costUsd}), 0)`,
        inputTokens: sql<string>`coalesce(sum(${writingAiUsage.inputTokens}), 0)`,
        outputTokens: sql<string>`coalesce(sum(${writingAiUsage.outputTokens}), 0)`,
      })
      .from(writingAiUsage)
      .where(gte(writingAiUsage.createdAt, since))
      .groupBy(writingAiUsage.operation),
    db
      .select({
        day: sql<string>`to_char(date_trunc('day', ${writingAiUsage.createdAt}), 'YYYY-MM-DD')`,
        costUsd: sql<string>`coalesce(sum(${writingAiUsage.costUsd}), 0)`,
        requests: sql<string>`count(*)`,
      })
      .from(writingAiUsage)
      .where(gte(writingAiUsage.createdAt, since))
      .groupBy(sql`1`)
      .orderBy(sql`1`),
    db
      .select({ status: writingSuggestions.status, n: sql<string>`count(*)` })
      .from(writingSuggestions)
      .where(gte(writingSuggestions.createdAt, since))
      .groupBy(writingSuggestions.status),
    db
      .select({ workflow: writingAgentRuns.workflow, status: writingAgentRuns.status, n: sql<string>`count(*)` })
      .from(writingAgentRuns)
      .where(gte(writingAgentRuns.createdAt, since))
      .groupBy(writingAgentRuns.workflow, writingAgentRuns.status),
    db
      .select({
        median: sql<string | null>`percentile_cont(0.5) within group (order by extract(epoch from (${writingAgentRuns.finishedAt} - ${writingAgentRuns.createdAt})))`,
      })
      .from(writingAgentRuns)
      .where(and(gte(writingAgentRuns.createdAt, since), eq(writingAgentRuns.status, "COMPLETED"))),
    db
      .select({ id: writingAgentRuns.id, workflow: writingAgentRuns.workflow, error: writingAgentRuns.error, createdAt: writingAgentRuns.createdAt })
      .from(writingAgentRuns)
      .where(and(gte(writingAgentRuns.createdAt, since), eq(writingAgentRuns.status, "FAILED")))
      .orderBy(desc(writingAgentRuns.createdAt))
      .limit(5),
  ]);

  const suggestions: Record<string, number> = {};
  for (const r of suggestionCounts) suggestions[r.status] = Number(r.n);
  const decided = (suggestions.accepted ?? 0) + (suggestions.modified ?? 0) + (suggestions.rejected ?? 0);
  const runs = { total: 0, completed: 0, failed: 0, cancelled: 0, waiting: 0 };
  const byWorkflow: Record<string, number> = {};
  for (const r of runCounts) {
    const n = Number(r.n);
    runs.total += n;
    byWorkflow[r.workflow] = (byWorkflow[r.workflow] ?? 0) + n;
    if (r.status === "COMPLETED") runs.completed += n;
    else if (r.status === "FAILED") runs.failed += n;
    else if (r.status === "CANCELLED") runs.cancelled += n;
    else if (r.status === "WAITING_FOR_APPROVAL") runs.waiting += n;
  }
  const operations = usageByOp
    .map((r) => ({
      operation: r.operation,
      requests: Number(r.requests),
      costUsd: Number(r.costUsd),
      inputTokens: Number(r.inputTokens),
      outputTokens: Number(r.outputTokens),
    }))
    .sort((a, b) => b.costUsd - a.costUsd);

  return {
    days,
    costUsd: operations.reduce((n, o) => n + o.costUsd, 0),
    requests: operations.reduce((n, o) => n + o.requests, 0),
    operations,
    byDay: usageByDay.map((d) => ({ day: d.day, costUsd: Number(d.costUsd), requests: Number(d.requests) })),
    suggestions: {
      ...suggestions,
      decided,
      // Accepted as is or after an edit, out of all decided suggestions
      acceptanceRate: decided ? ((suggestions.accepted ?? 0) + (suggestions.modified ?? 0)) / decided : null,
    },
    runs: { ...runs, byWorkflow, failureRate: runs.completed + runs.failed ? runs.failed / (runs.completed + runs.failed) : null },
    medianRunSeconds: durations[0]?.median != null ? Number(durations[0].median) : null,
    recentFailures: failures,
  };
}
