import type { z } from "zod";
import type { WritingAgentRun } from "@/lib/db/schema";
import type { ModelTier } from "@/lib/writing/ai/config";
import type { StyleForPrompt, ExampleForPrompt } from "@/lib/writing/ai/prompts";
import type { SearchOptions, SearchResult } from "./tavily";

export type ToolName = "web.search" | "web.fetch";

/** A page read with web.fetch: its main text, ready to show the model (fenced). */
export interface FetchedText {
  url: string;
  title: string;
  text: string;
}

export interface DocumentContext {
  id: string;
  title: string;
  excerpt: string;
  text: string;
  /** Section headings and the text under each, in order. */
  outline: Array<{ heading: string; text: string }>;
}

export interface StepContext {
  run: WritingAgentRun;
  input: Record<string, unknown>;
  /** Outputs of earlier steps, by step id. */
  state: Record<string, unknown>;
  /** Decisions the author made at earlier checkpoints, by approval kind. */
  approvals: Record<string, Record<string, unknown>>;
  document: DocumentContext | null;
  style: StyleForPrompt | null;
  examples: ExampleForPrompt[];
  signal: AbortSignal;
  /** A model call that must return JSON matching the schema. */
  json<S extends z.ZodTypeAny>(call: {
    label: string;
    tier: ModelTier;
    system: string;
    user: string;
    schema: S;
    maxOutputTokens: number;
  }): Promise<z.infer<S>>;
  /** Run an allowlisted tool. */
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
  /** Read one public web page (SSRF-safe; counts against the run's page-read budget). */
  fetchPage(url: string): Promise<FetchedText>;
  /** Work time so far in this run, for budget messages. */
  activeMs(): number;
  /** The usage so far (for showing the agent its remaining budget). */
  usage(): import("@/lib/db/schema").RunUsage;
  log(message: string, payload?: Record<string, unknown>): Promise<void>;
}

export interface ApprovalRequest {
  kind: string;
  title: string;
  proposal: unknown;
  /** Agent runs: the run completes when the author approves this (no more turns). */
  final?: boolean;
}

export interface StepOutcome {
  output: unknown;
  /** Pause after this step until the author decides. */
  approval?: ApprovalRequest;
  /** Agent runs: the run's whole state after this turn (replaces it). */
  state?: Record<string, unknown>;
  /** Agent runs: the run is done; this is its result. */
  finished?: Record<string, unknown>;
  /** Agent runs: stop now as failed with this message (e.g. a loop was detected). */
  stop?: { type: string; message: string };
}

export interface StepDef {
  id: string;
  label: string;
  run(ctx: StepContext): Promise<StepOutcome>;
}

export interface WorkflowDef {
  id: string;
  label: string;
  /**
   * Agent playbook (A2): instead of fixed steps, the runner calls this once
   * per turn and the model chooses the next tool. `steps` is empty.
   */
  agentTurn?: (ctx: StepContext) => Promise<StepOutcome>;
  description: string;
  /** Tools this workflow may use (server-side allowlist). */
  tools: ToolName[];
  needsDocument: boolean;
  inputSchema: z.ZodTypeAny;
  steps: StepDef[];
  /**
   * Runs when the author approves the final proposal, before the run completes:
   * the only place a workflow acts in public (e.g. publishing the weekly list).
   * Must be safe to repeat. Its return value is merged into the result.
   */
  onApproved?: (run: WritingAgentRun, state: Record<string, unknown>, decision: Record<string, unknown>) => Promise<Record<string, unknown>>;
  /** Builds the run's result once the last step (or a final approval) is done. */
  result(state: Record<string, unknown>, approvals: Record<string, Record<string, unknown>>): Record<string, unknown>;
}
