"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatWhen, studioFetch } from "@/components/writing/client";
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
  emailedAt: string | null;
  emailedCount: number;
}

function WeeklyLists() {
  const [lists, setLists] = useState<WeeklyListRow[] | null>(null);
  const [emailOn, setEmailOn] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const load = () => {
    studioFetch<{ lists: WeeklyListRow[] }>("/reading-agent")
      .then((d) => setLists(d.lists))
      .catch(() => setLists([]));
  };
  useEffect(() => {
    load();
    studioFetch<{ configured: boolean }>("/reading-agent/subscribers")
      .then((d) => setEmailOn(d.configured))
      .catch(() => {});
  }, []);
  const send = async (l: WeeklyListRow) => {
    setSending(l.id);
    try {
      const { sent } = await studioFetch<{ sent: number }>(`/reading-agent/lists/${l.id}/email`, { method: "POST" });
      toast.success(`Emailed to ${sent} subscriber${sent === 1 ? "" : "s"}`);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't send it");
    } finally {
      setSending(null);
    }
  };
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
          <span className="flex items-center gap-3">
            {l.emailedAt ? (
              <span className="text-xs text-muted-foreground">
                emailed to {l.emailedCount} · {formatWhen(l.emailedAt)}
              </span>
            ) : (
              emailOn && (
                <Button size="sm" variant="outline" className="h-8 rounded-full" disabled={sending === l.id} onClick={() => send(l)}>
                  {sending === l.id && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                  Email to subscribers
                </Button>
              )
            )}
            <Link href={`/reading/weekly/${l.week}`} target="_blank" className="inline-flex items-center gap-1 underline underline-offset-2">
              View <ArrowUpRight className="h-3 w-3" />
            </Link>
          </span>
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
