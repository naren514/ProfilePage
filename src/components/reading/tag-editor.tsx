"use client";

import { useEffect, useId, useState } from "react";
import { Plus, Sparkles, X } from "lucide-react";
import { cleanTags, topicSlug } from "@/lib/topics";
import { readingFetch } from "./client";

let vocabularyCache: Promise<string[]> | null = null;

/** Topics already in use (posts and reading), fetched once per page. */
export function useTopicVocabulary(): string[] {
  const [tags, setTags] = useState<string[]>([]);
  useEffect(() => {
    vocabularyCache ??= readingFetch<{ tags: string[] }>("/tags")
      .then((d) => d.tags)
      .catch(() => []);
    vocabularyCache.then(setTags);
  }, []);
  return tags;
}

/**
 * Topic chips with an input. Enter or comma adds; existing topics autocomplete;
 * AI suggestions appear as dashed chips to add with one click.
 */
export function TagEditor({
  value,
  onChange,
  suggested = [],
  label,
  idPrefix,
}: {
  value: string[];
  onChange: (tags: string[]) => void;
  suggested?: string[];
  label: string;
  idPrefix?: string;
}) {
  const vocabulary = useTopicVocabulary();
  const [draft, setDraft] = useState("");
  const autoId = useId();
  const inputId = `${idPrefix ?? autoId}-tag-input`;
  const listId = `${idPrefix ?? autoId}-tag-options`;
  const have = new Set(value.map(topicSlug));
  const pending = suggested.filter((t) => !have.has(topicSlug(t)));

  const add = (raw: string) => {
    const next = cleanTags([...value, ...raw.split(",")]);
    if (next.length !== value.length) onChange(next);
    setDraft("");
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5 rounded-xl border bg-background px-2 py-1.5 focus-within:ring-2 focus-within:ring-ring">
        <ul className="contents" aria-label={label}>
          {value.map((tag) => (
            <li key={tag} className="inline-flex items-center gap-1 rounded-full bg-muted py-0.5 pl-2.5 pr-1 text-xs">
              {tag}
              <button
                type="button"
                className="rounded-full p-0.5 text-muted-foreground hover:bg-background hover:text-foreground"
                onClick={() => onChange(value.filter((t) => t !== tag))}
                aria-label={`Remove topic ${tag}`}
              >
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
        <label htmlFor={inputId} className="sr-only">
          Add a topic
        </label>
        <input
          id={inputId}
          list={listId}
          value={draft}
          onChange={(e) => {
            const v = e.target.value;
            if (v.endsWith(",")) add(v);
            else setDraft(v);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (draft.trim()) add(draft);
            } else if (e.key === "Backspace" && !draft && value.length) {
              onChange(value.slice(0, -1));
            }
          }}
          onBlur={() => draft.trim() && add(draft)}
          placeholder={value.length ? "Add topic" : "Add topics, e.g. Supply chain"}
          className="h-7 min-w-[8rem] flex-1 bg-transparent px-1 text-sm placeholder:text-muted-foreground/70 focus:outline-none"
        />
        <datalist id={listId}>
          {vocabulary
            .filter((t) => !have.has(topicSlug(t)))
            .slice(0, 50)
            .map((t) => (
              <option key={t} value={t} />
            ))}
        </datalist>
      </div>
      {pending.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Suggested topics">
          <Sparkles className="h-3.5 w-3.5 text-ai" aria-hidden />
          {pending.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => add(tag)}
              className="inline-flex items-center gap-1 rounded-full border border-dashed border-ai/50 px-2.5 py-0.5 text-xs text-ai hover:bg-ai-soft"
              aria-label={`Add suggested topic ${tag}`}
            >
              <Plus className="h-3 w-3" aria-hidden />
              {tag}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
