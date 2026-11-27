"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowUpRight, ChevronRight, Download, Lightbulb, Link2, Loader2, LogOut, Menu, PanelLeftClose, PanelLeftOpen, Plus, Search, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth/auth-context";
import { cn } from "@/lib/utils";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ALL_ITEMS, isImmersive, NAV, type NavItem } from "./nav-config";

// The admin app shell: one grouped sidebar (collapsible to an icon rail) on
// larger screens; on phones a top bar, a bottom tab bar with a capture
// button in thumb reach, and a full menu sheet. ⌘K opens a command menu
// everywhere except the editor, which has its own.

interface User {
  name?: string | null;
  email?: string | null;
}

const RAIL_KEY = "admin:rail";
const MORE_KEY = "admin:more-open";
const read = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // private mode: not remembered
  }
};

function NavLink({ item, rail, active, onClick }: { item: NavItem; rail: boolean; active: boolean; onClick?: () => void }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      title={rail ? item.label : undefined}
      className={cn(
        "group flex h-9 items-center gap-3 rounded-lg px-2.5 text-[0.875rem] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
        active ? "bg-foreground/[0.06] font-medium text-foreground" : "text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground",
        rail && "justify-center px-0"
      )}
    >
      <Icon className={cn("h-[18px] w-[18px] shrink-0", active ? "text-foreground" : "text-muted-foreground group-hover:text-foreground")} strokeWidth={1.75} />
      {!rail && <span className="truncate">{item.label}</span>}
      {rail && <span className="sr-only">{item.label}</span>}
    </Link>
  );
}

function Brand({ rail }: { rail: boolean }) {
  return (
    <Link href="/admin" className={cn("flex h-9 items-center gap-2.5 rounded-lg px-1.5 outline-none focus-visible:ring-2 focus-visible:ring-ring", rail && "justify-center px-0")}>
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-foreground font-serif text-sm text-background">N</span>
      {!rail && <span className="font-serif text-[1.0625rem] tracking-tight">Studio</span>}
    </Link>
  );
}

