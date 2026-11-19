import dns from "dns";
import http from "http";
import https from "https";
import net from "net";
import zlib from "zlib";

// Fetch a public web page for the reading list without letting a saved link
// reach internal services (SSRF). The address check runs inside the socket's
// DNS lookup, so the address that is checked is the address that is used.

export class BlockedUrlError extends Error {}

const MAX_BYTES = 1_500_000;
const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 8000;

function ipv4ToInt(ip: string): number {
  return ip.split(".").reduce((acc, part) => (acc << 8) + Number(part), 0) >>> 0;
}

const V4_BLOCKED: Array<[string, number]> = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
];

/** True for loopback, private, link-local, CGNAT, multicast and other non-public addresses. */
export function isPrivateAddress(ip: string): boolean {
  const family = net.isIP(ip);
  if (family === 4) {
    const value = ipv4ToInt(ip);
    return V4_BLOCKED.some(([base, bits]) => {
      const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
      return (value & mask) === (ipv4ToInt(base) & mask);
    });
  }
  if (family === 6) {
    const lower = ip.toLowerCase();
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateAddress(mapped[1]);
    if (lower === "::" || lower === "::1") return true;
    if (/^f[cd]/.test(lower)) return true; // fc00::/7 unique local
    if (/^fe[89ab]/.test(lower)) return true; // fe80::/10 link local
    if (/^ff/.test(lower)) return true; // multicast
    if (lower.startsWith("64:ff9b:") || lower.startsWith("2001:db8")) return true;
    return false;
  }
  return true;
}

/**
 * Test-only escape hatch so end-to-end tests can serve fixture pages from
 * localhost. Never set READING_ALLOW_PRIVATE_HOSTS in a deployed environment.
 */
function allowPrivate(): boolean {
  return process.env.READING_ALLOW_PRIVATE_HOSTS === "1";
}

type LookupCallback = (err: NodeJS.ErrnoException | null, address: string | dns.LookupAddress[], family?: number) => void;

function guardedLookup(hostname: string, options: dns.LookupOptions, callback: LookupCallback) {
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, "", 0);
    const list = addresses as dns.LookupAddress[];
    const bad = list.find((a) => isPrivateAddress(a.address));
    if (bad && !allowPrivate()) {
      return callback(Object.assign(new BlockedUrlError(`Blocked address for ${hostname}`), { code: "EBLOCKED" }), "", 0);
    }
    if (options.all) return callback(null, list);
    callback(null, list[0].address, list[0].family);
  });
}

export interface FetchedPage {
  finalUrl: string;
  status: number;
  contentType: string;
  body: string;
}

function requestOnce(url: URL, signal: AbortSignal): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: Buffer }> {
  return new Promise((resolve, reject) => {
    if (net.isIP(url.hostname.replace(/^\[|\]$/g, "")) && isPrivateAddress(url.hostname.replace(/^\[|\]$/g, "")) && !allowPrivate()) {
      return reject(new BlockedUrlError("Blocked address"));
    }
    const lib = url.protocol === "https:" ? https : http;
    const req = lib.request(
      url,
      {
        method: "GET",
        lookup: guardedLookup as unknown as typeof dns.lookup,
        signal,
        headers: {
          // A browser-like agent: many publishers serve nothing useful to bots
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15 ReadingListBot/1.0",
          Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5",
          "Accept-Encoding": "gzip, deflate, br",
          "Accept-Language": "en-US,en;q=0.8",
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        let size = 0;
        const encoding = String(res.headers["content-encoding"] ?? "").toLowerCase();
        const stream =
          encoding === "gzip" ? res.pipe(zlib.createGunzip()) : encoding === "deflate" ? res.pipe(zlib.createInflate()) : encoding === "br" ? res.pipe(zlib.createBrotliDecompress()) : res;
        stream.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > MAX_BYTES) {
            // Enough for the <head>; stop reading
            chunks.push(chunk.subarray(0, Math.max(0, MAX_BYTES - (size - chunk.length))));
            req.destroy();
            resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks) });
            return;
          }
          chunks.push(chunk);
        });
        stream.on("end", () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks) }));
        stream.on("error", reject);
      }
    );
    req.on("error", reject);
    req.end();
  });
}

/** GET a page, following up to three redirects, each checked again. */
export async function safeFetchPage(input: URL, timeoutMs = TIMEOUT_MS): Promise<FetchedPage> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let url = input;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      if (url.protocol !== "http:" && url.protocol !== "https:") throw new BlockedUrlError("Only http and https links can be fetched");
      const res = await requestOnce(url, controller.signal);
      if (res.status >= 300 && res.status < 400 && res.headers.location) {
        url = new URL(res.headers.location, url);
        continue;
      }
      const contentType = String(res.headers["content-type"] ?? "");
      const charset = contentType.match(/charset=([\w-]+)/i)?.[1]?.toLowerCase();
      let body: string;
      try {
        body = new TextDecoder(charset && charset !== "utf8" ? charset : "utf-8").decode(res.body);
      } catch {
        body = res.body.toString("utf8");
      }
      return { finalUrl: url.toString(), status: res.status, contentType, body };
    }
    throw new Error("Too many redirects");
  } finally {
    clearTimeout(timer);
  }
}
