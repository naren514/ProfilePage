import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { certifications, type ReadingItem } from "@/lib/db/schema";
import { removeEntityFromRAG, syncEntityToRAG } from "@/lib/rag/sync";
import { parseArticleHtml, withFallbacks, type ArticleMetadata } from "./metadata";
import { suggestNote } from "./note";
import { safeFetchPage } from "./safe-fetch";
import { cleanTags } from "@/lib/topics";
import { knownTopicLabels } from "@/lib/topics-data";
import { hasEnoughDetail, NOT_ENOUGH, noteOnPublish } from "./rules";
import { cleanUrl, firstUrlIn, normalizeUrl, parseArticleUrl } from "./url";

export type ReadingStatus = "inbox" | "published" | "archived";
export type SavedVia = "shortcut" | "bookmarklet" | "admin";

export class ReadingInputError extends Error {}

const today = () => new Date().toISOString().slice(0, 10);



/** Short links that hide the article behind an interstitial page. */
function isInterstitial(url: URL): boolean {
  return url.hostname === "lnkd.in" || url.hostname === "t.co" || (url.hostname.endsWith("linkedin.com") && url.pathname.startsWith("/redir"));
}

/** The first outbound link on an interstitial page (LinkedIn's "you're leaving" page). */
function outboundLink(html: string, from: URL): URL | null {
  for (const m of Array.from(html.matchAll(/href=["'](https?:\/\/[^"']+)["']/gi))) {
    const candidate = parseArticleUrl(m[1].replace(/&amp;/g, "&"));
    if (candidate && candidate.hostname !== from.hostname && !/linkedin\.com|licdn\.com|lnkd\.in/.test(candidate.hostname)) return candidate;
  }
  return null;
}

export interface Resolved {
  url: URL;
  meta: ArticleMetadata;
  fetched: boolean;
}

/** Follow the link and read the article's details; falls back to what was shared. */
export async function resolveArticle(input: URL, shared: { title?: string | null; text?: string | null }): Promise<Resolved> {
  let url = input;
  try {
    let page = await safeFetchPage(url);
    let finalUrl = new URL(page.finalUrl);
    if (isInterstitial(finalUrl)) {
      const out = outboundLink(page.body, finalUrl);
      if (out) {
        url = out;
        page = await safeFetchPage(out);
        finalUrl = new URL(page.finalUrl);
      }
    }
    if (page.status >= 400 || !/html|xml/i.test(page.contentType || "text/html")) {
      return { url: isInterstitial(finalUrl) ? url : finalUrl, meta: withFallbacks({}, finalUrl, shared), fetched: false };
    }
    const meta = parseArticleHtml(page.body, finalUrl);
    // Prefer the canonical address when it is on the same site
    let best = finalUrl;
    if (meta.canonicalUrl) {
      const canonical = parseArticleUrl(meta.canonicalUrl);
      if (canonical && canonical.hostname.replace(/^www\./, "") === finalUrl.hostname.replace(/^www\./, "")) best = canonical;
    }
    return { url: best, meta: withFallbacks(meta, best, shared), fetched: true };
  } catch {
    return { url, meta: withFallbacks({}, url, shared), fetched: false };
  }
}

export interface SaveInput {
  url?: string | null;
  /** The title the share sheet or browser sent; used when the page gives none. */
  title?: string | null;
  /** A title the author typed; wins over the page's own. */
  titleOverride?: string | null;
  text?: string | null;
  quote?: string | null;
  note?: string | null;
  /** A suggestion already generated (the bookmarklet popup shows it first). */
  suggestedNote?: string | null;
  publish?: boolean;
  /** Topics the author chose (applied as given). */
  tags?: string[] | string | null;
  /** Topic suggestions already shown in the popup. */
  suggestedTags?: string[] | null;
  via: SavedVia;
  /** Generate an AI note suggestion when there isn't one (default true). */
  suggest?: boolean;
}

export interface SaveResult {
  item: ReadingItem;
  created: boolean;
  suggestion: { ok: boolean; reason?: string } | null;
}

const blank = (v: string | null | undefined) => {
  const t = v?.trim();
  return t ? t : null;
};

function publicFields(status: ReadingStatus) {
  return { status, isPublished: status === "published" };
}

/**
 * Save an article to the reading list. The same article saved again updates
 * the existing entry. "Publish now" publishes with the author's own note only:
 * an AI suggestion is never made public without the author choosing it.
 */
