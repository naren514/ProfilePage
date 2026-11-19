import { desc, eq, sql } from "drizzle-orm";
import { unstable_noStore as noStore } from "next/cache";
import { db } from "@/lib/db";
import { certifications, stories } from "@/lib/db/schema";
import { cleanTags, countTopics, hasTopic, topicSlug, type TopicCount } from "./topics";

// Server-side topic queries for the public site (published content only).

export interface TopicPost {
  id: string;
  slug: string;
  title: string;
  summary: string;
  date: string | null;
  tags: string[] | null;
}

export interface TopicReading {
  id: string;
  title: string;
  source: string;
  url: string | null;
  note: string | null;
  quote: string | null;
  date: string;
  tags: string[];
}

export async function publishedPosts(): Promise<TopicPost[]> {
  noStore();
  return db
    .select({ id: stories.id, slug: stories.slug, title: stories.title, summary: stories.summary, date: stories.date, tags: stories.tags })
    .from(stories)
    .where(eq(stories.isPublished, true))
    .orderBy(desc(stories.date), desc(stories.createdAt))
    .catch(() => []);
}

/** Published reading items; null when the reading-list update hasn't run yet. */
export async function publishedReading(): Promise<TopicReading[] | null> {
  noStore();
  try {
    const rows = await db
      .select({
        id: certifications.id,
        title: certifications.articleTitle,
        source: certifications.source,
        siteName: certifications.siteName,
        url: certifications.articleUrl,
        note: certifications.note,
        quote: certifications.quote,
        publishedDate: certifications.publishedDate,
        savedAt: certifications.savedAt,
        tags: certifications.tags,
      })
      .from(certifications)
      .where(eq(certifications.status, "published"))
      .orderBy(desc(sql`coalesce(${certifications.savedAt}, ${certifications.publishedDate}::timestamp)`))
      .limit(500);
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      source: r.siteName || r.source,
      url: r.url,
      note: r.note,
      quote: r.quote,
      date: r.savedAt ? r.savedAt.toISOString().slice(0, 10) : r.publishedDate,
      tags: r.tags ?? [],
    }));
  } catch {
    return null;
  }
}

export async function allTopics(): Promise<TopicCount[]> {
  const [posts, reading] = await Promise.all([publishedPosts(), publishedReading()]);
  return countTopics(posts, reading ?? []);
}

export async function topicBySlug(slug: string) {
  const [posts, reading] = await Promise.all([publishedPosts(), publishedReading()]);
  const topic = countTopics(posts, reading ?? []).find((t) => t.slug === slug);
  if (!topic) return null;
  const related = countTopics(
    posts.filter((p) => hasTopic(p.tags, slug)),
    (reading ?? []).filter((r) => hasTopic(r.tags, slug))
  )
    .filter((t) => t.slug !== slug)
    .slice(0, 8);
  return {
    topic,
    posts: posts.filter((p) => hasTopic(p.tags, slug)),
    reading: (reading ?? []).filter((r) => hasTopic(r.tags, slug)),
    related,
  };
}

/** Every topic wording in use (posts and all reading items), for the admin's suggestions. */
export async function knownTopicLabels(): Promise<string[]> {
  noStore();
  const [posts, reading] = await Promise.all([
    db.select({ tags: stories.tags }).from(stories).catch(() => []),
    db.select({ tags: certifications.tags }).from(certifications).catch(() => []),
  ]);
  return countTopics(posts, reading).map((t) => t.label);
}

export { cleanTags, topicSlug };
