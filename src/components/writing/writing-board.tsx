"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, ArrowUpRight, FileText, ListTree, Loader2, MoreHorizontal, PenLine, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { formatWhen, studioFetch, type StudioListItem } from "./client";
import { rememberActiveRun } from "./agent/assistant-panel";
import { startRun } from "./agent/use-agent-run";

// Posts by stage: Ideas → Outlining → Drafting → Published. One look shows
// the whole pipeline; an idea is one press from the editor ("Start
// writing" turns it into a post and starts the outline in the side panel).

export type Stage = "ideas" | "outlining" | "drafting" | "published";

/** Under this many words a draft is still an outline or notes. */
export const OUTLINE_WORDS = 300;

export function stageOf(doc: Pick<StudioListItem, "status" | "wordCount">): Exclude<Stage, "ideas"> {
  if (doc.status === "PUBLISHED") return "published";
  return doc.wordCount < OUTLINE_WORDS ? "outlining" : "drafting";
}

export const STAGES: Array<{ id: Stage; label: string; hint: string }> = [
  { id: "ideas", label: "Ideas", hint: "Captured, not started" },
  { id: "outlining", label: "Outlining", hint: `Notes and outlines, under ${OUTLINE_WORDS} words` },
  { id: "drafting", label: "Drafting", hint: "Being written" },
  { id: "published", label: "Published", hint: "Live on your site" },
];

interface Idea {
  id: string;
  content: string;
  tags: string[];
  createdAt: string;
}

