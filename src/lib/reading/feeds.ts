import { eq, inArray, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import { certifications, readingCandidates, readingFeedItems, readingSources, siteSettings, type ReadingSource } from "@/lib/db/schema";
import { safeFetchPage } from "./safe-fetch";
import { cleanUrl, normalizeUrl, parseArticleUrl } from "./url";

// Discovery from the author's sources (agent PRD A3, discovery): read each
// source's RSS or Atom feed, keep recent articles, and store each one once.
// No search credits; quality starts with the sources the author chose.

export interface FeedEntry {
  title: string;
  url: string;
  summary: string;
  publishedAt: Date | null;
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", hellip: "…", mdash: "—", ndash: "–", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“" };

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

/** Text of a feed field: CDATA unwrapped, markup removed, entities decoded, spaces collapsed. */
export function feedText(raw: string | undefined | null, max = 600): string {
  if (!raw) return "";
  let s = raw.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
  // Escaped HTML inside RSS descriptions: decode once, then strip tags
  s = decodeEntities(s).replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ");
  s = decodeEntities(s).replace(/\s+/g, " ").trim();
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}

function tag(block: string, name: string): string | undefined {
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"));
  return m?.[1];
}

function date(s: string | undefined): Date | null {
  if (!s) return null;
  const d = new Date(feedText(s, 100));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Parse RSS 2.0, RSS 1.0 (RDF) or Atom. Returns [] for anything else. */
export function parseFeed(xml: string, base?: string): FeedEntry[] {
  const out: FeedEntry[] = [];
  const resolve = (href: string) => {
    if (!href.trim()) return "";
    try {
      return new URL(decodeEntities(href.trim()), base).toString();
    } catch {
      return "";
    }
  };
  if (/<feed[\s>]/i.test(xml) && /<entry[\s>]/i.test(xml)) {
    for (const m of Array.from(xml.matchAll(/<entry[\s>][\s\S]*?<\/entry>/gi))) {
      const block = m[0];
      const links = Array.from(block.matchAll(/<link\b([^>]*)\/?>/gi)).map((l) => l[1]);
      const alt = links.find((a) => /rel=["']alternate["']/i.test(a)) ?? links.find((a) => !/rel=/i.test(a)) ?? links[0] ?? "";
      const href = alt.match(/href=["']([^"']+)["']/i)?.[1] ?? "";
      out.push({ title: feedText(tag(block, "title"), 300), url: resolve(href), summary: feedText(tag(block, "summary") ?? tag(block, "content")), publishedAt: date(tag(block, "published") ?? tag(block, "updated")) });
    }
    return out.filter((e) => e.url);
  }
  if (/<(rss|rdf:RDF)[\s>]/i.test(xml) || /<item[\s>]/i.test(xml)) {
    for (const m of Array.from(xml.matchAll(/<item[\s>][\s\S]*?<\/item>/gi))) {
      const block = m[0];
      const link = feedText(tag(block, "link"), 2000) || (/isPermaLink=["']?true/i.test(block) || !/isPermaLink/i.test(block) ? feedText(tag(block, "guid"), 2000) : "");
      out.push({ title: feedText(tag(block, "title"), 300), url: resolve(link), summary: feedText(tag(block, "description") ?? tag(block, "content:encoded")), publishedAt: date(tag(block, "pubDate") ?? tag(block, "dc:date")) });
    }
    return out.filter((e) => /^https?:\/\//.test(e.url));
  }
  return [];
}

const looksLikeFeed = (body: string) => /^\s*(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*<(rss|feed|rdf:RDF)[\s>]/i.test(body);

/** Feed links a page advertises (<link rel="alternate" type="application/rss+xml">). */
export function advertisedFeeds(html: string, base: string): string[] {
  const out: string[] = [];
  for (const m of Array.from(html.matchAll(/<link\b[^>]*>/gi))) {
    const t = m[0];
    if (!/rel=["']?alternate/i.test(t) || !/type=["']?application\/(rss|atom)\+xml/i.test(t)) continue;
    const href = t.match(/href=["']([^"']+)["']/i)?.[1];
    if (!href) continue;
    try {
      out.push(new URL(decodeEntities(href), base).toString());
    } catch {
      // ignore
    }
  }
  return out;
}

const COMMON_PATHS = ["/feed", "/rss", "/feed.xml", "/rss.xml", "/atom.xml", "/index.xml", "/feed/"];

type Fetcher = (url: URL) => Promise<{ finalUrl: string; status: number; body: string }>;
const defaultFetcher: Fetcher = (url) => safeFetchPage(url, 8000);

/** Find a site's feed: the address itself, an advertised feed, or a common path. */
export async function discoverFeed(address: string, fetcher: Fetcher = defaultFetcher): Promise<{ feedUrl: string; entries: FeedEntry[]; title: string } | null> {
  const start = parseArticleUrl(address);
  if (!start) return null;
  const tryFeed = async (u: string) => {
    const parsed = parseArticleUrl(u);
    if (!parsed) return null;
    const page = await fetcher(parsed).catch(() => null);
    if (!page || page.status >= 400 || !looksLikeFeed(page.body)) return null;
    return { feedUrl: page.finalUrl, entries: parseFeed(page.body, page.finalUrl), title: feedText(tag(page.body, "title"), 120) };
  };
  const first = await fetcher(start).catch(() => null);
  // The site doesn't answer at all: don't spend seconds guessing feed paths
  if (!first) return null;
  if (first.status < 400) {
    if (looksLikeFeed(first.body)) return { feedUrl: first.finalUrl, entries: parseFeed(first.body, first.finalUrl), title: feedText(tag(first.body, "title"), 120) };
    for (const href of advertisedFeeds(first.body, first.finalUrl).slice(0, 3)) {
      const found = await tryFeed(href);
      if (found) return found;
    }
  }
  const origin = new URL(first.finalUrl).origin;
  for (const path of COMMON_PATHS) {
    const found = await tryFeed(origin + path);
    if (found) return found;
  }
  return null;
}

/** How far back a feed article still counts as new. */
export const FEED_WINDOW_DAYS = 10;
const MAX_PER_SOURCE = 15;

export interface CollectSummary {
  sources: number;
  ok: number;
  failed: number;
  added: number;
}

/**
 * Read every source's feed and store articles not seen before (and not
 * already on the reading list or shortlist). Safe to run repeatedly.
 */
export async function collectFeeds(opts: { now?: Date; fetcher?: Fetcher; concurrency?: number; budgetMs?: number } = {}): Promise<CollectSummary> {
  const now = opts.now ?? new Date();
  // Stay well inside a serverless function's time limit; unread sources wait for the next run
  const deadline = Date.now() + (opts.budgetMs ?? 40_000);
  const sources = await db.select().from(readingSources);
  const since = new Date(now.getTime() - FEED_WINDOW_DAYS * 86_400_000);
  let ok = 0;
  let failed = 0;
  let added = 0;

  const one = async (source: ReadingSource) => {
    try {
      let feedUrl = source.feedUrl;
      let entries: FeedEntry[] | null = null;
      let name = source.name;
      if (feedUrl) {
        const parsed = parseArticleUrl(feedUrl);
        const page = parsed ? await (opts.fetcher ?? defaultFetcher)(parsed) : null;
        if (page && page.status < 400 && looksLikeFeed(page.body)) entries = parseFeed(page.body, page.finalUrl);
      }
      if (!entries) {
        const found = await discoverFeed(source.url, opts.fetcher);
        if (!found) {
          failed++;
          await db.update(readingSources).set({ status: "no_feed", lastError: "No RSS or Atom feed found at this address.", lastCheckedAt: now }).where(eq(readingSources.id, source.id));
          return;
        }
        feedUrl = found.feedUrl;
        entries = found.entries;
        name = name || found.title;
      }
      const recent = entries
        .filter((e) => e.title && (!e.publishedAt || e.publishedAt >= since))
        .slice(0, MAX_PER_SOURCE)
        .map((e) => ({ ...e, parsed: parseArticleUrl(e.url) }))
        .filter((e): e is FeedEntry & { parsed: URL } => Boolean(e.parsed));
      const keys = recent.map((e) => normalizeUrl(e.parsed));
      // Not already on the reading list or the shortlist
      const known = keys.length
        ? new Set([
            ...(await db.select({ k: certifications.urlNormalized }).from(certifications).where(inArray(certifications.urlNormalized, keys))).map((r) => r.k),
            ...(await db.select({ k: readingCandidates.urlNormalized }).from(readingCandidates).where(inArray(readingCandidates.urlNormalized, keys))).map((r) => r.k),
          ])
        : new Set<string | null>();
      const rows = recent
        .map((e, i) => ({ e, key: keys[i] }))
        .filter(({ key }) => !known.has(key))
        .map(({ e, key }) => ({ urlNormalized: key, url: cleanUrl(e.parsed), title: e.title, summary: e.summary, publishedAt: e.publishedAt, sourceId: source.id, sourceName: name || e.parsed.hostname.replace(/^www\./, ""), topic: source.topic }));
      if (rows.length) {
        const inserted = await db.insert(readingFeedItems).values(rows).onConflictDoNothing({ target: readingFeedItems.urlNormalized }).returning({ id: readingFeedItems.id });
        added += inserted.length;
      }
      ok++;
      await db.update(readingSources).set({ status: "ok", feedUrl, name, lastError: null, lastCheckedAt: now, lastItemCount: recent.length }).where(eq(readingSources.id, source.id));
    } catch (error) {
      failed++;
      await db
        .update(readingSources)
        .set({ status: "error", lastError: (error instanceof Error ? error.message : String(error)).slice(0, 300), lastCheckedAt: now })
        .where(eq(readingSources.id, source.id));
    }
  };

  const queue = [...sources];
  const workers = Array.from({ length: Math.min(opts.concurrency ?? 4, queue.length) }, async () => {
    for (let s = queue.shift(); s && Date.now() < deadline; s = queue.shift()) await one(s);
  });
  await Promise.all(workers);
  // Forget old items so the table stays small
  await db.delete(readingFeedItems).where(lt(readingFeedItems.createdAt, new Date(now.getTime() - 45 * 86_400_000)));
  return { sources: sources.length, ok, failed, added };
}

/** Starting sources, by topic; the author edits them on Weekly list. Feeds are found automatically. */
export const DEFAULT_SOURCES: Array<{ url: string; name: string; topic: string }> = [
  { url: "https://abnormalreturns.com", name: "Abnormal Returns", topic: "Investments" },
  { url: "https://ofdollarsanddata.com", name: "Of Dollars and Data", topic: "Investments" },
  { url: "https://awealthofcommonsense.com", name: "A Wealth of Common Sense", topic: "Finance" },
  { url: "https://marginalrevolution.com", name: "Marginal Revolution", topic: "Finance" },
  { url: "https://newsletter.pragmaticengineer.com", name: "The Pragmatic Engineer", topic: "Engineering" },
  { url: "https://martinfowler.com", name: "Martin Fowler", topic: "Engineering" },
  { url: "https://stratechery.com", name: "Stratechery", topic: "Technology" },
  { url: "https://www.ben-evans.com", name: "Benedict Evans", topic: "Technology" },
  { url: "https://simonwillison.net", name: "Simon Willison", topic: "Technology" },
  { url: "https://review.firstround.com", name: "First Round Review", topic: "Leadership" },
  { url: "https://leaddev.com", name: "LeadDev", topic: "Leadership" },
];

export async function listSources() {
  return db.select().from(readingSources).orderBy(readingSources.topic, readingSources.createdAt);
}

export async function addSource(input: { url: string; topic: string; name?: string }) {
  const parsed = parseArticleUrl(input.url);
  if (!parsed) throw new Error("Use a web address, like example.com");
  const [row] = await db
    .insert(readingSources)
    .values({ url: parsed.toString(), topic: input.topic.slice(0, 60), name: (input.name ?? "").slice(0, 120) })
    .onConflictDoUpdate({ target: readingSources.url, set: { topic: input.topic.slice(0, 60) } })
    .returning();
  return row;
}

const SEEDED_KEY = "reading_sources_seeded";

/** Add the starting sources once (the author can remove any of them; they don't come back). */
export async function ensureDefaultSources() {
  const [flag] = await db.select({ id: siteSettings.id }).from(siteSettings).where(eq(siteSettings.key, SEEDED_KEY)).limit(1);
  if (flag) return;
  await db.insert(readingSources).values(DEFAULT_SOURCES).onConflictDoNothing({ target: readingSources.url });
  await db.insert(siteSettings).values({ key: SEEDED_KEY, value: true, category: "ai", label: "Weekly list: starting sources added" }).onConflictDoNothing({ target: siteSettings.key });
}

/** Check one source now: find its feed and count recent articles (for the Sources list). */
export async function checkSource(id: string, fetcher?: Fetcher) {
  const [source] = await db.select().from(readingSources).where(eq(readingSources.id, id)).limit(1);
  if (!source) return null;
  const found = await discoverFeed(source.feedUrl ?? source.url, fetcher).catch(() => null);
  const since = Date.now() - FEED_WINDOW_DAYS * 86_400_000;
  const [row] = await db
    .update(readingSources)
    .set(
      found
        ? { status: "ok", feedUrl: found.feedUrl, name: source.name || found.title, lastError: null, lastCheckedAt: new Date(), lastItemCount: found.entries.filter((e) => !e.publishedAt || e.publishedAt.getTime() >= since).length }
        : { status: "no_feed", lastError: "No RSS or Atom feed found at this address.", lastCheckedAt: new Date() }
    )
    .where(eq(readingSources.id, id))
    .returning();
  return row;
}
