"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, Loader2, Plus, Search, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SetupCard } from "./setup-card";
import { formatWhen, StudioApiError, studioFetch, type StudioListItem } from "./client";

type Filter = "all" | "drafts" | "published";

export function StatusBadge({ status, unpublishedChanges }: { status: string; unpublishedChanges?: boolean }) {
  if (status === "PUBLISHED") {
    return (
      <span className="inline-flex flex-wrap items-center gap-1.5">
        <Badge>Published</Badge>
        {unpublishedChanges && <Badge variant="outline">Unpublished changes</Badge>}
      </span>
    );
  }
  return <Badge variant="secondary">Draft</Badge>;
}

export function DocumentsList() {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [documents, setDocuments] = useState<StudioListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [setupRequired, setSetupRequired] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 250);
    return () => clearTimeout(t);
  }, [query]);

  const load = useCallback(async () => {
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

  const create = async () => {
    setCreating(true);
    try {
      const doc = await studioFetch<{ id: string }>("/documents", { method: "POST" });
      router.push(`/admin/stories/${doc.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't create a draft");
      setCreating(false);
    }
  };

  const remove = async (doc: StudioListItem) => {
    if (!confirm(`Delete "${doc.title || "Untitled"}" and its version history? This can't be undone.`)) return;
    try {
      await studioFetch(`/documents/${doc.id}`, { method: "DELETE" });
      toast.success("Draft deleted");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't delete");
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Thoughts</h1>
          <p className="text-muted-foreground">Your writing studio. Drafts stay private until you publish them.</p>
        </div>
        {!setupRequired && (
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/admin/stories/styles">
                <Sparkles className="mr-2 h-4 w-4" />
                Styles &amp; AI
              </Link>
            </Button>
            <Button onClick={create} disabled={creating}>
              {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              New thought
            </Button>
          </div>
        )}
      </div>

      {setupRequired ? (
        <SetupCard onReady={load} />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="drafts">Drafts</TabsTrigger>
                <TabsTrigger value="published">Published</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="relative w-full max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search titles and text"
                aria-label="Search titles and text"
                className="pl-9"
              />
            </div>
          </div>

          {loading && documents.length === 0 ? (
            <div className="flex justify-center py-12" aria-live="polite">
              <Loader2 className="h-6 w-6 animate-spin" aria-label="Loading" />
            </div>
          ) : documents.length === 0 ? (
            <p className="py-12 text-center text-muted-foreground">
              {debouncedQuery ? "Nothing matches that search." : "No thoughts here yet."}
            </p>
          ) : (
            <ul className="divide-y rounded-lg border border-border/60" aria-busy={loading}>
              {documents.map((doc) => (
                <li key={doc.id} className="group flex items-start gap-4 p-4 hover:bg-muted/30">
                  <Link href={`/admin/stories/${doc.id}`} className="min-w-0 flex-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium group-hover:underline underline-offset-4">{doc.title || "Untitled"}</span>
                      <StatusBadge status={doc.status} unpublishedChanges={doc.hasUnpublishedChanges} />
                      {doc.liveChangedOutside && <Badge variant="destructive">Edited outside Studio</Badge>}
                    </div>
                    {doc.excerpt && <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{doc.excerpt}</p>}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {doc.wordCount.toLocaleString()} words · edited {formatWhen(doc.updatedAt)}
                    </p>
                  </Link>
                  <div className="flex shrink-0 items-center gap-1">
                    {doc.liveIsPublished && doc.liveSlug && (
                      <Button asChild variant="ghost" size="icon" aria-label="View live post">
                        <a href={`/thoughts/${doc.liveSlug}`} target="_blank" rel="noreferrer">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                    {doc.status !== "PUBLISHED" && (
                      <Button variant="ghost" size="icon" aria-label={`Delete ${doc.title || "Untitled"}`} onClick={() => remove(doc)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}

          <p className="text-xs text-muted-foreground">
            Need the old editor? <Link href="/admin/stories/classic" className="underline underline-offset-2">Open the classic editor</Link>.
            Changes made there show up here as &ldquo;Edited outside Studio&rdquo;.
          </p>
        </>
      )}
    </div>
  );
}
