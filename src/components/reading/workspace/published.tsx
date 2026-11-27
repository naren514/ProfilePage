"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { studioFetch } from "@/components/writing/client";
import { ReadingItems } from "../reading-inbox";
import { EmptyState } from "./shared";

// Published: what's public. Single articles, the weekly lists, and the
// archive (kept but not shown).

type View = "articles" | "lists" | "archived";

interface WeeklyListRow {
  id: string;
  week: string;
  title: string;
  picks: unknown[];
  publishedAt: string;
}

function WeeklyLists() {
  const [lists, setLists] = useState<WeeklyListRow[] | null>(null);
  useEffect(() => {
    studioFetch<{ lists: WeeklyListRow[] }>("/reading-agent")
      .then((d) => setLists(d.lists))
      .catch(() => setLists([]));
  }, []);
  if (lists === null) return null;
  if (lists.length === 0) return <EmptyState>No weekly lists yet. Approve one on This week and it appears here and on your site.</EmptyState>;
  return (
    <ul className="divide-y rounded-2xl border" aria-label="Weekly lists">
      {lists.map((l) => (
        <li key={l.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
          <span>
            <span className="font-medium">{l.title || `Week ${l.week.slice(6)}`}</span>
            <span className="text-muted-foreground">
              {" "}
              · {l.week} · {l.picks.length} pick{l.picks.length === 1 ? "" : "s"}
            </span>
          </span>
          <Link href={`/reading/weekly/${l.week}`} target="_blank" className="inline-flex items-center gap-1 underline underline-offset-2">
            View <ArrowUpRight className="h-3 w-3" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function Published() {
  const [view, setView] = useState<View>("articles");
  return (
    <div className="space-y-6">
      <div role="group" aria-label="Show" className="inline-flex rounded-full border p-0.5 text-sm">
        {(
          [
            ["articles", "Articles"],
            ["lists", "Weekly lists"],
            ["archived", "Archived"],
          ] as const
        ).map(([v, label]) => (
          <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)} className={cn("h-8 rounded-full px-3.5 transition-colors", view === v ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>
            {label}
          </button>
        ))}
      </div>
      {view === "lists" ? <WeeklyLists /> : <ReadingItems key={view} status={view === "articles" ? "published" : "archived"} />}
    </div>
  );
}
