// Turn a passage into a Postgres full-text query of its distinctive words.
// Pure, so it can be unit tested.

const STOPWORDS = new Set(
  "about above after again against also because been before being below between both cannot could does doing down during each from further have having here hers herself himself into itself just like more most must myself only other ought ours ourselves over same should some such than that their theirs them themselves then there these they this those through under until very want were what when where which while whom with would your yours yourself yourselves will shall said says make made many much even ever every into onto upon really thing things something".split(
    " "
  )
);

/** Up to `max` distinctive words, most frequent first, joined with OR for to_tsquery. */
export function buildTsQuery(text: string, max = 12): string | null {
  const counts = new Map<string, number>();
  for (const word of text.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").match(/[a-z0-9]{4,}/g) ?? []) {
    if (STOPWORDS.has(word) || /^\d+$/.test(word)) continue;
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  const words = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .slice(0, max)
    .map(([w]) => w);
  return words.length ? words.join(" | ") : null;
}
