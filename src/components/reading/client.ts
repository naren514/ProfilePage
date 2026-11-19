// Browser-side helpers for the reading list API.

export class ReadingApiError extends Error {
  constructor(public status: number, public code: string | undefined, message: string) {
    super(message);
  }
}

export async function readingFetch<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...rest } = init;
  const response = await fetch(`/api/admin/reading${path}`, {
    ...rest,
    headers: json !== undefined ? { "Content-Type": "application/json", ...headers } : headers,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
    cache: "no-store",
  });
  const body = await response.json().catch(() => ({ error: `Request failed (${response.status})` }));
  if (!response.ok) throw new ReadingApiError(response.status, body.code, body.error ?? "Request failed");
  return body as T;
}

export type ReadingStatus = "inbox" | "published" | "archived";

export interface ReadingItemDto {
  id: string;
  articleTitle: string;
  source: string;
  siteName: string | null;
  author: string | null;
  excerpt: string | null;
  articleUrl: string | null;
  publishedDate: string;
  status: ReadingStatus;
  note: string | null;
  suggestedNote: string | null;
  quote: string | null;
  tags: string[];
  suggestedTags: string[];
  imageUrl: string | null;
  savedVia: string | null;
  savedAt: string | null;
  createdAt: string;
}

export interface PreviewDto {
  url: string;
  meta: { title: string | null; siteName: string | null; description: string | null; imageUrl: string | null; author: string | null; publishedDate: string | null };
  fetched: boolean;
  existing: { id: string; status: ReadingStatus; note: string | null; suggestedNote: string | null; tags: string[] } | null;
  suggestedNote: string | null;
  suggestedTags: string[];
  suggestionError: string | null;
}

export function bookmarkletCode(origin: string): string {
  // Opens a small save window with the page's address, title and any selected text
  return `javascript:(()=>{const q=String(window.getSelection()||'').slice(0,1500);const u='${origin}/reading-save?url='+encodeURIComponent(location.href)+'&title='+encodeURIComponent(document.title)+'&quote='+encodeURIComponent(q);const w=window.open(u,'reading-save','width=540,height=720');if(!w)location.href=u;})()`;
}
