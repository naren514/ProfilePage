import type { RunBudget, RunUsage } from "@/lib/db/schema";

export const EMPTY_USAGE: RunUsage = { modelCalls: 0, toolCalls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 };

export function defaultRunBudget(maxCostUsd: number): RunBudget {
  return { maxModelCalls: 20, maxToolCalls: 8, maxCostUsd, maxDurationMs: 15 * 60 * 1000 };
}

export class BudgetExceeded extends Error {}

/** Throws BudgetExceeded if the next call would go over a run limit. */
export function assertWithinRunBudget(
  usage: RunUsage,
  budget: RunBudget,
  next: { modelCall?: boolean; toolCall?: boolean; worstCaseUsd: number },
  startedAt: Date,
  now = new Date()
): void {
  if (now.getTime() - startedAt.getTime() > budget.maxDurationMs) {
    throw new BudgetExceeded(`Stopped: this run passed its time limit of ${Math.round(budget.maxDurationMs / 60000)} minutes.`);
  }
  if (next.modelCall && usage.modelCalls + 1 > budget.maxModelCalls) {
    throw new BudgetExceeded(`Stopped: this run reached its limit of ${budget.maxModelCalls} AI calls.`);
  }
  if (next.toolCall && usage.toolCalls + 1 > budget.maxToolCalls) {
    throw new BudgetExceeded(`Stopped: this run reached its limit of ${budget.maxToolCalls} web searches.`);
  }
  if (usage.costUsd + next.worstCaseUsd > budget.maxCostUsd) {
    throw new BudgetExceeded(
      `Stopped: the next step could take this run over its ${"$"}${budget.maxCostUsd.toFixed(2)} limit (spent ${"$"}${usage.costUsd.toFixed(3)} so far). You can raise the per-run limit in Styles & AI.`
    );
  }
}

export function addUsage(usage: RunUsage, delta: Partial<RunUsage>): RunUsage {
  return {
    modelCalls: usage.modelCalls + (delta.modelCalls ?? 0),
    toolCalls: usage.toolCalls + (delta.toolCalls ?? 0),
    inputTokens: usage.inputTokens + (delta.inputTokens ?? 0),
    outputTokens: usage.outputTokens + (delta.outputTokens ?? 0),
    costUsd: Math.round((usage.costUsd + (delta.costUsd ?? 0)) * 1e6) / 1e6,
  };
}
