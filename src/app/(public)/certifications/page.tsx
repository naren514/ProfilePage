import { Metadata } from "next";
import { unstable_noStore as noStore } from "next/cache";
import { db } from "@/lib/db";
import { certifications } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { ArrowUpRight } from "lucide-react";
import { Container, EmptyState, PageHeader, formatMonthYear } from "@/components/site/ui";
import Link from "next/link";
import { ChatWidget } from "@/components/chat/chat-widget";

export const metadata: Metadata = {
  title: "Reading List",
  description: "Interesting online articles and curated reading notes.",
};

// Ensure fresh data on each request
export const dynamic = "force-dynamic";

async function getCertifications() {
  noStore();
  try {
    return await db
      .select()
      .from(certifications)
      .where(eq(certifications.isPublished, true))
      .orderBy(desc(certifications.publishedDate));
  } catch (error) {
    console.error("Error fetching certifications:", error);
    return [];
  }
}

export default async function CertificationsPage() {
  const certList = await getCertifications();

  return (
    <Container size="narrow">
      <PageHeader eyebrow="Reading list" title="Worth your time" description="A curated stream of articles worth sharing, with short notes and excerpts." />

      {certList.length > 0 ? (
        <ol className="border-t">
          {certList.map((item) => {
            const title = <span className="text-balance font-serif text-2xl leading-snug tracking-[-0.01em] sm:text-[1.625rem]">{item.articleTitle}</span>;
            return (
              <li key={item.id} className="grid gap-x-10 gap-y-2 border-b py-8 sm:grid-cols-[9rem_minmax(0,1fr)]">
                <div className="pt-1.5 text-sm text-muted-foreground">
                  <time dateTime={item.publishedDate} className="tabular-nums">
                    {formatMonthYear(item.publishedDate)}
                  </time>
                </div>
                <div className="min-w-0">
                  <p className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{item.source}</p>
                  {item.articleUrl ? (
                    <Link href={item.articleUrl} target="_blank" rel="noopener noreferrer" className="group inline underline-offset-[6px] decoration-1 hover:underline">
                      {title}
                      <ArrowUpRight className="ml-1 inline h-4 w-4 -translate-y-0.5 text-muted-foreground transition-transform group-hover:-translate-y-1 group-hover:translate-x-0.5" aria-hidden />
                      <span className="sr-only">(opens {item.source} in a new tab)</span>
                    </Link>
                  ) : (
                    title
                  )}
                  {item.excerpt && <p className="mt-3 max-w-2xl text-pretty leading-relaxed text-muted-foreground">{item.excerpt}</p>}
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
