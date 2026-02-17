import Link from "next/link";
import { notFound } from "next/navigation";
import { Metadata } from "next";
import { unstable_noStore as noStore } from "next/cache";
import { db } from "@/lib/db";
import { stories } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Calendar } from "lucide-react";

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

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const story = await getThought(params.slug);
  if (!story) return { title: "Thought not found" };
  return {
    title: story.title,
    description: story.summary,
  };
}

function formatDate(date: string | null) {
  if (!date) return "";
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function ThoughtDetailPage({ params }: { params: { slug: string } }) {
  const story = await getThought(params.slug);
  if (!story) return notFound();

  return (
    <div className="pt-24 pb-20">
      <article className="mx-auto max-w-3xl px-6 lg:px-8">
        <Link href="/volunteer" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8">
          <ArrowLeft className="h-4 w-4" />
          Back to Thoughts
        </Link>

        <header className="space-y-4">
          <h1 className="text-4xl font-bold tracking-tight">{story.title}</h1>
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            {story.date && (
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {formatDate(story.date)}
              </span>
            )}
            {story.company && <span>· {story.company}</span>}
            {story.role && <span>· {story.role}</span>}
          </div>
          {story.tags && story.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {story.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
              ))}
            </div>
          )}
        </header>

        <div className="mt-10 space-y-8">
          <p className="text-lg text-muted-foreground leading-relaxed">{story.summary}</p>

          {story.situation && (
            <section>
              <h2 className="text-xl font-semibold mb-2">Context</h2>
              <p className="text-muted-foreground leading-relaxed">{story.situation}</p>
            </section>
          )}

          {story.task && (
            <section>
              <h2 className="text-xl font-semibold mb-2">Problem</h2>
              <p className="text-muted-foreground leading-relaxed">{story.task}</p>
            </section>
          )}

          {story.action && (
            <section>
              <h2 className="text-xl font-semibold mb-3">Post</h2>
              <div
                className="prose prose-neutral dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: story.action }}
              />
            </section>
          )}

          {story.result && (
            <section>
              <h2 className="text-xl font-semibold mb-2">Outcome</h2>
              <p className="text-muted-foreground leading-relaxed">{story.result}</p>
            </section>
          )}

          {story.lessonsLearned && (
            <section>
              <h2 className="text-xl font-semibold mb-2">Takeaway</h2>
              <p className="text-muted-foreground leading-relaxed">{story.lessonsLearned}</p>
            </section>
          )}
        </div>
      </article>
    </div>
  );
}
