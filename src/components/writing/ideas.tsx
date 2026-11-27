"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, FileText, Lightbulb, ListTree, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatWhen, studioFetch } from "./client";
import { startRun } from "./agent/use-agent-run";

interface Idea {
  id: string;
  content: string;
  tags: string[];
  status: "new" | "converted" | "archived";
  linkedDocumentId: string | null;
  createdAt: string;
  sources?: Array<{ key: string; url: string; title: string; publisher: string }>;
}

/** One field, Enter to save. Tags can be added inline with #tag. */
export function QuickCapture({ onSaved }: { onSaved: () => void }) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  // Grow with the text (for browsers without CSS field-sizing)
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [text]);

  const save = async () => {
    const raw = text.trim();
    if (!raw || saving) return;
    const tags = Array.from(new Set((raw.match(new RegExp("(^|\\s)#([\\p{L}\\p{N}_-]{1,40})", "gu")) ?? []).map((t) => t.trim().slice(1).toLowerCase())));
    setSaving(true);
    try {
      await studioFetch("/ideas", { method: "POST", json: { content: raw, tags } });
      setText("");
      toast.success("Idea saved");
      onSaved();
      ref.current?.focus();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save the idea");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      className="group/capture rounded-2xl bg-muted/50 px-5 pb-3 pt-4 ring-1 ring-transparent transition focus-within:bg-background focus-within:shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.12)] focus-within:ring-border"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <label htmlFor="quick-capture" className="sr-only">
        Capture an idea
      </label>
      <div className="flex items-start gap-3">
        <Lightbulb className="mt-1.5 h-4 w-4 shrink-0 text-muted-foreground transition-colors group-focus-within/capture:text-foreground" aria-hidden />
        <textarea
          id="quick-capture"
          ref={ref}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              save();
            }
          }}
          rows={1}
          maxLength={8000}
          placeholder="Capture a thought before it slips away…"
          className="min-h-[1.75rem] flex-1 resize-none bg-transparent font-serif text-lg leading-relaxed placeholder:italic placeholder:text-muted-foreground/70 focus:outline-none [field-sizing:content]"
        />
      </div>
      <div className="mt-2 flex items-center justify-between gap-3 pl-7 text-[11px] text-muted-foreground">
        <span>
          <kbd className="kbd">↵</kbd> to save · <kbd className="kbd">⇧</kbd><kbd className="kbd">↵</kbd> new line · #tag to tag it
        </span>
        <Button type="submit" size="sm" variant="ghost" className="h-7 rounded-full px-3 text-xs" disabled={!text.trim() || saving}>
          {saving && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
          Save
        </Button>
      </div>
    </form>
  );
}

type IdeaFilter = "inbox" | "converted" | "archived";

