"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Check, EyeOff, Globe, Inbox, ListPlus, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatWhen, studioFetch, StudioApiError } from "../client";
import { PageHeader } from "../studio-ui";
import { SetupCard } from "../setup-card";

// The Feed (discovery, author-in-the-loop): every new article from the
// author's sources, best match first, with the agent's picks highlighted.
// The author can shortlist it for the weekly list, save it to read later,
// publish it, or hide it; each choice teaches the ranking.

type State = "new" | "shortlisted" | "picked" | "saved" | "published" | "hidden";

interface Item {
  id: string;
  url: string;
  title: string;
  summary: string;
  source: string;
  topic: string;
  publishedAt: string | null;
  taste: number;
  recommended: boolean;
  state: State;
  agentReason: string | null;
  agentScore: number | null;
}

const STATE_TEXT: Partial<Record<State, string>> = {
  shortlisted: "On this week's shortlist",
  picked: "In a weekly list",
  saved: "Saved to your inbox",
  published: "Published",
};

function ItemRow({ item, onAction, busy }: { item: Item; onAction: (item: Item, action: string) => void; busy: string | null }) {
  const done = item.state !== "new";
  const working = (a: string) => busy === `${item.id}:${a}`;
  return (
    <li
      className={cn("group relative px-4 py-4 sm:px-5", item.recommended && "bg-ai/[0.06]")}
      aria-label={item.title}
    >
      {item.recommended && <span className="absolute inset-y-0 left-0 w-0.5 bg-ai" aria-hidden />}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        {item.recommended && (
          <span className="inline-flex items-center gap-1 rounded-full bg-ai px-2 py-0.5 font-medium text-ai-foreground">
            <Sparkles className="h-3 w-3" aria-hidden /> Recommended
          </span>
        )}
        <span className="font-medium text-foreground/80">{item.source}</span>
        {item.topic && <span>· {item.topic}</span>}
        {item.publishedAt && <span>· {formatWhen(item.publishedAt)}</span>}
        <span title="How close it is to what you save and keep">· {Math.round(item.taste * 100)}% match</span>
      </div>
      <a href={item.url} target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-flex items-start gap-1 font-serif text-[1.1875rem] leading-snug hover:underline">
        {item.title}
        <ArrowUpRight className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <span className="sr-only">(opens in a new tab)</span>
      </a>
      {item.summary && <p className="mt-1 line-clamp-2 max-w-3xl text-sm text-muted-foreground">{item.summary}</p>}
      {item.agentReason && <p className="mt-1.5 text-sm"><span className="font-medium">Why the agent picked it:</span> {item.agentReason}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-1.5 [&_button]:h-9 [&_button]:rounded-full [&_button]:px-3.5 [&_button]:text-xs">
        {done ? (
          <span className="inline-flex items-center gap-1.5 text-sm text-emerald-700">
            <Check className="h-4 w-4" /> {STATE_TEXT[item.state]}
          </span>
        ) : (
          <>
            <Button size="sm" onClick={() => onAction(item, "shortlist")} disabled={Boolean(busy)} aria-label={`Shortlist ${item.title}`}>
              {working("shortlist") ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <ListPlus className="mr-1.5 h-3.5 w-3.5" />}
              Shortlist
            </Button>
            <Button size="sm" variant="outline" onClick={() => onAction(item, "save")} disabled={Boolean(busy)} aria-label={`Save ${item.title} to your inbox`}>
              {working("save") ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Inbox className="mr-1.5 h-3.5 w-3.5" />}
              Save
            </Button>
            <Button size="sm" variant="outline" onClick={() => onAction(item, "publish")} disabled={Boolean(busy)} aria-label={`Publish ${item.title}`}>
              {working("publish") ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Globe className="mr-1.5 h-3.5 w-3.5" />}
              Publish
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onAction(item, "hide")} disabled={Boolean(busy)} aria-label={`Hide ${item.title}`} className="text-muted-foreground">
              <EyeOff className="mr-1.5 h-3.5 w-3.5" /> Hide
            </Button>
          </>
        )}
      </div>
    </li>
  );
}

