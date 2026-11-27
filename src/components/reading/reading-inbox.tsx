"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Archive, ArrowUpRight, Check, Inbox, Link2, ListPlus, Loader2, RefreshCw, Send, Sparkles, Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatWhen } from "@/components/writing/client";
import { cn } from "@/lib/utils";
import { readingFetch, ReadingApiError, type ReadingItemDto, type ReadingStatus } from "./client";
import { TagEditor } from "./tag-editor";
import { notifyReadingChanged } from "./workspace/shared";

type Counts = Record<ReadingStatus, number>;
const WEEK_MS = 7 * 86_400_000;

const VIA: Record<string, string> = { shortcut: "iPhone", bookmarklet: "browser", admin: "pasted" };

function SetupNeeded({ onReady }: { onReady: () => void }) {
  const [running, setRunning] = useState(false);
  return (
    <div className="max-w-xl rounded-2xl border p-6">
      <h2 className="font-serif text-2xl">One-time update</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        The reading list needs a few new database columns (inbox, notes, tokens). Your existing entries stay published exactly as they are. It&apos;s safe to run again.
      </p>
      <Button
        className="mt-4 rounded-full"
        disabled={running}
        onClick={async () => {
          setRunning(true);
          try {
            const res = await fetch("/api/admin/writing/setup", { method: "POST" });
            if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Setup failed");
            onReady();
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Setup failed");
          } finally {
            setRunning(false);
          }
        }}
      >
        {running && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Set up now
      </Button>
    </div>
  );
}

function Capture({ onSaved }: { onSaved: () => void }) {
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!url.trim() || saving) return;
    setSaving(true);
    try {
      const result = await readingFetch<{ item: ReadingItemDto; created: boolean }>("", { method: "POST", json: { url: url.trim(), via: "admin" } });
      toast.success(result.created ? `Saved “${result.item.articleTitle}” to your inbox` : "Already on your list; moved it back to the top");
      setUrl("");
      onSaved();
      notifyReadingChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save the link");
    } finally {
      setSaving(false);
    }
  };
  return (
    <form
      className="group/capture flex items-center gap-3 rounded-2xl bg-muted/50 px-5 py-3 ring-1 ring-transparent transition focus-within:bg-background focus-within:shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.12)] focus-within:ring-border"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <Link2 className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-focus-within/capture:text-foreground" aria-hidden />
      <label htmlFor="reading-capture" className="sr-only">
        Paste an article link
      </label>
      <input
        id="reading-capture"
        type="text"
        inputMode="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="Paste an article link…"
        className="h-9 flex-1 bg-transparent font-serif text-lg placeholder:italic placeholder:text-muted-foreground/70 focus:outline-none"
      />
      <Button type="submit" size="sm" variant="ghost" className="h-8 rounded-full px-3 text-xs" disabled={!url.trim() || saving}>
        {saving && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
        {saving ? "Reading the page…" : "Save to inbox"}
      </Button>
    </form>
  );
}

