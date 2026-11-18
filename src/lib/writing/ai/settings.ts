import { eq, gte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { siteSettings, writingAiUsage } from "@/lib/db/schema";
import { aiSettingsSchema, defaultAiSettings, startOfMonthUtc, type AiSettings } from "./config";

export * from "./config";

export const AI_SETTINGS_KEY = "writing_ai";

export async function getAiSettings(): Promise<AiSettings> {
  const [row] = await db.select().from(siteSettings).where(eq(siteSettings.key, AI_SETTINGS_KEY)).limit(1);
  const defaults = defaultAiSettings();
  if (!row) return defaults;
  const parsed = aiSettingsSchema.partial().safeParse(row.value);
  if (!parsed.success) return defaults;
  return {
    ...defaults,
    ...parsed.data,
    models: { ...defaults.models, ...parsed.data.models },
    prices: parsed.data.prices ?? defaults.prices,
  };
}

export async function saveAiSettings(settings: AiSettings, updatedBy: string): Promise<void> {
  await db
    .insert(siteSettings)
    .values({ key: AI_SETTINGS_KEY, value: settings, category: "ai", label: "Writing Studio AI", updatedBy })
    .onConflictDoUpdate({ target: siteSettings.key, set: { value: settings, updatedAt: new Date(), updatedBy } });
}

export async function monthToDate(): Promise<{ spentUsd: number; requests: number }> {
  const [row] = await db
    .select({
      spent: sql<string>`coalesce(sum(${writingAiUsage.costUsd}), 0)`,
      requests: sql<string>`count(*)`,
    })
    .from(writingAiUsage)
    .where(gte(writingAiUsage.createdAt, startOfMonthUtc()));
  return { spentUsd: Number(row?.spent ?? 0), requests: Number(row?.requests ?? 0) };
}
