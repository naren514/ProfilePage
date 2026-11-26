"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, ChevronDown, ExternalLink, Loader2, RotateCcw, Search, Square, Wand2, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { studioFetch } from "../client";
import { isActive, markApplied, useAgentRun, wasApplied, type AgentEvent, type AgentRun } from "./use-agent-run";

/** What a run may do to the open post. All of it goes through the editor, so it's undoable. */
export interface EditorActions {
  insertHtml(html: string, mode: "append" | "replace"): Promise<boolean>;
  setMetadata(meta: { title?: string; excerpt?: string; slug?: string; tags?: string[] }): void;
  showQuote(quote: string): boolean;
  fixQuote(quote: string, instruction: string): void;
  research(question: string): void;
}

// ---------------------------------------------------------------------------

export function RunView({
  runId,
  actions,
  onClose,
  defaultShowLog = false,
  renderHeader,
  onStatusChange,
}: {
  runId: string;
  actions?: EditorActions;
  onClose?: () => void;
  defaultShowLog?: boolean;
  renderHeader?: (run: AgentRun) => React.ReactNode;
  onStatusChange?: () => void;
}) {
  const { run, events, error, decide, cancel, resume } = useAgentRun(runId);
  const [showLog, setShowLog] = useState(defaultShowLog);
  const status = run?.status;
  useEffect(() => {
    if (status) onStatusChange?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);
  const [busy, setBusy] = useState(false);

  if (!run) {
    return (
      <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  // Agent runs show their plan; the current activity is the turn, not a fixed step
  const currentLabel = run.agent ? `Turn ${run.currentStep + 1}: ${run.steps.find((s) => !s.done)?.label ?? "working"}` : run.steps[run.currentStep]?.label;

  return (
    <>
    {renderHeader?.(run)}
    <section
      aria-label={run.workflowLabel}
      className={cn(
        "overflow-hidden rounded-2xl bg-background ring-1",
        run.status === "WAITING_FOR_APPROVAL" ? "shadow-[0_10px_30px_-18px_hsl(var(--ai)/0.5)] ring-ai/30" : "ring-border"
      )}
    >
      <header className={cn("flex items-start justify-between gap-2 border-b px-4 py-3", run.status === "WAITING_FOR_APPROVAL" ? "border-ai/15 bg-ai-soft/70" : "border-border/70")}>
        <div className="min-w-0">
          <h3 className="text-[13px] font-medium">{run.workflowLabel}</h3>
          <p className="text-xs text-muted-foreground" aria-live="polite">
            <StatusLine run={run} currentLabel={currentLabel} />
          </p>
        </div>
        {onClose && !isActive(run) && (
          <button type="button" aria-label="Close" onClick={onClose} className="rounded-sm p-1 text-muted-foreground hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        )}
      </header>

      <div className="space-y-4 p-4">
        <ol className="relative space-y-2.5 text-xs before:absolute before:bottom-1.5 before:left-[6.5px] before:top-1.5 before:w-px before:bg-border" aria-label={run.agent ? "Plan" : "Steps"}>
          {run.steps.map((step, i) => {
            const running = isActive(run) && (run.agent ? i === run.steps.findIndex((x) => !x.done) : i === run.currentStep);
            return (
              <li key={step.id} className={cn("relative flex items-center gap-2.5", !step.done && !running && "text-muted-foreground")}>
                {step.done ? (
                  <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-foreground text-background" aria-label="done">
                    <Check className="h-2.5 w-2.5" strokeWidth={3} />
                  </span>
                ) : running ? (
                  <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-background ring-1 ring-ai/40" aria-label="in progress">
                    <Loader2 className="h-2.5 w-2.5 animate-spin text-ai" />
                  </span>
                ) : (
                  <span className="h-3.5 w-3.5 rounded-full border border-border bg-background" aria-hidden />
                )}
                {step.label}
              </li>
            );
          })}
        </ol>

        {error && isActive(run) && (
          <div role="alert" className="flex flex-wrap items-center gap-2 text-xs text-destructive">
            {error}
            <Button size="sm" variant="outline" className="h-7" onClick={resume}>
              Retry
            </Button>
          </div>
        )}

        {isActive(run) && (
          <Button size="sm" variant="outline" disabled={busy} onClick={() => act(cancel)}>
            <Square className="mr-1.5 h-3.5 w-3.5" /> Stop
          </Button>
        )}

        {run.status === "FAILED" && <p role="alert" className="text-sm text-destructive">{run.error}</p>}

        {run.status === "WAITING_FOR_APPROVAL" && run.pendingApproval && (
          <Approval run={run} busy={busy} actions={actions} onDecide={(action, decision) => act(() => decide(action, decision))} />
        )}

        {run.status === "COMPLETED" && <Result run={run} actions={actions} />}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-2 text-[11px] text-muted-foreground">
          <span>
            {run.usage.modelCalls} AI call{run.usage.modelCalls === 1 ? "" : "s"}
            {run.usage.toolCalls ? ` · ${run.usage.toolCalls} search${run.usage.toolCalls === 1 ? "" : "es"}` : ""} · ${run.usage.costUsd.toFixed(3)}
          </span>
          <button type="button" className="inline-flex items-center gap-1 hover:text-foreground" aria-expanded={showLog} onClick={() => setShowLog((s) => !s)}>
            Activity <ChevronDown className={cn("h-3 w-3 transition-transform", showLog && "rotate-180")} />
          </button>
        </div>
        {showLog && <Timeline events={events} />}
      </div>
    </section>
    </>
  );
}

function StatusLine({ run, currentLabel }: { run: AgentRun; currentLabel?: string }) {
  switch (run.status) {
    case "CREATED":
    case "RUNNING":
      return <>{currentLabel ? `${currentLabel}…` : "Starting…"} You can keep writing.</>;
    case "WAITING_FOR_APPROVAL":
      return <>Waiting for you: {run.pendingApproval?.title}</>;
    case "COMPLETED":
      return <>Done</>;
    case "FAILED":
      return <>Stopped with an error</>;
    case "CANCELLED":
      return <>Stopped. Finished steps are kept in the activity log.</>;
  }
}

export function Timeline({ events }: { events: AgentEvent[] }) {
  return (
    <ol className="max-h-64 space-y-1.5 overflow-y-auto border-l pl-3 text-[11px]" aria-label="Activity">
      {events.map((e) => (
        <li key={e.id}>
          <span className="text-muted-foreground">{new Date(e.createdAt).toLocaleTimeString()} · </span>
          <span className={cn(["failed", "budget_exceeded", "tool_error"].includes(e.type) && "text-destructive")}>{e.message}</span>
          {e.type === "model_call" && e.payload && (
            <span className="text-muted-foreground">
              {" "}
              ({String(e.payload.model)}, {String(e.payload.inputTokens)}+{String(e.payload.outputTokens)} tokens, ${Number(e.payload.costUsd ?? 0).toFixed(4)},{" "}
              {Math.round(Number(e.payload.ms ?? 0) / 100) / 10}s)
            </span>
          )}
          {e.type === "tool_call" && e.payload && <span className="text-muted-foreground"> ({String(e.payload.results)} results)</span>}
        </li>
      ))}
    </ol>
  );
}

// ---------------------------------------------------------------------------
// Checkpoints
// ---------------------------------------------------------------------------

type Decide = (action: "approve" | "regenerate" | "decline", decision?: Record<string, unknown>) => void;

function DecisionButtons({
  busy,
  primary,
  onPrimary,
  onDecide,
  disabled,
}: {
  busy: boolean;
  primary: string;
  onPrimary: () => void;
  onDecide: Decide;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1.5 pt-1 [&_button]:h-8 [&_button]:rounded-full [&_button]:px-3 [&_button]:text-xs">
      <Button size="sm" disabled={busy || disabled} onClick={onPrimary}>
        {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1.5 h-3.5 w-3.5" />}
        {primary}
      </Button>
      <Button size="sm" variant="outline" disabled={busy} onClick={() => onDecide("regenerate")}>
        <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> New options
      </Button>
      <Button size="sm" variant="ghost" disabled={busy} onClick={() => onDecide("decline")}>
        Stop here
      </Button>
    </div>
  );
}

function Choice({ name, checked, onChange, children }: { name: string; checked: boolean; onChange: () => void; children: React.ReactNode }) {
  return (
    <label className={cn("flex cursor-pointer gap-2.5 rounded-xl border p-3 text-sm transition-colors", checked ? "border-foreground/50 bg-muted/50" : "border-border/70 hover:bg-muted/30")}>
      <input type="radio" name={name} checked={checked} onChange={onChange} className="mt-1" />
      <span className="min-w-0">{children}</span>
    </label>
  );
}

function Approval({ run, busy, actions, onDecide }: { run: AgentRun; busy: boolean; actions?: EditorActions; onDecide: Decide }) {
  const pending = run.pendingApproval!;
  switch (pending.kind) {
    case "direction":
      return <DirectionApproval proposal={pending.proposal as DirectionProposal} busy={busy} onDecide={onDecide} />;
    case "outline":
      return <OutlineApproval proposal={pending.proposal as { outlines: Outline[] }} busy={busy} onDecide={onDecide} />;
    case "draft":
      return <DraftApproval run={run} proposal={pending.proposal as DraftProposal} busy={busy} actions={actions} onDecide={onDecide} />;
    case "findings":
      return <FindingsApproval run={run} proposal={pending.proposal as FindingsProposal} busy={busy} actions={actions} onDecide={onDecide} />;
    case "metadata":
      return <MetadataApproval run={run} proposal={pending.proposal as MetadataProposal} busy={busy} actions={actions} onDecide={onDecide} />;
    case "preferences":
      return <PreferencesApproval proposal={pending.proposal as PreferencesProposal} busy={busy} onDecide={onDecide} />;
    case "reading_list_approval":
      return <ReadingListApproval proposal={pending.proposal as ReadingListProposal} busy={busy} onDecide={onDecide} />;
    default:
      return <DecisionButtons busy={busy} primary="Continue" onPrimary={() => onDecide("approve")} onDecide={onDecide} />;
  }
}

interface ReadingListProposal {
  week: string;
  title: string;
  intro: string;
  picks: Array<{ ref: string; title: string; url: string; publisher: string; topic: string; line: string }>;
  review?: { rounds: number; verdict: string; openIssues: string[] };
  belowMinimum?: boolean;
}

/** The weekly reading list: choose picks, edit the intro and lines, then approve (the runner publishes). */
function ReadingListApproval({ proposal, busy, onDecide }: { proposal: ReadingListProposal; busy: boolean; onDecide: Decide }) {
  const [selected, setSelected] = useState<number[]>(proposal.picks.map((_, i) => i));
  const [intro, setIntro] = useState(proposal.intro);
  const [lines, setLines] = useState<string[]>(proposal.picks.map((p) => p.line));
  const [instruction, setInstruction] = useState("");
  const toggle = (i: number) => setSelected((s) => (s.includes(i) ? s.filter((x) => x !== i) : [...s, i].sort((a, b) => a - b)));
  const approve = () => {
    const edited: Record<string, string> = {};
    lines.forEach((l, i) => {
      if (l.trim() && l !== proposal.picks[i].line) edited[String(i)] = l.trim();
    });
    onDecide("approve", { selected, intro: intro.trim(), lines: edited });
  };
  const retry = () => {
    const removed = proposal.picks.filter((_, i) => !selected.includes(i)).map((p) => `"${p.title}"`);
    const note = [removed.length ? `Leave out ${removed.join(", ")}.` : "", instruction.trim()].filter(Boolean).join(" ");
    onDecide("regenerate", { instruction: note || "Try a different selection." });
  };
  return (
    <div className="space-y-4 text-sm">
      <p className="text-xs text-muted-foreground">
        Week {proposal.week}
        {proposal.review ? ` · reviewed ${proposal.review.rounds} time${proposal.review.rounds === 1 ? "" : "s"} before reaching you` : ""}
      </p>
      {proposal.review && proposal.review.openIssues.length > 0 && proposal.review.verdict !== "ready" && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-xs">
          <p className="font-medium">The reviewer still had notes:</p>
          <ul className="mt-1 list-disc pl-4">
            {proposal.review.openIssues.map((i, k) => (
              <li key={k}>{i}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="weekly-intro">Intro</Label>
        <Textarea id="weekly-intro" value={intro} onChange={(e) => setIntro(e.target.value)} rows={3} />
      </div>
      <fieldset className="space-y-2">
        <legend className="mb-1 font-medium">Picks ({selected.length} of {proposal.picks.length})</legend>
        {proposal.picks.map((p, i) => (
          <div key={p.ref} className={cn("space-y-1.5 rounded-xl border p-3", selected.includes(i) ? "border-foreground/40" : "border-border/60 opacity-60")}>
            <label className="flex cursor-pointer items-start gap-2.5">
              <input type="checkbox" checked={selected.includes(i)} onChange={() => toggle(i)} className="mt-1" aria-label={`Include ${p.title}`} />
              <span className="min-w-0">
                <a href={p.url} target="_blank" rel="noreferrer" className="font-medium hover:underline">
                  {p.title}
                </a>
                <span className="block text-xs text-muted-foreground">
                  {p.publisher}
                  {p.topic && ` · ${p.topic}`}
                </span>
              </span>
            </label>
            <Textarea value={lines[i]} onChange={(e) => setLines((l) => l.map((x, k) => (k === i ? e.target.value : x)))} rows={2} aria-label={`Line for ${p.title}`} disabled={!selected.includes(i)} />
          </div>
        ))}
      </fieldset>
      <div className="flex flex-wrap gap-1.5 [&_button]:h-8 [&_button]:rounded-full [&_button]:px-3 [&_button]:text-xs">
        <Button size="sm" disabled={busy || selected.length === 0} onClick={approve}>
          {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1.5 h-3.5 w-3.5" />}
          Approve and publish {selected.length}
        </Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => onDecide("decline")}>
          Skip this week
        </Button>
      </div>
      <div className="space-y-1.5 border-t pt-3">
        <Label htmlFor="weekly-instruction" className="text-xs">Or ask for changes</Label>
        <Textarea id="weekly-instruction" value={instruction} onChange={(e) => setInstruction(e.target.value)} rows={2} placeholder="e.g. make the intro two sentences" maxLength={900} />
        <Button size="sm" variant="outline" disabled={busy} onClick={retry} className="h-8 rounded-full px-3 text-xs">
          <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Try again with this
        </Button>
      </div>
    </div>
  );
}

interface DirectionProposal {
  angles: Array<{ title: string; summary: string }>;
  theses: string[];
  audiences: Array<{ name: string; why: string }>;
  questions: string[];
  counterarguments: string[];
}

function DirectionApproval({ proposal, busy, onDecide }: { proposal: DirectionProposal; busy: boolean; onDecide: Decide }) {
  const [angle, setAngle] = useState(0);
  const [thesis, setThesis] = useState(0);
  const [ownThesis, setOwnThesis] = useState("");
  const [audience, setAudience] = useState(0);
  const [notes, setNotes] = useState("");
  return (
    <div className="space-y-3 text-sm">
      <fieldset className="space-y-1.5">
        <legend className="mb-1 font-medium">Angle</legend>
        {proposal.angles.map((a, i) => (
          <Choice key={i} name="angle" checked={angle === i} onChange={() => setAngle(i)}>
            <span className="font-medium">{a.title}</span>
            <span className="block text-xs text-muted-foreground">{a.summary}</span>
          </Choice>
        ))}
      </fieldset>
      <fieldset className="space-y-1.5">
        <legend className="mb-1 font-medium">Thesis</legend>
        {proposal.theses.map((t, i) => (
          <Choice key={i} name="thesis" checked={thesis === i} onChange={() => setThesis(i)}>
            {t}
          </Choice>
        ))}
        <Choice name="thesis" checked={thesis === -1} onChange={() => setThesis(-1)}>
          <Input
            value={ownThesis}
            onFocus={() => setThesis(-1)}
            onChange={(e) => setOwnThesis(e.target.value)}
            placeholder="Or write your own"
            className="h-8"
            aria-label="Your own thesis"
          />
        </Choice>
      </fieldset>
      <fieldset className="space-y-1.5">
        <legend className="mb-1 font-medium">Audience</legend>
        {proposal.audiences.map((a, i) => (
          <Choice key={i} name="audience" checked={audience === i} onChange={() => setAudience(i)}>
            {a.name} <span className="text-xs text-muted-foreground">({a.why})</span>
          </Choice>
        ))}
      </fieldset>
      {(proposal.questions.length > 0 || proposal.counterarguments.length > 0) && (
        <details className="rounded-md border p-2 text-xs">
          <summary className="cursor-pointer font-medium">Questions and counterarguments to consider</summary>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            {proposal.questions.map((q, i) => (
              <li key={`q${i}`}>{q}</li>
            ))}
            {proposal.counterarguments.map((c, i) => (
              <li key={`c${i}`} className="text-muted-foreground">
                Counterpoint: {c}
              </li>
            ))}
          </ul>
        </details>
      )}
      <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Anything to add for the outline? (optional)" aria-label="Notes for the outline" />
      <DecisionButtons
        busy={busy}
        primary="Outline this"
        disabled={thesis === -1 && !ownThesis.trim()}
        onDecide={onDecide}
        onPrimary={() =>
          onDecide("approve", {
            angle: `${proposal.angles[angle]?.title}: ${proposal.angles[angle]?.summary}`,
            thesis: thesis === -1 ? ownThesis.trim() : proposal.theses[thesis],
            audience: proposal.audiences[audience]?.name,
            notes: notes.trim() || undefined,
          })
        }
      />
    </div>
  );
}

interface Outline {
  title: string;
  sections: Array<{ heading: string; points: string[] }>;
}

function OutlinePreview({ outline }: { outline: Outline }) {
  return (
    <div>
      <p className="font-medium">{outline.title}</p>
      <ol className="mt-1 list-decimal space-y-1 pl-5 text-xs">
        {outline.sections.map((s, i) => (
          <li key={i}>
            <span className="font-medium">{s.heading}</span>
            {s.points.length > 0 && <span className="block text-muted-foreground">{s.points.join(" · ")}</span>}
          </li>
        ))}
      </ol>
    </div>
  );
}

function OutlineApproval({ proposal, busy, onDecide }: { proposal: { outlines: Outline[] }; busy: boolean; onDecide: Decide }) {
  const [choice, setChoice] = useState(0);
  return (
    <div className="space-y-2 text-sm">
      {proposal.outlines.map((o, i) => (
        <Choice key={i} name="outline" checked={choice === i} onChange={() => setChoice(i)}>
          <OutlinePreview outline={o} />
        </Choice>
      ))}
      <DecisionButtons busy={busy} primary="Use this outline" onDecide={onDecide} onPrimary={() => onDecide("approve", { outlineIndex: choice })} />
    </div>
  );
}

interface DraftProposal {
  html: string;
  review: { summary: string; issues: string[] };
}

function DraftApproval({ run, proposal, busy, actions, onDecide }: { run: AgentRun; proposal: DraftProposal; busy: boolean; actions?: EditorActions; onDecide: Decide }) {
  const apply = async (mode: "append" | "replace") => {
    if (!actions) return;
    if (mode === "replace" && !confirm("Replace everything in the post with this draft? You can undo with Ctrl+Z, and the current text is saved in the version history.")) return;
    // Insert first, so the finished view knows it's already in the post
    if (!(await actions.insertHtml(proposal.html, mode))) return;
    markApplied(run.id);
    onDecide("approve", { mode });
  };
  return (
    <div className="space-y-2 text-sm">
      <div className="max-h-72 overflow-y-auto rounded-md border p-3">
        <div className="prose prose-sm prose-neutral max-w-none" dangerouslySetInnerHTML={{ __html: proposal.html }} />
      </div>
      <div className="rounded-md bg-muted/40 p-2 text-xs">
        <p className="font-medium">Structure check</p>
        <p className="mt-1">{proposal.review.summary}</p>
        {proposal.review.issues.length > 0 && (
          <ul className="mt-1 list-disc pl-4">
            {proposal.review.issues.map((issue, i) => (
              <li key={i}>{issue}</li>
            ))}
          </ul>
        )}
      </div>
      <p className="text-xs text-muted-foreground">Placeholders like [add: …] mark facts or examples only you can supply.</p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={busy || !actions} onClick={() => apply("append")}>
          <Check className="mr-1.5 h-3.5 w-3.5" /> Add below my notes
        </Button>
        <Button size="sm" variant="outline" disabled={busy || !actions} onClick={() => apply("replace")}>
          Replace my notes
        </Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => onDecide("regenerate")}>
          <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Rewrite
        </Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => onDecide("decline")}>
          Discard
        </Button>
      </div>
    </div>
  );
}

interface Source {
  id: string;
  ref: string;
  url: string;
  title: string;
  publisher: string;
  excerpt: string;
}

interface FindingsProposal {
  question: string;
  summary: string;
  findings: Array<{ statement: string; kind: "fact" | "interpretation"; sourceIds: string[]; unsupported: boolean }>;
  disagreements: string[];
  openQuestions: string[];
  sources: Source[];
}

function SourceChip({ source }: { source: Source }) {
  return (
    <a
      href={source.url}
      target="_blank"
      rel="noreferrer"
      title={`${source.title}\n\n${source.excerpt.slice(0, 300)}`}
      className="inline-flex max-w-full items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] hover:bg-muted"
    >
      <span className="truncate">{source.ref} · {source.publisher || source.title}</span>
      <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
    </a>
  );
}

function FindingsApproval({ run, proposal, busy, actions, onDecide }: { run: AgentRun; proposal: FindingsProposal; busy: boolean; actions?: EditorActions; onDecide: Decide }) {
  const [selected, setSelected] = useState<number[]>(proposal.findings.map((f, i) => (f.unsupported ? -1 : i)).filter((i) => i >= 0));
  const byId = new Map(proposal.sources.map((s) => [s.id, s]));
  const add = async () => {
    onDecide("approve", { selected });
    // The server builds the notes from the selection; apply them once the run finishes
    markPendingInsert(run.id);
  };
  return (
    <div className="space-y-3 text-sm">
      <p>{proposal.summary}</p>
      <ul className="space-y-2">
        {proposal.findings.map((f, i) => (
          <li key={i} className="rounded-md border p-2">
            <label className="flex gap-2">
              <input
                type="checkbox"
                className="mt-1"
                checked={selected.includes(i)}
                onChange={(e) => setSelected((s) => (e.target.checked ? [...s, i] : s.filter((x) => x !== i)))}
              />
              <span className="min-w-0 space-y-1">
                <span className="block">{f.statement}</span>
                <span className="flex flex-wrap gap-1">
                  {f.kind === "interpretation" && <Badge variant="outline">Interpretation</Badge>}
                  {f.unsupported && (
                    <Badge variant="destructive" className="gap-1">
                      <AlertTriangle className="h-3 w-3" /> No retrieved source
                    </Badge>
                  )}
                  {f.sourceIds.map((id) => byId.get(id)).filter((s): s is Source => Boolean(s)).map((s) => (
                    <SourceChip key={s.id} source={s} />
                  ))}
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      {proposal.disagreements.length > 0 && (
        <div className="text-xs">
          <p className="font-medium">Where sources disagree</p>
          <ul className="list-disc pl-4">{proposal.disagreements.map((d, i) => <li key={i}>{d}</li>)}</ul>
        </div>
      )}
      {proposal.openQuestions.length > 0 && (
        <div className="text-xs">
          <p className="font-medium">Still uncertain</p>
          <ul className="list-disc pl-4">{proposal.openQuestions.map((d, i) => <li key={i}>{d}</li>)}</ul>
        </div>
      )}
      <details className="text-xs">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">All {proposal.sources.length} sources retrieved</summary>
        <ul className="mt-1 space-y-1">
          {proposal.sources.map((s) => (
            <li key={s.id}>
              <SourceChip source={s} /> <span className="text-muted-foreground">{s.title}</span>
            </li>
          ))}
        </ul>
      </details>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={busy || selected.length === 0 || !actions} onClick={add}>
          <Check className="mr-1.5 h-3.5 w-3.5" /> Add {selected.length} to my post
        </Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => onDecide("approve", { selected: [] })}>
          Just keep the sources
        </Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => onDecide("regenerate")}>
          <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Summarize again
        </Button>
      </div>
    </div>
  );
}

interface MetadataProposal {
  titles: string[];
  excerpts: string[];
  slug: string;
  tags: string[];
}

function MetadataApproval({ run, proposal, busy, actions, onDecide }: { run: AgentRun; proposal: MetadataProposal; busy: boolean; actions?: EditorActions; onDecide: Decide }) {
  const [title, setTitle] = useState(0);
  const [excerpt, setExcerpt] = useState(0);
  const [slug, setSlug] = useState(proposal.slug);
  const [tags, setTags] = useState<string[]>(proposal.tags);
  const use = () => {
    const meta = { title: proposal.titles[title], excerpt: proposal.excerpts[excerpt], slug, tags };
    onDecide("approve", meta);
    actions?.setMetadata(meta);
    markApplied(run.id);
    toast.success("Details updated. Publish when you're ready.");
  };
  return (
    <div className="space-y-3 text-sm">
      <fieldset className="space-y-1.5">
        <legend className="mb-1 font-medium">Title</legend>
        {proposal.titles.map((t, i) => (
          <Choice key={i} name="title" checked={title === i} onChange={() => setTitle(i)}>
            {t}
          </Choice>
        ))}
      </fieldset>
      <fieldset className="space-y-1.5">
        <legend className="mb-1 font-medium">Excerpt</legend>
        {proposal.excerpts.map((t, i) => (
          <Choice key={i} name="excerpt" checked={excerpt === i} onChange={() => setExcerpt(i)}>
            {t}
          </Choice>
        ))}
      </fieldset>
      <div className="space-y-1">
        <label htmlFor={`slug-${run.id}`} className="font-medium">URL</label>
        <Input id={`slug-${run.id}`} value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"))} className="h-8 font-mono text-xs" />
      </div>
      <fieldset>
        <legend className="mb-1 font-medium">Tags</legend>
        <div className="flex flex-wrap gap-1.5">
          {proposal.tags.map((t) => (
            <label key={t} className="inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs">
              <input type="checkbox" checked={tags.includes(t)} onChange={(e) => setTags((s) => (e.target.checked ? [...s, t] : s.filter((x) => x !== t)))} />
              {t}
            </label>
          ))}
        </div>
      </fieldset>
      <DecisionButtons busy={busy} primary="Use these" onPrimary={use} onDecide={onDecide} disabled={!actions} />
    </div>
  );
}

interface PreferencesProposal {
  styleName: string;
  styleVersion: number;
  proposals: Array<{
    field: string;
    action: "add" | "remove";
    text: string;
    rationale: string;
    evidenceIds: string[];
    conflictsWith: string | null;
  }>;
  dropped: Array<{ text: string; why: string }>;
  evidence: Array<{ id: string; status: string; operation: string; reason: string | null; original: string; proposal: string; final: string | null }>;
}

const FIELD_LABEL: Record<string, string> = {
  voice: "Voice and tone",
  sentences: "Sentences and paragraphs",
  structure: "Structure",
  avoid: "Words to avoid",
  other: "Other preferences",
};

function PreferencesApproval({ proposal, busy, onDecide }: { proposal: PreferencesProposal; busy: boolean; onDecide: Decide }) {
  const [selected, setSelected] = useState<number[]>(proposal.proposals.map((p, i) => (p.conflictsWith ? -1 : i)).filter((i) => i >= 0));
  const byId = new Map(proposal.evidence.map((e) => [e.id, e]));
  return (
    <div className="space-y-3 text-sm">
      <p className="text-xs text-muted-foreground">
        Based on {proposal.evidence.length} suggestions you accepted, edited or rejected. Each change below is backed by at least two of them.
        Chosen changes are saved as a new version of &ldquo;{proposal.styleName}&rdquo;; you can restore the old one any time.
      </p>
      <ul className="space-y-2" aria-label="Proposed style changes">
        {proposal.proposals.map((p, i) => (
          <li key={i} className="rounded-md border p-2">
            <label className="flex gap-2">
              <input
                type="checkbox"
                className="mt-1"
                checked={selected.includes(i)}
                onChange={(e) => setSelected((s) => (e.target.checked ? [...s, i] : s.filter((x) => x !== i)))}
              />
              <span className="min-w-0 space-y-1">
                <span className="block text-xs text-muted-foreground">
                  {FIELD_LABEL[p.field] ?? p.field}: {p.action === "add" ? "add" : "remove"}
                </span>
                <span className="block font-medium">{p.text}</span>
                <span className="block text-xs">{p.rationale}</span>
                {p.conflictsWith && (
                  <span className="flex items-start gap-1 text-xs text-amber-700">
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> Conflicts with your current rule: &ldquo;{p.conflictsWith}&rdquo;
                  </span>
                )}
              </span>
            </label>
            <details className="mt-1 text-xs">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Evidence ({p.evidenceIds.length})</summary>
              <ul className="mt-1 space-y-1.5">
                {p.evidenceIds.map((id) => byId.get(id)).filter((e): e is PreferencesProposal["evidence"][number] => Boolean(e)).map((e) => (
                  <li key={e.id} className="rounded bg-muted/40 p-1.5">
                    <span className="font-medium capitalize">{e.status}</span> · {e.operation}
                    {e.reason ? ` · "${e.reason}"` : ""}
                    <span className="block text-muted-foreground">AI: {e.proposal}</span>
                    {e.final && <span className="block">You wrote: {e.final}</span>}
                  </li>
                ))}
              </ul>
            </details>
          </li>
        ))}
      </ul>
      {proposal.dropped.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">{proposal.dropped.length} idea(s) set aside</summary>
          <ul className="mt-1 list-disc pl-4">
            {proposal.dropped.map((d, i) => (
              <li key={i}>
                {d.text} <span className="text-muted-foreground">({d.why})</span>
              </li>
            ))}
          </ul>
        </details>
      )}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={busy || selected.length === 0} onClick={() => onDecide("approve", { selected })}>
          <Check className="mr-1.5 h-3.5 w-3.5" /> Apply {selected.length} change{selected.length === 1 ? "" : "s"}
        </Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => onDecide("regenerate")}>
          <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Look again
        </Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => onDecide("decline")}>
          Keep the style as it is
        </Button>
      </div>
    </div>
  );
}

// Research findings are inserted once the run has built the notes
const pendingInsertKey = (id: string) => `writing-studio:pending-insert:${id}`;
function markPendingInsert(id: string) {
  try {
    sessionStorage.setItem(pendingInsertKey(id), "1");
  } catch {
    // ignore
  }
}
function takePendingInsert(id: string): boolean {
  try {
    const had = sessionStorage.getItem(pendingInsertKey(id)) === "1";
    sessionStorage.removeItem(pendingInsertKey(id));
    return had;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

function Result({ run, actions }: { run: AgentRun; actions?: EditorActions }) {
  const router = useRouter();
  const [applied, setApplied] = useState(() => wasApplied(run.id));
  const [creating, setCreating] = useState(false);
  const result = run.result ?? {};
  const html = typeof result.html === "string" ? result.html : "";

  // Finish an "Add to my post" that was chosen at the research checkpoint
  useEffect(() => {
    if ((run.workflow === "research" || run.workflow === "research_agent") && html && actions && !applied && takePendingInsert(run.id)) {
      actions.insertHtml(html, "append").then((ok) => {
        if (ok) {
          markApplied(run.id);
          setApplied(true);
        }
      });
    }
  }, [run.id, run.workflow, html, actions, applied]);

  const insert = async (mode: "append" | "replace") => {
    if (!actions || !html) return;
    if (await actions.insertHtml(html, mode)) {
      markApplied(run.id);
      setApplied(true);
    }
  };

  if (run.workflow === "review") return <ReviewResult result={result as ReviewResultData} actions={actions} />;

  if (run.workflow === "explore") {
    const outline = result.outline as Outline | undefined;
    const createdId = result.appliedDocumentId as string | undefined;
    return (
      <div className="space-y-2 text-sm">
        {outline && <OutlinePreview outline={outline} />}
        {actions ? (
          <Button size="sm" disabled={applied} onClick={() => insert("append")}>
            {applied ? "Added to the post" : "Add outline to my post"}
          </Button>
        ) : createdId ? (
          <Button size="sm" asChild>
            <Link href={`/admin/stories/${createdId}`}>Open the draft</Link>
          </Button>
        ) : (
          <Button
            size="sm"
            disabled={creating}
            onClick={async () => {
              setCreating(true);
              try {
                const { documentId } = await studioFetch<{ documentId: string }>(`/agent-runs/${run.id}/apply`, { method: "POST" });
                router.push(`/admin/stories/${documentId}`);
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Couldn't create the draft");
                setCreating(false);
              }
            }}
          >
            {creating && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            Start a draft from this outline
          </Button>
        )}
      </div>
    );
  }

  if (run.workflow === "draft" || run.workflow === "research" || run.workflow === "research_agent") {
    if (!html) return <p className="text-sm text-muted-foreground">Done. Nothing was added to the post.</p>;
    return (
      <div className="space-y-2 text-sm">
        <p className="text-muted-foreground">{applied ? "Added to the post. Undo with Ctrl+Z." : "Ready to add to the post."}</p>
        {!applied && actions && (
          <Button size="sm" onClick={() => insert(result.mode === "replace" ? "replace" : "append")}>
            Add to my post
          </Button>
        )}
      </div>
    );
  }

  if (run.workflow === "learn") {
    const applied = Number(result.applied ?? 0);
    return (
      <div className="space-y-2 text-sm">
        <p>
          {applied > 0
            ? `Saved as version ${String(result.version)} with ${applied} change${applied === 1 ? "" : "s"}.`
            : String(result.reason ?? "No changes were made.")}
        </p>
        <Button asChild size="sm" variant="outline">
          <Link href="/admin/stories/styles">See the style</Link>
        </Button>
      </div>
    );
  }

  if (run.workflow === "publish_prep") {
    return <p className="text-sm text-muted-foreground">{applied ? "Title, excerpt, URL and tags were updated." : "Done."}</p>;
  }
  return <p className="text-sm text-muted-foreground">Done.</p>;
}

interface ReviewResultData {
  overall?: string;
  strengths?: string[];
  findings?: Array<{
    category: string;
    severity: "low" | "medium" | "high";
    quote: string;
    issue: string;
    suggestion: string;
    needsEvidence: boolean;
  }>;
}

function ReviewResult({ result, actions }: { result: ReviewResultData; actions?: EditorActions }) {
  const [dismissed, setDismissed] = useState<number[]>([]);
  const findings = (result.findings ?? []).map((f, i) => ({ ...f, i })).filter((f) => !dismissed.includes(f.i));
  return (
    <div className="space-y-3 text-sm">
      {result.overall && <p>{result.overall}</p>}
      {result.strengths && result.strengths.length > 0 && (
        <div className="text-xs">
          <p className="font-medium">What works</p>
          <ul className="list-disc pl-4">{result.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
        </div>
      )}
      {findings.length === 0 ? (
        <p className="text-xs text-muted-foreground">No open findings.</p>
      ) : (
        <ul className="space-y-2" aria-label="Review findings">
          {findings.map((f) => (
            <li key={f.i} className="space-y-1.5 rounded-md border p-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant={f.severity === "high" ? "destructive" : "secondary"} className="capitalize">
                  {f.category}
                </Badge>
                {f.needsEvidence && <Badge variant="outline">Needs a source</Badge>}
                <span className="text-[11px] text-muted-foreground">{f.severity}</span>
              </div>
              <blockquote className="border-l-2 pl-2 text-xs italic text-muted-foreground">{f.quote}</blockquote>
              <p>{f.issue}</p>
              {f.suggestion && <p className="text-xs text-muted-foreground">Suggestion: {f.suggestion}</p>}
              <div className="flex flex-wrap gap-1.5">
                {actions && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => {
                        if (!actions.showQuote(f.quote)) toast.error("That passage has changed, so it can't be found any more.");
                      }}
                    >
                      Show in text
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => actions.fixQuote(f.quote, `${f.issue} ${f.suggestion}`.trim())}
                    >
                      <Wand2 className="mr-1 h-3 w-3" /> Fix with AI
                    </Button>
                    {f.needsEvidence && (
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => actions.research(f.quote)}>
                        <Search className="mr-1 h-3 w-3" /> Research this
                      </Button>
                    )}
                  </>
                )}
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setDismissed((d) => [...d, f.i])}>
                  Dismiss
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
