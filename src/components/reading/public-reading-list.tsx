import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { formatMonthYear } from "@/components/site/ui";
import { TopicLinks } from "@/components/site/topics";

export interface PublicReadingItem {
  id: string;
  title: string;
  source: string;
  url: string | null;
  note: string | null;
  quote: string | null;
  date: string;
  tags?: string[] | null;
}

/** The public reading list: saved date, source, linked title, quote, note, topics. */
export function PublicReadingList({ items }: { items: PublicReadingItem[] }) {
  return (
    <ol className="border-t">
      {items.map((item) => {
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
              <TopicLinks tags={item.tags} className="mt-4" />
            </div>
          </li>
        );
      })}
    </ol>
  );
}
