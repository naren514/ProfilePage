// Pure URL helpers for the reading list (no I/O, unit tested).

const TRACKING_PARAMS = /^(utm_[a-z_]+|fbclid|gclid|dclid|msclkid|mc_cid|mc_eid|igshid|si|ref_src|ref_url|_hsenc|_hsmi|mkt_tok|trk|trackingId|rcm|lipi)$/i;

/** Parse a user-supplied link; adds https:// when the scheme is missing. Only http(s). */
export function parseArticleUrl(input: string): URL | null {
  const raw = input.trim();
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (!url.hostname.includes(".") && url.hostname !== "localhost") return null;
  return url;
}

/** The link without tracking parameters or fragment; used as the shareable URL. */
export function cleanUrl(url: URL): string {
  const clean = new URL(url.toString());
  clean.hash = "";
  for (const key of Array.from(clean.searchParams.keys())) {
    if (TRACKING_PARAMS.test(key)) clean.searchParams.delete(key);
  }
  return clean.toString();
}

/** Key used to spot the same article saved twice. */
export function normalizeUrl(url: URL): string {
  const clean = new URL(cleanUrl(url));
  clean.protocol = "https:";
  clean.hostname = clean.hostname.toLowerCase().replace(/^(www|m|mobile|amp)\./, "");
  clean.port = "";
  clean.searchParams.sort();
  let path = clean.pathname.replace(/\/amp\/?$/, "/").replace(/\/+$/, "");
  if (!path) path = "";
  const query = clean.searchParams.toString();
  return `${clean.hostname}${path}${query ? `?${query}` : ""}`;
}

/** First http(s) link in shared text (share sheets often send "Title https://…"). */
export function firstUrlIn(text: string | null | undefined): string | null {
  if (!text) return null;
  const match = text.match(/https?:\/\/[^\s<>"'()]+[^\s<>"'().,;:!?]/i);
  return match ? match[0] : null;
}

const KNOWN_SITES: Record<string, string> = {
  "x.com": "X",
  "twitter.com": "X",
  "linkedin.com": "LinkedIn",
  "medium.com": "Medium",
  "substack.com": "Substack",
  "youtube.com": "YouTube",
  "youtu.be": "YouTube",
  "github.com": "GitHub",
  "news.ycombinator.com": "Hacker News",
  "nytimes.com": "The New York Times",
  "hbr.org": "Harvard Business Review",
};

/** A readable source name from the domain when the page doesn't give one. */
export function siteNameFromUrl(url: URL): string {
  const host = url.hostname.toLowerCase().replace(/^(www|m|mobile)\./, "");
  if (KNOWN_SITES[host]) return KNOWN_SITES[host];
  for (const [domain, name] of Object.entries(KNOWN_SITES)) {
    if (host.endsWith("." + domain)) {
      // e.g. author.substack.com → "author (Substack)"
      const sub = host.slice(0, -domain.length - 1);
      return domain === "substack.com" || domain === "medium.com" ? `${sub} (${name})` : name;
    }
  }
  return host;
}
