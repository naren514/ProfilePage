"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatWhen, ORIGIN_LABELS, studioFetch, type VersionSummary } from "./client";

interface VersionDetail extends VersionSummary {
  excerpt: string;
  html: string;
}

export function VersionsSheet({
  documentId,
  open,
  onOpenChange,
  onRestore,
}: {
  documentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Restore the given version; resolves when done. */
  onRestore: (versionId: string) => Promise<void>;
}) {
  const [versions, setVersions] = useState<VersionSummary[] | null>(null);
  const [selected, setSelected] = useState<VersionDetail | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    if (!open) {
      setSelected(null);
      return;
    }
    setVersions(null);
    studioFetch<{ versions: VersionSummary[] }>(`/documents/${documentId}/versions`)
      .then((d) => setVersions(d.versions))
      .catch((e) => {
        toast.error(e instanceof Error ? e.message : "Couldn't load versions");
        setVersions([]);
      });
  }, [open, documentId]);

  const openVersion = async (id: string) => {
    setLoadingId(id);
    try {
      setSelected(await studioFetch<VersionDetail>(`/documents/${documentId}/versions/${id}`));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't load that version");
    } finally {
      setLoadingId(null);
    }
  };

  const restore = async () => {
    if (!selected) return;
    if (!confirm("Replace the current title, excerpt and text with this version? The current text stays in the history.")) return;
    setRestoring(true);
    try {
      await onRestore(selected.id);
      onOpenChange(false);
    } finally {
      setRestoring(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Version history</SheetTitle>
          <SheetDescription>
            Versions are saved when you save manually (Ctrl+S), publish or restore, and every few minutes while you
            write.
          </SheetDescription>
        </SheetHeader>

        {selected ? (
          <div className="mt-6 space-y-4">
            <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              All versions
            </Button>
            <div className="text-sm text-muted-foreground">
              {ORIGIN_LABELS[selected.changeOrigin] ?? selected.changeOrigin} · {new Date(selected.createdAt).toLocaleString()}
            </div>
            <Button onClick={restore} disabled={restoring}>
              {restoring ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}
              Restore this version
            </Button>
            <article className="rounded-md border p-4">
              <h2 className="text-2xl font-bold">{selected.title || "Untitled"}</h2>
              {selected.excerpt && <p className="mt-2 text-muted-foreground">{selected.excerpt}</p>}
              <div className="prose prose-neutral mt-4 max-w-none" dangerouslySetInnerHTML={{ __html: selected.html }} />
            </article>
          </div>
        ) : versions === null ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin" aria-label="Loading versions" />
          </div>
        ) : versions.length === 0 ? (
          <p className="mt-6 text-sm text-muted-foreground">
            No saved versions yet. Press Ctrl+S (⌘S on a Mac) to save one now.
          </p>
        ) : (
          <ul className="mt-6 divide-y rounded-md border">
            {versions.map((v) => (
              <li key={v.id}>
                <button
                  type="button"
                  onClick={() => openVersion(v.id)}
                  className="flex w-full items-start justify-between gap-3 p-3 text-left hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{ORIGIN_LABELS[v.changeOrigin] ?? v.changeOrigin}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {v.title || "Untitled"} · {v.wordCount.toLocaleString()} words
                      {v.publishedSlug ? ` · /thoughts/${v.publishedSlug}` : ""}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground" title={new Date(v.createdAt).toLocaleString()}>
                    {loadingId === v.id ? <Loader2 className="h-4 w-4 animate-spin" /> : formatWhen(v.createdAt)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </SheetContent>
    </Sheet>
  );
}
