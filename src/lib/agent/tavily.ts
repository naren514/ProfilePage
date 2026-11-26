import { z } from "zod";

// Tavily web search (D5). TAVILY_BASE_URL can point at a test double.

export interface SearchResult {
  title: string;
  url: string;
  content: string;
  score: number | null;
  publishedDate: string | null;
}

/** Optional search filters (the weekly reading list uses them). */
export interface SearchOptions {
  includeDomains?: string[];
  excludeDomains?: string[];
  /** Only pages from roughly this recent period. */
  timeRange?: "day" | "week" | "month";
}

export class SearchError extends Error {
  constructor(public kind: "not_configured" | "auth" | "limit" | "provider_error" | "cancelled", message: string) {
    super(message);
  }
}

const responseSchema = z.object({
  results: z
    .array(
      z
        .object({
          title: z.string().optional().nullable(),
          url: z.string(),
          content: z.string().optional().nullable(),
          score: z.number().optional().nullable(),
          published_date: z.string().optional().nullable(),
        })
        .passthrough()
    )
    .default([]),
});

export function isSearchConfigured(): boolean {
  return Boolean(process.env.TAVILY_API_KEY || process.env.TAVILY_BASE_URL);
}

function isWebUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

export async function tavilySearch(
  query: string,
  options: { maxResults?: number; signal?: AbortSignal; fetchImpl?: typeof fetch } & SearchOptions = {}
): Promise<SearchResult[]> {
  const key = process.env.TAVILY_API_KEY;
  const base = (process.env.TAVILY_BASE_URL || "https://api.tavily.com").replace(/\/+$/, "");
  if (!key && !process.env.TAVILY_BASE_URL) {
    throw new SearchError("not_configured", "Web research isn't set up: TAVILY_API_KEY is missing on the server.");
  }
  const timeout = AbortSignal.timeout(30_000);
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
  const filters = {
    ...(options.includeDomains?.length ? { include_domains: options.includeDomains.slice(0, 20) } : {}),
    ...(options.excludeDomains?.length ? { exclude_domains: options.excludeDomains.slice(0, 50) } : {}),
    ...(options.timeRange ? { time_range: options.timeRange } : {}),
  };
  const call = async (withFilters: boolean): Promise<Response> => {
    try {
      return await (options.fetchImpl ?? fetch)(`${base}/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(key ? { Authorization: `Bearer ${key}` } : {}) },
        body: JSON.stringify({
          query: query.slice(0, 400),
          search_depth: "basic",
          max_results: Math.min(Math.max(options.maxResults ?? 5, 1), 10),
          include_answer: false,
          include_raw_content: false,
          ...(withFilters ? filters : {}),
        }),
        signal,
      });
    } catch {
      if (options.signal?.aborted) throw new SearchError("cancelled", "Cancelled.");
      throw new SearchError("provider_error", "Couldn't reach the web search service.");
    }
  };
  let response = await call(true);
  // A plan or API version that rejects a filter: search again without the filters
  if ((response.status === 400 || response.status === 422) && Object.keys(filters).length) response = await call(false);
  if (response.status === 401 || response.status === 403) throw new SearchError("auth", "The web search service rejected the API key (check TAVILY_API_KEY in Vercel).");
  if (response.status === 429 || response.status === 432 || response.status === 433) {
    throw new SearchError("limit", "The web search service's usage limit was reached (check your Tavily plan).");
  }
  if (!response.ok) {
    const detail = (await response.text().catch(() => "")).replace(/\s+/g, " ").slice(0, 200);
    throw new SearchError("provider_error", `Web search failed (${response.status})${detail ? `: ${detail}` : ""}.`);
  }

  const parsed = responseSchema.safeParse(await response.json().catch(() => null));
  if (!parsed.success) throw new SearchError("provider_error", "The web search service returned an unexpected response.");
  return parsed.data.results
    .filter((r) => isWebUrl(r.url))
    .map((r) => ({
      title: (r.title ?? "").slice(0, 300),
      url: r.url,
      content: (r.content ?? "").slice(0, 3000),
      score: typeof r.score === "number" ? r.score : null,
      publishedDate: r.published_date ?? null,
    }));
}
