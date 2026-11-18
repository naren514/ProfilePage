// Security checks for the Writing Studio (PRD §17-18): authentication on every
// route, cross-site writes, XSS in published posts, draft privacy, input limits.
// Needs the app running against a freshly seeded database (see README.md).
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const BASE = process.env.BASE_URL || "http://localhost:3100";
const SHOTS = process.argv[2] || "test-results";
fs.mkdirSync(SHOTS, { recursive: true });
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
};
const ZERO = "00000000-0000-4000-8000-000000000000";

/** Every Studio API route and the methods it exports, read from the source tree. */
function studioRoutes() {
  const root = path.join(__dirname, "../../src/app/api/admin/writing");
  const out = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === "route.ts") {
        const src = fs.readFileSync(full, "utf8");
        const methods = [...src.matchAll(/export async function (GET|POST|PATCH|PUT|DELETE)/g)].map((m) => m[1]);
        const url = "/api/admin/writing" + path.relative(root, dir).replace(/\\/g, "/").replace(/\[[^\]]+\]/g, ZERO).replace(/^(?!$)/, "/");
        for (const method of methods) out.push({ method, url: url.replace(/\/$/, "") });
      }
    }
  };
  walk(root);
  return out;
}

(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const anon = await browser.newContext();
  const context = await browser.newContext();
  const page = await context.newPage();
  const dialogs = [];
  page.on("dialog", async (d) => {
    dialogs.push(d.message());
    await d.dismiss();
  });

  // 1. Every route refuses anonymous and forged sessions
  const routes = studioRoutes();
  const anonFailures = [];
  const forgedFailures = [];
  for (const { method, url } of routes) {
    const r1 = await anon.request.fetch(BASE + url, { method, data: method === "GET" ? undefined : {} });
    if (r1.status() !== 401) anonFailures.push(`${method} ${url} → ${r1.status()}`);
    const r2 = await anon.request.fetch(BASE + url, {
      method,
      data: method === "GET" ? undefined : {},
      headers: { cookie: "session=eyJlbWFpbCI6ImFkbWluQGV4YW1wbGUuY29tIiwiZXhwIjo5OTk5OTk5OTk5OTk5fQ.forged" },
    });
    if (r2.status() !== 401) forgedFailures.push(`${method} ${url} → ${r2.status()}`);
  }
  check(`all ${routes.length} Studio API endpoints refuse anonymous requests`, routes.length > 40 && anonFailures.length === 0, anonFailures.join(", "));
  check("a forged session cookie is refused everywhere", forgedFailures.length === 0, forgedFailures.join(", "));
  const adminPage = await anon.newPage();
  await adminPage.goto(BASE + "/admin/stories");
  check("the admin UI redirects to login without a session", adminPage.url().endsWith("/login"));

  // Log in
  await page.goto(BASE + "/login");
  await page.fill("#email", "admin@example.com");
  await page.fill("#password", "e2e-password");
  await page.getByRole("button", { name: /sign in|log in/i }).click();
  await page.waitForURL(/\/admin/);
  const api = (url, init = {}) => page.request.fetch(`${BASE}/api/admin/writing${url}`, init);
  await api("/setup", { method: "POST" });
  await api("/documents");

  // 2. Cross-site writes
  const evil = await api("/documents", { method: "POST", headers: { origin: "https://evil.example" } });
  check("a write sent from another website is blocked (403)", evil.status() === 403);
  const evilClassic = await page.request.fetch(`${BASE}/api/admin/stories`, { method: "POST", data: {}, headers: { origin: "https://evil.example" } });
  check("the classic editor's API is protected the same way", evilClassic.status() === 403);
  const own = await api("/documents", { method: "POST", headers: { origin: BASE } });
  check("the same write from the site itself works", own.status() === 201);
  const doc = await own.json();

  // 3. XSS payloads in a published post
  const evilJson = {
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text: "<script>alert('text-node')</script> plain text" }] },
      { type: "paragraph", content: [{ type: "text", text: "bad link", marks: [{ type: "link", attrs: { href: "javascript:alert('link')" } }] }] },
      { type: "paragraph", content: [{ type: "text", text: "data link", marks: [{ type: "link", attrs: { href: "data:text/html,<script>alert(1)</script>" } }] }] },
      { type: "image", attrs: { src: "javascript:alert('img')", alt: "x\" onerror=\"alert('alt')" } },
    ],
  };
  const patch = await api(`/documents/${doc.id}`, {
    method: "PATCH",
    data: {
      baseRevision: doc.currentRevision,
      title: `<img src=x onerror="alert('title')">Title`,
      excerpt: `<script>alert('excerpt')</script>`,
      slug: "xss-test",
      bodyJson: evilJson,
    },
  });
  check("the editor format accepts the content (it's only text and attributes)", patch.ok(), String(patch.status()));
  const rev = (await patch.json()).currentRevision;
  const pub = await api(`/documents/${doc.id}/publish`, { method: "POST", data: { baseRevision: rev, idempotencyKey: "xss-publish-1" } });
  check("the post publishes", pub.ok(), String(pub.status()));
  const publicHtml = await (await fetch(`${BASE}/thoughts/xss-test`)).text();
  const article = publicHtml.slice(publicHtml.indexOf("<article"), publicHtml.indexOf("</article>"));
  check("no javascript: or data: links reach the public page", !/href="(javascript|data):/i.test(article) && !/src="javascript:/i.test(article));

  check("the title and excerpt are shown as text", article.includes("&lt;img src=x onerror=") && article.includes("&lt;script&gt;alert(&#x27;excerpt&#x27;)"));
  await page.goto(`${BASE}/thoughts/xss-test`);
  await page.waitForTimeout(1000);
  // Ask the browser's own parser: escaped text or attribute values that merely contain "onerror=" are harmless
  const injected = await page.evaluate(() => {
    const article = document.querySelector("article");
    const found = [];
    for (const el of article.querySelectorAll("*")) {
      if (el.tagName === "SCRIPT" || el.tagName === "IFRAME") found.push(el.tagName);
      for (const attr of el.attributes) if (/^on/i.test(attr.name)) found.push(`${el.tagName}[${attr.name}]`);
    }
    return found;
  });
  check("no script elements or event-handler attributes come from the post", injected.length === 0, injected.join(", "));
  await page.getByText("bad link").click().catch(() => {});
  await page.waitForTimeout(300);
  check("opening the post (and clicking its links) runs no injected script", dialogs.length === 0, dialogs.join(" | "));

  const badNode = await api(`/documents/${doc.id}`, {
    method: "PATCH",
    data: { baseRevision: rev, bodyJson: { type: "doc", content: [{ type: "iframe", attrs: { src: "https://evil.example" } }] } },
  });
  check("content types the editor doesn't support are refused (400)", badNode.status() === 400);

  // Classic editor path is sanitized too
  const classic = await page.request.post(`${BASE}/api/admin/stories`, {
    headers: { origin: BASE },
    data: { title: "Classic", slug: "classic-xss", summary: "s", action: `<p>ok</p><img src=x onerror="alert('classic')"><a href="javascript:alert(1)">x</a>`, isPublished: true },
  });
  const classicHtml = await (await fetch(`${BASE}/thoughts/classic-xss`)).text();
  check("HTML saved through the classic editor is sanitized too", classic.ok() && !/onerror|javascript:/i.test(classicHtml.slice(classicHtml.indexOf("<article"))));

  // 4. Drafts stay private
  const draft = await (await api("/documents", { method: "POST" })).json();
  await api(`/documents/${draft.id}`, { method: "PATCH", data: { baseRevision: draft.currentRevision, title: "Secret draft", slug: "secret-draft", bodyJson: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "private words" }] }] } } });
  check("an unpublished draft has no public page (404)", (await fetch(`${BASE}/thoughts/secret-draft`)).status === 404);
  const list = await (await fetch(`${BASE}/thoughts`)).text();
  const sitemap = await (await fetch(`${BASE}/sitemap.xml`)).text();
  check("drafts are not listed publicly or in the sitemap", !list.includes("Secret draft") && !sitemap.includes("secret-draft") && !list.includes("Unfinished idea"));
  const preview = await anon.request.get(`${BASE}/admin/stories/${draft.id}/preview`, { maxRedirects: 0 });
  check("a draft preview needs a login", [302, 307, 308].includes(preview.status()));

  // 5. Input limits and bad ids
  const huge = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "x".repeat(3_200_000) }] }] };
  const big = await api(`/documents/${draft.id}`, { method: "PATCH", data: { baseRevision: 2, bodyJson: huge } });
  check("an oversized document is refused", big.status() === 400 || big.status() === 413, String(big.status()));
  check("malformed ids are a clean 404", (await api("/documents/not-a-uuid")).status() === 404 && (await api(`/documents/${ZERO}`)).status() === 404);
  const badJson = await api(`/documents/${draft.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, data: "{not json" });
  check("malformed JSON is a 400, not a crash", badJson.status() === 400);
  const html = await api("/media", { method: "POST", multipart: { file: { name: "x.html", mimeType: "text/html", buffer: Buffer.from("<script>alert(1)</script>") } } });
  check("only image uploads are accepted", html.status() === 415);
  const svg = await api("/media", { method: "POST", multipart: { file: { name: "x.svg", mimeType: "image/svg+xml", buffer: Buffer.from("<svg onload='alert(1)'/>") } } });
  check("SVG uploads (which can carry script) are refused", svg.status() === 415);

  // 6. Errors don't leak internals
  const err = await (await api(`/documents/${ZERO}`)).json();
  check("error responses have a code and a plain message", typeof err.code === "string" && !/select|stack|at \w+ \(/i.test(JSON.stringify(err)));

  // 7. Full export
  const exp = await api("/export");
  const JSZip = require("jszip");
  const zip = await JSZip.loadAsync(await exp.body());
  const manifest = JSON.parse(await zip.file("manifest.json").async("string"));
  const postDirs = Object.keys(zip.files).filter((f) => f.endsWith("/post.md"));
  const xssMd = await zip.file(postDirs.find((f) => f.includes("xss-test"))).async("string");
  check(
    "the export is a ZIP with a manifest, a README and every post",
    exp.headers()["content-type"] === "application/zip" && manifest.format === "writing-studio-export" && manifest.counts.posts === postDirs.length && postDirs.length >= 4 && Boolean(zip.file("README.md")),
    `${postDirs.length} posts`
  );
  check("posts are exported as Markdown with front matter", xssMd.startsWith("---\ntitle:") && xssMd.includes('slug: "xss-test"') && xssMd.includes("status: published"));
  const imported = JSON.parse(await zip.file(postDirs.find((f) => f.includes("lessons-from-a-migration")).replace("post.md", "post.json")).async("string"));
  check("each post's lossless JSON and its history are included", imported.bodyJson?.type === "doc" && Boolean(zip.file(postDirs[0].replace("post.md", "revisions.json"))));
  const media = JSON.parse(await zip.file("media.json").async("string"));
  check("image references are listed in media.json", media.some((m) => m.url === "https://example.com/a.jpg"));
  check("styles, samples, feedback, runs, usage and prompts are included", ["styles.json", "samples.json", "feedback.csv", "agent-runs.json", "ai-usage.csv", "prompts/rewrite-system.md", "ideas.json", "sources.csv"].every((f) => zip.file(f)));
  check("the export needs a login", (await anon.request.get(`${BASE}/api/admin/writing/export`)).status() === 401);

  await browser.close();
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error("SCRIPT ERROR:", e.message);
  process.exit(2);
});
