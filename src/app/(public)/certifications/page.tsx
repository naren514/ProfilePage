import { Metadata } from "next";
import { unstable_noStore as noStore } from "next/cache";
import { db } from "@/lib/db";
import { certifications } from "@/lib/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import { ArrowUpRight } from "lucide-react";
import { Container, EmptyState, PageHeader, formatMonthYear } from "@/components/site/ui";
import Link from "next/link";
import { ChatWidget } from "@/components/chat/chat-widget";

export const metadata: Metadata = {
  title: "Reading list",
  description: "Articles worth your time, with a short note on each.",
};

// Ensure fresh data on each request
export const dynamic = "force-dynamic";

interface PublicItem {
  id: string;
  title: string;
  source: string;
  url: string | null;
  note: string | null;
  quote: string | null;
  date: string;
}

async function getReadingList(): Promise<PublicItem[]> {
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
      })
      .from(certifications)
      .where(eq(certifications.status, "published"))
      .orderBy(desc(sql`coalesce(${certifications.savedAt}, ${certifications.publishedDate}::timestamp)`))
      .limit(300);
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      source: r.siteName || r.source,
      url: r.url,
      note: r.note,
      quote: r.quote,
      date: r.savedAt ? r.savedAt.toISOString().slice(0, 10) : r.publishedDate,
    }));
  } catch {
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
}

export default async function CertificationsPage() {
  const certList = await getReadingList();

  return (
    <Container size="narrow">
      <PageHeader eyebrow="Reading list" title="Worth your time" description="A curated stream of articles worth sharing, with short notes and excerpts." />

      {certList.length > 0 ? (
        <ol className="border-t">
          {certList.map((item) => {
            const title = <span className="text-balance font-serif text-2xl leading-snug tracking-[-0.01em] sm:text-[1.625rem]">{item.title}</span>;
            return (
              <li key={item.id} className="grid gap-x-10 gap-y-2 border-b py-8 sm:grid-cols-[9rem_minmax(0,1fr)]">
                <div className="pt-1.5 text-sm text-muted-foreground">
                  <time dateTime={item.date} className="tabular-nums">
                    {formatMonthYear(item.date)}
                  </time>
                </div>
                <div className="min-w-0">
                  <p className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{item.source}</p>
                  {item.url ? (
                    <Link href={item.url} target="_blank" rel="noopener noreferrer" className="group inline underline-offset-[6px] decoration-1 hover:underline">
                      {title}
                      <ArrowUpRight className="ml-1 inline h-4 w-4 -translate-y-0.5 text-muted-foreground transition-transform group-hover:-translate-y-1 group-hover:translate-x-0.5" aria-hidden />
                      <span className="sr-only">(opens {item.source} in a new tab)</span>
                    </Link>
                  ) : (
                    title
                  )}
                  {item.quote && (
                    <blockquote className="mt-4 max-w-2xl border-l-2 border-brand/50 pl-4 font-serif text-lg italic leading-relaxed text-foreground/75">{item.quote}</blockquote>
                  )}
                  {item.note && <p className="mt-3 max-w-2xl text-pretty leading-relaxed text-muted-foreground">{item.note}</p>}
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <EmptyState>The reading list is empty for now.</EmptyState>
      )}
      <ChatWidget />
    </Container>
  );
}
