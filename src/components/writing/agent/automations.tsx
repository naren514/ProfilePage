"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CalendarClock, Loader2, Play, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { formatWhen, studioFetch, StudioApiError } from "../client";
import { PageHeader } from "../studio-ui";
import { RunStatusBadge } from "./activity";
import type { AgentRun } from "./use-agent-run";

interface Trigger {
  id: string;
  key: string | null;
  name: string;
  description: string;
  kind: "cron" | "event";
  schedule: string | null;
  scheduleText: string | null;
  timezone: string;
  event: string | null;
  workflow: string;
  autonomyLevel: "L0" | "L1" | "L2";
  dailyBudgetUsd: string;
  spentTodayUsd: number;
  enabled: boolean;
  nextRunAt: string | null;
  lastFiredAt: string | null;
  lastRunId: string | null;
  lastStatus: string | null;
  consecutiveFailures: number;
}

interface Data {
  triggers: Trigger[];
  agentsEnabled: boolean;
  cronConfigured: boolean;
}

const EVENT_TEXT: Record<string, string> = {
  "reading.saved": "When you save an article to your reading list",
  "publish.opened": "When you open Publish on a post",
};

const SCHEDULES = [
  { value: "0 2 * * *", label: "Every night at 2 am" },
  { value: "0 6 * * *", label: "Every morning at 6 am" },
  { value: "0 7 * * 1", label: "Every Monday at 7 am" },
  { value: "0 18 * * 5", label: "Every Friday at 6 pm" },
];

function TriggerCard({ t, onChange }: { t: Trigger; onChange: (t: Trigger) => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [budget, setBudget] = useState(Number(t.dailyBudgetUsd).toFixed(2));

  const patch = async (body: Record<string, unknown>, label: string) => {
    setBusy(label);
    try {
      const { trigger } = await studioFetch<{ trigger: Trigger }>(`/triggers/${t.id}`, { method: "PATCH", json: body });
      onChange({ ...t, ...trigger });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save");
    } finally {
      setBusy(null);
    }
  };

  const runNow = async () => {
    setBusy("run");
    try {
      const out = await studioFetch<{ runId: string }>(`/triggers/${t.id}/run`, { method: "POST" });
      toast.success("Started. It runs in the background; you can close this page.", {
        action: { label: "Watch", onClick: () => (window.location.href = `/admin/stories/runs/${out.runId}`) },
      });
      onChange({ ...t, lastRunId: out.runId, lastStatus: "RUNNING", lastFiredAt: new Date().toISOString() });
    } catch (e) {
      toast.error(e instanceof StudioApiError ? e.message : "Couldn't start it");
    } finally {
      setBusy(null);
    }
  };

  const Icon = t.kind === "cron" ? CalendarClock : Zap;
  const spentPct = Math.min(100, (t.spentTodayUsd / Math.max(0.0001, Number(t.dailyBudgetUsd))) * 100);

  return (
    <li className="rounded-2xl border p-5" aria-label={t.name}>
      <div className="flex items-start gap-4">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-serif text-xl">{t.name}</h2>
            <label className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">{t.enabled ? "On" : "Off"}</span>
              <Switch checked={t.enabled} disabled={busy === "enabled"} onCheckedChange={(v) => patch({ enabled: v }, "enabled")} aria-label={`${t.name}: ${t.enabled ? "on" : "off"}`} />
            </label>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t.description}</p>

          <dl className="mt-4 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-xs uppercase tracking-[0.1em] text-muted-foreground">{t.kind === "cron" ? "Schedule" : "Runs"}</dt>
              <dd className="mt-1">
                {t.kind === "cron" ? (
                  <select
                    aria-label={`Schedule for ${t.name}`}
                    className="h-8 rounded-md border bg-background px-2 text-sm"
                    value={SCHEDULES.some((s) => s.value === t.schedule) ? t.schedule ?? "" : "custom"}
                    onChange={(e) => e.target.value !== "custom" && patch({ schedule: e.target.value }, "schedule")}
                  >
                    {SCHEDULES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                    {!SCHEDULES.some((s) => s.value === t.schedule) && <option value="custom">{t.scheduleText ?? t.schedule}</option>}
                  </select>
                ) : (
                  EVENT_TEXT[t.event ?? ""] ?? t.event
                )}
              </dd>
              {t.kind === "cron" && <dd className="mt-1 text-xs text-muted-foreground">{t.timezone.replace("_", " ")}</dd>}
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.1em] text-muted-foreground">Daily budget</dt>
              <dd className="mt-1 flex items-center gap-1.5">
                $
                <Input
                  aria-label={`Daily budget for ${t.name} in dollars`}
                  className="h-8 w-20"
                  inputMode="decimal"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  onBlur={() => {
                    const v = Number(budget);
                    if (Number.isFinite(v) && v >= 0 && v !== Number(t.dailyBudgetUsd)) patch({ dailyBudgetUsd: v }, "budget");
                    else setBudget(Number(t.dailyBudgetUsd).toFixed(2));
                  }}
                />
              </dd>
              <dd className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
                <span className="h-1 w-16 overflow-hidden rounded-full bg-muted" aria-hidden>
                  <span className="block h-full bg-foreground/60" style={{ width: `${spentPct}%` }} />
                </span>
                ${t.spentTodayUsd.toFixed(3)} today
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.1em] text-muted-foreground">Last run</dt>
              <dd className="mt-1 flex flex-wrap items-center gap-2">
                {t.lastRunId ? (
                  <>
                    {["CREATED", "RUNNING", "WAITING_FOR_APPROVAL", "COMPLETED", "FAILED", "CANCELLED"].includes(t.lastStatus ?? "") ? (
                      <RunStatusBadge status={t.lastStatus as AgentRun["status"]} />
                    ) : (
                      <span className="text-xs text-muted-foreground">{t.lastStatus}</span>
                    )}
                    <Link className="text-xs underline-offset-4 hover:underline" href={`/admin/stories/runs/${t.lastRunId}`}>
                      {formatWhen(t.lastFiredAt)}
                    </Link>
                  </>
                ) : t.lastStatus ? (
                  <span className="text-xs text-muted-foreground">{t.lastStatus}</span>
                ) : (
                  <span className="text-muted-foreground">Never</span>
                )}
              </dd>
              {t.consecutiveFailures >= 2 && <dd className="mt-1 text-xs text-amber-700">{t.consecutiveFailures} failures in a row</dd>}
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.1em] text-muted-foreground">Next run</dt>
              <dd className="mt-1">{t.kind === "cron" ? (t.enabled && t.nextRunAt ? new Date(t.nextRunAt).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—") : "On the event"}</dd>
            </div>
          </dl>
        </div>
        {t.kind === "cron" && (
          <Button variant="outline" size="sm" className="shrink-0 rounded-full" onClick={runNow} disabled={busy === "run"} aria-label={`Run ${t.name} now`}>
            {busy === "run" ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Play className="mr-1.5 h-3.5 w-3.5" />}
            Run now
          </Button>
        )}
      </div>
    </li>
  );
}

