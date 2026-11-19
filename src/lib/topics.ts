import { generateSlug } from "@/lib/content/slug";

// Tags shared by Thoughts posts and reading-list articles. A tag keeps the
// author's wording ("Supply chain"); its topic page is addressed by a slug
// ("supply-chain"), so "supply chain", "Supply-Chain" and "#supplychain"-style
// variants that slug the same are the same topic.

export const MAX_TAGS = 8;
export const MAX_TAG_LENGTH = 40;

/** Tidy one tag: no leading #, single spaces, at most 40 characters. */
export function normalizeTag(raw: string): string {
  return raw.trim().replace(/^#+/, "").replace(/\s+/g, " ").trim().slice(0, MAX_TAG_LENGTH).trim();
}

export function topicSlug(tag: string): string {
  return generateSlug(normalizeTag(tag)).slice(0, 60);
}

/** Tidy a list: drop empties and duplicates (by topic), keep the first wording, cap the count. */
export function cleanTags(input: Array<string | null | undefined> | string | null | undefined, max = MAX_TAGS): string[] {
  const list = typeof input === "string" ? input.split(/[,\n]/) : input ?? [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of list) {
    if (typeof raw !== "string") continue;
    const tag = normalizeTag(raw);
    const slug = topicSlug(tag);
    if (!tag || !slug || seen.has(slug)) continue;
    seen.add(slug);
    out.push(tag);
    if (out.length >= max) break;
  }
  return out;
}

export interface TopicCount {
  slug: string;
  label: string;
  posts: number;
  reading: number;
  total: number;
}

/**
 * Count topics across posts and reading items. The label is the wording used
 * most often for that topic (ties: first seen).
 */
export function countTopics(posts: Array<{ tags?: string[] | null }>, reading: Array<{ tags?: string[] | null }>): TopicCount[] {
  const map = new Map<string, { labels: Map<string, number>; posts: number; reading: number }>();
  const add = (tags: string[] | null | undefined, kind: "posts" | "reading") => {
    for (const tag of cleanTags(tags ?? [], 50)) {
      const slug = topicSlug(tag);
      const entry = map.get(slug) ?? { labels: new Map(), posts: 0, reading: 0 };
      entry.labels.set(tag, (entry.labels.get(tag) ?? 0) + 1);
      entry[kind]++;
      map.set(slug, entry);
    }
  };
  posts.forEach((p) => add(p.tags, "posts"));
  reading.forEach((r) => add(r.tags, "reading"));
  return Array.from(map.entries())
    .map(([slug, e]) => {
      let label = "";
      let best = -1;
      e.labels.forEach((n, l) => {
        if (n > best) {
          best = n;
          label = l;
        }
      });
      return { slug, label, posts: e.posts, reading: e.reading, total: e.posts + e.reading };
    })
    .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label));
}

export function hasTopic(tags: string[] | null | undefined, slug: string): boolean {
  return (tags ?? []).some((t) => topicSlug(t) === slug);
}
