"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, Lock, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TagEditor } from "./tag-editor";
import { readingFetch, ReadingApiError, type PreviewDto, type ReadingItemDto } from "./client";

interface Props {
  url: string;
  title: string;
  quote: string;
}

type Phase = { kind: "loading" } | { kind: "ready"; preview: PreviewDto } | { kind: "saving"; publish: boolean } | { kind: "saved"; item: ReadingItemDto } | { kind: "error"; message: string };

/** The small window the "+ Reading" bookmarklet opens. */
export function SavePopup({ url, title: sharedTitle, quote: sharedQuote }: Props) {
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [preview, setPreview] = useState<PreviewDto | null>(null);
  const [title, setTitle] = useState(sharedTitle);
  const [note, setNote] = useState("");
  const [quote, setQuote] = useState(sharedQuote);
  const [tags, setTags] = useState<string[]>([]);

  useEffect(() => {
    if (!url) {
      setPhase({ kind: "error", message: "No link was sent. Use the + Reading button on an article page." });
      return;
    }
    readingFetch<PreviewDto>("/preview", { method: "POST", json: { url, title: sharedTitle, quote: sharedQuote } })
      .then((p) => {
        setPreview(p);
        if (p.meta.title) setTitle(p.meta.title);
        if (p.existing?.note) setNote(p.existing.note);
        if (p.existing?.tags?.length) setTags(p.existing.tags);
        setPhase({ kind: "ready", preview: p });
      })
      .catch((e) =>
        setPhase({
          kind: "error",
          message: e instanceof ReadingApiError && e.code === "SETUP_REQUIRED" ? "Open Admin → Reading once to finish setting up the reading list." : e instanceof Error ? e.message : "Couldn't read the page",
        })
      );
  }, [url, sharedTitle, sharedQuote]);

  const save = async (publish: boolean) => {
    if (!preview) return;
    setPhase({ kind: "saving", publish });
    try {
      const { item } = await readingFetch<{ item: ReadingItemDto }>("", {
        method: "POST",
        json: {
          url: preview.url,
          title: sharedTitle,
          titleOverride: title.trim() && title.trim() !== preview.meta.title ? title.trim() : null,
          quote: quote.trim() || null,
          note: note.trim() || null,
          suggestedNote: preview.suggestedNote,
          tags,
          suggestedTags: preview.suggestedTags,
          publish,
          via: "bookmarklet",
          suggest: !preview.suggestedNote,
        },
      });
      setPhase({ kind: "saved", item });
      if (window.opener) setTimeout(() => window.close(), 1600);
    } catch (e) {
      setPhase({ kind: "error", message: e instanceof Error ? e.message : "Couldn't save" });
    }
  };

  if (phase.kind === "saved") {
    const published = phase.item.status === "published";
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center" role="status">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-foreground text-background">
          <Check className="h-6 w-6" aria-hidden />
        </span>
        <p className="mt-5 font-serif text-3xl">{published ? "Published" : "Saved"}</p>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          {published ? "It's on your public Reading page." : "It's in your Reading inbox, private until you publish it."}
        </p>
        <div className="mt-6 flex gap-2">
          <Button variant="outline" className="rounded-full" onClick={() => window.close()}>
            Close
          </Button>
          <Button asChild variant="ghost" className="rounded-full">
            <a href="/admin/reading">Open the inbox</a>
          </Button>
        </div>
      </div>
    );
  }

  if (phase.kind === "error") {
    return (
      <div className="py-16 text-center" role="alert">
        <p className="font-serif text-2xl">Couldn&apos;t save this one</p>
        <p className="mt-2 text-sm text-muted-foreground">{phase.message}</p>
        <Button asChild variant="outline" className="mt-6 rounded-full">
          <a href="/admin/reading">Open the inbox</a>
        </Button>
      </div>
    );
  }

  const loading = phase.kind === "loading";
  const saving = phase.kind === "saving";
  const meta = preview?.meta;
  const suggestion = preview?.suggestedNote;

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        save(false);
      }}
    >
      <div className="flex gap-4">
        <div className="min-w-0 flex-1 space-y-2">
          <p className="truncate text-xs uppercase tracking-[0.12em] text-muted-foreground">
            {loading ? "Reading the page…" : [meta?.siteName, meta?.author, meta?.publishedDate].filter(Boolean).join(" · ")}
          </p>
          <label htmlFor="save-title" className="sr-only">
            Title
          </label>
          <textarea
            id="save-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            rows={2}
            maxLength={300}
            className="w-full resize-none bg-transparent font-serif text-2xl leading-tight focus:outline-none [field-sizing:content]"
          />
          {preview?.existing && (
            <p className="text-xs text-amber-700">Already on your list ({preview.existing.status}). Saving again updates it.</p>
          )}
        </div>
        {meta?.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={meta.imageUrl} alt="" referrerPolicy="no-referrer" className="h-20 w-20 shrink-0 rounded-xl bg-muted object-cover" onError={(e) => (e.currentTarget.style.display = "none")} />
        )}
      </div>

      {quote && (
        <div>
          <label htmlFor="save-quote" className="mb-1.5 block text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
            Highlighted passage
          </label>
          <textarea
            id="save-quote"
            value={quote}
            onChange={(e) => setQuote(e.target.value)}
            rows={3}
            className="w-full resize-none border-l-2 border-ai/40 bg-transparent pl-3 font-serif text-sm italic leading-relaxed text-muted-foreground focus:outline-none [field-sizing:content]"
          />
        </div>
      )}

      <div>
        <label htmlFor="save-note" className="mb-1.5 block text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
          Your note <span className="normal-case tracking-normal">(optional, shown publicly)</span>
        </label>
        <textarea
          id="save-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          maxLength={600}
          autoFocus
          placeholder="Why is it worth reading?"
          className="w-full resize-none rounded-xl border bg-background px-3 py-2 font-serif leading-relaxed placeholder:italic placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-ring [field-sizing:content]"
        />
        {loading ? (
          <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-ai">
            <Loader2 className="h-3 w-3 animate-spin" /> Suggesting a note…
          </p>
        ) : suggestion && suggestion !== note ? (
          <div className="mt-2 flex items-start gap-3 rounded-xl bg-ai-soft px-3 py-2.5 text-sm" role="group" aria-label="Suggested note">
            <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ai" aria-hidden />
            <p className="flex-1 font-serif leading-relaxed">{suggestion}</p>
            <Button type="button" size="sm" variant="ghost" className="h-7 rounded-full px-2.5 text-xs text-ai hover:bg-ai/10 hover:text-ai" onClick={() => setNote(suggestion)}>
              Use
            </Button>
          </div>
        ) : preview?.suggestionError ? (
          <p className="mt-2 text-xs text-muted-foreground">No suggestion: {preview.suggestionError}</p>
        ) : null}
      </div>

      <div>
        <p className="mb-1.5 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Topics</p>
        <TagEditor value={tags} onChange={setTags} suggested={preview?.suggestedTags ?? []} label="Topics for this article" idPrefix="save" />
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-5">
        <Button type="submit" variant="outline" className="rounded-full" disabled={loading || saving}>
          {saving && !phase.publish ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Lock className="mr-1.5 h-4 w-4" />}
          Keep private
        </Button>
        <Button type="button" className="rounded-full" disabled={loading || saving} onClick={() => save(true)}>
          {saving && phase.publish ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-4 w-4" />}
          Publish now
        </Button>
      </div>
    </form>
  );
}
