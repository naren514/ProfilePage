import { sanitizePostHtml } from "./sanitize";
import type { ThoughtInput, ThoughtUpdateInput } from "@/lib/validations/api-schemas";

interface ExistingThought {
  slug: string;
  isPublished: boolean;
}

/** A published post's URL only changes when the author explicitly asks for it. */
export function isBlockedSlugChange(existing: ExistingThought, input: ThoughtUpdateInput): boolean {
  if (input.slug === undefined || input.slug === existing.slug) return false;
  return existing.isPublished && input.confirmSlugChange !== true;
}

const UPDATABLE_FIELDS = [
  "title", "slug", "summary", "action", "situation", "task", "result",
  "lessonsLearned", "company", "role", "date", "tags", "isFeatured", "isPublished",
] as const;

type UpdatableField = (typeof UPDATABLE_FIELDS)[number];

/**
 * Only fields present in the request are written, so saving from the Thoughts
 * editor can't blank out legacy STAR content it doesn't show.
 */
export function buildThoughtUpdate(input: ThoughtUpdateInput): Partial<Pick<ThoughtInput, UpdatableField>> {
  const update: Record<string, unknown> = {};
  for (const field of UPDATABLE_FIELDS) {
    if (input[field] !== undefined) update[field] = input[field];
  }
  if (typeof update.action === "string") update.action = sanitizePostHtml(update.action);
  return update as Partial<Pick<ThoughtInput, UpdatableField>>;
}
