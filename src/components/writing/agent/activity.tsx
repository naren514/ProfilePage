"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatWhen, studioFetch } from "../client";
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
  const variant = status === "FAILED" ? "destructive" : status === "COMPLETED" ? "secondary" : status === "WAITING_FOR_APPROVAL" ? "default" : "outline";
  return <Badge variant={variant}>{STATUS_LABEL[status]}</Badge>;
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
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-3">
          <Link href="/admin/stories">
            <ArrowLeft className="mr-1 h-4 w-4" /> Thoughts
          </Link>
        </Button>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Agent activity</h1>
        <p className="text-muted-foreground">Every workflow run: what it did, which models and searches it used, what it cost, and who approved what.</p>
      </div>
      {runs === null ? (
        <Loader2 className="h-6 w-6 animate-spin" aria-label="Loading" />
      ) : runs.length === 0 ? (
        <p className="text-muted-foreground">No runs yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
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
                  </td>
                  <td className="max-w-[16rem] truncate px-3 py-2 text-muted-foreground">
                    {r.documentId ? <Link href={`/admin/stories/${r.documentId}`} className="hover:underline">{r.documentTitle || "Untitled"}</Link> : "Idea"}
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
              <Button asChild variant="ghost" size="sm" className="-ml-3">
                <Link href="/admin/stories">
                  <ArrowLeft className="mr-1 h-4 w-4" /> Thoughts
                </Link>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <Link href="/admin/stories/activity">All activity</Link>
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
