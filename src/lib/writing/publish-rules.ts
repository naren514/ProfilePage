import { isValidSlug } from "@/lib/content/slug";

export interface PublishCandidate {
  title: string;
  slug: string | null;
  excerpt: string;
  wordCount: number;
  bodyJson: unknown;
}

function hasMedia(json: unknown): boolean {
  return JSON.stringify(json ?? "").includes('"type":"image"');
}

/** What's missing before a document can go live. Empty means ready. */
export function publishProblems(doc: PublishCandidate): string[] {
  const problems: string[] = [];
  if (!doc.title.trim()) problems.push("Add a title.");
  if (!doc.slug) problems.push("Add a URL slug.");
  else if (!isValidSlug(doc.slug)) problems.push("The URL slug can only use lowercase letters, numbers and single hyphens.");
  if (!doc.excerpt.trim()) problems.push("Add an excerpt; it's shown on the Thoughts page.");
  if (doc.wordCount === 0 && !hasMedia(doc.bodyJson)) problems.push("The post body is empty.");
  return problems;
}

/** Changing a live post's URL breaks shared links, so it needs explicit confirmation. */
export function needsSlugConfirmation(
  live: { slug: string; isPublished: boolean } | null,
  nextSlug: string | null,
  confirmed: boolean
): boolean {
  if (!live || !live.isPublished || !nextSlug) return false;
  return live.slug !== nextSlug && !confirmed;
}

/** True when the live story was edited after the draft last matched it (e.g. in the classic editor). */
export function liveChangedOutsideStudio(storyUpdatedAt: Date | null, storySyncedAt: Date | null): boolean {
  if (!storyUpdatedAt || !storySyncedAt) return false;
  return storyUpdatedAt.getTime() - storySyncedAt.getTime() > 1000;
}
