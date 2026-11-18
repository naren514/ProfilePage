import { z } from "zod";

// Pure AI configuration and budget rules (no database access).


export const priceSchema = z.object({
  input: z.number().min(0).max(1000),
  output: z.number().min(0).max(1000),
});

export const aiSettingsSchema = z.object({
  enabled: z.boolean(),
  models: z.object({
    fast: z.string().trim().min(1).max(100),
    quality: z.string().trim().min(1).max(100),
  }),
  monthlyBudgetUsd: z.number().min(0).max(10_000),
  /** US dollars per 1M tokens, by model ID. */
  prices: z.record(z.string(), priceSchema),
});

export type AiSettings = z.infer<typeof aiSettingsSchema>;
export type ModelTier = keyof AiSettings["models"];

/** Used when a model has no price entry, so the budget errs on the safe side. */
export const FALLBACK_PRICE = { input: 10, output: 50 };

export function defaultAiSettings(): AiSettings {
  const envModel = process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini";
  return {
    enabled: true,
    models: {
      fast: process.env.OPENAI_WRITING_FAST_MODEL || envModel,
      quality: process.env.OPENAI_WRITING_QUALITY_MODEL || envModel,
    },
    monthlyBudgetUsd: 20,
    // Starting values; check them against OpenAI's pricing page and edit in AI settings.
    prices: {
      "gpt-4o-mini": { input: 0.15, output: 0.6 },
      "gpt-6.2-sol": { input: 2, output: 10 },
      "gpt-6.2-astra": { input: 8, output: 40 },
    },
  };
}

export function priceFor(settings: AiSettings, model: string) {
  return settings.prices[model] ?? FALLBACK_PRICE;
}

export function costUsd(settings: AiSettings, model: string, inputTokens: number, outputTokens: number): number {
  const price = priceFor(settings, model);
  return (inputTokens * price.input + outputTokens * price.output) / 1_000_000;
}

export function startOfMonthUtc(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export type BudgetCheck = { ok: true } | { ok: false; message: string };

/** Refuse a request that could take this month's spend over the budget. */
export function checkBudget(settings: AiSettings, spentUsd: number, worstCaseUsd: number): BudgetCheck {
  if (spentUsd + worstCaseUsd <= settings.monthlyBudgetUsd) return { ok: true };
  const spent = spentUsd.toFixed(2);
  const cap = settings.monthlyBudgetUsd.toFixed(2);
  return {
    ok: false,
    message: `This month's AI budget is used up (${"$"}${spent} of ${"$"}${cap}). Raise it in AI settings, or wait until next month.`,
  };
}
