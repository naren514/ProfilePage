import { sleep } from "workflow";

// The durable driver for agent runs (agent PRD A1). It holds no agent state:
// Postgres does (runs, budgets, approvals, events). Each step is one call to
// advanceRun, which executes one checkpointed step and is safe to repeat, so
// Workflow's retries can't run a step twice. The instance ends when the run
// waits for the author or finishes; an approval starts a new instance.

const ACTIVE = new Set(["CREATED", "RUNNING"]);
const MAX_TURNS = 200;

export async function agentRunWorkflow(runId: string) {
  "use workflow";
  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const r = await runOneTurn(runId);
    if (!r.status || !ACTIVE.has(r.status)) return { runId, status: r.status ?? "MISSING", turns: turn + 1 };
    // Another driver holds this run's lock (a retry or the sweep): check back shortly
    if (r.working) await sleep("5s");
  }
  return { runId, status: "TURN_LIMIT", turns: MAX_TURNS };
}

async function runOneTurn(runId: string): Promise<{ status: string | null; working: boolean }> {
  "use step";
  const { advanceRun, presentRun } = await import("@/lib/agent/runner");
  const run = await advanceRun(runId);
  if (!run) return { status: null, working: false };
  return { status: run.status, working: presentRun(run).working };
}