export async function saveArticle(input: SaveInput): Promise<SaveResult> {
  const raw = blank(input.url) ?? firstUrlIn(input.text);
  const parsed = raw ? parseArticleUrl(raw) : null;
  if (!parsed) throw new ReadingInputError("No link found. Share or paste the article's web address.");

  const resolved = await resolveArticle(parsed, { title: input.title, text: input.text });
  const articleUrl = cleanUrl(resolved.url);
  const key = normalizeUrl(resolved.url);
  const meta = resolved.meta;
  const title = blank(input.titleOverride) ?? meta.title ?? articleUrl;
  const note = noteOnPublish(input.note, input.suggestedNote);
  const quote = blank(input.quote);
  const tags = cleanTags(input.tags);

  const [existing] = await db.select().from(certifications).where(eq(certifications.urlNormalized, key)).limit(1);

  let item: ReadingItem;
  let created = false;
  if (existing) {
    const status: ReadingStatus = input.publish ? "published" : existing.status === "archived" ? "inbox" : (existing.status as ReadingStatus);
    [item] = await db
      .update(certifications)
      .set({
        ...publicFields(status),
        ...(blank(input.titleOverride) ? { articleTitle: blank(input.titleOverride)!.slice(0, 300) } : {}),
        note: note ?? existing.note,
        quote: quote ?? existing.quote,
        tags: tags.length ? cleanTags([...(existing.tags ?? []), ...tags]) : existing.tags,
        suggestedNote: blank(input.suggestedNote) ?? existing.suggestedNote,
        suggestedTags: input.suggestedTags?.length ? cleanTags(input.suggestedTags, 3) : existing.suggestedTags,
        imageUrl: existing.imageUrl ?? meta.imageUrl,
        author: existing.author ?? meta.author,
        excerpt: existing.excerpt ?? meta.description,
        savedAt: new Date(),
      })
      .where(eq(certifications.id, existing.id))
      .returning();
  } else {
    created = true;
    const status: ReadingStatus = input.publish ? "published" : "inbox";
    [item] = await db
      .insert(certifications)
      .values({
        ...publicFields(status),
        articleTitle: title.slice(0, 300),
        source: (meta.siteName ?? resolved.url.hostname).slice(0, 200),
        siteName: meta.siteName,
        author: meta.author,
        excerpt: meta.description,
        articleUrl,
        urlNormalized: key,
        publishedDate: meta.publishedDate ?? today(),
        imageUrl: meta.imageUrl,
        note,
        quote,
        suggestedNote: blank(input.suggestedNote),
        tags,
        suggestedTags: cleanTags(input.suggestedTags ?? [], 3),
        savedVia: input.via,
        savedAt: new Date(),
      })
      .returning();
  }

  let suggestion: SaveResult["suggestion"] = null;
  if (input.suggest !== false && !item.suggestedNote && !item.note && !hasEnoughDetail({ fetched: resolved.fetched, description: item.excerpt, quote: item.quote })) {
    suggestion = { ok: false, reason: NOT_ENOUGH };
  } else if (input.suggest !== false && !item.suggestedNote && !item.note) {
    const existingTopics = await knownTopicLabels().catch(() => []);
    const result = await suggestNote({ title: item.articleTitle, siteName: item.siteName ?? item.source, author: item.author, description: item.excerpt, quote: item.quote, url: articleUrl, existingTopics }).catch(() => ({ ok: false as const, reason: "The note suggestion failed." }));
    if (result.ok) {
      [item] = await db.update(certifications).set({ suggestedNote: result.note, suggestedTags: result.tags }).where(eq(certifications.id, item.id)).returning();
      suggestion = { ok: true };
    } else {
      suggestion = { ok: false, reason: result.reason };
    }
  }

  syncRag(item);
  // Agent triggers on "an article was saved" (A1); never blocks or fails the save
  if (created) {
    void import("@/lib/agent/triggers")
      .then(({ emitEvent }) => emitEvent("reading.saved", { key: item.id, vars: { itemId: item.id } }))
      .catch((e) => console.error("reading.saved event failed:", e));
  }
  return { item, created, suggestion };
}

/** Keep the public chatbot's knowledge in step (published items only). Never blocks. */
function syncRag(item: ReadingItem) {
  syncEntityToRAG("certification", item).catch((err) => console.error("RAG sync failed for reading item:", err));
}

export async function listItems(status: ReadingStatus) {
  return db
    .select()
    .from(certifications)
    .where(eq(certifications.status, status))
    .orderBy(desc(sql`coalesce(${certifications.savedAt}, ${certifications.createdAt})`))
    .limit(500);
}

export async function countByStatus(): Promise<Record<ReadingStatus, number>> {
  const rows = await db.select({ status: certifications.status, n: sql<number>`count(*)::int` }).from(certifications).groupBy(certifications.status);
  const out: Record<ReadingStatus, number> = { inbox: 0, published: 0, archived: 0 };
  for (const r of rows) if (r.status in out) out[r.status as ReadingStatus] = r.n;
  return out;
}

