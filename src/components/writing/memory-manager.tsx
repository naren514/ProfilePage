"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Download, GraduationCap, Loader2, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { SetupCard } from "./setup-card";
import { formatWhen, StudioApiError, studioFetch } from "./client";
import { WordDiff } from "./word-diff";
import { RunView } from "./agent/run-view";
import { startRun } from "./agent/use-agent-run";

interface StyleOption {
  id: string;
  name: string;
  isDefault: boolean;
}

interface Sample {
  id: string;
  content: string;
  label: string;
  sourceDocumentId: string | null;
  sourceTitle: string;
  note: string;
  styleIds: string[];
  enabled: boolean;
  createdAt: string;
}

interface FeedbackItem {
  id: string;
  documentId: string;
  documentTitle: string;
  operation: string;
  instruction: string | null;
  styleId: string | null;
  status: string;
  reason: string | null;
  original: string;
  proposal: string;
  final: string | null;
  model: string;
  createdAt: string;
  resolvedAt: string | null;
}

const STATUS_LABEL: Record<string, string> = {
  accepted: "Accepted",
  modified: "Edited, then accepted",
  rejected: "Rejected",
  stale: "Went stale",
  cancelled: "Stopped",
};

export function MemoryManager() {
  const [styles, setStyles] = useState<StyleOption[]>([]);
  const [setupRequired, setSetupRequired] = useState(false);

  useEffect(() => {
    studioFetch<{ styles: StyleOption[] }>("/styles")
      .then((d) => setStyles(d.styles))
      .catch((e) => {
        if (e instanceof StudioApiError && e.code === "SETUP_REQUIRED") setSetupRequired(true);
      });
  }, []);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-3">
            <Link href="/admin/stories">
              <ArrowLeft className="mr-1 h-4 w-4" /> Thoughts
            </Link>
          </Button>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Writing memory</h1>
          <p className="max-w-2xl text-muted-foreground">
            What the AI knows about how you write: samples you chose, and your feedback on its suggestions. Feedback never changes a style
            by itself; it&apos;s only used when you ask for suggested style changes, and you approve each one.
          </p>
        </div>
        <Button asChild variant="outline">
          <a href="/api/admin/writing/memory/export" download>
            <Download className="mr-2 h-4 w-4" /> Export (JSON)
          </a>
        </Button>
      </div>
      {setupRequired ? (
        <SetupCard onReady={() => window.location.reload()} />
      ) : (
        <Tabs defaultValue="samples">
          <TabsList>
            <TabsTrigger value="samples">Samples</TabsTrigger>
            <TabsTrigger value="feedback">Feedback</TabsTrigger>
            <TabsTrigger value="learn">Learn</TabsTrigger>
          </TabsList>
          <TabsContent value="samples" className="mt-6">
            <SamplesTab styles={styles} />
          </TabsContent>
          <TabsContent value="feedback" className="mt-6">
            <FeedbackTab styles={styles} />
          </TabsContent>
          <TabsContent value="learn" className="mt-6">
            <LearnTab styles={styles} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function StyleChips({ styles, value, onChange }: { styles: StyleOption[]; value: string[]; onChange: (ids: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {styles.map((s) => {
        const on = value.includes(s.id);
        return (
          <button
            key={s.id}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((v) => v !== s.id) : [...value, s.id])}
            className={`rounded-full border px-2.5 py-0.5 text-xs ${on ? "border-foreground bg-foreground text-background" : "hover:bg-muted"}`}
          >
            {s.name}
          </button>
        );
      })}
    </div>
  );
}

function SamplesTab({ styles }: { styles: StyleOption[] }) {
  const [samples, setSamples] = useState<Sample[] | null>(null);
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ content: "", label: "", note: "", styleIds: [] as string[] });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (q = "") => {
    try {
      setSamples((await studioFetch<{ samples: Sample[] }>(`/samples${q ? `?q=${encodeURIComponent(q)}` : ""}`)).samples);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't load samples");
      setSamples([]);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(query), 250);
    return () => clearTimeout(t);
  }, [query, load]);

  const save = async () => {
    setSaving(true);
    try {
      await studioFetch("/samples", { method: "POST", json: draft });
      toast.success("Sample saved");
      setDraft({ content: "", label: "", note: "", styleIds: [] });
      setAdding(false);
      load(query);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save");
    } finally {
      setSaving(false);
    }
  };

  const update = async (sample: Sample, patch: Partial<Sample>) => {
    setSamples((list) => list?.map((s) => (s.id === sample.id ? { ...s, ...patch } : s)) ?? null);
    try {
      await studioFetch(`/samples/${sample.id}`, { method: "PATCH", json: patch });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't update");
      load(query);
    }
  };

  const remove = async (sample: Sample) => {
    if (!confirm("Delete this sample?")) return;
    await studioFetch(`/samples/${sample.id}`, { method: "DELETE" });
    load(query);
  };

  const styleName = (id: string) => styles.find((s) => s.id === id)?.name ?? "Removed style";

  return (
    <div className="max-w-3xl space-y-4">
      <p className="text-sm text-muted-foreground">
        Passages that sound like you. For each AI request, the two samples most relevant to the text are shown to the AI as voice examples (only
        enabled samples linked to the post&apos;s style, or to no style). Save one from the editor by selecting text, then More → Save as writing
        sample.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search samples" aria-label="Search samples" className="pl-9" />
        </div>
        <Button variant="outline" onClick={() => setAdding((a) => !a)}>
          <Plus className="mr-1.5 h-4 w-4" /> Add a sample
        </Button>
      </div>

      {adding && (
        <form
          className="space-y-3 rounded-lg border p-4"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="sample-content">Text</Label>
            <Textarea id="sample-content" rows={5} value={draft.content} onChange={(e) => setDraft({ ...draft, content: e.target.value })} maxLength={6000} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="sample-label">Label (optional)</Label>
              <Input id="sample-label" value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} placeholder="e.g. A good opening" maxLength={120} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sample-note">Where it&apos;s from (optional)</Label>
              <Input id="sample-note" value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} placeholder="e.g. Newsletter, March" maxLength={500} />
            </div>
          </div>
          <div className="space-y-1.5">
            <p className="text-sm font-medium">Styles it shows (none = all styles)</p>
            <StyleChips styles={styles} value={draft.styleIds} onChange={(styleIds) => setDraft({ ...draft, styleIds })} />
          </div>
          <Button type="submit" disabled={saving || draft.content.trim().length < 20}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save sample
          </Button>
        </form>
      )}

      {samples === null ? (
        <Loader2 className="h-5 w-5 animate-spin" aria-label="Loading samples" />
      ) : samples.length === 0 ? (
        <p className="py-6 text-sm text-muted-foreground">{query ? "No samples match." : "No samples yet."}</p>
      ) : (
        <ul className="space-y-3" aria-label="Writing samples">
          {samples.map((s) => (
            <li key={s.id} className={`space-y-2 rounded-lg border p-4 ${s.enabled ? "" : "opacity-60"}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  {s.label && <p className="font-medium">{s.label}</p>}
                  <p className="text-xs text-muted-foreground">
                    {s.sourceDocumentId ? (
                      <>
                        From <Link href={`/admin/stories/${s.sourceDocumentId}`} className="underline underline-offset-2">{s.sourceTitle || "a post"}</Link>
                      </>
                    ) : (
                      s.note || "Added by hand"
                    )}{" "}
                    · saved {formatWhen(s.createdAt)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <label className="flex items-center gap-1.5 text-xs">
                    <Switch checked={s.enabled} onCheckedChange={(enabled) => update(s, { enabled })} aria-label={s.enabled ? "Disable sample" : "Enable sample"} />
                    {s.enabled ? "Used" : "Off"}
                  </label>
                  <Button size="icon" variant="ghost" aria-label="Delete sample" onClick={() => remove(s)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
              <p className="whitespace-pre-wrap text-sm">{s.content}</p>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">{s.styleIds.length ? `Styles: ${s.styleIds.map(styleName).join(", ")}` : "Used for every style"}</p>
                <StyleChips styles={styles} value={s.styleIds} onChange={(styleIds) => update(s, { styleIds })} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function FeedbackTab({ styles }: { styles: StyleOption[] }) {
  const [items, setItems] = useState<FeedbackItem[] | null>(null);
  const [status, setStatus] = useState("");

  const load = useCallback(async () => {
    try {
      setItems((await studioFetch<{ feedback: FeedbackItem[] }>(`/feedback${status ? `?status=${status}` : ""}`)).feedback);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't load feedback");
      setItems([]);
    }
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  const remove = async (item: FeedbackItem) => {
    await studioFetch(`/feedback/${item.id}`, { method: "DELETE" });
    setItems((list) => list?.filter((i) => i.id !== item.id) ?? null);
  };

  const clearAll = async () => {
    if (!confirm("Delete all feedback? The AI will no longer be able to learn from past suggestions. This can't be undone.")) return;
    const { deleted } = await studioFetch<{ deleted: number }>("/feedback?confirm=all", { method: "DELETE" });
    toast.success(`Deleted ${deleted} feedback records`);
    load();
  };

  const styleName = (id: string | null) => (id ? styles.find((s) => s.id === id)?.name ?? "Removed style" : "No style");

  return (
    <div className="max-w-3xl space-y-4">
      <p className="text-sm text-muted-foreground">
        Every AI suggestion you accepted, edited, rejected or stopped. Delete any you don&apos;t want the AI to learn from.
      </p>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1" role="group" aria-label="Filter feedback">
          {["", "accepted", "modified", "rejected"].map((s) => (
            <Button key={s} size="sm" variant={status === s ? "secondary" : "ghost"} aria-pressed={status === s} onClick={() => setStatus(s)}>
              {s ? STATUS_LABEL[s] : "All"}
            </Button>
          ))}
        </div>
        <Button size="sm" variant="ghost" className="text-destructive" onClick={clearAll}>
          Delete all feedback
        </Button>
      </div>
      {items === null ? (
        <Loader2 className="h-5 w-5 animate-spin" aria-label="Loading feedback" />
      ) : items.length === 0 ? (
        <p className="py-6 text-sm text-muted-foreground">No feedback yet. It builds up as you accept or reject AI suggestions.</p>
      ) : (
        <ul className="space-y-3" aria-label="Feedback">
          {items.map((item) => (
            <li key={item.id} className="space-y-2 rounded-lg border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Badge variant={item.status === "rejected" ? "destructive" : item.status === "modified" ? "outline" : "secondary"}>{STATUS_LABEL[item.status] ?? item.status}</Badge>
                  <span className="capitalize">{item.operation}</span>
                  <span className="text-muted-foreground">
                    · {styleName(item.styleId)} · {item.documentTitle || "Untitled"} · {formatWhen(item.resolvedAt ?? item.createdAt)}
                  </span>
                </div>
                <Button size="icon" variant="ghost" aria-label="Delete this feedback" onClick={() => remove(item)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              {item.reason && <p className="text-sm">Reason: &ldquo;{item.reason}&rdquo;</p>}
              <WordDiff before={item.original} after={item.status === "modified" && item.final ? item.final : item.proposal} />
              {item.status === "modified" && item.final && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground">The AI&apos;s version before your edit</summary>
                  <p className="mt-1 whitespace-pre-wrap">{item.proposal}</p>
                </details>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function LearnTab({ styles }: { styles: StyleOption[] }) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [runId, setRunId] = useState<string | null>(null);
  const [starting, setStarting] = useState<string | null>(null);

  const loadCounts = useCallback(() => {
    studioFetch<{ evidenceByStyle: Record<string, number> }>("/memory/stats")
      .then((d) => setCounts(d.evidenceByStyle))
      .catch(() => {});
  }, []);

  useEffect(loadCounts, [loadCounts]);

  const learn = async (styleId: string) => {
    setStarting(styleId);
    try {
      const run = await startRun({ workflow: "learn", input: { styleId } });
      setRunId(run.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't start");
    } finally {
      setStarting(null);
    }
  };

  return (
    <div className="max-w-3xl space-y-4">
      <p className="text-sm text-muted-foreground">
        Ask the AI to look for patterns in your feedback for one style and suggest changes to its rules. It needs at least five accepted, edited
        or rejected suggestions, and each change it proposes must be backed by at least two of them. Nothing changes until you approve.
      </p>
      {runId ? (
        <RunView runId={runId} onClose={() => { setRunId(null); loadCounts(); }} />
      ) : (
        <ul className="divide-y rounded-lg border" aria-label="Styles">
          {styles.map((s) => {
            const n = counts[s.id] ?? 0;
            return (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-medium">
                    {s.name} {s.isDefault && <Badge variant="secondary">Default</Badge>}
                  </p>
                  <p className="text-xs text-muted-foreground">{n} piece{n === 1 ? "" : "s"} of feedback</p>
                </div>
                <Button size="sm" variant="outline" disabled={n < 5 || Boolean(starting)} onClick={() => learn(s.id)} title={n < 5 ? "Needs at least 5 pieces of feedback" : undefined}>
                  {starting === s.id ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <GraduationCap className="mr-1.5 h-4 w-4" />}
                  Suggest style changes
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
