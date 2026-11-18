"use client";

import { diffWords } from "diff";

/** Word-level comparison of the original passage and the AI proposal. */
export function WordDiff({ before, after }: { before: string; after: string }) {
  const parts = diffWords(before, after);
  return (
    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
      {parts.map((part, i) =>
        part.added ? (
          <ins key={i} className="rounded-sm bg-emerald-500/15 text-emerald-900 no-underline decoration-transparent">
            <span className="sr-only">[added: </span>
            {part.value}
            <span className="sr-only">]</span>
          </ins>
        ) : part.removed ? (
          <del key={i} className="rounded-sm bg-red-500/10 text-red-800/80 line-through">
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
