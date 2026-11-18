"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, ClipboardCheck, ExternalLink, FileText, ListTree, Loader2, Search, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatWhen, studioFetch } from "../client";
import { ChatPanel } from "./chat-panel";
import { RunView, type EditorActions } from "./run-view";
import { startRun, type AgentRun } from "./use-agent-run";

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
}: {
  documentId: string;
  actions: EditorActions;
  aiAvailable: boolean;
  aiReason?: string;
  getText: () => string;
  /** A question sent from elsewhere (e.g. "Research this" on a review finding). */
  pendingResearch: string | null;
  onResearchTaken: () => void;
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

  const open = (id: string | null) => {
    setActiveRunId(id);
    try {
      if (id) localStorage.setItem(activeKey(documentId), id);
      else localStorage.removeItem(activeKey(documentId));
    } catch {
      // ignore
    }
  };

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [documentId, loadRecent]
  );

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
  const button = (id: string, label: string, icon: React.ReactNode, onClick: () => void, extraDisabled = false) => (
    <Button
      variant="outline"
      size="sm"
      className="h-auto justify-start gap-2 whitespace-normal py-2 text-left"
      disabled={disabled || extraDisabled || Boolean(starting)}
      onClick={onClick}
    >
      {starting === id ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : icon}
      <span>{label}</span>
    </Button>
  );

  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="workflows">Workflows</TabsTrigger>
        <TabsTrigger value="chat">Chat</TabsTrigger>
        <TabsTrigger value="sources">Sources</TabsTrigger>
      </TabsList>

      <TabsContent value="workflows" forceMount className="mt-3 space-y-3 data-[state=inactive]:hidden">
        {disabled && <p className="text-xs text-muted-foreground">{aiReason}</p>}
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
          <div className="space-y-2">
            <div className="grid gap-2">
              {button("explore", "Outline from my notes", <ListTree className="h-4 w-4 shrink-0" />, () => {
                const text = getText().trim();
                if (text.split(/\s+/).length < 3) {
                  toast.error("Write a few words about the idea first.");
                  return;
                }
                start("explore", { idea: text.slice(0, 8000) });
              })}
              <div className="flex items-center gap-1">
                {button("draft", "Write a draft from the outline", <FileText className="h-4 w-4 shrink-0" />, () => start("draft", { length }))}
                <label htmlFor={`draft-length-${documentId}`} className="sr-only">
                  Draft length
                </label>
                <select
                  id={`draft-length-${documentId}`}
                  value={length}
                  onChange={(e) => setLength(e.target.value)}
                  className="h-9 rounded-md border border-input bg-background px-1 text-xs"
                >
                  <option value="short">Short</option>
                  <option value="medium">Medium</option>
                  <option value="long">Long</option>
                </select>
              </div>
              {button("review", "Editorial review", <ClipboardCheck className="h-4 w-4 shrink-0" />, () => start("review"))}
              {button("publish_prep", "Prepare to publish", <Send className="h-4 w-4 shrink-0" />, () => start("publish_prep"))}
            </div>
            <form
              className="space-y-1.5 rounded-md border p-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (question.trim().length >= 3) start("research", { question: question.trim() });
              }}
            >
              <label htmlFor={`research-q-${documentId}`} className="flex items-center gap-1.5 text-xs font-medium">
                <Search className="h-3.5 w-3.5" /> Research a question or claim
              </label>
              <Input
                id={`research-q-${documentId}`}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="e.g. How common are failed data migrations?"
                className="h-8 text-sm"
                disabled={disabled || !researchAvailable}
              />
              {!researchAvailable && <p className="text-[11px] text-muted-foreground">Add TAVILY_API_KEY on the server to enable web research.</p>}
              <Button type="submit" size="sm" className="h-7" disabled={disabled || !researchAvailable || question.trim().length < 3 || Boolean(starting)}>
                {starting === "research" && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                Research
              </Button>
            </form>
          </div>
        )}

        {recent.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Recent runs</p>
            <ul className="divide-y rounded-md border text-xs">
              {recent.slice(0, 6).map((r) => (
                <li key={r.id}>
                  <button type="button" className="flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left hover:bg-muted/40" onClick={() => open(r.id)}>
                    <span className="truncate">{r.workflowLabel}</span>
                    <span className="shrink-0 text-muted-foreground">
                      {r.status === "WAITING_FOR_APPROVAL" ? "waiting for you" : r.status.toLowerCase()} · {formatWhen(r.createdAt)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <Link href="/admin/stories/activity" className="text-[11px] text-muted-foreground underline underline-offset-2 hover:text-foreground">
              All agent activity
            </Link>
          </div>
        )}
      </TabsContent>

      <TabsContent value="chat" forceMount className="mt-3 data-[state=inactive]:hidden">
        <ChatPanel documentId={documentId} disabledReason={disabled ? aiReason : undefined} />
      </TabsContent>

      <TabsContent value="sources" className="mt-3 space-y-2">
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <BookOpen className="h-3.5 w-3.5" /> Everything research retrieved for this post, with what each source actually said.
        </p>
        {sources === null ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-label="Loading sources" />
        ) : sources.length === 0 ? (
          <p className="text-xs text-muted-foreground">No sources yet. Run a research workflow to collect some.</p>
        ) : (
          <ul className="space-y-2">
            {sources.map((s) => (
              <li key={s.id} className="rounded-md border p-2 text-xs">
                <a href={s.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium hover:underline">
                  {s.title || s.url} <ExternalLink className="h-3 w-3" aria-hidden />
                </a>
                <p className="text-muted-foreground">
                  {s.publisher} · retrieved {formatWhen(s.retrievedAt)} · for &ldquo;{s.query}&rdquo;
                </p>
                <details className="mt-1">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Excerpt</summary>
                  <p className="mt-1 whitespace-pre-wrap">{s.excerpt}</p>
                </details>
              </li>
            ))}
          </ul>
        )}
      </TabsContent>
    </Tabs>
  );
}
