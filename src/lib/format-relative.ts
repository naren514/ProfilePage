/** "just now", "12 min ago", "3 h ago", "2 days ago", then a date. */
export function formatRelative(when: Date | string | null | undefined): string {
  if (!when) return "";
  const date = new Date(when);
  const diff = Date.now() - date.getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} h ago`;
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)} day${diff < 2 * 86_400_000 ? "" : "s"} ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
