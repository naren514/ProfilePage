export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

export function summarizeText(text: string): { text: string; wordCount: number } {
  const normalized = text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  return { text: normalized, wordCount: countWords(normalized) };
}
