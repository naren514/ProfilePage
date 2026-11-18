// Typed fetch helpers for the Writing Studio API (browser side).

export interface ApiErrorBody {
  error: string;
  code?: string;
  details?: { currentRevision?: number; problems?: string[] } | unknown;
}

export class StudioApiError extends Error {
  constructor(public status: number, public body: ApiErrorBody) {
    super(body.error);
  }
  get code() {
    return this.body.code;
  }
}

export async function studioFetch<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...rest } = init;
  const response = await fetch(`/api/admin/writing${path}`, {
    ...rest,
    headers: json !== undefined ? { "Content-Type": "application/json", ...headers } : headers,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
    cache: "no-store",
  });
  const body = await response.json().catch(() => ({ error: `Request failed (${response.status})` }));
  if (!response.ok) throw new StudioApiError(response.status, body as ApiErrorBody);
  return body as T;
}

export interface LiveInfo {
  slug: string;
  isPublished: boolean;
  updatedAt: string;
}

export interface StudioDocument {
  id: string;
  title: string;
  slug: string | null;
  excerpt: string;
  status: string;
  bodyJson: { type: "doc"; content?: unknown[] };
  wordCount: number;
  tags: string[];
  postDate: string | null;
  styleId: string | null;
  currentRevision: number;
  publishedRevision: number | null;
  storyId: string | null;
  source: string;
  publishedAt: string | null;
  updatedAt: string;
  createdAt: string;
  live: LiveInfo | null;
  hasUnpublishedChanges: boolean;
  liveChangedOutside: boolean;
}

export interface StudioListItem {
  id: string;
  title: string;
  slug: string | null;
  excerpt: string;
  status: string;
  wordCount: number;
  tags: string[];
  currentRevision: number;
  publishedRevision: number | null;
  createdAt: string;
  updatedAt: string;
  liveSlug: string | null;
  liveIsPublished: boolean | null;
  hasUnpublishedChanges: boolean;
  liveChangedOutside: boolean;
}

export interface VersionSummary {
  id: string;
  revisionNumber: number;
  changeOrigin: string;
  title: string;
  wordCount: number;
  publishedSlug: string | null;
  createdBy: string | null;
  createdAt: string;
}

export const ORIGIN_LABELS: Record<string, string> = {
  import: "Imported from the old editor",
  autosave: "Autosave",
  manual: "Saved version",
  restore: "Restored an older version",
  publish: "Published",
  pull_live: "Pulled in the live post",
  before_ai: "Before an AI edit",
  ai_accept: "AI suggestion accepted",
};

export function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  const diff = Date.now() - date.getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} h ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
