"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Loader2, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { SetupCard } from "./setup-card";
import { IdeasList, QuickCapture } from "./ideas";
import { Kbd, PageHeader, StatusDot } from "./studio-ui";
import { formatWhen, StudioApiError, studioFetch, type StudioListItem } from "./client";

type Filter = "all" | "drafts" | "published" | "ideas";

/** Kept for the editor header. */
export function StatusBadge({ status, unpublishedChanges }: { status: string; unpublishedChanges?: boolean }) {
  return <StatusDot status={status} unpublishedChanges={unpublishedChanges} />;
}

/** Underline-style tabs used on Studio pages. */
export const tabListClass = "h-auto gap-5 rounded-none border-b bg-transparent p-0";
export const tabTriggerClass =
  "relative rounded-none border-b-2 border-transparent bg-transparent px-0 pb-2.5 pt-0 text-sm font-normal text-muted-foreground shadow-none transition-colors hover:text-foreground data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:font-medium data-[state=active]:text-foreground data-[state=active]:shadow-none -mb-px";

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function DocumentsList() {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [documents, setDocuments] = useState<StudioListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [setupRequired, setSetupRequired] = useState(false);
  // The Studio works, but a newer feature's tables are missing (an update since the last "Set up now")
  const [updateNeeded, setUpdateNeeded] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [creating, setCreating] = useState(false);
  const [ideasKey, setIdeasKey] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 250);
    return () => clearTimeout(t);
  }, [query]);

  const load = useCallback(async () => {
    if (filter === "ideas") return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ filter });
      if (debouncedQuery.trim()) params.set("q", debouncedQuery.trim());
      const data = await studioFetch<{ documents: StudioListItem[]; imported: number }>(`/documents?${params}`);
      setDocuments(data.documents);
      setSetupRequired(false);
      if (data.imported > 0) toast.success(`Copied ${data.imported} existing post${data.imported === 1 ? "" : "s"} into the Studio`);
    } catch (e) {
      if (e instanceof StudioApiError && e.code === "SETUP_REQUIRED") setSetupRequired(true);
      else toast.error(e instanceof Error ? e.message : "Couldn't load documents");
    } finally {
      setLoading(false);
    }
  }, [filter, debouncedQuery]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    studioFetch<{ ready: boolean }>("/setup")
      .then((r) => setUpdateNeeded(!r.ready))
      .catch(() => {});
  }, []);

  const finishSetup = async () => {
    setUpdating(true);
    try {
      await studioFetch("/setup", { method: "POST" });
      setUpdateNeeded(false);
      toast.success("Setup finished");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Setup failed");
    } finally {
      setUpdating(false);
    }
  };

  const create = useCallback(async () => {
    setCreating(true);
    try {
      const doc = await studioFetch<{ id: string }>("/documents", { method: "POST" });
      router.push(`/admin/stories/${doc.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't create a draft");
      setCreating(false);
    }
  }, [router]);

  // "c" starts a new thought when you're not typing somewhere
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (e.key !== "c" || e.metaKey || e.ctrlKey || e.altKey || target.closest("input, textarea, [contenteditable=true]")) return;
      e.preventDefault();
      if (!creating && !setupRequired) create();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [create, creating, setupRequired]);

  const remove = async (doc: StudioListItem) => {
    if (!confirm(`Delete "${doc.title || "Untitled"}" and its version history? This can't be undone.`)) return;
    try {
      await studioFetch(`/documents/${doc.id}`, { method: "DELETE" });
      // Drop the row right away; the reload then confirms the list
      setDocuments((list) => list.filter((d) => d.id !== doc.id));
      toast.success("Draft deleted");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't delete");
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-10">
      <PageHeader
        title="Thoughts"
        description="Your writing studio. Drafts stay private until you publish them."
        actions={
          !setupRequired && (
            <Button onClick={create} disabled={creating} className="gap-2 rounded-full pl-3 pr-4">
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              New thought
              <span className="ml-1 hidden rounded border border-background/30 px-1 text-[10px] font-medium text-background/70 sm:inline">C</span>
            </Button>
          )
        }
      />

      {updateNeeded && !setupRequired && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/40 px-4 py-3 text-sm">
          <span>New Studio features need a one-time database update. Your posts aren&apos;t changed, and it&apos;s safe to run again.</span>
          <Button size="sm" onClick={finishSetup} disabled={updating} className="gap-2">
            {updating && <Loader2 className="h-4 w-4 animate-spin" />}
            Set up now
          </Button>
        </div>
      )}

      {setupRequired ? (
        <SetupCard onReady={load} />
      ) : (
        <>
          <QuickCapture
            onSaved={() => {
              setIdeasKey((k) => k + 1);
              if (filter !== "ideas") toast.message("Find it under Ideas", { action: { label: "Show", onClick: () => setFilter("ideas") } });
            }}
          />

          <div className="space-y-2">
            <div className="flex flex-wrap items-end justify-between gap-4 border-b">
              <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
                <TabsList className={cn(tabListClass, "border-b-0")}>
                  {(["all", "drafts", "published", "ideas"] as const).map((f) => (
                    <TabsTrigger key={f} value={f} className={tabTriggerClass}>
                      {f === "all" ? "All" : f === "drafts" ? "Drafts" : f === "published" ? "Published" : "Ideas"}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
              {filter !== "ideas" && (
                <div className="relative mb-2 w-full max-w-[15rem]">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search"
                    aria-label="Search titles and text"
                    className="h-8 w-full rounded-full bg-muted/60 pl-8 pr-3 text-sm placeholder:text-muted-foreground focus:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
              )}
            </div>

            {filter === "ideas" ? (
              <IdeasList refreshKey={ideasKey} />
            ) : loading && documents.length === 0 ? (
              <div className="space-y-6 py-6" aria-live="polite" aria-label="Loading">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="space-y-2">
                    <div className="h-5 w-2/3 animate-pulse rounded bg-muted" />
                    <div className="h-3.5 w-1/2 animate-pulse rounded bg-muted/70" />
                  </div>
                ))}
              </div>
            ) : documents.length === 0 ? (
              <div className="py-16 text-center">
                <p className="font-serif text-2xl text-foreground/80">{debouncedQuery ? "Nothing matches that search." : "Nothing written yet."}</p>
                {!debouncedQuery && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    Capture an idea above, or press <Kbd>C</Kbd> to start writing.
                  </p>
                )}
              </div>
            ) : (
              <ul aria-busy={loading} className="divide-y divide-border/70">
                {documents.map((doc) => (
                  <li key={doc.id} className="group relative -mx-4 rounded-xl px-4 transition-colors hover:bg-muted/40 focus-within:bg-muted/40">
                    <div className="flex items-start gap-6 py-5">
                      <time dateTime={doc.updatedAt} className="hidden w-14 shrink-0 pt-1.5 text-xs tabular-nums text-muted-foreground sm:block">
                        {shortDate(doc.updatedAt)}
                      </time>
                      <Link href={`/admin/stories/${doc.id}`} className="min-w-0 flex-1 rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        <span className={cn("block font-serif text-[1.375rem] leading-snug tracking-tight", !doc.title && "italic text-muted-foreground")}>
                          {doc.title || "Untitled"}
                        </span>
                        {doc.excerpt && <span className="mt-1 line-clamp-1 block text-[0.9375rem] text-muted-foreground">{doc.excerpt}</span>}
                        <span className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <StatusDot status={doc.status} unpublishedChanges={doc.hasUnpublishedChanges} />
                          <span aria-hidden>·</span>
                          <span>{doc.wordCount.toLocaleString()} words</span>
                          <span aria-hidden>·</span>
                          <span>edited {formatWhen(doc.updatedAt)}</span>
                          {doc.liveChangedOutside && (
                            <>
                              <span aria-hidden>·</span>
                              <span className="text-amber-700">Edited outside Studio</span>
                            </>
                          )}
                        </span>
                      </Link>
                      <div className="flex shrink-0 items-center gap-0.5 pt-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                        {doc.liveIsPublished && doc.liveSlug && (
                          <Button asChild variant="ghost" size="icon" className="h-8 w-8 rounded-full" aria-label="View live post">
                            <a href={`/thoughts/${doc.liveSlug}`} target="_blank" rel="noreferrer">
                              <ArrowUpRight className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                        {doc.status !== "PUBLISHED" && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" aria-label={`Delete ${doc.title || "Untitled"}`} onClick={() => remove(doc)}>
                            <Trash2 className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            Prefer the old editor? <Link href="/admin/stories/classic" className="underline underline-offset-2 hover:text-foreground">Open the classic editor</Link>.
            Changes made there show up here as &ldquo;Edited outside Studio&rdquo;.
          </p>
        </>
      )}
    </div>
  );
}
