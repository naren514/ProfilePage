import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { formatDay } from "@/components/site/ui";

export interface ThoughtListItem {
  id: string;
  slug: string;
  title: string;
  summary: string;
  date: string | null;
  tags: string[] | null;
}

/** Editorial index of posts: date on the left, serif title, one-line summary. */
export function ThoughtList({ posts }: { posts: ThoughtListItem[] }) {
  return (
    <ol className="border-t">
      {posts.map((post) => (
        <li key={post.id} className="border-b">
          <Link
            href={`/thoughts/${post.slug}`}
            className="site-motion group grid gap-x-10 gap-y-2 py-8 transition-colors sm:grid-cols-[9rem_minmax(0,1fr)_auto] sm:py-10"
          >
            <time dateTime={post.date ?? undefined} className="pt-2 text-sm tabular-nums text-muted-foreground">
              {formatDay(post.date)}
            </time>
            <div className="min-w-0">
              <h3 className="text-balance font-serif text-[1.75rem] leading-[1.2] tracking-[-0.01em] underline-offset-[6px] decoration-1 group-hover:underline sm:text-3xl">
                {post.title}
              </h3>
              <p className="mt-3 max-w-2xl text-pretty leading-relaxed text-muted-foreground">{post.summary}</p>
              {post.tags && post.tags.length > 0 && (
                <p className="mt-4 text-xs uppercase tracking-[0.12em] text-muted-foreground/80">{post.tags.slice(0, 3).join(" · ")}</p>
              )}
            </div>
            <ArrowRight
              className="site-motion hidden h-5 w-5 self-center text-muted-foreground opacity-0 transition-all group-hover:translate-x-1 group-hover:opacity-100 sm:block"
              aria-hidden
            />
          </Link>
        </li>
      ))}
    </ol>
  );
}
