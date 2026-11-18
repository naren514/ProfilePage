"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, FileText, Lightbulb, ListTree, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
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
}

/** One field, Enter to save. Tags can be added inline with #tag. */
export function QuickCapture({ onSaved }: { onSaved: () => void }) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

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
      className="flex items-start gap-2 rounded-lg border border-dashed p-2 focus-within:border-solid focus-within:border-foreground/40"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <Lightbulb className="mt-2 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <label htmlFor="quick-capture" className="sr-only">
        Capture an idea
      </label>
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
        placeholder="Capture a thought… (Enter to save, Shift+Enter for a new line, #tag to tag it)"
        className="min-h-[2.25rem] flex-1 resize-y bg-transparent py-1.5 text-sm placeholder:text-muted-foreground/70 focus:outline-none"
      />
      <Button type="submit" size="sm" disabled={!text.trim() || saving}>
        {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
        Save
      </Button>
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
    <div className="space-y-3">
      <div className="flex gap-1 text-sm" role="group" aria-label="Show ideas">
        {(["inbox", "converted", "archived"] as const).map((f) => (
          <Button key={f} size="sm" variant={filter === f ? "secondary" : "ghost"} aria-pressed={filter === f} onClick={() => setFilter(f)}>
            {f === "inbox" ? "Inbox" : f === "converted" ? "Turned into drafts" : "Archived"}
          </Button>
        ))}
      </div>
      {ideas === null ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin" aria-label="Loading ideas" />
        </div>
      ) : ideas.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {filter === "inbox" ? "No ideas yet. Capture one above." : "Nothing here."}
        </p>
      ) : (
        <ul className="divide-y rounded-lg border border-border/60" aria-label="Ideas">
          {ideas.map((idea) => (
            <li key={idea.id} className="space-y-2 p-4">
              <p className="whitespace-pre-wrap text-sm">{idea.content}</p>
              <div className="flex flex-wrap items-center gap-2">
                {idea.tags.map((t) => (
                  <Badge key={t} variant="secondary">
                    {t}
                  </Badge>
                ))}
                <span className="text-xs text-muted-foreground">captured {formatWhen(idea.createdAt)}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {idea.status === "converted" && idea.linkedDocumentId ? (
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/admin/stories/${idea.linkedDocumentId}`}>
                      <FileText className="mr-1.5 h-3.5 w-3.5" /> Open draft
                    </Link>
                  </Button>
                ) : (
                  <>
                    <Button size="sm" variant="outline" disabled={busy === idea.id} onClick={() => explore(idea)}>
                      <ListTree className="mr-1.5 h-3.5 w-3.5" /> Explore and outline
                    </Button>
                    <Button size="sm" variant="outline" disabled={busy === idea.id} onClick={() => convert(idea)}>
                      <FileText className="mr-1.5 h-3.5 w-3.5" /> Start a draft
                    </Button>
                    {idea.status === "archived" ? (
                      <Button size="sm" variant="ghost" disabled={busy === idea.id} onClick={() => setStatus(idea, "new")}>
                        <ArchiveRestore className="mr-1.5 h-3.5 w-3.5" /> Back to inbox
                      </Button>
                    ) : (
                      <Button size="sm" variant="ghost" disabled={busy === idea.id} onClick={() => setStatus(idea, "archived")}>
                        <Archive className="mr-1.5 h-3.5 w-3.5" /> Archive
                      </Button>
                    )}
                  </>
                )}
                <Button size="sm" variant="ghost" aria-label="Delete idea" disabled={busy === idea.id} onClick={() => remove(idea)}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
