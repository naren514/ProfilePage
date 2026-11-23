import { createHash } from "crypto";
import { z } from "zod";
import type { AutonomyLevel } from "@/lib/db/schema";
import type { ApprovalRequest, StepContext } from "../types";

// The agent's tools (agent PRD A2). Each tool has a zod schema for its
// arguments, a risk class, and a run function. The model picks one tool per
// turn; the loop (loop.ts) validates, executes and records it.

export type Risk = "read" | "write-private" | "write-public" | "ask";

export interface PlanItem {
  text: string;
  status: "todo" | "doing" | "done";
}

export interface AgentSource {
  id: string;
  ref: string;
  url: string;
  title: string;
  publisher: string;
  excerpt: string;
  publishedDate: string | null;
  query: string;
  /** Main text read with web.fetch (capped). */
  pageText?: string;
}

export interface Observation {
  turn: number;
  tool: string;
  args: Record<string, unknown>;
  ok: boolean;
  /** What the model sees about the result (already fenced where it holds web text). */
  text: string;
}

export interface AgentState extends Record<string, unknown> {
  agent: true;
  goal: string;
  plan: PlanItem[];
  planVersion: number;
  observations: Observation[];
  sources: AgentSource[];
  /** How often each exact action was attempted (loop detection). */
  attempts: Record<string, number>;
  /** Turns in a row without progress (no new information, no plan item done). */
  stalled: number;
  turn: number;
  /** Instruction the author gave when asking for another try. */
  authorNote?: string;
}

export interface ToolResult {
  ok: boolean;
  /** Shown to the model as this turn's observation. */
  observation: string;
  /** New information was gathered (resets the no-progress counter). */
  progress?: boolean;
  /** Stop and ask the author. */
  approval?: ApprovalRequest;
  /** End the run with this result. */
  finished?: Record<string, unknown>;
}

export interface ToolDef<A extends z.ZodTypeAny = z.ZodTypeAny> {
  name: string;
  /** One line the model reads in its tool menu. */
  description: string;
  risk: Risk;
  args: A;
  /** Argument shape shown to the model, e.g. {"query":"…"}. */
  example: string;
  run(ctx: StepContext, args: z.infer<A>, state: AgentState): Promise<ToolResult>;
}

/** Declare a tool with its argument types inferred from the schema. */
export function defineTool<A extends z.ZodTypeAny>(tool: ToolDef<A>): ToolDef {
  return tool as unknown as ToolDef;
}

/** Tools available at an autonomy level: never public writes; L0 only reads and asks. */
export function toolsFor(level: AutonomyLevel, tools: ToolDef[]): ToolDef[] {
  return tools.filter((t) => {
    if (t.risk === "write-public") return false; // only the runner does those, after approval
    if (t.risk === "write-private") return level !== "L0";
    return true;
  });
}

/** Stable key for "the same action with the same arguments" (loop detection). */
export function actionKey(tool: string, args: unknown): string {
  const stable = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(stable);
    if (v && typeof v === "object") return Object.fromEntries(Object.keys(v as object).sort().map((k) => [k, stable((v as Record<string, unknown>)[k])]));
    if (typeof v === "string") return v.trim().toLowerCase().replace(/\s+/g, " ");
    return v;
  };
  return createHash("sha256").update(tool + "\u0000" + JSON.stringify(stable(args ?? {}))).digest("hex").slice(0, 24);
}

export function emptyAgentState(goal: string): AgentState {
  return { agent: true, goal, plan: [], planVersion: 0, observations: [], sources: [], attempts: {}, stalled: 0, turn: 0 };
}

export function isAgentState(v: unknown): v is AgentState {
  return Boolean(v && typeof v === "object" && (v as { agent?: unknown }).agent === true);
}
