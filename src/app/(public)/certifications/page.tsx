import { Metadata } from "next";
import { db } from "@/lib/db";
import { certifications } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { ArrowLink, Container, EmptyState, PageHeader } from "@/components/site/ui";
import { TopicBar } from "@/components/site/topics";
import { PublicReadingList, type PublicReadingItem } from "@/components/reading/public-reading-list";
import { countTopics } from "@/lib/topics";
import { publishedReading } from "@/lib/topics-data";
import { ChatWidget } from "@/components/chat/chat-widget";
import { weeklyLists, weekLabel } from "@/lib/reading/shortlist";

export const metadata: Metadata = {
  title: "Reading list",
  description: "Articles worth your time, with a short note on each.",
};

// Ensure fresh data on each request
export const dynamic = "force-dynamic";

async function getReadingList(): Promise<PublicReadingItem[]> {
  const items = await publishedReading();
  if (items) return items;
  // Before the reading-list update has run: the original columns only
  try {
    const rows = await db
      .select({ id: certifications.id, title: certifications.articleTitle, source: certifications.source, url: certifications.articleUrl, excerpt: certifications.excerpt, publishedDate: certifications.publishedDate })
      .from(certifications)
      .where(eq(certifications.isPublished, true))
      .orderBy(desc(certifications.publishedDate));
    return rows.map((r) => ({ id: r.id, title: r.title, source: r.source, url: r.url, note: r.excerpt, quote: null, date: r.publishedDate }));
  } catch (error) {
    console.error("Error fetching the reading list:", error);
    return [];
  }
}

async function latestWeekly() {
  try {
    return (await weeklyLists(1))[0] ?? null;
  } catch {
    return null; // before the database update has run
  }
}

export default async function CertificationsPage() {
  const [items, weekly] = await Promise.all([getReadingList(), latestWeekly()]);
  const topics = countTopics([], items);

  return (
    <Container size="narrow">
      <PageHeader eyebrow="Reading list" title="Worth your time" description="A curated stream of articles worth sharing, with short notes and excerpts." />
      {weekly && (
        <aside className="mb-10 rounded-2xl border px-6 py-5">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">This week&apos;s list · {weekLabel(weekly.week)}</p>
          <p className="mt-2 font-serif text-xl">{weekly.title || `${weekly.picks.length} pieces worth your time`}</p>
          <ArrowLink href={`/reading/weekly/${weekly.week}`} className="mt-3">
            Read the list
          </ArrowLink>
        </aside>
      )}
      <TopicBar topics={topics} />
      {items.length > 0 ? <PublicReadingList items={items} /> : <EmptyState>The reading list is empty for now.</EmptyState>}
      <ChatWidget />
    </Container>
  );
}
