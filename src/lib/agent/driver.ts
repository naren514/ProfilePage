// What keeps an agent run moving (agent PRD A1, plan §3.1). The run's state
// lives in Postgres; a driver only calls advanceRun until the run waits or
// ends. Swapping drivers never touches the runner.
//
//   workflow  Vercel Workflow (production; the Local World when not on Vercel)
//   inline    a loop in this Node process (tests, local dev without Workflow)
//   browser   today's behaviour: the open tab calls /advance (fallback)
//
// AGENT_DRIVER picks one; default: workflow.

export type DriverKind = "workflow" | "inline" | "browser";
export type EnqueueReason = "created" | "approved" | "resume" | "sweep";

export function driverKind(): DriverKind {
  const v = process.env.AGENT_DRIVER;
  return v === "inline" || v === "browser" || v === "workflow" ? v : "workflow";
}

const inlineActive = new Set<string>();

async function driveInline(runId: string) {
  if (inlineActive.has(runId)) return;
  inlineActive.add(runId);
  try {
    const { advanceRun, presentRun } = await import("./runner");
    for (let i = 0; i < 200; i++) {
      const run = await advanceRun(runId);
      if (!run || (run.status !== "CREATED" && run.status !== "RUNNING")) return;
      if (presentRun(run).working) await new Promise((r) => setTimeout(r, 2000));
    }
  } catch (error) {
    console.error(`Inline driver for run ${runId} stopped:`, error);
  } finally {
    inlineActive.delete(runId);
  }
}

/**
 * Make sure something is executing this run on the server. Safe to call more
 * than once: advanceRun claims each step with a compare-and-swap.
 */
export async function enqueueRun(runId: string, reason: EnqueueReason): Promise<DriverKind> {
  const kind = driverKind();
  if (kind === "browser") return kind;
  if (kind === "inline") {
    void driveInline(runId);
    return kind;
  }
  const [{ start }, { agentRunWorkflow }] = await Promise.all([import("workflow/api"), import("@/workflows/agent-run")]);
  await start(agentRunWorkflow, [runId]);
  if (process.env.AGENT_DEBUG) console.log(`Enqueued run ${runId} (${reason}) on Vercel Workflow`);
  return kind;
}
