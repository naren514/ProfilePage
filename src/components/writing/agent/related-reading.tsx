"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowUpRight, BookOpen, Check, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { studioFetch } from "../client";

// "From your reading": articles the author saved or picked that relate to
// this post, with the words they share. One press adds one to the post's
// sources, where research and drafting can cite it.

interface Related {
  key: string;
  url: string;
  title: string;
  publisher: string;
  status: string;
  terms: string[];
  added: boolean;
}

export function RelatedReading({ documentId, onAdded }: { documentId: string; onAdded: () => void }) {
  const [items, setItems] = useState<Related[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    studioFetch<{ items: Related[] }>(`/documents/${documentId}/related-reading`)
      .then((d) => setItems(d.items))
      .catch(() => setItems([]));
  }, [documentId]);
  useEffect(load, [load]);

  const add = async (r: Related) => {
    setBusy(r.key);
    try {
      await studioFetch(`/documents/${documentId}/related-reading`, { method: "POST", json: { key: r.key } });
      setItems((list) => list?.map((x) => (x.key === r.key ? { ...x, added: true } : x)) ?? null);
      toast.success("Added to this post's sources");
      onAdded();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't add it");
    } finally {
      setBusy(null);
    }
  };

  if (items === null) return null;
  return (
    <section aria-label="From your reading" className="space-y-2">
      <h3 className="flex items-center gap-1.5 text-[0.6875rem] font-medium uppercase tracking-[0.12em] text-muted-foreground">
        <BookOpen className="h-3 w-3" aria-hidden /> From your reading
      </h3>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nothing you&apos;ve saved matches this post yet. It updates as the post grows.</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((r) => (
            <li key={r.key} aria-label={r.title} className="flex items-start gap-2 rounded-xl bg-background p-2.5 text-xs ring-1 ring-border">
              <div className="min-w-0 flex-1">
                <a href={r.url} target="_blank" rel="noreferrer" className="inline-flex items-start gap-1 text-[0.8125rem] font-medium leading-snug hover:underline">
                  {r.title} <ArrowUpRight className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                </a>
                <p className="mt-0.5 text-muted-foreground">
                  {r.publisher}
                  {r.terms.length > 0 && ` · shares “${r.terms.join("”, “")}”`}
                </p>
              </div>
              {r.added ? (
                <span className="inline-flex h-7 shrink-0 items-center gap-1 text-muted-foreground">
                  <Check className="h-3.5 w-3.5" /> Source
                </span>
              ) : (
                <button type="button" onClick={() => add(r)} disabled={busy === r.key} className="inline-flex h-7 shrink-0 items-center gap-1 rounded-full px-2 ring-1 ring-border hover:bg-muted" aria-label={`Add ${r.title} as a source`}>
                  {busy === r.key ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />} Source
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
