import { Metadata } from "next";
import { unstable_noStore as noStore } from "next/cache";
import { db } from "@/lib/db";
import { stories } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { Container, EmptyState, PageHeader } from "@/components/site/ui";
import { ThoughtList } from "@/components/thoughts/thought-list";
import { TopicBar } from "@/components/site/topics";
import { countTopics } from "@/lib/topics";
import { ChatWidget } from "@/components/chat/chat-widget";

export const metadata: Metadata = {
  title: "Thoughts",
  description: "Personal writing, reflections, and ideas.",
  alternates: { types: { "application/rss+xml": [{ url: "/thoughts/rss.xml", title: "Thoughts" }] } },
};

export const dynamic = "force-dynamic";

async function getThoughts() {
  noStore();
  try {
    return await db
      .select()
      .from(stories)
      .where(eq(stories.isPublished, true))
      .orderBy(desc(stories.date), desc(stories.createdAt));
  } catch {
    return [];
  }
}

export default async function ThoughtsPage() {
  const thoughtList = await getThoughts();

  return (
    <Container size="narrow">
      <PageHeader
        eyebrow={thoughtList.length > 0 ? `${thoughtList.length} ${thoughtList.length === 1 ? "post" : "posts"}` : "Writing"}
        title="Thoughts"
        description="Notes on building, learning, and the occasional hard-won lesson."
      />
      <TopicBar topics={countTopics(thoughtList, [])} />
      {thoughtList.length > 0 ? <ThoughtList posts={thoughtList} /> : <EmptyState>Nothing published yet. Check back soon.</EmptyState>}
      {thoughtList.length > 0 && (
        <p className="pt-10 text-sm text-muted-foreground">
          Follow new posts with a feed reader:{" "}
          <a href="/thoughts/rss.xml" className="underline underline-offset-4">
            RSS
          </a>
        </p>
      )}
      <ChatWidget />
    </Container>
  );
}