export function IdeasList({ refreshKey }: { refreshKey: number }) {
  const router = useRouter();
  const [filter, setFilter] = useState<IdeaFilter>("inbox");
  const [ideas, setIdeas] = useState<Idea[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setIdeas((await studioFetch<{ ideas: Idea[] }>(`/ideas?filter=${filter}`)).ideas);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't load ideas");
      setIdeas([]);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const act = async (id: string, fn: () => Promise<void>) => {
    setBusy(id);
    try {
      await fn();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  };

  const explore = (idea: Idea) =>
    act(idea.id, async () => {
      const run = await startRun({ workflow: "explore", ideaId: idea.id, input: { idea: idea.content } });
      router.push(`/admin/stories/runs/${run.id}`);
    });

  const convert = (idea: Idea) =>
    act(idea.id, async () => {
      const { documentId } = await studioFetch<{ documentId: string }>(`/ideas/${idea.id}/convert`, { method: "POST" });
      router.push(`/admin/stories/${documentId}`);
    });

  const setStatus = (idea: Idea, status: "new" | "archived") =>
    act(idea.id, async () => {
      await studioFetch(`/ideas/${idea.id}`, { method: "PATCH", json: { status } });
      await load();
    });

  const remove = (idea: Idea) => {
    if (!confirm("Delete this idea? This can't be undone.")) return;
    act(idea.id, async () => {
      await studioFetch(`/ideas/${idea.id}`, { method: "DELETE" });
      await load();
    });
  };

  return (
    <div className="space-y-4 pt-2">
      <div className="flex gap-1 text-sm" role="group" aria-label="Show ideas">
        {(["inbox", "converted", "archived"] as const).map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 text-xs transition-colors ${filter === f ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
          >
            {f === "inbox" ? "Inbox" : f === "converted" ? "Turned into drafts" : "Archived"}
          </button>
        ))}
      </div>
      {ideas === null ? (
        <div className="space-y-4 py-4" aria-label="Loading ideas">
          {[0, 1].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-muted/60" />
          ))}
        </div>
      ) : ideas.length === 0 ? (
        <p className="py-14 text-center font-serif text-xl text-foreground/70">
          {filter === "inbox" ? "Your inbox is empty. Capture a thought above." : "Nothing here."}
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2" aria-label="Ideas">
          {ideas.map((idea) => (
            <li key={idea.id} className="group flex flex-col justify-between gap-4 rounded-2xl border border-border/70 bg-background p-5 transition-shadow hover:shadow-[0_8px_24px_-16px_rgba(0,0,0,0.25)]">
              <div className="space-y-2">
                <p className="whitespace-pre-wrap font-serif text-[1.0625rem] leading-relaxed">{idea.content}</p>
                {idea.sources && idea.sources.length > 0 && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-ai">From your reading · {idea.sources.length} article{idea.sources.length === 1 ? "" : "s"}</summary>
                    <ul className="mt-1 space-y-0.5">
                      {idea.sources.map((src) => (
                        <li key={src.key}>
                          <a href={src.url} target="_blank" rel="noreferrer" className="hover:underline">
                            {src.title}
                          </a>{" "}
                          <span className="text-muted-foreground">· {src.publisher}</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
                <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                  {idea.tags.map((t) => (
                    <span key={t} className="text-foreground/70">
                      #{t}
                    </span>
                  ))}
                  <span>captured {formatWhen(idea.createdAt)}</span>
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1">
                {idea.status === "converted" && idea.linkedDocumentId ? (
                  <Button asChild size="sm" variant="secondary" className="h-8 rounded-full">
                    <Link href={`/admin/stories/${idea.linkedDocumentId}`}>
                      <FileText className="mr-1.5 h-3.5 w-3.5" /> Open draft
                    </Link>
                  </Button>
                ) : (
                  <>
                    <Button size="sm" variant="secondary" className="h-8 rounded-full" disabled={busy === idea.id} onClick={() => explore(idea)}>
                      <ListTree className="mr-1.5 h-3.5 w-3.5 text-ai" /> Explore and outline
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 rounded-full" disabled={busy === idea.id} onClick={() => convert(idea)}>
                      <FileText className="mr-1.5 h-3.5 w-3.5" /> Start a draft
                    </Button>
                    {idea.status === "archived" ? (
                      <Button size="sm" variant="ghost" className="h-8 rounded-full" disabled={busy === idea.id} onClick={() => setStatus(idea, "new")}>
                        <ArchiveRestore className="mr-1.5 h-3.5 w-3.5" /> Back to inbox
                      </Button>
                    ) : (
                      <Button size="sm" variant="ghost" className="h-8 rounded-full" disabled={busy === idea.id} onClick={() => setStatus(idea, "archived")}>
                        <Archive className="mr-1.5 h-3.5 w-3.5" /> Archive
                      </Button>
                    )}
                  </>
                )}
                <Button size="icon" variant="ghost" className="ml-auto h-8 w-8 rounded-full opacity-60 hover:opacity-100" aria-label="Delete idea" disabled={busy === idea.id} onClick={() => remove(idea)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
