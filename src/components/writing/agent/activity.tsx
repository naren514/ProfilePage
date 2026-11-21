"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { meetsTarget, TARGETS } from "@/lib/agent/metrics";
import { formatWhen, studioFetch } from "../client";
import { PageHeader } from "../studio-ui";
import { RunView } from "./run-view";
import type { AgentRun } from "./use-agent-run";

const STATUS_LABEL: Record<AgentRun["status"], string> = {
  CREATED: "Starting",
  RUNNING: "Running",
  WAITING_FOR_APPROVAL: "Waiting for you",
  COMPLETED: "Done",
  FAILED: "Failed",
  CANCELLED: "Stopped",
};

export function RunStatusBadge({ status }: { status: AgentRun["status"] }) {
  const dot =
    status === "FAILED"
      ? "bg-red-500"
      : status === "COMPLETED"
        ? "bg-emerald-500"
        : status === "WAITING_FOR_APPROVAL"
          ? "bg-ai"
          : status === "RUNNING" || status === "CREATED"
            ? "bg-amber-500"
            : "border border-muted-foreground/60";
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-muted-foreground">
      <span aria-hidden className={"h-1.5 w-1.5 rounded-full " + dot} />
      {STATUS_LABEL[status]}
    </span>
  );
}

interface Stats {
  days: number;
  costUsd: number;
  requests: number;
  operations: Array<{ operation: string; requests: number; costUsd: number; inputTokens: number; outputTokens: number }>;
  suggestions: { decided: number; acceptanceRate: number | null; [status: string]: number | null };
  runs: { total: number; completed: number; failed: number; cancelled: number; waiting: number; failureRate: number | null };
  medianRunSeconds: number | null;
  recentFailures: Array<{ id: string; workflow: string; error: string | null; createdAt: string }>;
  agent?: { days: number; runs: number } & Record<AgentMetricKey, Rate>;
}

type Rate = { value: number | null; numerator: number; denominator: number };
type AgentMetricKey = keyof typeof TARGETS;

