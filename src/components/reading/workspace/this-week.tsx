"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Bot, Loader2, Play, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatWhen, studioFetch, StudioApiError } from "@/components/writing/client";
import { SetupCard } from "@/components/writing/setup-card";
import { ReadingListApproval, type ReadingListProposal } from "@/components/writing/agent/run-view";
import { isActive, useAgentRun } from "@/components/writing/agent/use-agent-run";
import { EmptyState, notifyReadingChanged } from "./shared";

// This week: the list as it builds up. The nightly agent adds finds, the
// author adds theirs (from Discover or by saving), and on Monday the agent
// drafts the intro and lines. The author approves right here; the run page
// is only the history of what the agent did.

interface Candidate {
  id: string;
  url: string;
  title: string;
  publisher: string;
  topic: string;
  score: string;
  reason: string;
  runId: string | null;
  createdAt: string;
}

interface Saved {
  id: string;
  title: string;
  url: string | null;
  publisher: string | null;
  note: string | null;
  status: string;
}

interface TriggerRow {
  id: string;
  key: string;
  enabled: boolean;
  scheduleText: string | null;
  lastStatus: string | null;
  lastRunId: string | null;
}

interface Data {
  shortlist: Candidate[];
  saved: Saved[];
  triggers: TriggerRow[];
  weekLabel: string;
  config: { minPicks: number; maxPicks: number };
}

function Who({ agent }: { agent: boolean }) {
  return agent ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-ai-soft px-2 py-0.5 text-[11px] font-medium text-ai">
      <Bot className="h-3 w-3" aria-hidden /> Agent
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground/80">
      <UserRound className="h-3 w-3" aria-hidden /> You
    </span>
  );
}

function Approval({ runId, onDone }: { runId: string; onDone: () => void }) {
  const { run, decide } = useAgentRun(runId);
  const [busy, setBusy] = useState(false);
  if (!run) return null;
  if (isActive(run)) {
    return (
      <div role="status" className="flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" /> The agent is drafting this week&apos;s list…
        <Link href={`/admin/stories/runs/${run.id}`} className="ml-auto text-muted-foreground underline underline-offset-2">
          Watch
        </Link>
      </div>
    );
  }
  if (run.status !== "WAITING_FOR_APPROVAL" || run.pendingApproval?.kind !== "reading_list_approval") return null;
  return (
    <section aria-label="Ready for your approval" className="space-y-3 rounded-2xl border border-ai/40 bg-ai-soft/40 p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-serif text-xl font-medium">Ready for you: {(run.pendingApproval.proposal as ReadingListProposal).title || "this week's list"}</h2>
        <Link href={`/admin/stories/runs/${run.id}`} className="text-xs text-muted-foreground underline underline-offset-2">
          What the agent did
        </Link>
      </div>
      <ReadingListApproval
        proposal={run.pendingApproval.proposal as ReadingListProposal}
        busy={busy}
        onDecide={async (action, decision) => {
          setBusy(true);
          try {
            const next = await decide(action, decision);
            if (action === "approve") toast.success("Approved. It's on your Reading page.");
            else if (action === "decline") toast.message("Skipped this week.");
            else toast.message("Asked for changes. A new draft is on its way.");
            if (next && !isActive(next)) onDone();
            notifyReadingChanged();
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Couldn't record that");
          } finally {
            setBusy(false);
          }
        }}
      />
    </section>
  );
}