export interface ItemPatch {
  title?: string;
  source?: string;
  note?: string | null;
  quote?: string | null;
  status?: ReadingStatus;
  suggestedNote?: string | null;
  tags?: string[];
  suggestedTags?: string[];
  forThisWeek?: true;
}

export async function updateItem(id: string, patch: ItemPatch): Promise<ReadingItem | null> {
  const values: Partial<typeof certifications.$inferInsert> = {};
  if (patch.title !== undefined) values.articleTitle = patch.title;
  if (patch.source !== undefined) {
    values.source = patch.source;
    values.siteName = patch.source;
  }
  if (patch.note !== undefined) values.note = blank(patch.note);
  if (patch.quote !== undefined) values.quote = blank(patch.quote);
  if (patch.suggestedNote !== undefined) values.suggestedNote = blank(patch.suggestedNote);
  if (patch.tags !== undefined) values.tags = cleanTags(patch.tags);
  if (patch.suggestedTags !== undefined) values.suggestedTags = cleanTags(patch.suggestedTags, 3);
  if (patch.status) Object.assign(values, publicFields(patch.status));
  if (patch.forThisWeek) values.savedAt = new Date();
  if (Object.keys(values).length === 0) {
    const [row] = await db.select().from(certifications).where(eq(certifications.id, id)).limit(1);
    return row ?? null;
  }
  const [row] = await db.update(certifications).set(values).where(eq(certifications.id, id)).returning();
  if (row) syncRag(row);
  return row ?? null;
}

export async function deleteItem(id: string): Promise<boolean> {
  const rows = await db.delete(certifications).where(and(eq(certifications.id, id))).returning({ id: certifications.id });
  if (rows.length) removeEntityFromRAG("certification", id).catch(() => {});
  return rows.length > 0;
}

export async function getItem(id: string): Promise<ReadingItem | null> {
  const [row] = await db.select().from(certifications).where(eq(certifications.id, id)).limit(1);
  return row ?? null;
}

/** Regenerate the AI note suggestion for an item. */
export async function regenerateSuggestion(id: string) {
  const item = await getItem(id);
  if (!item) return null;
  if (!hasEnoughDetail({ fetched: Boolean(item.author || item.imageUrl), description: item.excerpt, quote: item.quote })) return { item, error: NOT_ENOUGH };
  const result = await suggestNote({
    title: item.articleTitle,
    siteName: item.siteName ?? item.source,
    author: item.author,
    description: item.excerpt,
    quote: item.quote,
    url: item.articleUrl ?? "",
    existingTopics: await knownTopicLabels().catch(() => []),
  });
  if (!result.ok) return { item, error: result.reason };
  const [row] = await db.update(certifications).set({ suggestedNote: result.note, suggestedTags: result.tags }).where(eq(certifications.id, id)).returning();
  return { item: row, error: null };
}

/** Details and a note suggestion for the bookmarklet popup, without saving anything. */
export async function previewArticle(input: { url?: string | null; title?: string | null; text?: string | null; quote?: string | null }) {
  const raw = blank(input.url) ?? firstUrlIn(input.text);
  const parsed = raw ? parseArticleUrl(raw) : null;
  if (!parsed) throw new ReadingInputError("No link found. Share or paste the article's web address.");
  const resolved = await resolveArticle(parsed, { title: input.title, text: input.text });
  const articleUrl = cleanUrl(resolved.url);
  const [existing] = await db.select().from(certifications).where(eq(certifications.urlNormalized, normalizeUrl(resolved.url))).limit(1);
  const suggestion =
    existing?.suggestedNote || existing?.note
      ? null
      : !hasEnoughDetail({ fetched: resolved.fetched, description: resolved.meta.description, quote: blank(input.quote) })
      ? { ok: false as const, reason: NOT_ENOUGH }
      : await suggestNote({ title: resolved.meta.title ?? articleUrl, siteName: resolved.meta.siteName, author: resolved.meta.author, description: resolved.meta.description, quote: blank(input.quote), url: articleUrl, existingTopics: await knownTopicLabels().catch(() => []) }).catch(() => ({ ok: false as const, reason: "The note suggestion failed." }));
  return {
    url: articleUrl,
    meta: resolved.meta,
    fetched: resolved.fetched,
    existing: existing ? { id: existing.id, status: existing.status, note: existing.note, suggestedNote: existing.suggestedNote, tags: existing.tags ?? [] } : null,
    suggestedNote: suggestion && suggestion.ok ? suggestion.note : existing?.suggestedNote ?? null,
    suggestedTags: suggestion && suggestion.ok ? suggestion.tags : existing?.suggestedTags ?? [],
    suggestionError: suggestion && !suggestion.ok ? suggestion.reason : null,
  };
}
