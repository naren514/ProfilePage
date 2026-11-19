import Link from "next/link";
import { Metadata } from "next";
import { Container, EmptyState, PageHeader } from "@/components/site/ui";
import { allTopics } from "@/lib/topics-data";

export const metadata: Metadata = {
  title: "Topics",
  description: "Writing and reading, grouped by topic.",
};

export const dynamic = "force-dynamic";

function counts(posts: number, reading: number) {
  return [posts && `${posts} ${posts === 1 ? "post" : "posts"}`, reading && `${reading} ${reading === 1 ? "article" : "articles"}`].filter(Boolean).join(" · ");
}

export default async function TopicsPage() {
  const topics = await allTopics();
  const max = Math.max(1, ...topics.map((t) => t.total));

  return (
    <Container size="narrow">
      <PageHeader eyebrow="Topics" title="Browse by topic" description="My writing and the articles I recommend, grouped by what they're about." />
      {topics.length === 0 ? (
        <EmptyState>No topics yet.</EmptyState>
      ) : (
        <ul className="grid grid-cols-1 border-t sm:grid-cols-2 sm:gap-x-10" aria-label="All topics">
          {topics.map((t) => (
            <li key={t.slug} className="border-b">
              <Link href={`/topics/${t.slug}`} className="group flex items-baseline justify-between gap-4 py-5">
                <span className="font-serif text-2xl leading-tight underline-offset-[6px] decoration-1 group-hover:underline">{t.label}</span>
                <span className="flex shrink-0 items-center gap-3 text-sm text-muted-foreground">
                  {counts(t.posts, t.reading)}
                  <span className="hidden h-1 w-12 overflow-hidden rounded-full bg-muted sm:block" aria-hidden>
                    <span className="block h-full rounded-full bg-brand/60" style={{ width: `${Math.max(12, (t.total / max) * 100)}%` }} />
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Container>
  );
}
