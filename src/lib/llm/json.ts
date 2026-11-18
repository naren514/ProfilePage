import type { z } from "zod";
import { LLMError, type ChatMessage, type GenerateRequest, type GenerateResult, type LLMProvider, type Usage } from "./types";

export interface JsonResult<T> {
  data: T;
  model: string;
  usage: Usage;
  attempts: number;
}

/** Pull the first JSON object out of a reply (tolerates code fences and stray text). */
export function extractJson(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1));
    throw new Error("The reply wasn't JSON");
  }
}

function describe(error: unknown): string {
  if (error && typeof error === "object" && "issues" in error) {
    const issues = (error as z.ZodError).issues.slice(0, 5);
    return issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ");
  }
  return error instanceof Error ? error.message : "invalid reply";
}

/**
 * Generate a JSON object that matches `schema`. An invalid reply gets one
 * correction round (bounded retries, clear failure: PRD FR-LOCAL-004).
 */
export async function generateJson<S extends z.ZodTypeAny>(
  provider: LLMProvider,
  request: Omit<GenerateRequest, "responseFormat">,
  schema: S,
  maxRepairs = 1
): Promise<JsonResult<z.infer<S>>> {
  const messages: ChatMessage[] = [...request.messages];
  const usage: Usage = { inputTokens: 0, outputTokens: 0, reported: true };
  let last: GenerateResult | null = null;
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= maxRepairs; attempt++) {
    last = await provider.generate({ ...request, messages, responseFormat: "json" });
    usage.inputTokens += last.usage.inputTokens;
    usage.outputTokens += last.usage.outputTokens;
    usage.reported = usage.reported && last.usage.reported;
    try {
      const parsed = schema.safeParse(extractJson(last.text));
      if (parsed.success) return { data: parsed.data, model: last.model, usage, attempts: attempt + 1 };
      lastError = parsed.error;
    } catch (error) {
      lastError = error;
    }
    messages.push(
      { role: "assistant", content: last.text.slice(0, 4000) },
      { role: "user", content: `That reply didn't match the required JSON format (${describe(lastError)}). Reply again with only the corrected JSON object.` }
    );
  }
  const error = new LLMError("provider_error", `The AI's reply wasn't in the expected format: ${describe(lastError)}`);
  (error as LLMError & { usage?: Usage }).usage = usage;
  throw error;
}
