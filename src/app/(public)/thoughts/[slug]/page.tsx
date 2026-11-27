import { ReadingProgress } from "@/components/site/reading-progress";
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
  return {
    title: story.title,
    description: story.summary,
    alternates: { canonical: `https://narenc.com/thoughts/${story.slug}` },
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
