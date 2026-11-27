"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatWhen, studioFetch } from "../client";
import { startRun, type AgentRun } from "./use-agent-run";
import { RunStatusBadge } from "./activity";

// AI → Deep research: ask a question, see the cost limit, start. The run
// keeps going on the server; past reports are listed below.

export function DeepResearchStart() {
  const router = useRouter();
  const [question, setQuestion] = useState("");
  const [starting, setStarting] = useState(false);
  const [limit, setLimit] = useState<number | null>(null);
  const [runs, setRuns] = useState<AgentRun[] | null>(null);

  useEffect(() => {
    studioFetch<{ settings: { deepResearchBudgetUsd?: number } }>("/ai/settings")
      .then((d) => setLimit(d.settings.deepResearchBudgetUsd ?? 2))
      .catch(() => {});
    studioFetch<{ runs: AgentRun[] }>("/agent-runs?limit=100")
      .then((d) => setRuns(d.runs.filter((r) => r.workflow === "deep_research")))
      .catch(() => setRuns([]));
  }, []);

  const start = async () => {
    setStarting(true);
    try {
      const run = await startRun({ workflow: "deep_research", input: { question: question.trim() } });
      router.push(`/admin/stories/runs/${run.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't start");
      setStarting(false);
    }
  };

  return (
    <div className="space-y-8">
      <form
        className="space-y-3 rounded-2xl border p-4 sm:p-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (question.trim().length >= 10) start();
        }}
      >
        <label htmlFor="deep-question" className="flex items-center gap-2 font-serif text-xl">
          <Search className="h-4 w-4 text-ai" aria-hidden /> What do you want to understand?
        </label>
        <Textarea id="deep-question" value={question} onChange={(e) => setQuestion(e.target.value)} rows={3} maxLength={1000} placeholder="e.g. Do low-cost index funds still beat active funds after fees, and where don't they?" />
        <p className="text-xs text-muted-foreground">
          The agent splits your question into a few parts, checks your own reading first, searches and reads many sources, and writes a report with citations and how well each point is supported. An editor reviews it before you see it. It takes a few minutes and keeps going if you close the page
          {limit !== null && (
            <>
              {" "}
              (stops at ${limit.toFixed(2)}; change it in{" "}
              <Link href="/admin/ai/settings" className="underline underline-offset-2">
                Settings &amp; cost
              </Link>
              )
            </>
          )}
          .
        </p>
        <Button type="submit" disabled={starting || question.trim().length < 10} className="gap-2 rounded-full">
          {starting && <Loader2 className="h-4 w-4 animate-spin" />}
          Start deep research
        </Button>
      </form>

      <section className="space-y-3" aria-label="Past research">
        <h2 className="text-[0.6875rem] font-medium uppercase tracking-[0.12em] text-muted-foreground">Past research</h2>
        {runs === null ? null : runs.length === 0 ? (
          <p className="text-sm text-muted-foreground">None yet.</p>
        ) : (
          <ul className="divide-y rounded-2xl border">
            {runs.map((r) => (
              <li key={r.id}>
                <Link href={`/admin/stories/runs/${r.id}`} className="flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-muted/40">
                  <span className="min-w-0 truncate">{String(r.input.question ?? "Research")}</span>
                  <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                    <RunStatusBadge status={r.status} /> {formatWhen(r.createdAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
