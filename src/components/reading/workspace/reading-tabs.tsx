"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useReadingCounts } from "./shared";

// The Reading workspace: one place, in the order the work happens.
// Discover what's new → Inbox (saved to read) → This week (the list being
// built) → Published. Set-once settings sit behind the gear.

const TABS = [
  { href: "/admin/reading", label: "Discover", count: "discover" as const, about: "New articles from your sources, best match first." },
  { href: "/admin/reading/inbox", label: "Inbox", count: "inbox" as const, about: "Articles you saved to read. Add a note and publish the ones worth sharing." },
  { href: "/admin/reading/week", label: "This week", count: "week" as const, about: "This week's list as it builds up: the agent's finds and yours. You approve it before anything is published." },
  { href: "/admin/reading/published", label: "Published", count: null, about: "What's on your public Reading page." },
];

export function ReadingTabs() {
  const path = usePathname() ?? "/admin/reading";
  const counts = useReadingCounts();
  const settings = path.startsWith("/admin/reading/settings");
  const current = TABS.find((t) => t.href === path) ?? (settings ? null : TABS[0]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0 space-y-1.5">
          <h1 className="font-serif text-[2.5rem] font-medium leading-none tracking-tight">{settings ? "Reading settings" : "Reading"}</h1>
          <p className="max-w-xl text-[0.9375rem] text-muted-foreground">{settings ? "Sources, topics, the schedule and ways to save. Set once; change any time." : current?.about}</p>
        </div>
        <div className="flex items-center gap-1">
          <a href="/certifications" target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-1 rounded-full px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">
            Public page <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
          <Link
            href="/admin/reading/settings"
            aria-label="Reading settings"
            aria-current={settings ? "page" : undefined}
            className={cn("inline-flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground", settings && "bg-muted text-foreground")}
          >
            <Settings2 className="h-[1.125rem] w-[1.125rem]" />
          </Link>
        </div>
      </header>
      <nav aria-label="Reading" className="-mx-1 flex gap-1 overflow-x-auto border-b px-1 [scrollbar-width:none]">
        {TABS.map((t) => {
          const active = !settings && current?.href === t.href;
          const n = t.count && counts ? counts[t.count] : 0;
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative inline-flex h-11 shrink-0 items-center gap-1.5 px-2.5 text-sm transition-colors sm:px-3",
                active ? "font-medium text-foreground after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full after:bg-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t.label}
              {n > 0 && <span className="rounded-full bg-muted px-1.5 text-[11px] tabular-nums text-muted-foreground">{n}</span>}
              {t.count === "week" && counts?.waiting && <span className="h-2 w-2 rounded-full bg-ai" aria-label="ready for you to approve" />}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
