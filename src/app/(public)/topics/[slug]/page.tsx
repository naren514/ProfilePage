import Link from "next/link";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Container, PageHeader, SectionHeader } from "@/components/site/ui";
import { TopicBar } from "@/components/site/topics";
import { ThoughtList } from "@/components/thoughts/thought-list";
import { PublicReadingList } from "@/components/reading/public-reading-list";
import { topicBySlug } from "@/lib/topics-data";

export const dynamic = "force-dynamic";

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export async function generateMetadata(props: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const params = await props.params;
  const data = SLUG.test(params.slug) ? await topicBySlug(params.slug) : null;
  if (!data) return { title: "Topic not found" };
  return {
    title: data.topic.label,
    description: `Posts and recommended reading about ${data.topic.label}.`,
    alternates: { canonical: `https://narenc.com/topics/${data.topic.slug}` },
  };
}

export default async function TopicPage(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const data = SLUG.test(params.slug) ? await topicBySlug(params.slug) : null;
  if (!data) notFound();
  const { topic, posts, reading, related } = data;
  const parts = [posts.length && `${posts.length} ${posts.length === 1 ? "post" : "posts"}`, reading.length && `${reading.length} recommended ${reading.length === 1 ? "article" : "articles"}`].filter(Boolean);

  return (
    <Container size="narrow">
      <div className="pt-10 sm:pt-14">
        <Link href="/topics" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          All topics
        </Link>
      </div>
      <PageHeader eyebrow="Topic" title={topic.label} description={parts.join(" and ") + "."} className="pt-10 sm:pt-14" />

      {posts.length > 0 && (
        <section className="mb-16">
          <SectionHeader title="From my writing" className="mb-0" />
          <div className="[&>ol]:border-t-0">
            <ThoughtList posts={posts} />
          </div>
        </section>
      )}

      {reading.length > 0 && (
        <section className="mb-16">
          <SectionHeader title="Worth reading" className="mb-0" />
          <div className="[&>ol]:border-t-0">
            <PublicReadingList items={reading} />
          </div>
        </section>
      )}

      {related.length > 0 && <TopicBar topics={related} label="Related topics" max={8} />}
    </Container>
  );
}
