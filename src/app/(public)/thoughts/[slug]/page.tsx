import { ReadingProgress } from "@/components/site/reading-progress";
import { SITE_NAME, siteUrl } from "@/lib/site";
import { notFound } from "next/navigation";
import { Metadata } from "next";
import { unstable_noStore as noStore } from "next/cache";
import { db } from "@/lib/db";
import { stories } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { sanitizePostHtml } from "@/lib/content/sanitize";
import { ThoughtArticle } from "@/components/thoughts/thought-article";

export const dynamic = "force-dynamic";

async function getThought(slug: string) {
  noStore();
  const [story] = await db
    .select()
    .from(stories)
    .where(and(eq(stories.slug, slug), eq(stories.isPublished, true)))
    .limit(1);

  return story || null;
}

export async function generateMetadata(props: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const params = await props.params;
  const story = await getThought(params.slug);
  if (!story) return { title: "Thought not found" };
  const url = siteUrl(`/thoughts/${story.slug}`);
  return {
    title: story.title,
    description: story.summary,
    alternates: { canonical: url },
    openGraph: { type: "article", url, title: story.title, description: story.summary, siteName: SITE_NAME, publishedTime: story.date ?? undefined },
    twitter: { card: "summary_large_image", title: story.title, description: story.summary },
  };
}

export default async function ThoughtDetailPage(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const story = await getThought(params.slug);
  if (!story) return notFound();

  return (
    <div className="pb-8">
      <ReadingProgress />
      <ThoughtArticle post={{ ...story, html: sanitizePostHtml(story.action) }} />
    </div>
  );
}
