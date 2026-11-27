"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

// The AI page: everything about the assistant in one place, in plain words.
// Your voice (styles) · What it learned (samples and feedback) · Helpers
// (the jobs that run by themselves) · History (every run) · Settings & cost.

const TABS = [
  { href: "/admin/ai", label: "Your voice", about: "How you write. The assistant follows these styles; each post can use a different one." },
  { href: "/admin/ai/memory", label: "What it learned", about: "Examples of your writing and your feedback on its suggestions. Nothing changes a style until you approve it." },
  { href: "/admin/ai/helpers", label: "Helpers", about: "Jobs that run by themselves on a schedule, like the nightly reading search. Anything public still waits for you." },
  { href: "/admin/ai/history", label: "History", about: "Everything the assistant did: what it read, what it cost, and what you approved." },
  { href: "/admin/ai/settings", label: "Settings & cost", about: "Which AI models to use, the monthly budget, and what you've spent." },
];

export function AiTabs() {
  const path = usePathname() ?? "/admin/ai";
  const current = TABS.find((t) => t.href === path) ?? TABS[0];
  return (
    <div className="space-y-6">
      <header className="space-y-1.5">
        <h1 className="font-serif text-[2.5rem] font-medium leading-none tracking-tight">AI</h1>
        <p className="max-w-xl text-[0.9375rem] text-muted-foreground">{current.about}</p>
      </header>
      <nav aria-label="AI" className="-mx-1 flex gap-1 overflow-x-auto border-b px-1 [scrollbar-width:none]">
        {TABS.map((t) => {
          const active = t.href === current.href;
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative inline-flex h-11 shrink-0 items-center px-2.5 text-sm transition-colors sm:px-3",
                active ? "font-medium text-foreground after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full after:bg-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