function Sidebar({ path, rail, onToggle, onCommand, onCapture, user, onSignOut }: { path: string; rail: boolean; onToggle: () => void; onCommand: () => void; onCapture: () => void; user: User; onSignOut: () => void }) {
  const [moreOpen, setMoreOpen] = useState(false);
  useEffect(() => setMoreOpen(read(MORE_KEY) === "1"), []);
  const toggleMore = () =>
    setMoreOpen((o) => {
      write(MORE_KEY, o ? "0" : "1");
      return !o;
    });
  return (
    <aside
      aria-label="Main"
      className={cn("fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-border/60 bg-muted/30 transition-[width] duration-200 motion-reduce:transition-none lg:flex", rail ? "w-[68px] px-2.5" : "w-60 px-3")}
    >
      <div className={cn("flex items-center justify-between gap-2 pb-3 pt-4", rail && "flex-col")}>
        <Brand rail={rail} />
        <button type="button" onClick={onToggle} className="rounded-md p-1.5 text-muted-foreground outline-none hover:bg-foreground/[0.05] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring" aria-label={rail ? "Expand the sidebar" : "Collapse the sidebar"} title={rail ? "Expand ([)" : "Collapse ([)"}>
          {rail ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </div>

      <div className={cn("space-y-1.5 pb-3", rail && "flex flex-col items-center")}>
        <button
          type="button"
          onClick={onCapture}
          className={cn("flex h-9 w-full items-center gap-2 rounded-lg bg-foreground px-3 text-sm font-medium text-background outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2", rail && "w-9 justify-center px-0")}
          title="Capture an idea or a link"
        >
          <Plus className="h-4 w-4 shrink-0" />
          {!rail && "Capture"}
          {rail && <span className="sr-only">Capture</span>}
        </button>
        <button
          type="button"
          onClick={onCommand}
          className={cn("flex h-9 w-full items-center gap-2 rounded-lg border border-border/70 bg-background px-3 text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring", rail && "w-9 justify-center px-0")}
          title="Search and jump (⌘K)"
        >
          <Search className="h-4 w-4 shrink-0" />
          {!rail && (
            <>
              <span className="flex-1 text-left">Search…</span>
              <kbd className="rounded border px-1 font-sans text-[10px]">⌘K</kbd>
            </>
          )}
          {rail && <span className="sr-only">Search</span>}
        </button>
      </div>

      <nav aria-label="Admin" className="-mx-1 flex-1 space-y-5 overflow-y-auto px-1 py-2">
        {NAV.map((group, i) => {
          const folded = Boolean(group.collapsible) && !rail && !moreOpen && !group.items.some((item) => item.match(path));
          return (
            <div key={group.label ?? i} className="space-y-0.5">
              {group.label &&
                (rail ? (
                  <div className="mx-auto mb-1.5 h-px w-6 bg-border" aria-hidden />
                ) : group.collapsible ? (
                  <button type="button" onClick={toggleMore} aria-expanded={!folded} className="flex w-full items-center gap-1 rounded-md px-2.5 pb-1 text-[0.6875rem] font-medium uppercase tracking-[0.12em] text-muted-foreground/80 hover:text-foreground">
                    {group.label}
                    <ChevronRight className={cn("h-3 w-3 transition-transform", !folded && "rotate-90")} aria-hidden />
                  </button>
                ) : (
                  <p className="px-2.5 pb-1 text-[0.6875rem] font-medium uppercase tracking-[0.12em] text-muted-foreground/80">{group.label}</p>
                ))}
              {!folded && group.items.map((item) => <NavLink key={item.href} item={item} rail={rail} active={item.match(path)} />)}
            </div>
          );
        })}
      </nav>

      <div className={cn("space-y-0.5 border-t border-border/60 py-3", rail && "flex flex-col items-center")}>
        <a href="/" target="_blank" rel="noreferrer" className={cn("flex h-9 items-center gap-3 rounded-lg px-2.5 text-sm text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground", rail && "w-9 justify-center px-0")} title="View the site">
          <ArrowUpRight className="h-[18px] w-[18px]" strokeWidth={1.75} />
          {!rail ? "View site" : <span className="sr-only">View site</span>}
        </a>
        <div className={cn("flex items-center gap-2.5 rounded-lg px-2.5 py-1.5", rail && "justify-center px-0")}>
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-foreground/[0.08] text-xs font-medium uppercase" aria-hidden>
            {(user.name || user.email || "A").charAt(0)}
          </span>
          {!rail && (
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm">{user.name || "Admin"}</span>
              <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
            </span>
          )}
          {!rail && (
            <button type="button" onClick={onSignOut} className="rounded-md p-1.5 text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground" aria-label="Sign out" title="Sign out">
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}

const TABS: Array<{ label: string; href: string; item: NavItem }> = ["/admin", "/admin/stories", "/admin/reading"].map((href) => {
  const item = ALL_ITEMS.find((i) => i.href === href)!;
  return { label: item.label === "Reading inbox" ? "Reading" : item.label, href, item };
});

function MobileBars({ path, title, onCapture, onMenu, onCommand }: { path: string; title: string; onCapture: () => void; onMenu: () => void; onCommand: () => void }) {
  const tab = (t: (typeof TABS)[number]) => {
    const Icon = t.item.icon;
    const active = t.item.match(path);
    return (
      <Link key={t.href} href={t.href} aria-current={active ? "page" : undefined} className={cn("flex min-h-[52px] flex-1 flex-col items-center justify-center gap-0.5 text-[0.6875rem]", active ? "text-foreground" : "text-muted-foreground")}>
        <Icon className="h-5 w-5" strokeWidth={active ? 2 : 1.75} />
        {t.label}
      </Link>
    );
  };
  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b border-border/60 bg-background/85 px-4 backdrop-blur-md supports-[backdrop-filter]:bg-background/70 lg:hidden">
        <Link href="/admin" className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-foreground font-serif text-sm text-background">N</span>
          <span className="truncate font-serif text-[1.0625rem]">{title}</span>
        </Link>
        <button type="button" onClick={onCommand} className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted" aria-label="Search">
          <Search className="h-5 w-5" />
        </button>
      </header>
      <nav aria-label="Quick" className="fixed inset-x-0 bottom-0 z-30 border-t border-border/60 bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden">
        <div className="mx-auto flex max-w-md items-stretch">
          {tab(TABS[0])}
          {tab(TABS[1])}
          <div className="flex flex-1 items-center justify-center">
            <button type="button" onClick={onCapture} className="-mt-5 flex h-14 w-14 items-center justify-center rounded-full bg-foreground text-background shadow-lg shadow-foreground/20 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" aria-label="Capture an idea or a link">
              <Plus className="h-6 w-6" />
            </button>
          </div>
          {tab(TABS[2])}
          <button type="button" onClick={onMenu} className="flex min-h-[52px] flex-1 flex-col items-center justify-center gap-0.5 text-[0.6875rem] text-muted-foreground" aria-label="Menu">
            <Menu className="h-5 w-5" strokeWidth={1.75} />
            More
          </button>
        </div>
      </nav>
    </>
  );
}

function MenuSheet({ open, onClose, path, onSignOut }: { open: boolean; onClose: () => void; path: string; onSignOut: () => void }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
      <button type="button" className="absolute inset-0 bg-foreground/20 backdrop-blur-[2px]" onClick={onClose} aria-label="Close the menu" />
      <div className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-3xl border-t bg-background px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3 shadow-2xl">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" aria-hidden />
        <div className="mb-2 flex items-center justify-between">
          <p className="font-serif text-xl">Menu</p>
          <button type="button" onClick={onClose} className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-muted" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav aria-label="All pages" className="space-y-5">
          {NAV.map((group, i) => (
            <div key={group.label ?? i}>
              {group.label && <p className="px-1 pb-1.5 text-[0.6875rem] font-medium uppercase tracking-[0.12em] text-muted-foreground">{group.label}</p>}
              <div className="grid grid-cols-2 gap-2">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = item.match(path);
                  return (
                    <Link key={item.href} href={item.href} onClick={onClose} aria-current={active ? "page" : undefined} className={cn("flex min-h-[52px] items-center gap-3 rounded-2xl border px-3.5 text-[0.9375rem]", active ? "border-foreground/30 bg-foreground/[0.04] font-medium" : "border-border/70")}>
                      <Icon className="h-5 w-5 shrink-0 text-muted-foreground" strokeWidth={1.75} />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        <div className="mt-6 grid grid-cols-2 gap-2 border-t pt-4">
          <a href="/" target="_blank" rel="noreferrer" className="flex min-h-[48px] items-center gap-2 rounded-2xl border px-3.5 text-sm">
            <ArrowUpRight className="h-4 w-4" /> View site
          </a>
          <button type="button" onClick={onSignOut} className="flex min-h-[48px] items-center gap-2 rounded-2xl border px-3.5 text-sm">
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

function CaptureDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [mode, setMode] = useState<"idea" | "link">("idea");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (open) setText("");
  }, [open]);

  const save = async () => {
    const value = text.trim();
    if (!value) return;
    setBusy(true);
    try {
      if (mode === "idea") {
        const tags = Array.from(value.matchAll(/(^|\s)#([A-Za-z0-9-]{1,40})/g)).map((m) => m[2]);
        const res = await fetch("/api/admin/writing/ideas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: value, tags }) });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Couldn't save the idea");
        toast.success("Idea saved", { action: { label: "Open ideas", onClick: () => router.push("/admin/stories") } });
      } else {
        const res = await fetch("/api/admin/reading", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: value }) });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error ?? "Couldn't save the link");
        toast.success(`Saved to your reading inbox${body.item?.articleTitle ? `: ${body.item.articleTitle}` : ""}`, { action: { label: "Open inbox", onClick: () => router.push("/admin/reading/inbox") } });
      }
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save");
    } finally {
      setBusy(false);
    }
  };

  const looksLikeLink = /^https?:\/\/\S+$/i.test(text.trim());
  useEffect(() => {
    if (looksLikeLink) setMode("link");
  }, [looksLikeLink]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-[30%] gap-4 rounded-2xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl font-normal">Capture</DialogTitle>
          <DialogDescription>An idea for a post, or a link to read later. Press ⌘↵ to save.</DialogDescription>
        </DialogHeader>
        <div role="radiogroup" aria-label="What are you saving?" className="inline-flex w-fit rounded-full bg-muted p-1 text-sm">
          {(
            [
              ["idea", "Idea", Lightbulb],
              ["link", "Link to read", Link2],
            ] as const
          ).map(([value, label, Icon]) => (
            <button key={value} type="button" role="radio" aria-checked={mode === value} onClick={() => setMode(value)} className={cn("flex h-8 items-center gap-1.5 rounded-full px-3.5 transition-colors", mode === value ? "bg-background shadow-sm" : "text-muted-foreground")}>
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          ))}
        </div>
        {mode === "idea" ? (
          <Textarea
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => (e.metaKey || e.ctrlKey) && e.key === "Enter" && save()}
            placeholder="What's on your mind? Add #tags to file it."
            rows={4}
            className="resize-none text-base"
            aria-label="Your idea"
          />
        ) : (
          <Input autoFocus type="url" inputMode="url" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && save()} placeholder="https://…" className="h-11 text-base" aria-label="Article link" />
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy || !text.trim()} className="gap-2">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "idea" ? "Save idea" : "Save to inbox"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CommandMenu({ open, onOpenChange, onCapture }: { open: boolean; onOpenChange: (v: boolean) => void; onCapture: () => void }) {
  const router = useRouter();
  const go = (href: string) => {
    onOpenChange(false);
    router.push(href);
  };
  const newThought = async () => {
    onOpenChange(false);
    try {
      const res = await fetch("/api/admin/writing/documents", { method: "POST" });
      const doc = await res.json();
      if (!res.ok) throw new Error(doc.error ?? "Couldn't create a draft");
      router.push(`/admin/stories/${doc.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't create a draft");
    }
  };
  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Jump to a page or run an action…" />
      <CommandList>
        <CommandEmpty>Nothing matches.</CommandEmpty>
        <CommandGroup heading="Actions">
          <CommandItem value="new thought post draft write" onSelect={newThought}>
            <Plus className="mr-2 h-4 w-4" /> New thought
          </CommandItem>
          <CommandItem
            value="capture idea link save article"
            onSelect={() => {
              onOpenChange(false);
              onCapture();
            }}
          >
            <Lightbulb className="mr-2 h-4 w-4" /> Capture an idea or a link
          </CommandItem>
          <CommandItem value="export download backup zip" onSelect={() => (window.location.href = "/api/admin/writing/export")}>
            <Download className="mr-2 h-4 w-4" /> Export everything (ZIP)
          </CommandItem>
          <CommandItem value="view public site open" onSelect={() => window.open("/", "_blank")}>
            <ArrowUpRight className="mr-2 h-4 w-4" /> View the public site
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        {NAV.map((group, i) => (
          <CommandGroup key={group.label ?? i} heading={group.label ?? "Go to"}>
            {group.items.map((item) => {
              const Icon = item.icon;
              return [
                <CommandItem key={item.href} value={`${item.label} ${(item.keywords ?? []).join(" ")}`} onSelect={() => go(item.href)}>
                  <Icon className="mr-2 h-4 w-4" /> {item.label}
                </CommandItem>,
                ...(item.within ?? []).map((w) => (
                  <CommandItem key={`${w.href}#${w.label}`} value={`${w.label} ${(w.keywords ?? []).join(" ")}`} onSelect={() => go(w.href)}>
                    <Icon className="mr-2 h-4 w-4 opacity-0" /> {w.label}
                  </CommandItem>
                )),
              ];
            })}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  );
}

