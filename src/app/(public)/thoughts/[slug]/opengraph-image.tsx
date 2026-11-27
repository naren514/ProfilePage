import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { stories } from "@/lib/db/schema";
import { OG_SIZE, shareCard } from "@/lib/og-card";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Share card for a post";

export default async function Image({ params }: { params: Promise<{ slug: string }> | { slug: string } }) {
  const { slug } = await Promise.resolve(params);
  const [post] = await db
    .select({ title: stories.title, summary: stories.summary, date: stories.date })
    .from(stories)
    .where(and(eq(stories.slug, slug), eq(stories.isPublished, true)))
    .limit(1)
    .catch(() => []);
  const when = post?.date ? new Date(post.date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }) : undefined;
  return shareCard({ eyebrow: "Thoughts", title: post?.title ?? "Thoughts", lines: post?.summary ? [post.summary] : [], footer: when });
}
