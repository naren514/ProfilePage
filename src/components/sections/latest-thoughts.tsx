import { unstable_noStore as noStore } from "next/cache";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { stories } from "@/lib/db/schema";
import { Container, SectionHeader } from "@/components/site/ui";
import { ThoughtList } from "@/components/thoughts/thought-list";

async function getLatest() {
  noStore();
  try {
    return await db
      .select({ id: stories.id, slug: stories.slug, title: stories.title, summary: stories.summary, date: stories.date, tags: stories.tags })
      .from(stories)
      .where(eq(stories.isPublished, true))
      .orderBy(desc(stories.date), desc(stories.createdAt))
      .limit(3);
  } catch {
    return [];
  }
}

/** The three most recent posts; hidden until something is published. */
export async function LatestThoughts() {
  const posts = await getLatest();
  if (posts.length === 0) return null;
  return (
    <section className="py-12 sm:py-16">
      <Container>
        <SectionHeader title="Recent thoughts" description="Notes on building, learning, and the occasional hard-won lesson." href="/thoughts" linkLabel="All posts" className="mb-0" />
        <div className="[&>ol]:border-t-0">
          <ThoughtList posts={posts} />
        </div>
      </Container>
    </section>
  );
}
