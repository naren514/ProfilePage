"use client";

import { useCallback, useEffect, useState } from "react";
import { studioFetch } from "@/components/writing/client";

// Shared by the Reading workspace tabs: the counts on the tabs, and a
// signal any tab sends after changing something so the counts refresh.

const EVENT = "reading:changed";

export function notifyReadingChanged() {
  window.dispatchEvent(new Event(EVENT));
}

export interface ReadingCounts {
  discover: number;
  inbox: number;
  week: number;
  waiting: boolean;
}

export function useReadingCounts() {
  const [counts, setCounts] = useState<ReadingCounts | null>(null);
  const load = useCallback(() => {
    studioFetch<ReadingCounts>("/reading-agent/counts")
      .then(setCounts)
      .catch(() => {});
  }, []);
  useEffect(() => {
    load();
    window.addEventListener(EVENT, load);
    return () => window.removeEventListener(EVENT, load);
  }, [load]);
  return counts;
}

/** True when a key press belongs to a text field or an open dialog, not to the page's shortcuts. */
export function typingIn(e: KeyboardEvent) {
  const t = e.target as HTMLElement | null;
  if (e.metaKey || e.ctrlKey || e.altKey) return true;
  if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return true;
  return Boolean(document.querySelector("[role=dialog], [role=menu]"));
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">{children}</div>;
}
