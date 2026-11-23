import type { RunBudget, RunUsage } from "@/lib/db/schema";

export const EMPTY_USAGE: RunUsage = { modelCalls: 0, toolCalls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 };

export function defaultRunBudget(maxCostUsd: number): RunBudget {
  return { maxModelCalls: 20, maxToolCalls: 8, maxFetches: 8, maxCostUsd, maxDurationMs: 15 * 60 * 1000 };
}

export class BudgetExceeded extends Error {}

/** How long a run may wait for the author before it expires (swept by the cron tick). */
export const MAX_WAIT_DAYS = 7;

/**
 * Throws BudgetExceeded if the next call would go over a run limit. The time
 * limit counts only time spent working (activeMs), never time waiting for the
 * author's approval.
 */
export function assertWithinRunBudget(
  usage: RunUsage,
  budget: RunBudget,
  next: { modelCall?: boolean; toolCall?: boolean; fetch?: boolean; worstCaseUsd: number },
  activeMs: number
): void {
  if (activeMs > budget.maxDurationMs) {
    throw new BudgetExceeded(`Stopped: this run passed its time limit of ${Math.round(budget.maxDurationMs / 60000)} minutes of work.`);
  }
  if (next.modelCall && usage.modelCalls + 1 > budget.maxModelCalls) {
    throw new BudgetExceeded(`Stopped: this run reached its limit of ${budget.maxModelCalls} AI calls.`);
  }
  if (next.fetch && (usage.fetches ?? 0) + 1 > (budget.maxFetches ?? 8)) {
    throw new BudgetExceeded(`Stopped: this run reached its limit of ${budget.maxFetches ?? 8} web pages read.`);
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
    fetches: (usage.fetches ?? 0) + (delta.fetches ?? 0),
    inputTokens: usage.inputTokens + (delta.inputTokens ?? 0),
    outputTokens: usage.outputTokens + (delta.outputTokens ?? 0),
    costUsd: Math.round((usage.costUsd + (delta.costUsd ?? 0)) * 1e6) / 1e6,
  };
}
