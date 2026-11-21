// The agent PRD's five success metrics, computed from run rows, their events
// and their approvals. Pure (no I/O) so it can be unit tested; the database
// loader is in metrics-data.ts.

export interface MetricRun {
  id: string;
  workflow: string;
  status: string;
  origin: string;
  /** Run state (research keeps the synthesized findings under state.synthesize). */
  state: Record<string, unknown> | null;
}

export interface MetricEvent {
  runId: string;
  type: string;
}

export interface MetricApproval {
  runId: string;
  createdAt: Date | string;
  decision: Record<string, unknown>;
}

export interface Rate {
  value: number | null;
  numerator: number;
  denominator: number;
}

export interface AgentMetrics {
  runs: number;
  /** Started by a schedule or an event, not a click. Target ≥ 50%. */
  startedAutomatically: Rate;
  /** Finished (or still waiting) without hitting a budget limit. Target ≥ 90%. */
  withinBudget: Rate;
  /** Final proposals accepted, whole or edited. Target ≥ 70%. */
  acceptance: Rate;
  /** Research facts that cited no retrieved source. Target ≤ 5%. */
  unsupportedFacts: Rate;
  /** Runs stopped by loop detection or a tool error. Target ≤ 5%. */
  loopOrToolStops: Rate;
}

export const TARGETS: Record<Exclude<keyof AgentMetrics, "runs">, { op: ">=" | "<="; value: number; label: string }> = {
  startedAutomatically: { op: ">=", value: 0.5, label: "Runs started by a schedule or event" },
  withinBudget: { op: ">=", value: 0.9, label: "Runs finished within budget" },
  acceptance: { op: ">=", value: 0.7, label: "Final proposals accepted" },
  unsupportedFacts: { op: "<=", value: 0.05, label: "Research facts left unsupported" },
  loopOrToolStops: { op: "<=", value: 0.05, label: "Runs stopped by a loop or tool error" },
};

const rate = (numerator: number, denominator: number): Rate => ({ numerator, denominator, value: denominator ? numerator / denominator : null });

const SETTLED = new Set(["COMPLETED", "FAILED", "CANCELLED", "WAITING_FOR_APPROVAL"]);
const ACCEPTING = new Set(["approve", "apply", "create_document"]);
const REJECTING = new Set(["decline"]);

interface FindingLike {
  kind?: string;
  unsupported?: boolean;
}

function researchFindings(state: Record<string, unknown> | null): FindingLike[] {
  const synth = state?.synthesize as { findings?: unknown } | undefined;
  return Array.isArray(synth?.findings) ? (synth!.findings as FindingLike[]) : [];
}

export function computeAgentMetrics(runs: MetricRun[], events: MetricEvent[], approvals: MetricApproval[]): AgentMetrics {
  const eventsByRun = new Map<string, Set<string>>();
  for (const e of events) {
    const set = eventsByRun.get(e.runId) ?? new Set<string>();
    set.add(e.type);
    eventsByRun.set(e.runId, set);
  }

  const settled = runs.filter((r) => SETTLED.has(r.status));
  const overBudget = settled.filter((r) => eventsByRun.get(r.id)?.has("budget_exceeded")).length;
  const stopped = settled.filter((r) => {
    const types = eventsByRun.get(r.id);
    return r.status === "FAILED" && Boolean(types?.has("loop_detected") || types?.has("tool_error"));
  }).length;

  // The last decision on each run is its final verdict (regenerate is not final)
  const last = new Map<string, MetricApproval>();
  for (const a of approvals) {
    const action = String(a.decision?.action ?? "");
    if (!ACCEPTING.has(action) && !REJECTING.has(action)) continue;
    const prev = last.get(a.runId);
    if (!prev || new Date(a.createdAt).getTime() >= new Date(prev.createdAt).getTime()) last.set(a.runId, a);
  }
  let accepted = 0;
  last.forEach((a) => {
    if (ACCEPTING.has(String(a.decision.action))) accepted++;
  });

  let facts = 0;
  let unsupported = 0;
  for (const r of runs) {
    if (r.workflow !== "research") continue;
    for (const f of researchFindings(r.state)) {
      if (f.kind === "interpretation") continue;
      facts++;
      if (f.unsupported) unsupported++;
    }
  }

  return {
    runs: runs.length,
    startedAutomatically: rate(runs.filter((r) => r.origin !== "manual").length, runs.length),
    withinBudget: rate(settled.length - overBudget, settled.length),
    acceptance: rate(accepted, last.size),
    unsupportedFacts: rate(unsupported, facts),
    loopOrToolStops: rate(stopped, settled.length),
  };
}

/** Whether a rate meets its PRD target (null when there's no data yet). */
export function meetsTarget(key: keyof typeof TARGETS, r: Rate): boolean | null {
  if (r.value === null) return null;
  const t = TARGETS[key];
  return t.op === ">=" ? r.value >= t.value : r.value <= t.value;
}
