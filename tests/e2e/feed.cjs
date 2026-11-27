// The Feed (/admin/feed): new articles from the author's sources with real
// links, recommended ones highlighted, and the author's own choices:
// shortlist, save to inbox, publish, hide (which lowers similar articles).
const fs = require("fs");
const { chromium } = require("playwright");

const BASE = process.env.BASE_URL || "http://localhost:3100";
const MOCK = process.env.MOCK_URL || "http://localhost:3999";
const SHOTS = process.argv[2] || "test-results";
fs.mkdirSync(SHOTS, { recursive: true });
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
};

(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(BASE + "/login");
  await page.fill("#email", "admin@example.com");
  await page.fill("#password", "e2e-password");
  await page.getByRole("button", { name: /sign in|log in/i }).click();
  await page.waitForURL((u) => u.pathname.startsWith("/admin"));
  const H = { origin: BASE };
  const get = async (p) => (await ctx.request.get(BASE + p)).json();
  const send = (method, p, data) => ctx.request.fetch(BASE + p, { method, headers: H, data });
  await send("POST", "/api/admin/writing/setup");

  // Sources: the test feeds instead of the starting list; a kept article sets the taste
  const ra = await get("/api/admin/writing/reading-agent");
  for (const x of ra.sources) await send("DELETE", `/api/admin/writing/reading-agent/sources/${x.id}`);
  await send("PUT", "/api/admin/writing/reading-agent", { ...ra.config, topics: ["Finance", "Leadership"] });
  await send("POST", "/api/admin/writing/reading-agent/sources", { url: `${MOCK}/feeds/finance.xml`, topic: "Finance" });
  await send("POST", "/api/admin/writing/reading-agent/sources", { url: `${MOCK}/blog`, topic: "Leadership" });
  for (const [slug, title] of [["kept-1", "Why low-cost index funds win over decades"], ["kept-2", "Index fund fees and long-term returns"], ["kept-3", "Investing returns: fees matter"]]) {
    await send("POST", "/api/admin/reading", { url: `${MOCK}/articles/${slug}`, titleOverride: title, note: "Index funds, fees and long-term investing returns.", publish: true, tags: ["Finance"] });
  }

  // The Feed page, reached from the sidebar
  await page.goto(BASE + "/admin");
  await page.getByRole("navigation", { name: "Admin" }).getByRole("link", { name: "Feed" }).click();
  await page.waitForURL(/\/admin\/feed/);
  await page.getByText("Nothing new yet").waitFor();
  check("an empty feed explains what to do", true);
  await page.getByRole("button", { name: "Check sources now" }).click();
  const list = page.getByRole("list", { name: "Feed" });
  await list.waitFor({ timeout: 20000 });
  const rows = list.locator("> li");
  const titles = await rows.evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
  check("new articles from the sources are listed (old ones skipped)", titles.length === 5 && !titles.includes("An article from last year"), titles.join(" | "));
  const first = rows.first();
  check("the best match comes first and is marked Recommended", /index fund/i.test(titles[0]) && (await first.getByText("Recommended").isVisible()), titles[0]);
  const link = first.getByRole("link").first();
  const href = await link.getAttribute("href");
  check("each article links to the real page (opens in a new tab, tracking removed)", href.startsWith(`${MOCK}/articles/`) && !href.includes("utm_") && (await link.getAttribute("target")) === "_blank", href);
  const sourdough = page.getByRole("listitem", { name: "My weekend sourdough experiments" });
  check("unrelated articles aren't recommended", (await sourdough.getByText("Recommended").count()) === 0);
  await page.screenshot({ path: `${SHOTS}/feed.png`, fullPage: true });

  // Filters
  await page.getByRole("group", { name: "Filter the feed" }).getByRole("button", { name: "Leadership" }).click();
  check("filtering by topic", (await rows.count()) === 2);
  await page.getByRole("group", { name: "Filter the feed" }).getByRole("button", { name: "All topics" }).click();
  await page.getByLabel(/Recommended only/).check();
  const recCount = await rows.count();
  check("'Recommended only' shows just the highlighted ones", recCount >= 1 && recCount < 5, String(recCount));
  await page.getByLabel(/Recommended only/).uncheck();

  // Shortlist → on the weekly shortlist
  const fees = page.getByRole("listitem", { name: /index fund fees/ });
  await fees.getByRole("button", { name: /^Shortlist/ }).click();
  await fees.getByText("On this week's shortlist").waitFor();
  const shortlist = (await get("/api/admin/writing/reading-agent")).shortlist;
  check("Shortlist adds it to this week's shortlist", shortlist.some((c) => /index fund fees/.test(c.title) && c.reason === "You added it from the feed."));

  // Save → reading inbox
  const bond = page.getByRole("listitem", { name: /bond ladder/ });
  await bond.getByRole("button", { name: /^Save/ }).click();
  await bond.getByText("Saved to your inbox").waitFor({ timeout: 20000 });
  const inbox = (await get("/api/admin/reading?status=inbox")).items;
  check("Save puts it in the reading inbox", inbox.some((i) => (i.articleUrl || "").includes("bond-ladder")));

  // Publish → public reading list
  const incidents = page.getByRole("listitem", { name: /incident reviews/ });
  await incidents.getByRole("button", { name: /^Publish/ }).click();
  await incidents.getByText("Published").waitFor({ timeout: 20000 });
  const publicHtml = await (await ctx.request.get(BASE + "/certifications")).text();
  check("Publish puts it on the public reading list", publicHtml.includes("incident-reviews") || /incident reviews/i.test(publicHtml));

  // Hide → gone, and counts against similar articles; Undo brings it back
  await sourdough.getByRole("button", { name: /^Hide/ }).click();
  await page.getByText("Hidden. Similar articles will rank lower.").waitFor();
  check("Hide removes it from the feed", (await page.getByRole("listitem", { name: "My weekend sourdough experiments" }).count()) === 0);
  await page.reload();
  await list.waitFor();
  check("…and it stays hidden", (await page.getByRole("listitem", { name: "My weekend sourdough experiments" }).count()) === 0);
  check("what you did is remembered after a reload", await page.getByRole("listitem", { name: /index fund fees/ }).getByText("On this week's shortlist").isVisible());

  // Home points at the feed
  await page.goto(BASE + "/admin");
  check("Home shows what's new from your sources", await page.getByRole("link", { name: /new from your sources this week/ }).isVisible());

  check("no uncaught page errors", errors.length === 0, errors.join(" | "));
  await browser.close();
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error("SCRIPT ERROR:", e.message);
  process.exit(2);
});
