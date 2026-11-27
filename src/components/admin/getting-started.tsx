"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

// A short checklist for a new Studio: shown on Home until every step is
// done (or the author hides it). Each step links to where it's done.

export interface Step {
  id: string;
  label: string;
  href: string;
  done: boolean;
}

const HIDE_KEY = "admin:getting-started-hidden";

export function GettingStarted({ steps }: { steps: Step[] }) {
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    try {
      setHidden(localStorage.getItem(HIDE_KEY) === "1");
    } catch {
      setHidden(false);
    }
  }, []);
  const done = steps.filter((s) => s.done).length;
  if (hidden || done === steps.length) return null;

  return (
    <section aria-label="Getting started" className="space-y-3 rounded-2xl border p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-xl font-medium">Getting started</h2>
          <p className="text-sm text-muted-foreground">
            {done} of {steps.length} done
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setHidden(true);
            try {
              localStorage.setItem(HIDE_KEY, "1");
            } catch {
              // ignore
            }
          }}
          className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Hide the getting-started list"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-muted" aria-hidden>
        <div className="h-full rounded-full bg-foreground transition-all" style={{ width: `${(done / steps.length) * 100}%` }} />
      </div>
      <ol className="space-y-1">
        {steps.map((s) => (
          <li key={s.id}>
            <Link href={s.href} className={cn("flex min-h-[44px] items-center gap-3 rounded-xl px-2 text-[0.9375rem] hover:bg-muted/50", s.done && "text-muted-foreground")}>
              <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full border", s.done && "border-foreground bg-foreground text-background")} aria-hidden>
                {s.done && <Check className="h-3.5 w-3.5" />}
              </span>
              <span className={cn(s.done && "line-through decoration-muted-foreground/50")}>{s.label}</span>
              <span className="sr-only">{s.done ? "(done)" : "(to do)"}</span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