function IdeaCard({ idea, onChanged }: { idea: Idea; onChanged: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (what: string, fn: () => Promise<void>) => {
    setBusy(what);
    try {
      await fn();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
      setBusy(null);
    }
  };

  // Idea → a post, with the outline step running in the editor's side panel
  const startWriting = () =>
    run("start", async () => {
      const { documentId } = await studioFetch<{ documentId: string }>(`/ideas/${idea.id}/convert`, { method: "POST" });
      let runId: string | null = null;
      try {
        runId = (await startRun({ workflow: "explore", documentId, input: { idea: idea.content.slice(0, 8000) } })).id;
        rememberActiveRun(documentId, runId);
      } catch {
        // No AI available: just open the post
      }
      router.push(`/admin/stories/${documentId}${runId ? `?run=${runId}` : ""}`);
    });

  const explore = () =>
    run("explore", async () => {
      const r = await startRun({ workflow: "explore", ideaId: idea.id, input: { idea: idea.content } });
      router.push(`/admin/stories/runs/${r.id}`);
    });

  const blank = () =>
    run("blank", async () => {
      const { documentId } = await studioFetch<{ documentId: string }>(`/ideas/${idea.id}/convert`, { method: "POST" });
      router.push(`/admin/stories/${documentId}`);
    });

  const archive = () =>
    run("archive", async () => {
      await studioFetch(`/ideas/${idea.id}`, { method: "PATCH", json: { status: "archived" } });
      setBusy(null);
      onChanged();
      toast.message("Archived", {
        action: {
          label: "Undo",
          onClick: async () => {
            await studioFetch(`/ideas/${idea.id}`, { method: "PATCH", json: { status: "new" } });
            onChanged();
          },
        },
      });
    });

  const remove = () => {
    if (!confirm("Delete this idea? This can't be undone.")) return;
    run("delete", async () => {
      await studioFetch(`/ideas/${idea.id}`, { method: "DELETE" });
      setBusy(null);
      onChanged();
    });
  };

  return (
    <li className="space-y-3 rounded-xl border bg-background p-3.5" aria-label={idea.content.slice(0, 80)}>
      <p className="line-clamp-4 whitespace-pre-wrap font-serif text-[0.9875rem] leading-relaxed">{idea.content}</p>
      <p className="flex flex-wrap gap-x-2 text-[11px] text-muted-foreground">
        {idea.tags.map((t) => (
          <span key={t} className="text-foreground/70">
            #{t}
          </span>
        ))}
        <span>{formatWhen(idea.createdAt)}</span>
      </p>
      <div className="flex items-center gap-1">
        <Button size="sm" className="h-8 flex-1 rounded-full text-xs" onClick={startWriting} disabled={Boolean(busy)} aria-label={`Start writing: ${idea.content.slice(0, 60)}`}>
          {busy === "start" ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <PenLine className="mr-1.5 h-3.5 w-3.5" />}
          Start writing
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full" disabled={Boolean(busy)} aria-label="More for this idea">
              {busy && busy !== "start" ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={explore}>
              <ListTree className="mr-2 h-4 w-4" /> Explore and outline first
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={blank}>
              <FileText className="mr-2 h-4 w-4" /> Start without the assistant
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={archive}>
              <Archive className="mr-2 h-4 w-4" /> Archive
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={remove} className="text-destructive">
              <Trash2 className="mr-2 h-4 w-4" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  );
}

function PostCard({ doc, onDelete }: { doc: StudioListItem; onDelete: (doc: StudioListItem) => void }) {
  return (
    <li className="group relative rounded-xl border bg-background p-3.5 transition-shadow hover:shadow-[0_8px_24px_-16px_rgba(0,0,0,0.25)]" aria-label={doc.title || "Untitled"}>
      <Link href={`/admin/stories/${doc.id}`} className="block rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <span className={cn("block font-serif text-[1.0625rem] leading-snug", !doc.title && "italic text-muted-foreground")}>{doc.title || "Untitled"}</span>
        {doc.excerpt && <span className="mt-1 line-clamp-2 block text-xs text-muted-foreground">{doc.excerpt}</span>}
        <span className="mt-2 flex flex-wrap gap-x-2 text-[11px] text-muted-foreground">
          <span>{doc.wordCount.toLocaleString()} words</span>
          <span>· {formatWhen(doc.updatedAt)}</span>
          {doc.hasUnpublishedChanges && <span className="text-amber-700">· unpublished changes</span>}
          {doc.liveChangedOutside && <span className="text-amber-700">· edited outside Studio</span>}
        </span>
      </Link>
      <div className="absolute right-2 top-2 flex gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
        {doc.liveIsPublished && doc.liveSlug && (
          <Button asChild variant="ghost" size="icon" className="h-7 w-7 rounded-full bg-background" aria-label="View live post">
            <a href={`/thoughts/${doc.liveSlug}`} target="_blank" rel="noreferrer">
              <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          </Button>
        )}
        {doc.status !== "PUBLISHED" && (
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full bg-background" aria-label={`Delete ${doc.title || "Untitled"}`} onClick={() => onDelete(doc)}>
            <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        )}
      </div>
    </li>
  );
}

export function WritingBoard({ documents, refreshKey, onDelete }: { documents: StudioListItem[]; refreshKey: number; onDelete: (doc: StudioListItem) => void }) {
  const [ideas, setIdeas] = useState<Idea[] | null>(null);
  const [phoneStage, setPhoneStage] = useState<Stage>("drafting");

  const loadIdeas = useCallback(async () => {
    try {
      setIdeas((await studioFetch<{ ideas: Idea[] }>("/ideas?filter=inbox")).ideas);
    } catch {
      setIdeas([]);
    }
  }, []);

  useEffect(() => {
    loadIdeas();
  }, [loadIdeas, refreshKey]);

  const columns: Record<Stage, number> = {
    ideas: ideas?.length ?? 0,
    outlining: documents.filter((d) => stageOf(d) === "outlining").length,
    drafting: documents.filter((d) => stageOf(d) === "drafting").length,
    published: documents.filter((d) => stageOf(d) === "published").length,
  };

  return (
    <div className="space-y-4">
      {/* Phones: one stage at a time */}
      <div role="group" aria-label="Stage" className="flex gap-1 overflow-x-auto rounded-full border p-0.5 text-sm md:hidden">
        {STAGES.map((s) => (
          <button key={s.id} type="button" aria-pressed={phoneStage === s.id} onClick={() => setPhoneStage(s.id)} className={cn("h-8 flex-1 shrink-0 whitespace-nowrap rounded-full px-2.5", phoneStage === s.id ? "bg-foreground text-background" : "text-muted-foreground")}>
            {s.label} {columns[s.id] > 0 && <span className="tabular-nums opacity-70">{columns[s.id]}</span>}
          </button>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        {STAGES.map((s) => {
          const docs = s.id === "ideas" ? [] : documents.filter((d) => stageOf(d) === s.id);
          return (
            <section key={s.id} aria-label={s.label} className={cn("min-w-0 space-y-3 rounded-2xl bg-muted/40 p-2.5", phoneStage !== s.id && "hidden md:block")}>
              <header className="flex items-baseline justify-between gap-2 px-1">
                <h2 className="text-[0.6875rem] font-medium uppercase tracking-[0.12em] text-muted-foreground" title={s.hint}>
                  {s.label}
                </h2>
                <span className="text-xs tabular-nums text-muted-foreground">{columns[s.id]}</span>
              </header>
              {s.id === "ideas" ? (
                ideas === null ? (
                  <div className="h-20 animate-pulse rounded-xl bg-muted" />
                ) : ideas.length === 0 ? (
                  <p className="px-1 pb-2 text-xs text-muted-foreground">No ideas waiting. Capture one above.</p>
                ) : (
                  <ul className="space-y-2" aria-label="Ideas">
                    {ideas.map((idea) => (
                      <IdeaCard key={idea.id} idea={idea} onChanged={loadIdeas} />
                    ))}
                  </ul>
                )
              ) : docs.length === 0 ? (
                <p className="px-1 pb-2 text-xs text-muted-foreground">{s.id === "published" ? "Nothing live yet." : "Nothing here."}</p>
              ) : (
                <ul className="space-y-2" aria-label={`${s.label} posts`}>
                  {docs.map((d) => (
                    <PostCard key={d.id} doc={d} onDelete={onDelete} />
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">Outlining means a post under {OUTLINE_WORDS} words; it moves to Drafting as it grows.</p>
    </div>
  );
}