/** Studio → Automations: schedules and events that start agent runs in the background. */
export function AutomationsPage() {
  const [data, setData] = useState<Data | null>(null);
  const load = useCallback(() => {
    studioFetch<Data>("/triggers")
      .then(setData)
      .catch((e) => toast.error(e instanceof Error ? e.message : "Couldn't load automations"));
  }, []);
  useEffect(load, [load]);

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <PageHeader
        title="Automations"
        description="Agent runs that start on a schedule or when something happens, and keep going on the server with no tab open. Anything public still waits for you."
      />
      {data && !data.agentsEnabled && (
        <p role="status" className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Agents are paused in <Link className="underline" href="/admin/stories/styles">Styles &amp; AI</Link>. Nothing below will run until you turn them back on.
        </p>
      )}
      {data && !data.cronConfigured && (
        <p role="status" className="rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">
          Schedules need <code className="font-mono text-xs">CRON_SECRET</code> set on the server (Vercel → Settings → Environment Variables). Event automations and “Run now” work without it.
        </p>
      )}
      {!data ? (
        <Loader2 className="h-5 w-5 animate-spin" aria-label="Loading" />
      ) : (
        <ul className="space-y-4" aria-label="Automations">
          {data.triggers.map((t) => (
            <TriggerCard key={t.id} t={t} onChange={(next) => setData((d) => (d ? { ...d, triggers: d.triggers.map((x) => (x.id === next.id ? next : x)) } : d))} />
          ))}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">
        Each automation has its own daily budget on top of your monthly AI budget. Runs it starts show on the <Link className="underline" href="/admin/stories/activity">Activity</Link> page.
      </p>
    </div>
  );
}
