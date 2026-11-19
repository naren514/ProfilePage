import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cleanTags, topicSlug } from "@/lib/topics";
import { TopicLinks } from "@/components/site/topics";

export interface ThoughtArticleData {
  title: string;
  summary: string;
  /** Already-sanitized post body HTML. */
  html: string;
  date: string | null;
  tags: string[] | null;
  // Legacy STAR fields from older posts
  company?: string | null;
  role?: string | null;
  situation?: string | null;
  task?: string | null;
  result?: string | null;
  lessonsLearned?: string | null;
}

function formatDate(date: string | null) {
  if (!date) return "";
  return new Date(date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}

function plainWords(html: string, ...parts: Array<string | null | undefined>) {
  const text = html.replace(/<[^>]+>/g, " ") + " " + parts.filter(Boolean).join(" ");
  return text.split(/\s+/).filter(Boolean).length;
}

function LegacySection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{label}</h2>
      <p className="site-prose">{children}</p>
    </section>
  );
}

/** The public post layout, shared by /thoughts/[slug] and the Writing Studio preview. */
export function ThoughtArticle({ post, backHref = "/thoughts" }: { post: ThoughtArticleData; backHref?: string }) {
  const minutes = Math.max(1, Math.round(plainWords(post.html, post.situation, post.task, post.result, post.lessonsLearned) / 230));
  const meta = [formatDate(post.date), `${minutes} min read`, post.company, post.role].filter(Boolean);

  return (
    <article className="mx-auto w-full max-w-[42rem] px-5 sm:px-8">
      <div className="pt-10 sm:pt-14">
        <Link href={backHref} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Back to Thoughts
        </Link>
      </div>

      <header className="pb-10 pt-12 sm:pt-16">
        {post.tags && post.tags.length > 0 && (
          <p className="mb-6 flex flex-wrap gap-x-3 text-xs font-medium uppercase tracking-[0.14em] text-brand">
            {cleanTags(post.tags)
              .slice(0, 3)
              .map((tag) => (
                <Link key={tag} href={`/topics/${topicSlug(tag)}`} className="underline-offset-4 hover:underline">
                  {tag}
                </Link>
              ))}
          </p>
        )}
        <h1 className="text-balance font-serif text-5xl font-normal leading-[1.05] tracking-[-0.02em] sm:text-[3.5rem]">{post.title}</h1>
        {post.summary && <p className="mt-6 text-pretty font-serif text-2xl italic leading-snug text-foreground/65">{post.summary}</p>}
        <p className="mt-8 flex flex-wrap gap-x-2 text-sm text-muted-foreground">
          {meta.map((m, i) => (
            <span key={i}>
              {i > 0 && (
                <span className="mr-2" aria-hidden>
                  ·
                </span>
              )}
              {m}
            </span>
          ))}
        </p>
      </header>

      <div className="space-y-10 border-t pt-10">
        {post.situation && <LegacySection label="Context">{post.situation}</LegacySection>}
        {post.task && <LegacySection label="Problem">{post.task}</LegacySection>}

        {post.html && (
          <div
            className="site-prose prose prose-neutral max-w-none prose-headings:font-serif prose-headings:font-medium prose-h2:mt-12 prose-h2:text-[1.75rem] prose-h3:text-2xl prose-blockquote:font-normal prose-a:text-foreground prose-img:rounded-xl"
            dangerouslySetInnerHTML={{ __html: post.html }}
          />
        )}

        {post.result && <LegacySection label="Outcome">{post.result}</LegacySection>}
        {post.lessonsLearned && <LegacySection label="Takeaway">{post.lessonsLearned}</LegacySection>}
      </div>

      <footer className="mt-16 space-y-6 border-t pt-8">
        {post.tags && post.tags.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">More on</span>
            <TopicLinks tags={post.tags} max={8} />
          </div>
        )}
        <Link href={backHref} className="inline-flex items-center gap-1.5 text-sm font-medium transition-colors hover:text-muted-foreground">
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          More thoughts
        </Link>
      </footer>
    </article>
  );
}
