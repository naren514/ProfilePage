import Link from "next/link";
import { ArrowLeft, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";

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
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** The public post layout, shared by /thoughts/[slug] and the Writing Studio preview. */
export function ThoughtArticle({ post, backHref = "/thoughts" }: { post: ThoughtArticleData; backHref?: string }) {
  return (
    <article className="mx-auto max-w-3xl px-6 lg:px-8">
      <Link href={backHref} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8">
        <ArrowLeft className="h-4 w-4" />
        Back to Thoughts
      </Link>

      <header className="space-y-4">
        <h1 className="text-4xl font-bold tracking-tight">{post.title}</h1>
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          {post.date && (
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              {formatDate(post.date)}
            </span>
          )}
          {post.company && <span>· {post.company}</span>}
          {post.role && <span>· {post.role}</span>}
        </div>
        {post.tags && post.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {post.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
            ))}
          </div>
        )}
      </header>

      <div className="mt-10 space-y-8">
        <p className="text-lg text-muted-foreground leading-relaxed">{post.summary}</p>

        {post.situation && (
          <section>
            <h2 className="text-xl font-semibold mb-2">Context</h2>
            <p className="text-muted-foreground leading-relaxed">{post.situation}</p>
          </section>
        )}

        {post.task && (
          <section>
            <h2 className="text-xl font-semibold mb-2">Problem</h2>
            <p className="text-muted-foreground leading-relaxed">{post.task}</p>
          </section>
        )}

        {post.html && (
          <section>
            <h2 className="text-xl font-semibold mb-3">Post</h2>
            <div className="prose prose-neutral max-w-none" dangerouslySetInnerHTML={{ __html: post.html }} />
          </section>
        )}

        {post.result && (
          <section>
            <h2 className="text-xl font-semibold mb-2">Outcome</h2>
            <p className="text-muted-foreground leading-relaxed">{post.result}</p>
          </section>
        )}

        {post.lessonsLearned && (
          <section>
            <h2 className="text-xl font-semibold mb-2">Takeaway</h2>
            <p className="text-muted-foreground leading-relaxed">{post.lessonsLearned}</p>
          </section>
        )}
      </div>
    </article>
  );
}
