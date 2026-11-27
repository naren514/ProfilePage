import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { siteSettings } from "@/lib/db/schema";

// What the weekly reading list agent looks for (agent PRD A3): the author's
// topics, sites to favour or skip, and the rubric it scores articles with.
// Stored in site_settings; edited on Studio → Weekly list.

export const READING_AGENT_KEY = "reading_agent";

const site = z
  .string()
  .trim()
  .toLowerCase()
  .transform((s) => s.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, ""))
  .pipe(z.string().regex(/^[a-z0-9.-]+\.[a-z]{2,}$/, "Use a site's address, like example.com"));

export const readingAgentConfigSchema = z.object({
  topics: z.array(z.string().trim().min(2).max(60)).min(1, "Add at least one topic.").max(10),
  /** Sites to search first (searched in addition to the open web). */
  favourSites: z.array(site).max(20).default([]),
  /** Sites never to suggest. */
  avoidSites: z.array(site).max(50).default([]),
  /** How the agent judges an article; shown to it each night and week. */
  rubric: z.string().trim().min(20).max(2000),
  /** Weekly list size. */
  minPicks: z.number().int().min(1).max(10).default(3),
  maxPicks: z.number().int().min(1).max(10).default(7),
  /** Email the list to subscribers when the author approves it. */
  emailSubscribers: z.boolean().default(true),
});

export type ReadingAgentConfig = z.infer<typeof readingAgentConfigSchema>;

export const DEFAULT_RUBRIC = `Score each article 0–10 on:
- Relevance: squarely about one of my topics, useful to a practitioner.
- Depth: original thinking, data or first-hand experience, not a rewrite of news or a listicle.
- Credibility: a named author or publication with a track record; claims backed by evidence.
- Recency: published in the last few weeks, or a classic that is newly relevant.
Prefer variety across topics and sources. Skip paywalled teasers, press releases, syndicated copies and anything mainly selling a product.`;

export function defaultReadingAgentConfig(): ReadingAgentConfig {
  return {
    topics: ["Investments", "Finance", "Engineering", "Technology", "Leadership"],
    favourSites: [],
    avoidSites: [],
    rubric: DEFAULT_RUBRIC,
    minPicks: 3,
    maxPicks: 7,
    emailSubscribers: true,
  };
}

export async function getReadingAgentConfig(): Promise<ReadingAgentConfig> {
  const defaults = defaultReadingAgentConfig();
  const [row] = await db.select().from(siteSettings).where(eq(siteSettings.key, READING_AGENT_KEY)).limit(1);
  if (!row) return defaults;
  const parsed = readingAgentConfigSchema.partial().safeParse(row.value);
  return parsed.success ? { ...defaults, ...parsed.data } : defaults;
}

export async function saveReadingAgentConfig(config: ReadingAgentConfig, updatedBy: string): Promise<void> {
  await db
    .insert(siteSettings)
    .values({ key: READING_AGENT_KEY, value: config, category: "ai", label: "Weekly reading list", updatedBy })
    .onConflictDoUpdate({ target: siteSettings.key, set: { value: config, updatedAt: new Date(), updatedBy } });
}

/** Whether a URL's site is on a list (example.com also matches blog.example.com). */
export function siteMatches(url: string, sites: string[]): boolean {
  let host: string;
  try {
    host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return false;
  }
  return sites.some((s) => host === s || host.endsWith(`.${s}`));
}
