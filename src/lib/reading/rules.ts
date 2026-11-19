// Pure reading-list rules (no I/O), unit tested.

export const NOT_ENOUGH = "Not enough detail about this page to suggest a note (it couldn't be read).";

/** Only ask the AI for a note when there is real information to base it on. */
export function hasEnoughDetail(input: { fetched?: boolean; description?: string | null; quote?: string | null }): boolean {
  return Boolean(input.fetched || input.description?.trim() || input.quote?.trim());
}

/** Shortcut menus send the chosen item's label; accept that as well as booleans. */
export function wantsPublish(value: unknown): boolean {
  return value === true || value === "true" || value === "Publish now";
}

/**
 * The note that goes public when an article is published straight from a
 * share sheet or the popup: only what the author typed. An AI suggestion is
 * never published unless the author chose it.
 */
export function noteOnPublish(typed: string | null | undefined, _suggested: string | null | undefined): string | null {
  const t = typed?.trim();
  return t ? t : null;
}