export function ThisWeek() {
  const [data, setData] = useState<Data | null>(null);
  const [setupRequired, setSetupRequired] = useState(false);
  const [starting, setStarting] = useState(false);
  const [runId, setRunId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await studioFetch<Data>("/reading-agent");
      setData(d);
      const weekly = d.triggers.find((t) => t.key === "reading-weekly-list");
      if (weekly?.lastRunId && (weekly.lastStatus === "WAITING_FOR_APPROVAL" || weekly.lastStatus === "RUNNING" || weekly.lastStatus === "CREATED")) setRunId(weekly.lastRunId);
    } catch (e) {
      if (e instanceof StudioApiError && e.code === "SETUP_REQUIRED") setSetupRequired(true);
      else toast.error(e instanceof Error ? e.message : "Couldn't load this week");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const remove = async (c: Candidate) => {
    try {
      await studioFetch(`/reading-agent/candidates/${c.id}`, { method: "PATCH", json: { status: "dropped" } });
      setData((d) => (d ? { ...d, shortlist: d.shortlist.filter((x) => x.id !== c.id) } : d));
      notifyReadingChanged();
      toast.message("Removed. It won't be suggested again.", {
        action: {
          label: "Undo",
          onClick: async () => {
            await studioFetch(`/reading-agent/candidates/${c.id}`, { method: "PATCH", json: { status: "active" } });
            await load();
            notifyReadingChanged();
          },
        },
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't remove it");
    }
  };

  const draftNow = async (t: TriggerRow) => {
    setStarting(true);
    try {
      const out = await studioFetch<{ runId: string }>(`/triggers/${t.id}/run`, { method: "POST" });
      setRunId(out.runId);
      toast.success("Drafting now. It takes a minute or two; you can leave this page.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't start it");
    } finally {
      setStarting(false);
    }
  };

  if (setupRequired) return <SetupCard onReady={load} />;
  if (!data) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }

  const weekly = data.triggers.find((t) => t.key === "reading-weekly-list");
  const scout = data.triggers.find((t) => t.key === "reading-scout-nightly");
  const total = data.shortlist.length + data.saved.length;

  return (
    <div className="space-y-6">
      {runId && <Approval key={runId} runId={runId} onDone={() => { setRunId(null); load(); }} />}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border px-4 py-3 text-sm">
        <div className="min-w-0 flex-1">
          <p className="font-medium">
            Week of {data.weekLabel} · {total} pick{total === 1 ? "" : "s"} so far
          </p>
          <p className="text-xs text-muted-foreground">
            {weekly?.enabled ? `The agent drafts the list ${weekly.scheduleText?.toLowerCase() ?? "every Monday"} and waits for your approval.` : "The weekly draft is switched off. "}
            {!weekly?.enabled && (
              <Link href="/admin/reading/settings" className="underline underline-offset-2">
                Turn it on in settings
              </Link>
            )}
          </p>
        </div>
        {weekly && !runId && (
          <Button size="sm" variant="outline" className="h-9 gap-1.5 rounded-full" onClick={() => draftNow(weekly)} disabled={starting || total === 0}>
            {starting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            Draft the list now
          </Button>
        )}
      </div>

      {total === 0 ? (
        <EmptyState>
          Nothing for this week yet. Add articles from{" "}
          <Link href="/admin/reading" className="underline underline-offset-4">
            Discover
          </Link>
          , save some to your inbox, or let the nightly search find some.
        </EmptyState>
      ) : (
        <ul className="divide-y overflow-hidden rounded-2xl border" aria-label="This week's picks">
          {data.shortlist.map((c) => (
            <li key={c.id} className="flex gap-3 px-4 py-3.5 sm:px-5" aria-label={c.title}>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Who agent={Boolean(c.runId)} />
                  <span>{c.publisher}</span>
                  {c.topic && <span>· {c.topic}</span>}
                  <span>· added {formatWhen(c.createdAt)}</span>
                </div>
                <a href={c.url} target="_blank" rel="noreferrer" className="inline-flex items-start gap-1 font-serif text-[1.0625rem] leading-snug hover:underline">
                  {c.title || c.url}
                  <ArrowUpRight className="mt-1 h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
                </a>
                {c.reason && <p className="text-sm text-muted-foreground">{c.runId ? c.reason : c.reason.replace("You added it from the feed.", "You added it from Discover.")}</p>}
              </div>
              <Button variant="ghost" size="sm" className="h-9 shrink-0 rounded-full" onClick={() => remove(c)} aria-label={`Remove ${c.title}`}>
                Remove
              </Button>
            </li>
          ))}
          {data.saved.map((s) => (
            <li key={s.id} className="flex gap-3 px-4 py-3.5 sm:px-5" aria-label={s.title}>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Who agent={false} />
                  <span>{s.publisher}</span>
                  <span>· you saved it{s.status === "published" ? " and published it" : ""}</span>
                </div>
                {s.url ? (
                  <a href={s.url} target="_blank" rel="noreferrer" className="inline-flex items-start gap-1 font-serif text-[1.0625rem] leading-snug hover:underline">
                    {s.title}
                    <ArrowUpRight className="mt-1 h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
                  </a>
                ) : (
                  <p className="font-serif text-[1.0625rem]">{s.title}</p>
                )}
                {s.note && <p className="text-sm text-muted-foreground">Your note: {s.note}</p>}
              </div>
              <Link href={s.status === "published" ? "/admin/reading/published" : "/admin/reading/inbox"} className="inline-flex h-9 shrink-0 items-center rounded-full px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">
                {s.status === "published" ? "Published" : "In inbox"}
              </Link>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">
        The list keeps {data.config.minPicks}–{data.config.maxPicks} of these; you choose the final ones when you approve. Anything you remove is never suggested again.
        {scout?.lastRunId && (
          <>
            {" "}
            <Link href={`/admin/stories/runs/${scout.lastRunId}`} className="underline underline-offset-2">
              What the nightly search did
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
