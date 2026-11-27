// Agent PRD A3: the weekly reading list, end to end (plan §7, in compressed
// time). The mock AI plays both agents (tests/e2e/mock-openai.cjs): three
// nights of searching the author's topics, then the weekly list with a review,
// a change request from the author, approval, and publishing by the runner.
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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ACTIVE = new Set(["CREATED", "RUNNING"]);

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
  await page.waitForURL(/\/admin/);
  const api = ctx.request;
  const H = { origin: BASE };
  const get = async (path) => (await api.get(BASE + path)).json();
  const send = (method, path, data) => api.fetch(BASE + path, { method, headers: H, data });
  await send("POST", "/api/admin/writing/setup");

  const waitRun = async (id, ms = 45000) => {
    const end = Date.now() + ms;
    let data;
    while (Date.now() < end) {
      data = await get(`/api/admin/writing/agent-runs/${id}`);
      if (!ACTIVE.has(data.run.status)) return data;
      await sleep(600);
    }
    return data;
  };
  const publicCount = async () => (await (await api.get(BASE + "/certifications")).text()).match(/<li /g)?.length ?? 0;

  // 1. Settings: the default topics are the author's; set two topics and a site to avoid
  let ra = await get("/api/admin/writing/reading-agent");
  check("starts with the author's topics", ra.config.topics.join(",") === "Investments,Finance,Engineering,Technology,Leadership", ra.config.topics.join(","));
  check("both reading-list jobs exist and start switched off", ra.triggers.length === 2 && ra.triggers.every((t) => !t.enabled));
  const bad = await send("PUT", "/api/admin/writing/reading-agent", { ...ra.config, topics: [] });
  check("settings need at least one topic", bad.status() === 400);
  await page.goto(BASE + "/admin/reading/settings");
  await page.getByRole("button", { name: "Remove Investments" }).click();
  await page.getByRole("button", { name: "Remove Engineering" }).click();
  await page.getByRole("button", { name: "Remove Technology" }).click();
  await page.getByRole("button", { name: "Remove Leadership" }).click();
  await page.getByLabel("New topic").fill("Leadership");
  await page.getByLabel("New topic").press("Enter");
  await page.getByLabel("Sites to never suggest (optional)").fill("https://www.spam.example/anything");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByText("Saved. The next search uses these.").waitFor({ timeout: 10000 });
  ra = await get("/api/admin/writing/reading-agent");
  check("topics and avoided sites are saved from the page (addresses cleaned)", ra.config.topics.join(",") === "Finance,Leadership" && ra.config.avoidSites.join(",") === "spam.example", JSON.stringify(ra.config));
  const scout = ra.triggers.find((t) => t.key === "reading-scout-nightly");

  // Sources: starting ones are suggested; replace them with test feeds
  check("starting sources are suggested for the author's topics", ra.sources.length >= 8 && ra.sources.some((x) => x.topic === "Investments"), `${ra.sources.length} sources`);
  for (const x of ra.sources) await send("DELETE", `/api/admin/writing/reading-agent/sources/${x.id}`);
  await page.goto(BASE + "/admin/reading/settings");
  const addSource = async (url, topic) => {
    await page.getByLabel("Source address").fill(url);
    await page.getByLabel("Topic for this source").selectOption(topic);
    await page.getByRole("button", { name: "Add source" }).click();
    // Done when the box clears (the add finished and the list updated)
    await page.waitForFunction(() => document.querySelector('input[aria-label="Source address"]')?.value === "", null, { timeout: 15000 });
  };
  await addSource(`${MOCK}/feeds/finance.xml`, "Finance");
  await addSource(`${MOCK}/blog`, "Leadership");
  await addSource(`${MOCK}/nofeed`, "Leadership");
  ra = await get("/api/admin/writing/reading-agent");
  const byUrl = (u) => ra.sources.find((x) => x.url.startsWith(u));
  check("an RSS feed address is read directly", byUrl(`${MOCK}/feeds/finance.xml`)?.status === "ok" && byUrl(`${MOCK}/feeds/finance.xml`)?.lastItemCount === 3, JSON.stringify(byUrl(`${MOCK}/feeds/finance.xml`)));
  check("a site's feed is found from its page (Atom)", byUrl(`${MOCK}/blog`)?.feedUrl?.endsWith("/feeds/engineering.atom") && byUrl(`${MOCK}/blog`)?.name === "Build Log");
  check("a site without a feed says so", byUrl(`${MOCK}/nofeed`)?.status === "no_feed" && (await page.getByText(/No feed found/).isVisible()));
  // Taste: the author kept an article about index funds
  await send("POST", "/api/admin/reading", { url: `${MOCK}/articles/kept-index`, titleOverride: "Why low-cost index funds win over decades", note: "Index funds, fees and long-term investing returns.", publish: true, tags: ["Finance"] });
  const weekly = ra.triggers.find((t) => t.key === "reading-weekly-list");

  // 2. Three nights of searching
  const before = await publicCount();
  for (let night = 1; night <= 3; night++) {
    const { runId } = await (await send("POST", `/api/admin/writing/triggers/${scout.id}/run`)).json();
    const { run, events } = await waitRun(runId);
    const list = (await get("/api/admin/writing/reading-agent")).shortlist;
    const urls = list.map((c) => c.url);
    if (night === 1) {
      check("night 1 finishes on its own", run.status === "COMPLETED", `${run.status} ${run.error ?? ""}`);
      check("it read the author's sources first", events.some((e) => e.payload?.tool === "feeds.new" && /Checked 3 source/.test(e.message)), events.filter((e) => e.payload?.tool === "feeds.new").map((e) => e.message).join(" | "));
      check("…so it didn't need to search", !events.some((e) => e.payload?.tool === "web.search" && e.type === "tool_call"));
      const offered = run.state.sources.map((x) => x.title);
      check("articles closest to what the author keeps come first", /index fund/i.test(offered[0] ?? "") && offered.indexOf("My weekend sourdough experiments") > 0, offered.join(" | "));
      check("old articles in a feed are skipped", !offered.includes("An article from last year"));
      check("tracking parameters are dropped from feed links", run.state.sources.every((x) => !x.url.includes("utm_")));
      check("it read a page in full before scoring", events.some((e) => e.type === "tool_call" && e.payload?.tool === "web.fetch"));
      check("pages telling it to publish change nothing (no public action)", !events.some((e) => e.type === "public_write" || e.type === "approval_requested"));
    }
    check(`night ${night}: shortlist ≤ 15, no duplicates, each scored with a reason`, list.length > 0 && list.length <= 15 && new Set(urls).size === urls.length && list.every((c) => Number(c.score) > 0 && c.reason.length > 5), `${list.length} candidates`);
    check(`night ${night}: never suggests a site the author avoids`, !urls.some((u) => u.includes("spam.example")));
    check(`night ${night}: within the nightly budget`, run.usage.costUsd <= 0.5, `$${run.usage.costUsd}`);
  }
  check("nothing was published during the week", (await publicCount()) === before && (await api.get(BASE + "/reading/weekly")).ok && !(await (await api.get(BASE + "/reading/weekly")).text()).includes("/reading/weekly/2"));

  await page.goto(BASE + "/admin/reading/week");
  const picksList = page.getByRole("list", { name: "This week's picks" });
  await picksList.waitFor();
  check("This week shows who added each pick", (await picksList.getByText("Agent", { exact: true }).count()) > 0 && (await picksList.getByText("You", { exact: true }).count()) > 0);
  await page.screenshot({ path: `${SHOTS}/weekly-shortlist.png`, fullPage: true });
  // Removing a candidate keeps it off the list
  const firstTitle = (await get("/api/admin/writing/reading-agent")).shortlist[0].title;
  await page.getByRole("button", { name: `Remove ${firstTitle}` }).click();
  await page.getByText("Removed. It won't be suggested again.").waitFor({ timeout: 10000 });
  check("removing a candidate takes it off the shortlist", !(await get("/api/admin/writing/reading-agent")).shortlist.some((c) => c.title === firstTitle));

  // 3. Monday: the weekly list
  const { runId: weeklyId } = await (await send("POST", `/api/admin/writing/triggers/${weekly.id}/run`)).json();
  let w = await waitRun(weeklyId);
  check("the weekly run stops for the author's approval", w.run.status === "WAITING_FOR_APPROVAL" && w.run.pendingApproval?.kind === "reading_list_approval", `${w.run.status} ${w.run.error ?? ""}`);
  const p1 = w.run.pendingApproval.proposal;
  const reviews = w.events.filter((e) => e.type === "note" && e.payload?.tool === "critic.review").length;
  check("the draft was reviewed before reaching the author (1–3 reviews)", reviews >= 1 && reviews <= 3 && p1.review.rounds === reviews, `${reviews} review(s)`);
  check("the proposal has 3–7 picks and an intro", p1.picks.length >= 3 && p1.picks.length <= 7 && p1.intro.length > 10, `${p1.picks.length} picks`);
  check("the removed candidate isn't proposed", !p1.picks.some((p) => p.title === firstTitle));
  check("each pick links to an article that was found or saved", p1.picks.every((p) => /^https?:\/\//.test(p.url) && p.line.length > 10));
  ra = await get("/api/admin/writing/reading-agent");
  // 4. Approve where the list is: on This week, not the run page
  await page.goto(BASE + "/admin/reading/week");
  check("This week shows the list ready for approval", await page.getByRole("region", { name: "Ready for your approval" }).waitFor({ timeout: 15000 }).then(() => true, () => false));
  check("the This week tab is marked as waiting", await page.getByRole("navigation", { name: "Reading" }).getByLabel("ready for you to approve").isVisible());
  await page.getByLabel("Intro").waitFor({ timeout: 15000 });
  await page.screenshot({ path: `${SHOTS}/weekly-approval.png`, fullPage: true });
  const third = p1.picks[2].title;
  await page.getByLabel(`Include ${third}`).uncheck();
  await page.getByLabel("Or ask for changes").fill("make the intro two sentences");
  await page.getByRole("button", { name: "Try again with this" }).click();
  await sleep(1500);
  w = await waitRun(weeklyId);
  const p2 = w.run.pendingApproval?.proposal;
  check("asking for changes revises the list and asks again", w.run.status === "WAITING_FOR_APPROVAL" && Boolean(p2), w.run.status);
  check("…leaving out the pick the author removed", p2 && !p2.picks.some((p) => p.title === third), p2?.picks.map((p) => p.title).join(" | "));
  check("…with a two-sentence intro", p2 && (p2.intro.match(/[.!?](\s|$)/g) || []).length === 2, p2?.intro);
  check("…and the revision was reviewed too (at most 3 reviews in all)", p2 && p2.review.rounds >= 2 && p2.review.rounds <= 3);

  // 5. Approve in the page: the runner publishes
  await page.reload();
  await page.getByLabel("Intro").waitFor({ timeout: 15000 });
  const lineBox = page.getByLabel(`Line for ${p2.picks[0].title}`);
  await lineBox.fill("My own words on why this one matters.");
  await page.getByRole("button", { name: /Approve and publish \d+/ }).click();
  const done = await (async () => {
    for (let i = 0; i < 40; i++) {
      const d = await get(`/api/admin/writing/agent-runs/${weeklyId}`);
      if (d.run.status === "COMPLETED") return d;
      await sleep(500);
    }
    return get(`/api/admin/writing/agent-runs/${weeklyId}`);
  })();
  check("approving completes the run with the published list", done.run.status === "COMPLETED" && done.run.result?.published === true && Boolean(done.run.result.week), JSON.stringify(done.run.result).slice(0, 200));
  check("publishing was done by the runner after the author approved", done.events.some((e) => e.type === "approved") && done.events.some((e) => e.type === "public_write"));
  const week = done.run.result.week;
  const pub = await api.get(`${BASE}/reading/weekly/${week}`);
  const html = await pub.text();
  check("the week's page shows the intro and the picks", pub.ok && html.includes(p2.picks[0].title.replace(/&/g, "&amp;")) && html.includes("Each one changed how I think"), `${pub.status()}`);
  check("the author's edited line is what's published", html.includes("My own words on why this one matters."));
  const after = await publicCount();
  check("the picks appear on the reading list", after === before + p2.picks.length, `${before} → ${after}`);
  const readingHtml = await (await api.get(BASE + "/certifications")).text();
  check("the reading page links to this week's list", readingHtml.includes(`/reading/weekly/${week}`));

  // 6. Approving twice publishes once
  const again = await send("POST", `/api/admin/writing/agent-runs/${weeklyId}/decide`, { action: "approve", stepIndex: 0, decision: {}, idempotencyKey: `double-${Date.now()}` });
  check("a second approval is refused", again.status() === 409, String(again.status()));
  check("and the list exists once", (await get("/api/admin/writing/reading-agent")).lists.filter((l) => l.week === week).length === 1);
  check("picked articles leave the shortlist", !(await get("/api/admin/writing/reading-agent")).shortlist.some((c) => p2.picks.some((p) => p.url === c.url)));

  await page.goto(`${BASE}/reading/weekly/${week}`);
  await page.screenshot({ path: `${SHOTS}/weekly-public.png`, fullPage: true });
  await page.goto(`${BASE}/reading/weekly`);
  check("the archive lists the week", await page.getByRole("link", { name: /Worth your time/ }).first().isVisible());

  check("no uncaught page errors", errors.length === 0, errors.join(" | "));
  await browser.close();
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error("SCRIPT ERROR:", e.message);
  process.exit(2);
});
