import { siteNameFromUrl } from "./url";

// Read an article's title, source, date, author, description and image from
// its HTML <head>. Pure (no I/O) so it can be unit tested against fixtures.

export interface ArticleMetadata {
  title: string | null;
  siteName: string | null;
  description: string | null;
  imageUrl: string | null;
  author: string | null;
  /** YYYY-MM-DD */
  publishedDate: string | null;
  canonicalUrl: string | null;
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", mdash: "—", ndash: "–", hellip: "…", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“" };

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, code: string) => {
    if (code[0] === "#") {
      const n = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m;
    }
    return ENTITIES[code.toLowerCase()] ?? m;
  });
}

function clean(value: string | null | undefined, max = 500): string | null {
  if (!value) return null;
  const text = decodeEntities(value.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
  return text ? text.slice(0, max) : null;
}

function attrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of Array.from(tag.matchAll(/([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g))) {
    out[m[1].toLowerCase()] = m[3] ?? m[4] ?? m[5] ?? "";
  }
  return out;
}

function toDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(value.trim());
  if (Number.isNaN(d.getTime())) return null;
  const year = d.getUTCFullYear();
  if (year < 1990 || d.getTime() > Date.now() + 86_400_000 * 2) return null;
  return d.toISOString().slice(0, 10);
}

function absolute(value: string | null, base: URL): string | null {
  if (!value) return null;
  try {
    const url = new URL(decodeEntities(value.trim()), base);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

interface JsonLdArticle {
  headline?: string;
  name?: string;
  datePublished?: string;
  author?: unknown;
  publisher?: { name?: string };
  image?: unknown;
  description?: string;
}

function jsonLdArticles(html: string): JsonLdArticle[] {
  const out: JsonLdArticle[] = [];
  for (const m of Array.from(html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi))) {
    try {
      const parsed = JSON.parse(m[1].trim());
      const queue: unknown[] = Array.isArray(parsed) ? parsed : [parsed];
      while (queue.length) {
        const item = queue.shift() as Record<string, unknown> | null;
        if (!item || typeof item !== "object") continue;
        if (Array.isArray(item["@graph"])) queue.push(...(item["@graph"] as unknown[]));
        const type = ([] as unknown[]).concat(item["@type"] ?? []).map(String);
        if (type.some((t) => /Article|BlogPosting|Report|NewsArticle|WebPage/i.test(t))) out.push(item as JsonLdArticle);
      }
    } catch {
      // ignore broken JSON-LD
    }
  }
  return out;
}

function personName(author: unknown): string | null {
  if (!author) return null;
  if (typeof author === "string") return author;
  if (Array.isArray(author)) return author.map(personName).filter(Boolean).slice(0, 3).join(", ") || null;
  if (typeof author === "object" && "name" in (author as object)) return String((author as { name: unknown }).name);
  return null;
}

function imageOf(image: unknown): string | null {
  if (!image) return null;
  if (typeof image === "string") return image;
  if (Array.isArray(image)) return imageOf(image[0]);
  if (typeof image === "object" && "url" in (image as object)) return String((image as { url: unknown }).url);
  return null;
}

export function parseArticleHtml(html: string, pageUrl: URL): ArticleMetadata {
  const head = html.slice(0, 400_000);
  const meta: Record<string, string> = {};
  for (const m of Array.from(head.matchAll(/<meta\b[^>]*>/gi))) {
    const a = attrs(m[0]);
    const key = (a.property || a.name || a.itemprop || "").toLowerCase();
    if (key && a.content !== undefined && !(key in meta)) meta[key] = a.content;
  }
  let canonical: string | null = null;
  for (const m of Array.from(head.matchAll(/<link\b[^>]*>/gi))) {
    const a = attrs(m[0]);
    if ((a.rel || "").toLowerCase().split(/\s+/).includes("canonical") && a.href) {
      canonical = a.href;
      break;
    }
  }
  const titleTag = head.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? null;
  const ld = jsonLdArticles(head)[0];

  const siteName = clean(meta["og:site_name"] || meta["application-name"] || ld?.publisher?.name, 120);
  let title = clean(meta["og:title"] || meta["twitter:title"] || ld?.headline || ld?.name || titleTag, 300);
  // "Article title | Site" → "Article title" when the site name is known
  if (title && siteName) {
    const stripped = title.replace(new RegExp(`\\s*[|\\-–—:·]\\s*${siteName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "i"), "");
    if (stripped.length >= 8) title = stripped;
  }

  return {
    title,
    siteName,
    description: clean(meta["og:description"] || meta["twitter:description"] || meta["description"] || ld?.description, 600),
    imageUrl: absolute(meta["og:image:secure_url"] || meta["og:image"] || meta["twitter:image"] || meta["twitter:image:src"] || imageOf(ld?.image), pageUrl),
    author: clean(meta["author"] || meta["article:author"] || meta["twitter:creator"] || personName(ld?.author), 160)?.replace(/^https?:\/\/\S+$/, "") || null,
    publishedDate: toDate(meta["article:published_time"] || meta["og:published_time"] || meta["date"] || meta["pubdate"] || meta["publish-date"] || meta["dc.date"] || ld?.datePublished),
    canonicalUrl: absolute(canonical || meta["og:url"] || null, pageUrl),
  };
}

/** Fill gaps from what the share sheet sent and the domain. */
export function withFallbacks(meta: Partial<ArticleMetadata>, url: URL, shared: { title?: string | null; text?: string | null }): ArticleMetadata {
  const sharedTitle = clean(shared.title, 300) || clean(shared.text?.replace(/https?:\/\/\S+/g, ""), 300);
  return {
    title: meta.title || sharedTitle || url.hostname + url.pathname.replace(/\/$/, ""),
    siteName: meta.siteName || siteNameFromUrl(url),
    description: meta.description ?? null,
    imageUrl: meta.imageUrl ?? null,
    author: meta.author ?? null,
    publishedDate: meta.publishedDate ?? null,
    canonicalUrl: meta.canonicalUrl ?? null,
  };
}