export function FeedPage() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [topics, setTopics] = useState<string[]>([]);
  const [topic, setTopic] = useState<string>("");
  const [onlyRecommended, setOnlyRecommended] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [setupRequired, setSetupRequired] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await studioFetch<{ items: Item[]; topics: string[] }>("/reading-agent/feed");
      setItems(d.items);
      setTopics(d.topics);
    } catch (e) {
      if (e instanceof StudioApiError && e.code === "SETUP_REQUIRED") setSetupRequired(true);
      else toast.error(e instanceof Error ? e.message : "Couldn't load the feed");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (item: Item, action: string) => {
    setBusy(`${item.id}:${action}`);
    try {
      const { state } = await studioFetch<{ state: State }>(`/reading-agent/feed/${item.id}`, { method: "POST", json: { action } });
      if (action === "hide") {
        setItems((list) => list?.filter((i) => i.id !== item.id) ?? null);
        toast.message("Hidden. Similar articles will rank lower.", {
          action: {
            label: "Undo",
            onClick: async () => {
              await studioFetch(`/reading-agent/feed/${item.id}`, { method: "POST", json: { action: "unhide" } });
              load();
            },
          },
        });
      } else {
        setItems((list) => list?.map((i) => (i.id === item.id ? { ...i, state } : i)) ?? null);
        toast.success(action === "shortlist" ? "Added to this week's shortlist" : action === "save" ? "Saved to your reading inbox" : "Published on your reading list");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't do that");
    } finally {
      setBusy(null);
    }
  };

  const checkNow = async () => {
    setChecking(true);
    try {
      const { summary } = await studioFetch<{ summary: { added: number; failed: number } }>("/reading-agent/sources/check", { method: "POST" });
      toast.success(`${summary.added} new article${summary.added === 1 ? "" : "s"}${summary.failed ? `; ${summary.failed} source(s) couldn't be read` : ""}`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't check the sources");
    } finally {
      setChecking(false);
    }
  };

  const shown = useMemo(() => (items ?? []).filter((i) => (!topic || i.topic === topic) && (!onlyRecommended || i.recommended)), [items, topic, onlyRecommended]);
  const recommendedCount = (items ?? []).filter((i) => i.recommended && i.state === "new").length;

  if (setupRequired) return <SetupCard onReady={() => window.location.reload()} />;

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <PageHeader
        title="Feed"
        description="New articles from your sources, best match first. Recommended ones are highlighted. Shortlist what's worth this week's list, save what you want to read, publish what you'd share, and hide the rest: every choice sharpens the ranking."
        actions={
          <Button variant="outline" onClick={checkNow} disabled={checking} className="gap-2 rounded-full">
            {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Check sources now
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter the feed">
        {["", ...topics].map((t) => (
          <button
            key={t || "all"}
            type="button"
            aria-pressed={topic === t}
            onClick={() => setTopic(t)}
            className={cn("h-9 rounded-full border px-3.5 text-sm transition-colors", topic === t ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}
          >
            {t || "All topics"}
          </button>
        ))}
        <label className="ml-auto inline-flex h-9 cursor-pointer items-center gap-2 rounded-full border px-3.5 text-sm">
          <input type="checkbox" checked={onlyRecommended} onChange={(e) => setOnlyRecommended(e.target.checked)} />
          Recommended only{recommendedCount ? ` (${recommendedCount})` : ""}
        </label>
      </div>

      {items === null ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">
          {items.length === 0 ? (
            <>
              Nothing new yet. Press <strong>Check sources now</strong>, or add sources on <Link href="/admin/stories/weekly" className="underline underline-offset-4">Weekly list</Link>.
            </>
          ) : (
            "Nothing matches these filters."
          )}
        </div>
      ) : (
        <ul className="divide-y overflow-hidden rounded-2xl border" aria-label="Feed">
          {shown.map((item) => (
            <ItemRow key={item.id} item={item} onAction={act} busy={busy} />
          ))}
        </ul>
      )}
    </div>
  );
}
