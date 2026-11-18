// Provider-neutral model contract. Application code depends on this file only;
// provider SDKs and wire formats stay inside the adapters.

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface GenerateRequest {
  model: string;
  messages: ChatMessage[];
  /** Upper bound on generated tokens. */
  maxOutputTokens: number;
  signal?: AbortSignal;
  /** Fails with a "timeout" error after this many ms (default 60s). */
  timeoutMs?: number;
}

export interface Usage {
  inputTokens: number;
  outputTokens: number;
  /** False when the provider didn't report usage and it was estimated. */
  reported: boolean;
}

export interface GenerateResult {
  text: string;
  usage: Usage;
  model: string;
  finishReason: "stop" | "length" | "other";
}

export type StreamEvent =
  | { type: "delta"; text: string }
  | { type: "done"; result: GenerateResult };

export interface ProviderCapabilities {
  streaming: boolean;
  /** Reports token usage for streamed responses. */
  streamUsage: boolean;
}

export type LLMErrorKind =
  | "not_configured"
  | "auth"
  | "rate_limited"
  | "model_not_found"
  | "context_overflow"
  | "timeout"
  | "cancelled"
  | "provider_error";

export class LLMError extends Error {
  constructor(public kind: LLMErrorKind, message: string, public status?: number) {
    super(message);
    this.name = "LLMError";
  }
}

export interface LLMProvider {
  readonly id: string;
  capabilities(): ProviderCapabilities;
  generate(request: GenerateRequest): Promise<GenerateResult>;
  stream(request: GenerateRequest): AsyncIterable<StreamEvent>;
}

/** Rough token estimate for when a provider doesn't report usage (~4 chars/token). */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
