import { OpenAICompatibleProvider } from "./openai-compatible";
import { LLMError, type LLMProvider } from "./types";

export * from "./types";

/**
 * The configured provider. Phase 1: OpenAI. OPENAI_BASE_URL points it at any
 * OpenAI-compatible server (a local Ollama/vLLM in Phase 2, or a test double).
 */
export function getProvider(): LLMProvider {
  const apiKey = process.env.OPENAI_API_KEY;
  const baseUrl = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
  if (!apiKey && !process.env.OPENAI_BASE_URL) {
    throw new LLMError("not_configured", "AI isn't configured: OPENAI_API_KEY is missing on the server.");
  }
  return new OpenAICompatibleProvider({ id: "openai", baseUrl, apiKey });
}

export function isProviderConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY || process.env.OPENAI_BASE_URL);
}
