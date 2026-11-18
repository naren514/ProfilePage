"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, ClipboardCheck, FileText, ListTree, Loader2, Search, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { formatWhen, studioFetch } from "../client";
import { ChatPanel } from "./chat-panel";
import { RunView, type EditorActions } from "./run-view";
import { startRun, type AgentRun } from "./use-agent-run";
import { tabListClass, tabTriggerClass } from "../documents-list";

const activeKey = (docId: string) => `writing-studio:active-run:${docId}`;

interface SourceRow {
  id: string;
  url: string;
  title: string;
  publisher: string;
  excerpt: string;
  query: string;
  retrievedAt: string;
}

/** Lets the editor's command menu start workflows and switch tabs. */
export interface AssistantControl {
  start(workflow: string, input?: Record<string, unknown>): void;
  openTab(tab: "workflows" | "chat" | "sources"): void;
}

const STATUS_WORD: Record<string, string> = {
  CREATED: "starting",
  RUNNING: "running",
  WAITING_FOR_APPROVAL: "waiting for you",
  COMPLETED: "done",
  FAILED: "failed",
  CANCELLED: "stopped",
};

/**
 * The editor's AI assistant: workflows (with progress and checkpoints), the
 * writing-partner chat and the research library for this post.
 */
export function AssistantPanel({
  documentId,
  actions,
  aiAvailable,
  aiReason,
  getText,
  pendingResearch,
  onResearchTaken,
  controlRef,
}: {
  documentId: string;
  actions: EditorActions;
  aiAvailable: boolean;
  aiReason?: string;
  getText: () => string;
  /** A question sent from elsewhere (e.g. "Research this" on a review finding). */
  pendingResearch: string | null;
  onResearchTaken: () => void;
  controlRef?: React.MutableRefObject<AssistantControl | null>;
}) {
  const [tab, setTab] = useState("workflows");
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [recent, setRecent] = useState<AgentRun[]>([]);
  const [researchAvailable, setResearchAvailable] = useState(true);
  const [question, setQuestion] = useState("");
  const [length, setLength] = useState("medium");
  const [starting, setStarting] = useState<string | null>(null);
  const [sources, setSources] = useState<SourceRow[] | null>(null);

  const loadRecent = useCallback(async () => {
    try {
      const data = await studioFetch<{ runs: AgentRun[]; researchAvailable: boolean }>(`/agent-runs?documentId=${documentId}&limit=10`);
      setRecent(data.runs);
      setResearchAvailable(data.researchAvailable);
    } catch {
      setRecent([]);
    }
  }, [documentId]);

  // Pick up a run left open in this browser (e.g. after a refresh)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(activeKey(documentId));
      if (saved) setActiveRunId(saved);
    } catch {
      // ignore
    }
    loadRecent();
  }, [documentId, loadRecent]);

  const open = useCallback(
    (id: string | null) => {
      setActiveRunId(id);
      try {
        if (id) localStorage.setItem(activeKey(documentId), id);
        else localStorage.removeItem(activeKey(documentId));
      } catch {
        // ignore
      }
    },
    [documentId]
  );

  const start = useCallback(
    async (workflow: string, input: Record<string, unknown> = {}) => {
      setStarting(workflow);
      try {
        const run = await startRun({ workflow, documentId, input });
        open(run.id);
        setTab("workflows");
        loadRecent();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't start");
      } finally {
        setStarting(null);
      }
    },
    [documentId, loadRecent, open]
  );

  useEffect(() => {
    if (!controlRef) return;
    controlRef.current = {
      start: (workflow, input) => start(workflow, input),
      openTab: (t) => {
        setTab(t);
        if (t === "workflows") setTimeout(() => document.getElementById(`research-q-${documentId}`)?.focus(), 50);
      },
    };
    return () => {
      controlRef.current = null;
    };
  }, [controlRef, start, documentId]);

  useEffect(() => {
    if (pendingResearch) {
      onResearchTaken();
      start("research", { question: `Is this accurate, and what's the evidence? "${pendingResearch.slice(0, 600)}"` });
    }
  }, [pendingResearch, onResearchTaken, start]);

  useEffect(() => {
    if (tab !== "sources") return;
    studioFetch<{ sources: SourceRow[] }>(`/documents/${documentId}/sources`)
      .then((d) => setSources(d.sources))
      .catch(() => setSources([]));
  }, [tab, documentId]);

  const disabled = !aiAvailable;

  /** One workflow as a row: icon, name, what it does. */
  const action = (id: string, label: string, description: string, icon: React.ReactNode, onClick: () => void, trailing?: React.ReactNode) => (
    <div className="group flex items-stretch">
      <button
        type="button"
        aria-label={label}
        aria-describedby={`wf-${id}-${documentId}`}
        disabled={disabled || Boolean(starting)}
        onClick={onClick}
        className="flex min-w-0 flex-1 items-start gap-3 rounded-xl px-2.5 py-2.5 text-left transition-colors hover:bg-background disabled:pointer-events-none disabled:opacity-50"
      >
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-ai-soft text-ai ring-1 ring-ai/10">
          {starting === id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">{label}</span>
          <span id={`wf-${id}-${documentId}`} className="block text-xs leading-snug text-muted-foreground">
            {description}
          </span>
        </span>
        <ArrowRight className="mt-1.5 h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
      </button>
      {trailing}
    </div>
  );

  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList className={cn(tabListClass, "w-full justify-start gap-4")}>
        <TabsTrigger value="workflows" className={cn(tabTriggerClass, "text-xs")}>
          Workflows
        </TabsTrigger>
        <TabsTrigger value="chat" className={cn(tabTriggerClass, "text-xs")}>
          Chat
        </TabsTrigger>
        <TabsTrigger value="sources" className={cn(tabTriggerClass, "text-xs")}>
          Sources
        </TabsTrigger>
      </TabsList>

      <TabsContent value="workflows" forceMount className="mt-4 space-y-5 data-[state=inactive]:hidden">
        {disabled && <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">{aiReason}</p>}
        {activeRunId ? (
          <RunView
            key={activeRunId}
            runId={activeRunId}
            actions={actions}
            onStatusChange={loadRecent}
            onClose={() => {
              open(null);
              loadRecent();
            }}
          />
        ) : (
          <div className="space-y-4">
            <div className="-mx-2.5 space-y-0.5">
              {action("explore", "Outline from my notes", "Angles, a thesis and two outlines to choose from", <ListTree className="h-3.5 w-3.5" />, () => {
                const text = getText().trim();
                if (text.split(/\s+/).length < 3) {
                  toast.error("Write a few words about the idea first.");
                  return;
                }
                start("explore", { idea: text.slice(0, 8000) });
              })}
              {action(
                "draft",
                "Write a draft from the outline",
                "Full prose in this post's style; you review it first",
                <FileText className="h-3.5 w-3.5" />,
                () => start("draft", { length }),
                <>
                  <label htmlFor={`draft-length-${documentId}`} className="sr-only">
                    Draft length
                  </label>
                  <select
                    id={`draft-length-${documentId}`}
                    value={length}
                    onChange={(e) => setLength(e.target.value)}
                    className="my-2.5 mr-1 h-7 self-start rounded-full border border-border bg-background px-2 text-[11px] text-muted-foreground"
                  >
                    <option value="short">Short</option>
                    <option value="medium">Medium</option>
                    <option value="long">Long</option>
                  </select>
                </>
              )}
              {action("review", "Editorial review", "A critical read that points at exact passages", <ClipboardCheck className="h-3.5 w-3.5" />, () => start("review"))}
              {action("publish_prep", "Prepare to publish", "Title, excerpt, URL and tag suggestions", <Wand2 className="h-3.5 w-3.5" />, () => start("publish_prep"))}
            </div>

            <form
              className="space-y-2 rounded-xl bg-background p-3 ring-1 ring-border"
              onSubmit={(e) => {
                e.preventDefault();
                if (question.trim().length >= 3) start("research", { question: question.trim() });
              }}
            >
              <label htmlFor={`research-q-${documentId}`} className="flex items-center gap-1.5 text-xs font-medium">
                <Search className="h-3.5 w-3.5 text-ai" /> Research a question or claim
              </label>
              <div className="flex gap-1.5">
                <input
                  id={`research-q-${documentId}`}
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="How common are failed data migrations?"
                  className="h-8 min-w-0 flex-1 rounded-lg bg-muted/60 px-2.5 text-sm placeholder:text-muted-foreground/70 focus:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                  disabled={disabled || !researchAvailable}
                />
                <button
                  type="submit"
                  className="inline-flex h-8 items-center rounded-lg bg-foreground px-3 text-xs font-medium text-background disabled:opacity-40"
                  disabled={disabled || !researchAvailable || question.trim().length < 3 || Boolean(starting)}
                >
                  {starting === "research" && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
                  Research
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {researchAvailable ? "Searches the web and cites only what it actually retrieved." : "Add TAVILY_API_KEY on the server to enable web research."}
              </p>
            </form>
          </div>
        )}

        {recent.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-muted-foreground">Recent runs</p>
              <Link href="/admin/stories/activity" className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground hover:text-foreground">
                All agent activity <ArrowUpRight className="h-3 w-3" aria-hidden />
              </Link>
            </div>
            <ul className="-mx-2.5 text-xs">
              {recent.slice(0, 6).map((r) => (
                <li key={r.id}>
                  <button type="button" className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left hover:bg-background" onClick={() => open(r.id)}>
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        aria-hidden
                        className={cn(
                          "h-1.5 w-1.5 shrink-0 rounded-full",
                          r.status === "COMPLETED"
                            ? "bg-emerald-500"
                            : r.status === "FAILED"
                              ? "bg-destructive"
                              : r.status === "WAITING_FOR_APPROVAL"
                                ? "bg-ai"
                                : "bg-muted-foreground/50"
                        )}
                      />
                      <span className="truncate">{r.workflowLabel}</span>
                    </span>
                    <span className="shrink-0 text-muted-foreground">
                      {STATUS_WORD[r.status] ?? r.status.toLowerCase()} · {formatWhen(r.createdAt)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </TabsContent>

      <TabsContent value="chat" forceMount className="mt-4 data-[state=inactive]:hidden">
        <ChatPanel documentId={documentId} disabledReason={disabled ? aiReason : undefined} />
      </TabsContent>

      <TabsContent value="sources" className="mt-4 space-y-3">
        <p className="text-xs text-muted-foreground">Everything research retrieved for this post, with what each source actually said.</p>
        {sources === null ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-label="Loading sources" />
        ) : sources.length === 0 ? (
          <p className="rounded-xl bg-background px-3 py-6 text-center text-xs text-muted-foreground ring-1 ring-border">No sources yet. Run a research workflow to collect some.</p>
        ) : (
          <ul className="space-y-2">
            {sources.map((s) => (
              <li key={s.id} className="rounded-xl bg-background p-3 text-xs ring-1 ring-border">
                <a href={s.url} target="_blank" rel="noreferrer" className="inline-flex items-start gap-1 text-sm font-medium leading-snug hover:underline">
                  {s.title || s.url} <ArrowUpRight className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                </a>
                <p className="mt-0.5 text-muted-foreground">
                  {s.publisher} · retrieved {formatWhen(s.retrievedAt)} · for &ldquo;{s.query}&rdquo;
                </p>
                <details className="mt-1.5">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Excerpt</summary>
                  <p className="mt-1 whitespace-pre-wrap leading-relaxed">{s.excerpt}</p>
                </details>
              </li>
            ))}
          </ul>
        )}
      </TabsContent>
    </Tabs>
  );
}
