"use client";

import { diffWords } from "diff";

/** Word-level comparison of the original passage and the AI proposal. */
export function WordDiff({ before, after }: { before: string; after: string }) {
  const parts = diffWords(before, after);
  return (
    <p className="whitespace-pre-wrap break-words font-serif text-[0.9375rem] leading-relaxed">
      {parts.map((part, i) =>
        part.added ? (
          <ins key={i} className="rounded-[3px] bg-ai/[0.12] px-px text-foreground no-underline shadow-[inset_0_-1.5px_0_hsl(var(--ai)/0.5)]">
            <span className="sr-only">[added: </span>
            {part.value}
            <span className="sr-only">]</span>
          </ins>
        ) : part.removed ? (
          <del key={i} className="text-muted-foreground/70 line-through decoration-muted-foreground/50">
            <span className="sr-only">[removed: </span>
            {part.value}
            <span className="sr-only">]</span>
          </del>
        ) : (
          <span key={i}>{part.value}</span>
        )
      )}
    </p>
  );
}

export function diffStats(before: string, after: string) {
  const count = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);
  return { beforeWords: count(before), afterWords: count(after) };
}
