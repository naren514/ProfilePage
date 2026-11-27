"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Check, EyeOff, Globe, Inbox, ListPlus, Loader2, MoreHorizontal, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { formatWhen, studioFetch, StudioApiError } from "@/components/writing/client";
import { SetupCard } from "@/components/writing/setup-card";
import { EmptyState, notifyReadingChanged, typingIn } from "./shared";

// Discover: every new article from the author's sources, best match first,
// recommended ones highlighted with the reason. Two main choices per
// article (add to this week, read later); publish and hide under "More".
// Keyboard: J/K move, S this week, R read later, H hide, O open.
// Phone: swipe right for this week, left to hide.

type State = "new" | "shortlisted" | "picked" | "saved" | "published" | "hidden";
type Action = "shortlist" | "save" | "publish" | "hide";

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
  because: string | null;
  state: State;
  agentReason: string | null;
}

const DONE: Partial<Record<State, string>> = {
  shortlisted: "Added to this week",
  picked: "In a weekly list",
  saved: "In your inbox",
  published: "Published",
};

const SWIPE = 90;

function Card({ item, active, busy, onAction, onFocus }: { item: Item; active: boolean; busy: string | null; onAction: (item: Item, a: Action) => void; onFocus: () => void }) {
  const ref = useRef<HTMLLIElement>(null);
  const start = useRef<{ x: number; y: number; swiping: boolean } | null>(null);
  const [dx, setDx] = useState(0);
  const done = item.state !== "new";
  const working = (a: Action) => busy === `${item.id}:${a}`;

  useEffect(() => {
    if (active) ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [active]);

  return (
    <li
      ref={ref}
      aria-label={item.title}
      data-active={active || undefined}
      onClick={onFocus}
      onTouchStart={(e) => {
        if (done) return;
        start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, swiping: false };
      }}
      onTouchMove={(e) => {
        const s = start.current;
        if (!s) return;
        const x = e.touches[0].clientX - s.x;
        const y = e.touches[0].clientY - s.y;
        if (!s.swiping && Math.abs(x) > 12 && Math.abs(x) > Math.abs(y) * 1.5) s.swiping = true;
        if (s.swiping) setDx(Math.max(-160, Math.min(160, x)));
      }}
      onTouchEnd={() => {
        if (dx >= SWIPE) onAction(item, "shortlist");
        else if (dx <= -SWIPE) onAction(item, "hide");
        start.current = null;
        setDx(0);
      }}
      className="relative overflow-hidden"
    >
      {dx !== 0 && (
        <div className={cn("absolute inset-0 flex items-center px-5 text-sm font-medium", dx > 0 ? "justify-start bg-foreground text-background" : "justify-end bg-muted text-muted-foreground")} aria-hidden>
          {dx > 0 ? (dx >= SWIPE ? "Release: add to this week" : "Add to this week") : dx <= -SWIPE ? "Release: hide" : "Hide"}
        </div>
      )}
      <div
        className={cn("relative bg-background px-4 py-4 transition-[box-shadow] sm:px-5", item.recommended && "bg-[linear-gradient(hsl(var(--ai)/0.06),hsl(var(--ai)/0.06))]", active && "shadow-[inset_0_0_0_2px_hsl(var(--ring))]")}
        style={dx ? { transform: `translateX(${dx}px)` } : undefined}
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
        </div>
        <a href={item.url} target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-flex items-start gap-1 font-serif text-[1.1875rem] leading-snug hover:underline" data-open>
          {item.title}
          <ArrowUpRight className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
          <span className="sr-only">(opens in a new tab)</span>
        </a>
        {item.summary && <p className="mt-1 line-clamp-2 max-w-3xl text-sm text-muted-foreground">{item.summary}</p>}
        {item.agentReason ? (
          <p className="mt-1.5 text-sm">
            <span className="font-medium">Why the agent picked it:</span> {item.agentReason}
          </p>
        ) : (
          item.because && <p className="mt-1.5 text-sm text-muted-foreground">Because you saved “{item.because}”</p>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-1.5 [&_button]:h-9 [&_button]:rounded-full [&_button]:text-xs">
          {done ? (
            <span className="inline-flex items-center gap-1.5 text-sm text-emerald-700">
              <Check className="h-4 w-4" /> {DONE[item.state]}
            </span>
          ) : (
            <>
              <Button size="sm" className="px-3.5" onClick={() => onAction(item, "shortlist")} disabled={Boolean(busy)} aria-label={`Add ${item.title} to this week`}>
                {working("shortlist") ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <ListPlus className="mr-1.5 h-3.5 w-3.5" />}
                Add to this week
              </Button>
              <Button size="sm" variant="outline" className="px-3.5" onClick={() => onAction(item, "save")} disabled={Boolean(busy)} aria-label={`Read ${item.title} later`}>
                {working("save") ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Inbox className="mr-1.5 h-3.5 w-3.5" />}
                Read later
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="ghost" className="w-9 px-0 text-muted-foreground" disabled={Boolean(busy)} aria-label={`More for ${item.title}`}>
                    {working("publish") ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onSelect={() => onAction(item, "publish")}>
                    <Globe className="mr-2 h-4 w-4" /> Publish now
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => onAction(item, "hide")}>
                    <EyeOff className="mr-2 h-4 w-4" /> Hide
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
      </div>
    </li>
  );
}

export function Discover() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [topics, setTopics] = useState<string[]>([]);
  const [topic, setTopic] = useState("");
  const [onlyRecommended, setOnlyRecommended] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [setupRequired, setSetupRequired] = useState(false);
  const [cursor, setCursor] = useState(-1);

  const load = useCallback(async () => {
    try {
      const d = await studioFetch<{ items: Item[]; topics: string[] }>("/reading-agent/feed");
      setItems(d.items);
      setTopics(d.topics);
    } catch (e) {
      if (e instanceof StudioApiError && e.code === "SETUP_REQUIRED") setSetupRequired(true);
      else toast.error(e instanceof Error ? e.message : "Couldn't load new articles");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const act = useCallback(
    async (item: Item, action: Action) => {
      if (item.state !== "new") return;
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
                await load();
                notifyReadingChanged();
              },
            },
          });
        } else {
          setItems((list) => list?.map((i) => (i.id === item.id ? { ...i, state } : i)) ?? null);
          toast.success(action === "shortlist" ? "Added to this week's list" : action === "save" ? "Saved to your inbox to read later" : "Published on your reading list");
        }
        notifyReadingChanged();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't do that");
      } finally {
        setBusy(null);
      }
    },
    [load]
  );

  const checkNow = async () => {
    setChecking(true);
    try {
      const { summary } = await studioFetch<{ summary: { added: number; failed: number } }>("/reading-agent/sources/check", { method: "POST" });
      toast.success(`${summary.added} new article${summary.added === 1 ? "" : "s"}${summary.failed ? `; ${summary.failed} source(s) couldn't be read` : ""}`);
      await load();
      notifyReadingChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't check the sources");
    } finally {
      setChecking(false);
    }
  };

  const shown = useMemo(() => (items ?? []).filter((i) => (!topic || i.topic === topic) && (!onlyRecommended || i.recommended)), [items, topic, onlyRecommended]);
  const recommendedCount = (items ?? []).filter((i) => i.recommended && i.state === "new").length;

  // Keyboard triage, like an email client
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (typingIn(e) || shown.length === 0) return;
      const key = e.key.toLowerCase();
      const at = Math.min(cursor, shown.length - 1);
      const item = at >= 0 ? shown[at] : null;
      if (key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        setCursor(Math.min(shown.length - 1, at + 1));
      } else if (key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        setCursor(Math.max(0, at - 1));
      } else if (item && key === "s") act(item, "shortlist");
      else if (item && key === "r") act(item, "save");
      else if (item && key === "h") act(item, "hide");
      else if (item && (key === "o" || e.key === "Enter")) window.open(item.url, "_blank", "noopener");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shown, cursor, act]);

  if (setupRequired) return <SetupCard onReady={() => window.location.reload()} />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by topic">
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
        </div>
        <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-full border px-3.5 text-sm">
          <input type="checkbox" checked={onlyRecommended} onChange={(e) => setOnlyRecommended(e.target.checked)} />
          Recommended only{recommendedCount ? ` (${recommendedCount})` : ""}
        </label>
        <Button variant="ghost" onClick={checkNow} disabled={checking} className="ml-auto h-9 gap-2 rounded-full">
          {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Check sources now
        </Button>
      </div>

      {items === null ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : shown.length === 0 ? (
        <EmptyState>
          {items.length === 0 ? (
            <>
              Nothing new yet. Press <strong>Check sources now</strong>, or choose your sources in{" "}
              <Link href="/admin/reading/settings" className="underline underline-offset-4">
                Reading settings
              </Link>
              .
            </>
          ) : (
            "Nothing matches these filters."
          )}
        </EmptyState>
      ) : (
        <>
          <ul className="divide-y overflow-hidden rounded-2xl border" aria-label="New articles">
            {shown.map((item, i) => (
              <Card key={item.id} item={item} active={i === cursor} busy={busy} onAction={act} onFocus={() => setCursor(i)} />
            ))}
          </ul>
          <p className="hidden text-xs text-muted-foreground md:block">
            Keys: <kbd className="rounded border bg-muted px-1 font-mono">J</kbd> <kbd className="rounded border bg-muted px-1 font-mono">K</kbd> move · <kbd className="rounded border bg-muted px-1 font-mono">S</kbd> add to this week ·{" "}
            <kbd className="rounded border bg-muted px-1 font-mono">R</kbd> read later · <kbd className="rounded border bg-muted px-1 font-mono">H</kbd> hide · <kbd className="rounded border bg-muted px-1 font-mono">O</kbd> open
          </p>
          <p className="text-xs text-muted-foreground md:hidden">Swipe right to add to this week, left to hide.</p>
        </>
      )}
    </div>
  );
}
