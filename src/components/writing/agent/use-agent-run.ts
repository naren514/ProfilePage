"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { studioFetch } from "../client";

export interface RunStep {
  id: string;
  label: string;
  done: boolean;
}

export interface AgentRun {
  id: string;
  workflow: string;
  workflowLabel: string;
  status: "CREATED" | "RUNNING" | "WAITING_FOR_APPROVAL" | "COMPLETED" | "FAILED" | "CANCELLED";
  documentId: string | null;
  ideaId: string | null;
  input: Record<string, unknown>;
  currentStep: number;
  steps: RunStep[];
  pendingApproval: { stepIndex: number; kind: string; title: string; proposal: unknown } | null;
  result: Record<string, unknown> | null;
  usage: { modelCalls: number; toolCalls: number; inputTokens: number; outputTokens: number; costUsd: number };
  budget: { maxCostUsd: number };
  error: string | null;
  working: boolean;
  /** How it started (a click, a schedule, an event) and what executes it. */
  origin?: "manual" | "cron" | "event";
  driver?: "workflow" | "inline" | "browser";
  createdAt: string;
  finishedAt: string | null;
  documentTitle?: string | null;
}

export interface AgentEvent {
  id: string;
  type: string;
  message: string;
  payload: Record<string, unknown> | null;
  createdAt: string;
}

type RunResponse = { run: AgentRun; events: AgentEvent[] };

export const isActive = (run: AgentRun | null) => Boolean(run && (run.status === "CREATED" || run.status === "RUNNING"));

/**
 * Follows a run. Runs executed on the server (driver "workflow" or "inline")
 * are only watched: closing the tab never pauses them. Runs in browser mode
 * (the fallback) are driven from here by calling /advance.
 */
export function useAgentRun(runId: string | null) {
  const [run, setRun] = useState<AgentRun | null>(null);
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const loopRef = useRef(0);

  const apply = (data: RunResponse) => {
    setRun(data.run);
    setEvents(data.events);
  };

  const drive = useCallback(async (id: string) => {
    const loop = ++loopRef.current;
    let failures = 0;
    while (loopRef.current === loop) {
      try {
        const current = await studioFetch<RunResponse>(`/agent-runs/${id}`);
        if (loopRef.current !== loop) return;
        apply(current);
        if (!isActive(current.run)) return;
        if (current.run.driver && current.run.driver !== "browser") {
          // The server is executing it: just watch
          await new Promise((r) => setTimeout(r, 1500));
          continue;
        }
        if (current.run.working) {
          // Another request is running this step; check back shortly
          await new Promise((r) => setTimeout(r, 2000));
          continue;
        }
        const next = await studioFetch<RunResponse>(`/agent-runs/${id}/advance`, { method: "POST" });
        if (loopRef.current !== loop) return;
        apply(next);
        setError(null);
        failures = 0;
        if (!isActive(next.run)) return;
      } catch (e) {
        failures++;
        setError(e instanceof Error ? e.message : "Lost contact with the server");
        if (failures >= 5) return;
        await new Promise((r) => setTimeout(r, 2000 * failures));
      }
    }
  }, []);

  useEffect(() => {
    if (!runId) {
      loopRef.current++;
      setRun(null);
      setEvents([]);
      return;
    }
    drive(runId);
    return () => {
      loopRef.current++;
    };
  }, [runId, drive]);

  const decide = useCallback(
    async (action: "approve" | "regenerate" | "decline", decision?: Record<string, unknown>) => {
      if (!run?.pendingApproval) return null;
      const data = await studioFetch<RunResponse>(`/agent-runs/${run.id}/decide`, {
        method: "POST",
        json: { action, stepIndex: run.pendingApproval.stepIndex, decision, idempotencyKey: crypto.randomUUID() },
      });
      apply(data);
      if (isActive(data.run)) drive(data.run.id);
      return data.run;
    },
    [run, drive]
  );

  const cancel = useCallback(async () => {
    if (!run) return;
    const data = await studioFetch<RunResponse>(`/agent-runs/${run.id}/cancel`, { method: "POST" });
    apply(data);
    // A running step stops within a couple of seconds; keep watching until it does
    if (isActive(data.run)) drive(data.run.id);
  }, [run, drive]);

  const resume = useCallback(() => {
    if (run) drive(run.id);
  }, [run, drive]);

  return { run, events, error, decide, cancel, resume };
}

export async function startRun(params: {
  workflow: string;
  documentId?: string;
  ideaId?: string;
  input?: Record<string, unknown>;
}): Promise<AgentRun> {
  return studioFetch<AgentRun>("/agent-runs", { method: "POST", json: { input: {}, ...params } });
}

// Remember in this browser which finished runs were already put into the post,
// so a reload doesn't offer to insert them twice.
const appliedKey = (id: string) => `writing-studio:applied:${id}`;
export function wasApplied(runId: string): boolean {
  try {
    return localStorage.getItem(appliedKey(runId)) === "1";
  } catch {
    return false;
  }
}
export function markApplied(runId: string) {
  try {
    localStorage.setItem(appliedKey(runId), "1");
  } catch {
    // ignore
  }
}
