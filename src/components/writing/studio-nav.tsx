"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Download } from "lucide-react";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/admin/stories", label: "Thoughts", match: (p: string) => p === "/admin/stories" },
  { href: "/admin/stories/styles", label: "Styles & AI", match: (p: string) => p.startsWith("/admin/stories/styles") },
  { href: "/admin/stories/memory", label: "Memory", match: (p: string) => p.startsWith("/admin/stories/memory") },
  { href: "/admin/stories/weekly", label: "Weekly list", match: (p: string) => p.startsWith("/admin/stories/weekly") },
  { href: "/admin/stories/automations", label: "Automations", match: (p: string) => p.startsWith("/admin/stories/automations") },
  {
    href: "/admin/stories/activity",
    label: "Activity",
    match: (p: string) => p.startsWith("/admin/stories/activity") || p.startsWith("/admin/stories/runs"),
  },
];

/** The editor and preview are full-screen writing surfaces: no sub-navigation there. */
const IMMERSIVE = /^\/admin\/stories\/[0-9a-f-]{36}(\/preview)?$/;

export function StudioNav() {
  const pathname = usePathname() ?? "";
  if (IMMERSIVE.test(pathname) || pathname.startsWith("/admin/stories/classic")) return null;
  return (
    <nav aria-label="Writing Studio" className="-mx-8 -mt-8 mb-10 flex items-center justify-between gap-4 border-b px-8">
      <ul className="flex items-center gap-1 overflow-x-auto">
        {LINKS.map((link) => {
          const active = link.match(pathname);
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative inline-flex h-12 items-center px-3 text-sm transition-colors",
                  active ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {link.label}
                {active && <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-foreground" aria-hidden />}
              </Link>
            </li>
          );
        })}
      </ul>
      <a
        href="/api/admin/writing/export"
        download
        title="Download everything (posts, versions, ideas, sources, styles, memory) as a ZIP"
        className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <Download className="h-3.5 w-3.5" aria-hidden />
        Export
      </a>
    </nav>
  );
}
