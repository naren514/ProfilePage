// Decides what the public chatbot is allowed to learn from. Kept free of
// database imports so it can be unit tested.

interface Publishable {
  isPublished?: boolean | null;
}

/**
 * Thoughts posts are personal writing: only published ones may reach the
 * public chatbot. Other entity types keep their existing behaviour.
 */
export function isEligibleForPublicRAG(entityType: string, entity: Publishable): boolean {
  if (entityType === "story") return entity.isPublished === true;
  return true;
}

export function filterPublishedStories<T extends Publishable>(rows: T[]): T[] {
  return rows.filter((row) => row.isPublished === true);
}
