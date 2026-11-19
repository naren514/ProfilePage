import Link from "next/link";
import { cleanTags, topicSlug, type TopicCount } from "@/lib/topics";
import { cn } from "@/lib/utils";

/** A topic as a small link to its page. */
export function TopicLink({ tag, className }: { tag: string; className?: string }) {
  return (
    <Link
      href={`/topics/${topicSlug(tag)}`}
      className={cn(
        "relative z-10 inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-foreground hover:text-background",
        className
      )}
    >
      {tag}
    </Link>
  );
}

export function TopicLinks({ tags, max = 4, className }: { tags: string[] | null | undefined; max?: number; className?: string }) {
  const list = cleanTags(tags ?? []).slice(0, max);
  if (list.length === 0) return null;
  return (
    <ul className={cn("flex flex-wrap gap-1.5", className)} aria-label="Topics">
      {list.map((t) => (
        <li key={t}>
          <TopicLink tag={t} />
        </li>
      ))}
    </ul>
  );
}

/** "Browse by topic" row shown above a list. */
export function TopicBar({ topics, label = "Browse by topic", max = 12 }: { topics: TopicCount[]; label?: string; max?: number }) {
  if (topics.length === 0) return null;
  return (
    <nav aria-label={label} className="mb-10 flex flex-wrap items-center gap-x-2 gap-y-2">
      <span className="mr-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{label}</span>
      {topics.slice(0, max).map((t) => (
        <Link
          key={t.slug}
          href={`/topics/${t.slug}`}
          className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors hover:bg-foreground hover:text-background"
        >
          {t.label}
          <span className="text-xs tabular-nums text-muted-foreground">{t.total}</span>
        </Link>
      ))}
      {topics.length > max && (
        <Link href="/topics" className="px-2 text-sm text-muted-foreground underline-offset-4 hover:underline">
          All topics
        </Link>
      )}
    </nav>
  );
}