export function AdminShell({ user, children }: { user: User; children: React.ReactNode }) {
  const path = usePathname() ?? "/admin";
  const router = useRouter();
  const { signOut } = useAuth();
  const immersive = isImmersive(path);
  const [railPref, setRailPref] = useState(false);
  const [menu, setMenu] = useState(false);
  const [command, setCommand] = useState(false);
  const [capture, setCapture] = useState(false);

  useEffect(() => setRailPref(read(RAIL_KEY) === "1"), []);
  useEffect(() => setMenu(false), [path]);
  const rail = railPref || immersive;

  const toggleRail = useCallback(() => {
    setRailPref((r) => {
      write(RAIL_KEY, r ? "0" : "1");
      return !r;
    });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing = target.closest("input, textarea, select, [contenteditable=true]");
      // The editor has its own ⌘K menu
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k" && !immersive) {
        e.preventDefault();
        setCommand((c) => !c);
      } else if (e.key === "[" && !typing && !e.metaKey && !e.ctrlKey && !immersive) {
        toggleRail();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [immersive, toggleRail]);

  const signOutNow = async () => {
    await signOut();
    router.push("/");
    router.refresh();
  };

  const current = ALL_ITEMS.find((i) => i.match(path));

  return (
    <div className="min-h-screen bg-background">
      <Sidebar path={path} rail={rail} onToggle={toggleRail} onCommand={() => setCommand(true)} onCapture={() => setCapture(true)} user={user} onSignOut={signOutNow} />
      {!immersive && <MobileBars path={path} title={current?.label ?? "Studio"} onCapture={() => setCapture(true)} onMenu={() => setMenu(true)} onCommand={() => setCommand(true)} />}
      {/* The sidebar offset and the page padding live on separate elements so they can't override each other */}
      <div className={cn("min-w-0 transition-[padding] duration-200 motion-reduce:transition-none", rail ? "lg:pl-[68px]" : "lg:pl-60")}>
        <div id="main" className={cn("min-w-0", immersive ? "" : "px-4 pb-28 pt-6 sm:px-6 lg:px-10 lg:pb-16 lg:pt-10")}>
          {children}
        </div>
      </div>
      <MenuSheet open={menu} onClose={() => setMenu(false)} path={path} onSignOut={signOutNow} />
      <CommandMenu open={command} onOpenChange={setCommand} onCapture={() => setCapture(true)} />
      <CaptureDialog open={capture} onOpenChange={setCapture} />
    </div>
  );
}
