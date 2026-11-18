import type { z } from "zod";
import type { WritingAgentRun } from "@/lib/db/schema";
import type { ModelTier } from "@/lib/writing/ai/config";
import type { StyleForPrompt, ExampleForPrompt } from "@/lib/writing/ai/prompts";
import type { SearchResult } from "./tavily";

export type ToolName = "web.search";

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
  search(query: string): Promise<SearchResult[]>;
  log(message: string, payload?: Record<string, unknown>): Promise<void>;
}

export interface ApprovalRequest {
  kind: string;
  title: string;
  proposal: unknown;
}

export interface StepOutcome {
  output: unknown;
  /** Pause after this step until the author decides. */
  approval?: ApprovalRequest;
}

export interface StepDef {
  id: string;
  label: string;
  run(ctx: StepContext): Promise<StepOutcome>;
}

export interface WorkflowDef {
  id: string;
  label: string;
  description: string;
  /** Tools this workflow may use (server-side allowlist). */
  tools: ToolName[];
  needsDocument: boolean;
  inputSchema: z.ZodTypeAny;
  steps: StepDef[];
  /** Builds the run's result once the last step (or a final approval) is done. */
  result(state: Record<string, unknown>, approvals: Record<string, Record<string, unknown>>): Record<string, unknown>;
}
