import {
  estimateTokens,
  LLMError,
  type ChatMessage,
  type GenerateRequest,
  type GenerateResult,
  type LLMProvider,
  type ProviderCapabilities,
  type StreamEvent,
} from "./types";

// Adapter for the OpenAI Chat Completions wire format. The same format is
// served by OpenAI, and by Ollama and vLLM (Phase 2), so only the base URL,
// key and capabilities differ between them.

export interface OpenAICompatibleOptions {
  id: string;
  baseUrl: string;
  apiKey?: string;
  capabilities?: Partial<ProviderCapabilities>;
  fetchImpl?: typeof fetch;
}

interface ChatChunk {
  choices?: Array<{ delta?: { content?: string | null }; finish_reason?: string | null }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number } | null;
  model?: string;
}

function mapFinish(reason: string | null | undefined): GenerateResult["finishReason"] {
  if (reason === "stop") return "stop";
  if (reason === "length") return "length";
  return "other";
}

async function errorFromResponse(response: Response): Promise<LLMError> {
  let message = `Model request failed (${response.status})`;
  let code: string | undefined;
  try {
    const body = await response.json();
    message = body?.error?.message || message;
    code = body?.error?.code;
  } catch {
    // keep defaults
  }
  if (response.status === 401 || response.status === 403) return new LLMError("auth", "The AI provider rejected the API key.", response.status);
  if (response.status === 429) return new LLMError("rate_limited", "The AI provider is rate limiting requests, or the account is out of credit.", 429);
  if (response.status === 404 || code === "model_not_found") return new LLMError("model_not_found", `Model not available: ${message}`, response.status);
  if (code === "context_length_exceeded") return new LLMError("context_overflow", "The text is too long for this model.", response.status);
  return new LLMError("provider_error", message, response.status);
}

function linkSignals(request: GenerateRequest): { signal: AbortSignal; cleanup: () => void; timedOut: () => boolean } {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, request.timeoutMs ?? 60_000);
  const onAbort = () => controller.abort();
  request.signal?.addEventListener("abort", onAbort);
  if (request.signal?.aborted) controller.abort();
  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timer);
      request.signal?.removeEventListener("abort", onAbort);
    },
    timedOut: () => timedOut,
  };
}

function abortError(timedOut: boolean): LLMError {
  return timedOut ? new LLMError("timeout", "The AI took too long to respond.") : new LLMError("cancelled", "Cancelled.");
}

/** Parse a text/event-stream body into its data payloads. */
export async function* readSSE(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let index: number;
      while ((index = buffer.search(/\r?\n\r?\n/)) !== -1) {
        const rawEvent = buffer.slice(0, index);
        buffer = buffer.slice(index).replace(/^\r?\n\r?\n/, "");
        const data = rawEvent
          .split(/\r?\n/)
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).replace(/^ /, ""))
          .join("\n");
        if (data) yield data;
      }
    }
    const tail = buffer.trim();
    if (tail.startsWith("data:")) yield tail.slice(5).trim();
  } finally {
    reader.releaseLock();
  }
}

export class OpenAICompatibleProvider implements LLMProvider {
  readonly id: string;
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly caps: ProviderCapabilities;
  private readonly fetchImpl: typeof fetch;

  constructor(options: OpenAICompatibleOptions) {
    this.id = options.id;
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.apiKey = options.apiKey;
    this.caps = { streaming: true, streamUsage: true, ...options.capabilities };
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  capabilities(): ProviderCapabilities {
    return this.caps;
  }

  private body(request: GenerateRequest, stream: boolean) {
    return JSON.stringify({
      model: request.model,
      messages: request.messages,
      // Sampling parameters are left at provider defaults: several current
      // models reject non-default temperature.
      max_completion_tokens: request.maxOutputTokens,
      stream,
      ...(request.responseFormat === "json" ? { response_format: { type: "json_object" } } : {}),
      ...(stream && this.caps.streamUsage ? { stream_options: { include_usage: true } } : {}),
    });
  }

  private async post(request: GenerateRequest, stream: boolean, signal: AbortSignal): Promise<Response> {
    const response = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
      },
      body: this.body(request, stream),
      signal,
    });
    if (!response.ok) throw await errorFromResponse(response);
    return response;
  }

  async generate(request: GenerateRequest): Promise<GenerateResult> {
    let final: GenerateResult | null = null;
    for await (const event of this.stream(request)) if (event.type === "done") final = event.result;
    if (!final) throw new LLMError("provider_error", "The AI returned no response.");
    return final;
  }

  async *stream(request: GenerateRequest): AsyncGenerator<StreamEvent> {
    const { signal, cleanup, timedOut } = linkSignals(request);
    let text = "";
    let finish: string | null | undefined;
    let usage: { prompt_tokens?: number; completion_tokens?: number } | null | undefined;
    let model = request.model;
    try {
      let response: Response;
      try {
        response = await this.post(request, true, signal);
      } catch (error) {
        if (error instanceof LLMError) throw error;
        if (signal.aborted) throw abortError(timedOut());
        throw new LLMError("provider_error", "Couldn't reach the AI provider.");
      }
      if (!response.body) throw new LLMError("provider_error", "The AI returned an empty response.");
      try {
        for await (const data of readSSE(response.body)) {
          if (data === "[DONE]") break;
          let chunk: ChatChunk;
          try {
            chunk = JSON.parse(data);
          } catch {
            continue;
          }
          if (chunk.model) model = chunk.model;
          if (chunk.usage) usage = chunk.usage;
          const choice = chunk.choices?.[0];
          if (choice?.finish_reason) finish = choice.finish_reason;
          const delta = choice?.delta?.content;
          if (delta) {
            text += delta;
            yield { type: "delta", text: delta };
          }
        }
      } catch (error) {
        if (signal.aborted) throw abortError(timedOut());
        throw error instanceof LLMError ? error : new LLMError("provider_error", "The AI response was interrupted.");
      }
      const reported = Boolean(usage && typeof usage.prompt_tokens === "number");
      yield {
        type: "done",
        result: {
          text,
          model,
          finishReason: mapFinish(finish),
          usage: {
            inputTokens: reported ? usage!.prompt_tokens! : estimateMessages(request.messages),
            outputTokens: reported ? usage!.completion_tokens ?? 0 : estimateTokens(text),
            reported,
          },
        },
      };
    } finally {
      cleanup();
    }
  }
}

export function estimateMessages(messages: ChatMessage[]): number {
  return messages.reduce((sum, m) => sum + estimateTokens(m.content) + 4, 0);
}