function NoteEditor({ item, onChange }: { item: ReadingItemDto; onChange: (item: ReadingItemDto) => void }) {
  const [value, setValue] = useState(item.note ?? "");
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const saved = useRef(item.note ?? "");

  useEffect(() => {
    setValue(item.note ?? "");
    saved.current = item.note ?? "";
  }, [item.note]);

  const persist = async (note: string) => {
    if (note.trim() === saved.current.trim()) return;
    setSaving(true);
    try {
      const { item: updated } = await readingFetch<{ item: ReadingItemDto }>(`/${item.id}`, { method: "PATCH", json: { note } });
      saved.current = updated.note ?? "";
      onChange(updated);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save the note");
    } finally {
      setSaving(false);
    }
  };

  const regenerate = async () => {
    setRegenerating(true);
    try {
      const { item: updated } = await readingFetch<{ item: ReadingItemDto }>(`/${item.id}/suggest`, { method: "POST" });
      onChange(updated);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't suggest a note");
    } finally {
      setRegenerating(false);
    }
  };

  const showSuggestion = item.suggestedNote && item.suggestedNote.trim() !== value.trim();

  return (
    <div className="space-y-2">
      <div className="relative">
        <label htmlFor={`note-${item.id}`} className="sr-only">
          Your note on {item.articleTitle}
        </label>
        <textarea
          id={`note-${item.id}`}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => persist(value)}
          rows={2}
          maxLength={600}
          placeholder="Why is it worth reading? (shown under the link)"
          className="w-full resize-none rounded-xl border bg-background px-3 py-2 font-serif text-[0.95rem] leading-relaxed placeholder:italic placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-ring [field-sizing:content]"
        />
        {saving && <Loader2 className="absolute right-2 top-2 h-3.5 w-3.5 animate-spin text-muted-foreground" aria-label="Saving" />}
      </div>
      {showSuggestion ? (
        <div className="flex items-start gap-3 rounded-xl bg-ai-soft px-3 py-2.5 text-sm" role="group" aria-label="Suggested note">
          <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ai" aria-hidden />
          <p className="flex-1 font-serif leading-relaxed">{item.suggestedNote}</p>
          <div className="flex shrink-0 gap-1">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 rounded-full px-2.5 text-xs text-ai hover:bg-ai/10 hover:text-ai"
              onClick={() => {
                setValue(item.suggestedNote!);
                persist(item.suggestedNote!);
              }}
            >
              Use
            </Button>
            <Button type="button" size="icon" variant="ghost" className="h-7 w-7 rounded-full text-ai hover:bg-ai/10 hover:text-ai" onClick={regenerate} disabled={regenerating} aria-label="Suggest another note">
              {regenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>
      ) : (
        !value.trim() && (
          <button type="button" onClick={regenerate} disabled={regenerating} className="inline-flex items-center gap-1.5 text-xs text-ai hover:underline">
            {regenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            Suggest a note
          </button>
        )
      )}
    </div>
  );
}

function ItemTags({ item, onChange }: { item: ReadingItemDto; onChange: (item: ReadingItemDto) => void }) {
  const save = async (tags: string[]) => {
    onChange({ ...item, tags });
    try {
      const { item: updated } = await readingFetch<{ item: ReadingItemDto }>(`/${item.id}`, { method: "PATCH", json: { tags } });
      onChange(updated);
    } catch (e) {
      onChange(item);
      toast.error(e instanceof Error ? e.message : "Couldn't save the topics");
    }
  };
  return <TagEditor value={item.tags ?? []} suggested={item.suggestedTags ?? []} onChange={save} label={`Topics for ${item.articleTitle}`} idPrefix={item.id} />;
}

function ItemRow({ item, onChange, onRemove }: { item: ReadingItemDto; onChange: (item: ReadingItemDto) => void; onRemove: (id: string, moved?: ReadingStatus) => void }) {
  const [busy, setBusy] = useState<string | null>(null);

  const thisWeek = item.status !== "archived" && Date.now() - new Date(item.savedAt ?? item.createdAt).getTime() < WEEK_MS;

  const addToWeek = async () => {
    setBusy("week");
    try {
      const { item: updated } = await readingFetch<{ item: ReadingItemDto }>(`/${item.id}`, { method: "PATCH", json: { forThisWeek: true } });
      onChange(updated);
      toast.success("Added to this week's list");
      notifyReadingChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't add it");
    } finally {
      setBusy(null);
    }
  };

  const move = async (status: ReadingStatus, label: string) => {
    setBusy(status);
    try {
      await readingFetch(`/${item.id}`, { method: "PATCH", json: { status } });
      toast.success(label);
      onRemove(item.id, status);
      notifyReadingChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't update the article");
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!window.confirm(`Delete “${item.articleTitle}” from your reading list?`)) return;
    setBusy("delete");
    try {
      await readingFetch(`/${item.id}`, { method: "DELETE" });
      onRemove(item.id);
      notifyReadingChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't delete");
      setBusy(null);
    }
  };

  const meta = [item.siteName || item.source, item.author, `saved ${formatWhen(item.savedAt ?? item.createdAt)}`, item.savedVia ? `via ${VIA[item.savedVia] ?? item.savedVia}` : null].filter(Boolean);

  return (
    <li className="grid gap-5 py-7 sm:grid-cols-[minmax(0,1fr)_7.5rem]">
      <div className="min-w-0 space-y-3">
        <p className="text-xs text-muted-foreground">{meta.join(" · ")}</p>
        <h3 className="font-serif text-[1.375rem] leading-snug">
          {item.articleUrl ? (
            <a href={item.articleUrl} target="_blank" rel="noopener noreferrer" className="group underline-offset-4 hover:underline">
              {item.articleTitle}
              <ArrowUpRight className="ml-1 inline h-4 w-4 -translate-y-0.5 text-muted-foreground" aria-hidden />
            </a>
          ) : (
            item.articleTitle
          )}
        </h3>
        {item.quote && <blockquote className="border-l-2 border-ai/40 pl-3 font-serif text-sm italic text-muted-foreground">{item.quote}</blockquote>}
        {!item.quote && item.excerpt && <p className="line-clamp-2 text-sm text-muted-foreground">{item.excerpt}</p>}
        <NoteEditor item={item} onChange={onChange} />
        <ItemTags item={item} onChange={onChange} />
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          {item.status !== "published" && (
            <Button size="sm" className="h-8 rounded-full" onClick={() => move("published", "Published on your Reading page")} disabled={!!busy}>
              {busy === "published" ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Send className="mr-1.5 h-3.5 w-3.5" />}
              Publish
            </Button>
          )}
          {item.status === "inbox" &&
            (thisWeek ? (
              <span className="inline-flex h-8 items-center gap-1 px-2 text-xs text-muted-foreground" title="Saved in the last 7 days: the weekly list can include it">
                <Check className="h-3.5 w-3.5" /> On this week&apos;s list
              </span>
            ) : (
              <Button size="sm" variant="outline" className="h-8 rounded-full" onClick={addToWeek} disabled={!!busy} aria-label={`Add ${item.articleTitle} to this week`}>
                {busy === "week" ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <ListPlus className="mr-1.5 h-3.5 w-3.5" />}
                Add to this week
              </Button>
            ))}
          {item.status !== "inbox" && (
            <Button size="sm" variant="outline" className="h-8 rounded-full" onClick={() => move("inbox", item.status === "published" ? "Unpublished: back in your inbox" : "Moved to your inbox")} disabled={!!busy}>
              <Undo2 className="mr-1.5 h-3.5 w-3.5" />
              {item.status === "published" ? "Unpublish" : "Move to inbox"}
            </Button>
          )}
          {item.status !== "archived" && (
            <Button size="sm" variant="ghost" className="h-8 rounded-full" onClick={() => move("archived", "Archived")} disabled={!!busy}>
              <Archive className="mr-1.5 h-3.5 w-3.5" />
              Archive
            </Button>
          )}
          <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full text-muted-foreground hover:text-destructive" onClick={remove} disabled={!!busy} aria-label={`Delete ${item.articleTitle}`}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      {item.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer" className="hidden aspect-[4/3] w-full rounded-xl bg-muted object-cover sm:block" onError={(e) => (e.currentTarget.style.display = "none")} />
      )}
    </li>
  );
}

