"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, Loader2, Play, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { formatWhen, studioFetch, StudioApiError } from "../client";
import { PageHeader } from "../studio-ui";
import { SetupCard } from "../setup-card";

interface Config {
  topics: string[];
  favourSites: string[];
  avoidSites: string[];
  rubric: string;
  minPicks: number;
  maxPicks: number;
}

interface Candidate {
  id: string;
  url: string;
  title: string;
  publisher: string;
  topic: string;
  score: string;
  reason: string;
  readInFull: boolean;
  createdAt: string;
}

interface WeeklyListRow {
  id: string;
  week: string;
  title: string;
  intro: string;
  picks: unknown[];
  publishedAt: string;
}

interface TriggerRow {
  id: string;
  key: string;
  name: string;
  enabled: boolean;
  scheduleText: string | null;
  lastStatus: string | null;
  lastRunId: string | null;
  nextRunAt: string | null;
}

interface Data {
  config: Config;
  shortlist: Candidate[];
  savedThisWeek: number;
  lists: WeeklyListRow[];
  triggers: TriggerRow[];
}

const lines = (s: string) =>
  s
    .split(/[\n,]/)
    .map((x) => x.trim())
    .filter(Boolean);

const STATUS_TEXT: Record<string, string> = {
  RUNNING: "running now",
  CREATED: "starting",
  WAITING_FOR_APPROVAL: "waiting for you",
  COMPLETED: "finished",
  FAILED: "failed",
  CANCELLED: "cancelled",
};

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="font-serif text-xl font-medium">{title}</h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function TopicsEditor({ value, onChange }: { value: string[]; onChange: (t: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const t = draft.trim();
    if (t.length >= 2 && !value.some((v) => v.toLowerCase() === t.toLowerCase()) && value.length < 10) onChange([...value, t]);
    setDraft("");
  };
  return (
    <div className="space-y-2">
      <ul className="flex flex-wrap gap-2" aria-label="Topics">
        {value.map((t) => (
          <li key={t} className="inline-flex items-center gap-1 rounded-full border bg-muted/40 py-1 pl-3 pr-1 text-sm">
            {t}
            <button type="button" onClick={() => onChange(value.filter((v) => v !== t))} className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={`Remove ${t}`}>
              <X className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
      </ul>
      <div className="flex max-w-sm gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="Add a topic"
          aria-label="New topic"
        />
        <Button type="button" variant="outline" onClick={add} disabled={!draft.trim()}>
          Add
        </Button>
      </div>
    </div>
  );
}

export function WeeklyListPage() {
  const [data, setData] = useState<Data | null>(null);
  const [setupRequired, setSetupRequired] = useState(false);
  const [config, setConfig] = useState<Config | null>(null);
  const [favour, setFavour] = useState("");
  const [avoid, setAvoid] = useState("");
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await studioFetch<Data>("/reading-agent");
      setData(d);
      setConfig(d.config);
      setFavour(d.config.favourSites.join("\n"));
      setAvoid(d.config.avoidSites.join("\n"));
      setSetupRequired(false);
    } catch (e) {
      if (e instanceof StudioApiError && e.code === "SETUP_REQUIRED") setSetupRequired(true);
      else toast.error(e instanceof Error ? e.message : "Couldn't load the weekly list");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (!config) return;
    setSaving(true);
    try {
      const { config: saved } = await studioFetch<{ config: Config }>("/reading-agent", { method: "PUT", json: { ...config, favourSites: lines(favour), avoidSites: lines(avoid) } });
      setConfig(saved);
      setFavour(saved.favourSites.join("\n"));
      setAvoid(saved.avoidSites.join("\n"));
      toast.success("Saved. The next search uses these.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save");
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (t: TriggerRow, enabled: boolean) => {
    setBusy(t.id);
    try {
      await studioFetch(`/triggers/${t.id}`, { method: "PATCH", json: { enabled } });
      setData((d) => (d ? { ...d, triggers: d.triggers.map((x) => (x.id === t.id ? { ...x, enabled } : x)) } : d));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't change it");
    } finally {
      setBusy(null);
    }
  };

  const runNow = async (t: TriggerRow) => {
    setBusy(`run-${t.id}`);
    try {
      const out = await studioFetch<{ runId: string }>(`/triggers/${t.id}/run`, { method: "POST" });
      toast.success("Started. It runs in the background; you can close this page.", { action: { label: "Watch", onClick: () => (window.location.href = `/admin/stories/runs/${out.runId}`) } });
      setData((d) => (d ? { ...d, triggers: d.triggers.map((x) => (x.id === t.id ? { ...x, lastRunId: out.runId, lastStatus: "RUNNING" } : x)) } : d));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't start it");
    } finally {
      setBusy(null);
    }
  };

  const remove = async (c: Candidate) => {
    try {
      await studioFetch(`/reading-agent/candidates/${c.id}`, { method: "PATCH", json: { status: "dropped" } });
      setData((d) => (d ? { ...d, shortlist: d.shortlist.filter((x) => x.id !== c.id) } : d));
      toast.success("Removed. It won't be suggested again.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't remove it");
    }
  };

  if (setupRequired) return <SetupCard onReady={load} />;
  if (!data || !config) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }

  const waiting = data.triggers.find((t) => t.lastStatus === "WAITING_FOR_APPROVAL" && t.lastRunId);
  const order = ["reading-scout-nightly", "reading-weekly-list"];
  const triggers = [...data.triggers].sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));

  return (
    <div className="mx-auto max-w-4xl space-y-12">
      <PageHeader
        title="Weekly list"
        description="Each night the agent searches your topics and keeps a private shortlist. Every Monday it drafts a “worth your time” list from it and from what you saved. Nothing is published until you approve it."
      />

      {waiting && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-foreground/20 bg-muted/40 px-4 py-3 text-sm">
          <span>This week&apos;s list is ready for you to review.</span>
          <Button asChild size="sm">
            <Link href={`/admin/stories/runs/${waiting.lastRunId}`}>Review the list</Link>
          </Button>
        </div>
      )}

      <Section title="Schedule" description="Both start switched off. Turn them on when your topics look right.">
        <ul className="divide-y rounded-xl border">
          {triggers.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0 space-y-0.5">
                <Label htmlFor={`trigger-${t.id}`} className="text-sm font-medium">
                  {t.name}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {t.scheduleText}
                  {t.lastStatus && t.lastRunId && (
                    <>
                      {" · last run "}
                      <Link href={`/admin/stories/runs/${t.lastRunId}`} className="underline underline-offset-2">
                        {STATUS_TEXT[t.lastStatus] ?? t.lastStatus.toLowerCase()}
                      </Link>
                    </>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="sm" onClick={() => runNow(t)} disabled={busy === `run-${t.id}`} className="gap-1.5">
                  {busy === `run-${t.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                  Run now
                </Button>
                <Switch id={`trigger-${t.id}`} checked={t.enabled} disabled={busy === t.id} onCheckedChange={(v) => toggle(t, v)} />
              </div>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="What to look for" description="The agent searches the whole web for these topics, favouring the sites you list and never suggesting the ones you avoid.">
        <div className="space-y-6">
          <div className="space-y-2">
            <Label>Topics</Label>
            <TopicsEditor value={config.topics} onChange={(topics) => setConfig({ ...config, topics })} />
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="favour-sites">Sites to favour (optional)</Label>
              <Textarea id="favour-sites" value={favour} onChange={(e) => setFavour(e.target.value)} placeholder={"One per line, e.g.\nhbr.org\nstratechery.com"} rows={4} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="avoid-sites">Sites to never suggest (optional)</Label>
              <Textarea id="avoid-sites" value={avoid} onChange={(e) => setAvoid(e.target.value)} placeholder={"One per line, e.g.\nmedium.com"} rows={4} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="rubric">How to judge an article</Label>
            <Textarea id="rubric" value={config.rubric} onChange={(e) => setConfig({ ...config, rubric: e.target.value })} rows={7} className="font-mono text-xs" />
          </div>
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <Label htmlFor="min-picks">Picks per week</Label>
              <div className="flex items-center gap-2 text-sm">
                <Input id="min-picks" type="number" min={1} max={10} value={config.minPicks} onChange={(e) => setConfig({ ...config, minPicks: Number(e.target.value) || 1 })} className="w-20" aria-label="Fewest picks" />
                to
                <Input type="number" min={1} max={10} value={config.maxPicks} onChange={(e) => setConfig({ ...config, maxPicks: Number(e.target.value) || 1 })} className="w-20" aria-label="Most picks" />
              </div>
            </div>
            <Button onClick={save} disabled={saving || config.topics.length === 0} className="ml-auto gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save
            </Button>
          </div>
        </div>
      </Section>

      <Section
        title="This week's shortlist"
        description={`${data.shortlist.length} found by the agent${data.savedThisWeek ? `, plus ${data.savedThisWeek} you saved this week` : ""}. Private until a list is approved. Remove anything that doesn't belong.`}
      >
        {data.shortlist.length === 0 ? (
          <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">Nothing yet. The nightly search fills this in, or press Run now above.</p>
        ) : (
          <ul className="divide-y rounded-xl border" aria-label="Shortlist">
            {data.shortlist.map((c) => (
              <li key={c.id} className="flex gap-4 px-4 py-3">
                <span className="w-10 shrink-0 pt-0.5 text-right font-mono text-sm tabular-nums" title="Score out of 10">
                  {Number(c.score).toFixed(1)}
                </span>
                <div className="min-w-0 flex-1 space-y-1">
                  <a href={c.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium hover:underline">
                    {c.title || c.url}
                    <ExternalLink className="h-3 w-3 text-muted-foreground" />
                  </a>
                  <p className="text-xs text-muted-foreground">
                    {c.publisher}
                    {c.topic && ` · ${c.topic}`}
                    {c.readInFull && " · read in full"} · {formatWhen(c.createdAt)}
                  </p>
                  <p className="text-sm text-muted-foreground">{c.reason}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => remove(c)} aria-label={`Remove ${c.title}`}>
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Published lists">
        {data.lists.length === 0 ? (
          <p className="text-sm text-muted-foreground">None yet. Approved lists appear on your site under Reading.</p>
        ) : (
          <ul className="divide-y rounded-xl border">
            {data.lists.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <span>
                  <span className="font-medium">{l.title || `Week ${l.week.slice(6)}`}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    · {l.week} · {l.picks.length} pick{l.picks.length === 1 ? "" : "s"}
                  </span>
                </span>
                <Link href={`/reading/weekly/${l.week}`} target="_blank" className="inline-flex items-center gap-1 underline underline-offset-2">
                  View <ExternalLink className="h-3 w-3" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