/** The agent PRD's success metrics against their targets (A0 baseline, then tracked). */
function AgentGoals({ agent }: { agent: NonNullable<Stats["agent"]> }) {
  const keys = Object.keys(TARGETS) as AgentMetricKey[];
  return (
    <section aria-label="Agent goals" className="space-y-3">
      <h2 className="text-sm font-medium text-muted-foreground">
        Agent goals · last {agent.days} days · {agent.runs} {agent.runs === 1 ? "run" : "runs"}
      </h2>
      <div className="overflow-x-auto rounded-2xl border">
        <table className="w-full text-sm">
          <caption className="sr-only">Agent success metrics against the PRD targets</caption>
          <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Metric</th>
              <th className="px-3 py-2 text-right font-medium">Now</th>
              <th className="px-3 py-2 text-right font-medium">Target</th>
              <th className="px-3 py-2 font-medium">
                <span className="sr-only">Status</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {keys.map((key) => {
              const r = agent[key];
              const t = TARGETS[key];
              const ok = meetsTarget(key, r);
              return (
                <tr key={key}>
                  <td className="px-3 py-1.5">{t.label}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">
                    {r.value === null ? "–" : Math.round(r.value * 100) + "%"}
                    <span className="ml-1 text-xs text-muted-foreground">
                      ({r.numerator}/{r.denominator})
                    </span>
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                    {t.op === ">=" ? "≥" : "≤"} {Math.round(t.value * 100)}%
                  </td>
                  <td className="px-3 py-1.5 text-xs">
                    {ok === null ? <span className="text-muted-foreground">No data yet</span> : ok ? <span className="text-emerald-700">On target</span> : <span className="text-amber-700">Below target</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const OPERATION_LABEL: Record<string, string> = {
  improve: "Improve clarity",
  flow: "Improve flow",
  shorten: "Shorten",
  expand: "Expand",
  simplify: "Simplify",
  grammar: "Fix grammar",
  style: "Rewrite in style",
  custom: "Custom edit",
  chat: "Chat",
  "tool:web.search": "Web search (Tavily)",
  "agent:explore": "Idea → outline",
  "agent:draft": "Outline → draft",
  "agent:research": "Research",
  "agent:review": "Editorial review",
  "agent:publish_prep": "Prepare to publish",
  "agent:learn": "Learn from feedback",
  "reading:note": "Reading note",
};

const usd = (n: number, digits = 2) => "$" + n.toFixed(digits);

function Metric({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-2xl bg-muted/40 p-4 ring-1 ring-border/60">
      <p className="text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
      <p className="mt-2 font-serif text-3xl tabular-nums leading-none">{value}</p>
      {detail && <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>}
    </div>
  );
}

/** Spend, acceptance and reliability at a glance (PRD §16 observability). */
function Health() {
  const [stats, setStats] = useState<Stats | null>(null);
  useEffect(() => {
    studioFetch<Stats>("/stats?days=30").then(setStats).catch(() => setStats(null));
  }, []);
  if (!stats) return null;
  const pct = (v: number | null) => (v === null ? "–" : Math.round(v * 100) + "%");
  return (
    <section aria-label="Last 30 days" className="space-y-4">
      <h2 className="text-sm font-medium text-muted-foreground">Last {stats.days} days</h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Metric label="AI spend" value={usd(stats.costUsd)} detail="estimated from your prices" />
        <Metric label="AI requests" value={String(stats.requests)} />
        <Metric label="Suggestions kept" value={pct(stats.suggestions.acceptanceRate)} detail={"of " + stats.suggestions.decided + " decided (incl. edited)"} />
        <Metric
          label="Workflow runs"
          value={stats.runs.completed + " done"}
          detail={stats.runs.failed + " failed · " + stats.runs.cancelled + " stopped · " + stats.runs.waiting + " waiting"}
        />
        <Metric
          label="Typical run time"
          value={stats.medianRunSeconds === null ? "–" : Math.round(stats.medianRunSeconds) + " s"}
          detail="median, including time waiting for you"
        />
      </div>
      {stats.operations.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border">
          <table className="w-full text-sm">
            <caption className="sr-only">AI cost by feature</caption>
            <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Feature</th>
                <th className="px-3 py-2 text-right font-medium">Requests</th>
                <th className="px-3 py-2 text-right font-medium">Tokens in / out</th>
                <th className="px-3 py-2 text-right font-medium">Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {stats.operations.map((o) => (
                <tr key={o.operation}>
                  <td className="px-3 py-1.5">{OPERATION_LABEL[o.operation] ?? o.operation}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{o.requests}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                    {o.inputTokens.toLocaleString()} / {o.outputTokens.toLocaleString()}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{usd(o.costUsd, 3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {stats.agent && <AgentGoals agent={stats.agent} />}
      {stats.recentFailures.length > 0 && (
        <div className="space-y-1">
          <p className="text-sm font-medium">Recent failures</p>
          <ul className="space-y-1 text-sm">
            {stats.recentFailures.map((f) => (
              <li key={f.id}>
                <Link href={"/admin/stories/runs/" + f.id} className="hover:underline">
                  {OPERATION_LABEL["agent:" + f.workflow] ?? f.workflow}
                </Link>{" "}
                <span className="text-muted-foreground">
                  · {formatWhen(f.createdAt)} · {f.error}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/** Every agent run, newest first: the audit trail (FR-AGENT-006). */
export function ActivityList() {
  const [runs, setRuns] = useState<(AgentRun & { documentTitle: string | null })[] | null>(null);
  useEffect(() => {
    studioFetch<{ runs: (AgentRun & { documentTitle: string | null })[] }>("/agent-runs?limit=100")
      .then((d) => setRuns(d.runs))
      .catch(() => setRuns([]));
  }, []);

  return (
    <div className="mx-auto max-w-5xl space-y-10">
      <PageHeader title="Activity" description="Every workflow run: what it did, the models and searches it used, what it cost, and who approved what." />
      <Health />
      {runs === null ? (
        <Loader2 className="h-6 w-6 animate-spin" aria-label="Loading" />
      ) : runs.length === 0 ? (
        <p className="text-muted-foreground">No runs yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border">
          <table className="w-full text-sm" aria-label="Workflow runs">
            <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Workflow</th>
                <th className="px-3 py-2 font-medium">Post</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">AI calls</th>
                <th className="px-3 py-2 font-medium">Cost</th>
                <th className="px-3 py-2 font-medium">Started</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {runs.map((r) => (
                <tr key={r.id} className="hover:bg-muted/30">
                  <td className="px-3 py-2">
                    <Link href={`/admin/stories/runs/${r.id}`} className="font-medium hover:underline">
                      {r.workflowLabel}
                    </Link>
                    {r.origin && r.origin !== "manual" && (
                      <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{r.origin === "cron" ? "scheduled" : "event"}</span>
                    )}
                  </td>
                  <td className="max-w-[16rem] truncate px-3 py-2 text-muted-foreground">
                    {r.documentId ? <Link href={`/admin/stories/${r.documentId}`} className="hover:underline">{r.documentTitle || "Untitled"}</Link> : r.workflow === "learn" ? "Writing style" : "Idea"}
                  </td>
                  <td className="px-3 py-2">
                    <RunStatusBadge status={r.status} />
                  </td>
                  <td className="px-3 py-2">
                    {r.usage.modelCalls}
                    {r.usage.toolCalls ? ` + ${r.usage.toolCalls} searches` : ""}
                  </td>
                  <td className="px-3 py-2">${r.usage.costUsd.toFixed(3)}</td>
                  <td className="px-3 py-2 text-muted-foreground">{formatWhen(r.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** A single run on its own page (used for Idea → outline, and from the activity list). */
export function RunPage({ runId }: { runId: string }) {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <RunView
        runId={runId}
        defaultShowLog
        renderHeader={(run) => (
          <div className="mb-6 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Button asChild variant="ghost" size="sm" className="-ml-3 rounded-full">
                <Link href="/admin/stories/activity">
                  <ArrowLeft className="mr-1 h-4 w-4" /> All activity
                </Link>
              </Button>
              {run.documentId && (
                <Button asChild variant="outline" size="sm">
                  <Link href={`/admin/stories/${run.documentId}`}>Open the post</Link>
                </Button>
              )}
            </div>
            {run.workflow === "explore" && typeof run.input.idea === "string" && (
              <blockquote className="whitespace-pre-wrap border-l-2 pl-3 text-sm text-muted-foreground">{run.input.idea}</blockquote>
            )}
          </div>
        )}
      />
    </div>
  );
}
