// The Reading workspace (/admin/reading): Discover lists new articles from
// the author's sources with real links, recommended ones highlighted with a
// reason, and the author's choices (add to this week, read later, publish,
// hide), by click, keyboard or swipe. Tabs: Discover · Inbox · This week ·
// Published, settings behind the gear; old addresses redirect.
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

  // Reading, reached from the sidebar, opens on Discover
  await page.goto(BASE + "/admin");
  await page.getByRole("navigation", { name: "Admin" }).getByRole("link", { name: "Reading" }).click();
  await page.waitForURL((u) => u.pathname === "/admin/reading");
  const tabs = page.getByRole("navigation", { name: "Reading" });
  check("Reading opens on Discover", (await tabs.getByRole("link", { name: /Discover/ }).getAttribute("aria-current")) === "page");
  await page.getByText("Nothing new yet").waitFor();
  check("an empty Discover explains what to do", true);
  await page.getByRole("button", { name: "Check sources now" }).click();
  const list = page.getByRole("list", { name: "New articles" });
  await list.waitFor({ timeout: 20000 });
  const rows = list.locator("> li");
  const titles = await rows.evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
  check("new articles from the sources are listed (old ones skipped)", titles.length === 5 && !titles.includes("An article from last year"), titles.join(" | "));
  const first = rows.first();
  check("the best match comes first and is marked Recommended", /index fund/i.test(titles[0]) && (await first.getByText("Recommended").isVisible()), titles[0]);
  check("a recommendation says why: the kept article it's like", await first.getByText(/Because you saved “.*index funds/).isVisible());
  const link = first.getByRole("link").first();
  const href = await link.getAttribute("href");
  check("each article links to the real page (opens in a new tab, tracking removed)", href.startsWith(`${MOCK}/articles/`) && !href.includes("utm_") && (await link.getAttribute("target")) === "_blank", href);
  const sourdough = page.getByRole("listitem", { name: "My weekend sourdough experiments" });
  check("unrelated articles aren't recommended", (await sourdough.getByText("Recommended").count()) === 0);
  check("the Discover tab counts what's new", await tabs.getByRole("link", { name: /Discover\s*5/ }).waitFor({ timeout: 8000 }).then(() => true, () => false));
  await page.screenshot({ path: `${SHOTS}/reading-discover.png`, fullPage: true });

  // Filters
  await page.getByRole("group", { name: "Filter by topic" }).getByRole("button", { name: "Leadership" }).click();
  check("filtering by topic", (await rows.count()) === 2);
  await page.getByRole("group", { name: "Filter by topic" }).getByRole("button", { name: "All topics" }).click();
  await page.getByLabel(/Recommended only/).check();
  const recCount = await rows.count();
  check("'Recommended only' shows just the highlighted ones", recCount >= 1 && recCount < 5, String(recCount));
  await page.getByLabel(/Recommended only/).uncheck();

  // Add to this week → on This week, marked as yours
  const fees = page.getByRole("listitem", { name: /index fund fees/ });
  const feesTitle = await fees.getAttribute("aria-label");
  await fees.getByRole("button", { name: /to this week$/ }).click();
  await fees.getByText("Added to this week").waitFor();
  const shortlist = (await get("/api/admin/writing/reading-agent")).shortlist;
  check("Add to this week puts it on this week's list", shortlist.some((c) => /index fund fees/.test(c.title) && c.reason === "You added it from the feed."));

  // Read later → reading inbox
  const bond = page.getByRole("listitem", { name: /bond ladder/ });
  await bond.getByRole("button", { name: /later$/ }).click();
  await bond.getByText("In your inbox").waitFor({ timeout: 20000 });
  const inbox = (await get("/api/admin/reading?status=inbox")).items;
  check("Read later puts it in the reading inbox", inbox.some((i) => (i.articleUrl || "").includes("bond-ladder")));

  // More → Publish now → public reading list
  const incidents = page.getByRole("listitem", { name: /incident reviews/ });
  await incidents.getByRole("button", { name: /^More for/ }).click();
  await page.getByRole("menuitem", { name: "Publish now" }).click();
  await incidents.getByText("Published").waitFor({ timeout: 20000 });
  const publicHtml = await (await ctx.request.get(BASE + "/certifications")).text();
  check("Publish now puts it on the public reading list", publicHtml.includes("incident-reviews") || /incident reviews/i.test(publicHtml));

  // Keyboard: pick a card, H hides it; Undo brings it back
  await sourdough.locator("p").first().click();
  await page.keyboard.press("h");
  await page.getByText("Hidden. Similar articles will rank lower.").waitFor();
  check("H hides the selected article", (await page.getByRole("listitem", { name: "My weekend sourdough experiments" }).count()) === 0);
  await page.getByRole("button", { name: "Undo" }).click();
  await sourdough.waitFor({ timeout: 10000 });
  check("Undo brings a hidden article back", true);
  await page.reload();
  await list.waitFor();
  check("what you did is remembered after a reload", await page.getByRole("listitem", { name: /index fund fees/ }).getByText("Added to this week").isVisible());
  // J moves down, S adds the selected one to this week
  const remaining = await rows.evaluateAll((els) => els.map((e) => [e.getAttribute("aria-label"), e.textContent.includes("Add to this week")]));
  const target = remaining.findIndex(([, open]) => open);
  for (let i = 0; i <= target; i++) await page.keyboard.press("j");
  await page.keyboard.press("s");
  await page.getByRole("listitem", { name: remaining[target][0] }).getByText("Added to this week").waitFor({ timeout: 10000 });
  check("J/K move and S adds the selected article to this week", true, remaining[target][0]);

  // This week: what was added, marked as yours, removable with undo
  await tabs.getByRole("link", { name: /This week/ }).click();
  await page.waitForURL(/\/admin\/reading\/week/);
  const picks = page.getByRole("list", { name: "This week's picks" });
  await picks.waitFor();
  const feesPick = picks.getByRole("listitem", { name: feesTitle });
  check("This week lists what you added from Discover, marked as yours", (await feesPick.getByText("You", { exact: true }).isVisible()) && (await feesPick.getByText("You added it from Discover.").isVisible()));
  check("…and what you saved this week", (await picks.getByText("you saved it").count()) >= 1);
  await page.screenshot({ path: `${SHOTS}/reading-week.png`, fullPage: true });
  await feesPick.getByRole("button", { name: `Remove ${feesTitle}` }).click();
  await page.getByRole("button", { name: "Undo" }).click();
  await picks.getByRole("listitem", { name: feesTitle }).waitFor({ timeout: 10000 });
  check("removing a pick can be undone", (await get("/api/admin/writing/reading-agent")).shortlist.some((c) => c.title === feesTitle));

  // Inbox and Published tabs
  await tabs.getByRole("link", { name: /Inbox/ }).click();
  await page.waitForURL(/\/admin\/reading\/inbox/);
  await page.getByRole("list", { name: "inbox articles" }).waitFor();
  check("Inbox shows saved articles with paste-a-link", (await page.getByLabel("Paste an article link").count()) === 1);
  await tabs.getByRole("link", { name: "Published" }).click();
  await page.getByRole("list", { name: "published articles" }).waitFor();
  check("Published shows what's public", (await page.getByRole("list", { name: "published articles" }).getByRole("listitem").count()) >= 1);
  await page.getByRole("button", { name: "Weekly lists" }).click();
  check("…and the weekly lists", await page.getByText(/No weekly lists yet/).waitFor({ timeout: 10000 }).then(() => true, () => false));

  // Settings behind the gear
  await page.getByRole("link", { name: "Reading settings" }).click();
  await page.waitForURL(/\/admin\/reading\/settings/);
  await page.getByRole("heading", { name: "Sources", exact: true }).waitFor({ timeout: 15000 });
  for (const h of ["Sources", "What to look for", "Schedule", "Ways to save"]) check(`settings has ${h}`, await page.getByRole("heading", { name: h, exact: true }).first().isVisible());

  // Old addresses still work
  await page.goto(BASE + "/admin/feed");
  check("the old Feed address opens Discover", new URL(page.url()).pathname === "/admin/reading");
  await page.goto(BASE + "/admin/stories/weekly");
  check("the old Weekly list address opens This week", new URL(page.url()).pathname === "/admin/reading/week");

  // Home points at Reading
  await page.goto(BASE + "/admin");
  check("Home shows what's new from your sources", (await page.getByRole("link", { name: /new from your sources this week/ }).getAttribute("href")) === "/admin/reading");

  // Phone: swipe left hides
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, storageState: await ctx.storageState() });
  const p = await phone.newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto(BASE + "/admin/reading");
  const card = p.getByRole("listitem", { name: "My weekend sourdough experiments" });
  await card.waitFor({ timeout: 15000 });
  const box = await card.boundingBox();
  const y = box.y + 20;
  const x0 = box.x + box.width - 40;
  await card.dispatchEvent("touchstart", { touches: [{ identifier: 1, clientX: x0, clientY: y }] });
  for (const dx of [20, 60, 110, 140]) await card.dispatchEvent("touchmove", { touches: [{ identifier: 1, clientX: x0 - dx, clientY: y }] });
  await card.dispatchEvent("touchend", { touches: [] });
  await p.getByText("Hidden. Similar articles will rank lower.").waitFor({ timeout: 10000 }).catch(() => {});
  check("on a phone, swiping left hides an article", (await p.getByRole("listitem", { name: "My weekend sourdough experiments" }).count()) === 0);
  check("Discover fits a phone screen", (await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 1);
  await p.screenshot({ path: `${SHOTS}/reading-discover-phone.png` });
  await phone.close();
  await page.goto(BASE + "/admin/reading");
  await list.waitFor();
  check("…and it stays hidden", (await page.getByRole("listitem", { name: "My weekend sourdough experiments" }).count()) === 0);

  check("no uncaught page errors", errors.length === 0, errors.join(" | "));
  await browser.close();
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error("SCRIPT ERROR:", e.message);
  process.exit(2);
});
