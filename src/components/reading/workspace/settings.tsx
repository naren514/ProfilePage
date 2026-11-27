"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Play, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { studioFetch, StudioApiError } from "@/components/writing/client";
import { SetupCard } from "@/components/writing/setup-card";
import { WaysToSave } from "../ways-to-save";
import { notifyReadingChanged } from "./shared";

// Reading settings: the set-once parts, kept apart from the daily work.
// Schedule, sources, what to look for, and ways to save.

interface Config {
  topics: string[];
  favourSites: string[];
  avoidSites: string[];
  rubric: string;
  minPicks: number;
  maxPicks: number;
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

interface Source {
  id: string;
  url: string;
  name: string;
  topic: string;
  feedUrl: string | null;
  status: "new" | "ok" | "no_feed" | "error";
  lastError: string | null;
  lastCheckedAt: string | null;
  lastItemCount: number;
}

interface Data {
  config: Config;
  sources: Source[];
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

function Section({ id, title, description, children }: { id?: string; title: string; description?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20 space-y-4">
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

const host = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return u;
  }
};

function SourceStatus({ s }: { s: Source }) {
  if (s.status === "ok") return <span className="text-emerald-700">● {s.lastItemCount} recent article{s.lastItemCount === 1 ? "" : "s"}</span>;
  if (s.status === "no_feed") return <span className="text-amber-700">● No feed found: try the site&apos;s feed address, or remove it</span>;
  if (s.status === "error") return <span className="text-red-700">● Couldn&apos;t read it{s.lastError ? `: ${s.lastError}` : ""}</span>;
  return <span className="text-muted-foreground">● Not checked yet</span>;
}

function SourcesSection({ sources, topics, onChange }: { sources: Source[]; topics: string[]; onChange: (s: Source[]) => void }) {
  const [url, setUrl] = useState("");
  const [topic, setTopic] = useState(topics[0] ?? "");
  const [adding, setAdding] = useState(false);
  const [checking, setChecking] = useState(false);

  const add = async () => {
    if (!url.trim()) return;
    setAdding(true);
    try {
      const { source } = await studioFetch<{ source: Source }>("/reading-agent/sources", { method: "POST", json: { url: url.trim(), topic } });
      onChange([...sources.filter((x) => x.id !== source.id), source]);
      setUrl("");
      if (source.status === "ok") toast.success(`Added ${source.name || host(source.url)}: its feed was found`);
      else toast.message(`Added, but no feed was found at ${host(source.url)}. Try the site's feed address.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't add it");
    } finally {
      setAdding(false);
    }
  };

  const remove = async (s: Source) => {
    try {
      await studioFetch(`/reading-agent/sources/${s.id}`, { method: "DELETE" });
      onChange(sources.filter((x) => x.id !== s.id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't remove it");
    }
  };

  const checkAll = async () => {
    setChecking(true);
    try {
      const { summary } = await studioFetch<{ summary: { ok: number; failed: number; added: number } }>("/reading-agent/sources/check", { method: "POST" });
      toast.success(`${summary.added} new article${summary.added === 1 ? "" : "s"} found${summary.failed ? `; ${summary.failed} source(s) couldn't be read` : ""}`);
      notifyReadingChanged();
      const d = await studioFetch<{ sources: Source[] }>("/reading-agent");
      onChange(d.sources);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't check the sources");
    } finally {
      setChecking(false);
    }
  };

  const groups = Array.from(new Set([...topics, ...sources.map((s) => s.topic)])).map((t) => ({ topic: t, items: sources.filter((s) => s.topic === t) })).filter((g) => g.items.length);

  return (
    <div className="space-y-4">
      {groups.length === 0 ? (
        <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">No sources yet. Add a publication, blog or newsletter below.</p>
      ) : (
        <div className="space-y-4" aria-label="Sources">
          {groups.map((g) => (
            <div key={g.topic || "none"}>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">{g.topic || "No topic"}</p>
              <ul className="divide-y rounded-xl border">
                {g.items.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2.5 text-sm">
                    <span className="min-w-0">
                      <a href={s.url} target="_blank" rel="noreferrer" className="font-medium hover:underline">
                        {s.name || host(s.url)}
                      </a>
                      <span className="block text-xs">
                        <SourceStatus s={s} />
                      </span>
                    </span>
                    <Button variant="ghost" size="sm" onClick={() => remove(s)} aria-label={`Remove ${s.name || host(s.url)}`}>
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void add();
        }}
      >
        <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Add a site or newsletter, e.g. stratechery.com" aria-label="Source address" className="min-w-[14rem] flex-1" />
        <select value={topic} onChange={(e) => setTopic(e.target.value)} aria-label="Topic for this source" className="h-10 rounded-md border bg-background px-2 text-sm">
          {topics.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
          <option value="">No topic</option>
        </select>
        <Button type="submit" disabled={adding || !url.trim()} className="gap-2">
          {adding && <Loader2 className="h-4 w-4 animate-spin" />}
          Add source
        </Button>
        <Button type="button" variant="outline" onClick={checkAll} disabled={checking} className="gap-2">
          {checking && <Loader2 className="h-4 w-4 animate-spin" />}
          Check all now
        </Button>
      </form>
    </div>
  );
}

export function ReadingSettings() {
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
      else toast.error(e instanceof Error ? e.message : "Couldn't load the settings");
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

  if (setupRequired) return <SetupCard onReady={load} />;
  if (!data || !config) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }

  const order = ["reading-scout-nightly", "reading-weekly-list"];
  const triggers = [...data.triggers].sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));

  return (
    <div className="space-y-12">
      <nav aria-label="On this page" className="flex flex-wrap gap-2 text-sm">
        {[
          ["#sources", "Sources"],
          ["#look-for", "What to look for"],
          ["#schedule", "Schedule"],
          ["#ways-to-save", "Ways to save"],
        ].map(([href, label]) => (
          <a key={href} href={href} className="rounded-full border px-3 py-1.5 text-muted-foreground hover:text-foreground">
            {label}
          </a>
        ))}
      </nav>

      <Section
        id="sources"
        title="Sources"
        description="Publications and newsletters the agent reads first, through their feeds: no search credits, and quality starts with sources you trust. New articles are ranked by how close they are to what you save and keep. Paste a site's address; its feed is found automatically."
      >
        <SourcesSection sources={data.sources ?? []} topics={config.topics} onChange={(sources) => setData((d) => (d ? { ...d, sources } : d))} />
      </Section>

      <Section id="look-for" title="What to look for" description="Your topics and how to judge an article. The agent searches the wider web only to fill gaps the sources leave, favouring the sites you list and never suggesting the ones you avoid.">
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

      <Section id="schedule" title="Schedule" description="The nightly search adds finds to This week; the Monday draft turns them into a list for you to approve. Both start switched off.">
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

      <Section id="ways-to-save" title="Ways to save" description="Send articles to your inbox from your phone or browser.">
        <WaysToSave />
      </Section>
    </div>
  );
}