const EMPTY: Record<ReadingStatus, string> = {
  inbox: "Your inbox is empty. Send articles here from your iPhone or browser.",
  published: "Nothing published yet.",
  archived: "Nothing archived.",
};

/** One status's articles (the Inbox tab, or Published / Archived), with paste-a-link on the inbox. */
export function ReadingItems({ status, capture = false }: { status: ReadingStatus; capture?: boolean }) {
  const [items, setItems] = useState<ReadingItemDto[] | null>(null);
  const [setupNeeded, setSetupNeeded] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await readingFetch<{ items: ReadingItemDto[]; counts: Counts }>(`?status=${status}`);
      setItems(data.items);
      setSetupNeeded(false);
    } catch (e) {
      if (e instanceof ReadingApiError && e.code === "SETUP_REQUIRED") setSetupNeeded(true);
      else toast.error(e instanceof Error ? e.message : "Couldn't load the reading list");
      setItems([]);
    }
  }, [status]);

  useEffect(() => {
    setItems(null);
    load();
  }, [load]);

  if (setupNeeded) return <SetupNeeded onReady={load} />;

  return (
    <div className="space-y-6">
      {capture && <Capture onSaved={load} />}
      {items === null ? (
        <div className="space-y-6 py-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="h-3 w-48" />
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-14 w-full" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="py-14 text-center">
          <Inbox className="mx-auto h-6 w-6 text-muted-foreground" aria-hidden />
          <p className="mt-3 font-serif text-xl text-muted-foreground">{EMPTY[status]}</p>
          {status === "inbox" && (
            <Button asChild variant="link" className="mt-1">
              <Link href="/admin/reading/settings#ways-to-save">Set up saving from your phone or browser</Link>
            </Button>
          )}
        </div>
      ) : (
        <ul className={cn("divide-y", !capture && "-mt-4")} aria-label={`${status} articles`}>
          {items.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              onChange={(updated) => setItems((list) => list?.map((x) => (x.id === updated.id ? updated : x)) ?? null)}
              onRemove={(id) => setItems((list) => list?.filter((x) => x.id !== id) ?? null)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
