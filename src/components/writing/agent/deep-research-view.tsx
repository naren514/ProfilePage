"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, FileText, Lightbulb, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { studioFetch } from "../client";

// Deep research: the report as the author reviews it (approve, dig deeper,
// stop), and what they can do with it afterwards (add to the post, start a
// draft, save as an idea).

type Confidence = "high" | "medium" | "low";

export interface DeepReport {
  title: string;
  question: string;
  summary: string;
  sections: Array<{ question: string; findings: Array<{ text: string; sources: string[]; confidence: Confidence }> }>;
  disagreements: string[];
  openQuestions: string[];
  sources: Array<{ ref: string; url: string; title: string; publisher: string; publishedDate: string | null }>;
  review?: { rounds: number; verdict: string; openIssues: string[] };
}

type Decide = (action: "approve" | "regenerate" | "decline", decision?: Record<string, unknown>) => void;

const CONF: Record<Confidence, { label: string; cls: string }> = {
  high: { label: "Well supported", cls: "bg-emerald-500/10 text-emerald-800" },
  medium: { label: "Fairly supported", cls: "bg-amber-500/10 text-amber-800" },
  low: { label: "Tentative", cls: "bg-muted text-muted-foreground" },
};

export function ReportBody({ report }: { report: DeepReport }) {
  const num = new Map(report.sources.map((s, i) => [s.ref, i + 1]));
  return (
    <div className="space-y-4 text-sm" aria-label="Research report">
      <div className="space-y-1">
        <p className="font-serif text-lg leading-snug">{report.title}</p>
        <p className="text-muted-foreground">{report.summary}</p>
      </div>
      {report.sections.map((s, i) => (
        <section key={i} className="space-y-1.5" aria-label={s.question}>
          <h4 className="font-medium">{s.question}</h4>
          <ul className="space-y-1.5">
            {s.findings.map((f, k) => (
              <li key={k} className="leading-relaxed">
                <span className={cn("mr-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium", CONF[f.confidence].cls)}>{CONF[f.confidence].label}</span>
                {f.text}{" "}
                {f.sources
                  .filter((r) => num.has(r))
                  .map((r) => (
                    <a key={r} href={report.sources[num.get(r)! - 1].url} target="_blank" rel="noreferrer" className="text-xs text-ai hover:underline">
                      [{num.get(r)}]
                    </a>
                  ))}
              </li>
            ))}
          </ul>
        </section>
      ))}
      {report.disagreements.length > 0 && (
        <section className="space-y-1" aria-label="Where sources disagree">
          <h4 className="font-medium">Where sources disagree</h4>
          <ul className="list-disc space-y-1 pl-4 text-muted-foreground">
            {report.disagreements.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        </section>
      )}
      {report.openQuestions.length > 0 && (
        <section className="space-y-1" aria-label="Open questions">
          <h4 className="font-medium">Open questions</h4>
          <ul className="list-disc space-y-1 pl-4 text-muted-foreground">
            {report.openQuestions.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        </section>
      )}
      <details className="rounded-lg border p-2 text-xs">
        <summary className="cursor-pointer font-medium">{report.sources.length} sources</summary>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          {report.sources.map((s) => (
            <li key={s.ref}>
              <a href={s.url} target="_blank" rel="noreferrer" className="hover:underline">
                {s.title || s.url}
              </a>{" "}
              <span className="text-muted-foreground">
                · {s.publisher}
                {s.publishedDate ? ` · ${s.publishedDate}` : ""}
              </span>
            </li>
          ))}
        </ol>
      </details>
    </div>
  );
}

export function DeepResearchApproval({ report, busy, onDecide }: { report: DeepReport; busy: boolean; onDecide: Decide }) {
  const [note, setNote] = useState("");
  return (
    <div className="space-y-4">
      {report.review && (
        <p className="text-xs text-muted-foreground">
          Reviewed {report.review.rounds} time{report.review.rounds === 1 ? "" : "s"} before reaching you
          {report.review.openIssues.length ? ". The reviewer still noted: " + report.review.openIssues.join("; ") : "."}
        </p>
      )}
      <ReportBody report={report} />
      <div className="flex flex-wrap gap-1.5 [&_button]:h-8 [&_button]:rounded-full [&_button]:px-3 [&_button]:text-xs">
        <Button size="sm" disabled={busy} onClick={() => onDecide("approve", {})}>
          {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1.5 h-3.5 w-3.5" />}
          Use this report
        </Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => onDecide("decline")}>
          Stop here
        </Button>
      </div>
      <div className="space-y-1.5 border-t pt-3">
        <label htmlFor="deep-more" className="text-xs font-medium">
          Or dig deeper
        </label>
        <Textarea id="deep-more" value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={900} placeholder="e.g. find data from the last two years, and look for counter-evidence" />
        <Button size="sm" variant="outline" disabled={busy || !note.trim()} onClick={() => onDecide("regenerate", { instruction: note.trim() })} className="h-8 rounded-full px-3 text-xs">
          <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Keep researching with this
        </Button>
      </div>
    </div>
  );
}

/** After approval: add to the post, start a draft, or save as an idea. */
export function DeepResearchResult({ runId, report, html, applied, onInsert, createdId }: { runId: string; report: DeepReport; html: string; applied: boolean; onInsert?: () => void; createdId?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const act = async (what: "draft" | "idea") => {
    setBusy(what);
    try {
      if (what === "draft") {
        const { documentId } = await studioFetch<{ documentId: string }>(`/agent-runs/${runId}/apply`, { method: "POST", json: {} });
        router.push(`/admin/stories/${documentId}`);
      } else {
        await studioFetch<{ ideaId: string }>(`/agent-runs/${runId}/apply`, { method: "POST", json: { as: "idea" } });
        toast.success("Saved to your Ideas, with its sources");
        setBusy(null);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't do that");
      setBusy(null);
    }
  };
  return (
    <div className="space-y-4">
      <ReportBody report={report} />
      <div className="flex flex-wrap gap-1.5 [&_a]:h-8 [&_button]:h-8 [&_a]:rounded-full [&_button]:rounded-full [&_a]:text-xs [&_button]:text-xs">
        {onInsert && html && (
          <Button size="sm" disabled={applied} onClick={onInsert}>
            {applied ? "Added to the post" : "Add to my post"}
          </Button>
        )}
        {createdId ? (
          <Button size="sm" variant="outline" asChild>
            <Link href={`/admin/stories/${createdId}`}>Open the draft</Link>
          </Button>
        ) : (
          <Button size="sm" variant={onInsert ? "outline" : "default"} disabled={Boolean(busy)} onClick={() => act("draft")}>
            {busy === "draft" ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <FileText className="mr-1.5 h-3.5 w-3.5" />}
            Start a draft from this
          </Button>
        )}
        <Button size="sm" variant="ghost" disabled={Boolean(busy)} onClick={() => act("idea")}>
          {busy === "idea" ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Lightbulb className="mr-1.5 h-3.5 w-3.5" />}
          Save as an idea
        </Button>
      </div>
    </div>
  );
}
