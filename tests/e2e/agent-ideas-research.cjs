// Reading → writing and deep research (agent upgrades): the idea miner turns
// themes in the author's reading into ideas with their articles; Start
// writing carries those articles into the post; deep research plans
// sub-questions, reads many sources, gets reviewed, and its report can start
// a draft or become an idea. The mock AI plays both agents.
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
  const H = { origin: BASE };
  const api = (path, init = {}) => page.request.fetch(`${BASE}/api/admin/writing${path}`, { ...init, headers: { ...H, ...(init.headers || {}) } });
  const get = async (path) => (await api(path)).json();
  await api("/setup", { method: "POST" });
  const settings = (await get("/ai/settings")).settings;
  await api("/ai/settings", { method: "PUT", data: { ...settings, models: { fast: "mock-fast", quality: "mock-quality" }, prices: { "mock-fast": { input: 1, output: 2 }, "mock-quality": { input: 3, output: 6 } } } });

  // The author's reading: two themes, and one unrelated piece
  const save = (slug, title, note) => page.request.post(`${BASE}/api/admin/reading`, { headers: H, data: { url: `${MOCK}/articles/${slug}`, titleOverride: title, note } });
  await save("mig-1", "Why legacy data migrations overrun", "Migration planning and data quality decide the schedule.");
  await save("mig-2", "A ten-year migration of legacy systems", "Data migration cut-over lessons from a long project.");
  await save("mig-3", "Data quality before any migration", "Profile the legacy data before the migration starts.");
  await save("fund-1", "Index funds and long-term returns", "Low fees win for investors over decades.");
  await save("fund-2", "Fees: why index funds beat active funds", "Investors and fees over decades of returns.");
  await save("bread", "My weekend sourdough experiments", "Flour, water and patience.");

  // 1. Find ideas in my reading, from the Thoughts board
  await page.goto(BASE + "/admin/stories");
  const ideasCol = page.getByRole("region", { name: "Ideas" });
  await ideasCol.waitFor();
  await ideasCol.getByRole("button", { name: "Find ideas in my reading" }).click();
  await page.getByText(/Added 2 ideas from your reading/).waitFor({ timeout: 60000 });
  check("the idea miner adds ideas from the author's reading", true);
  const ideas = (await get("/ideas?filter=inbox")).ideas;
  check("two ideas, each with the articles it came from", ideas.length === 2 && ideas.every((i) => i.sources.length >= 2), ideas.map((i) => `${i.content} [${i.sources.length}]`).join(" | "));
  check("the unrelated article isn't used", !ideas.some((i) => i.sources.some((s) => s.url.includes("bread"))));
  const migIdea = ideas.find((i) => i.sources.some((s) => s.url.includes("mig-")));
  const fundIdea = ideas.find((i) => i.sources.some((s) => s.url.includes("fund-")));
  check("one idea per theme", Boolean(migIdea && fundIdea) && migIdea.id !== fundIdea.id);
  const card = ideasCol.getByRole("listitem", { name: migIdea.content.slice(0, 80) });
  await card.getByText(/From your reading · \d articles/).click();
  check("the idea card shows its articles", await card.getByRole("link", { name: /legacy data migrations overrun/ }).isVisible());
  await page.screenshot({ path: `${SHOTS}/ideas-from-reading.png` });

  // Running it again doesn't repeat the same themes
  await ideasCol.getByRole("button", { name: "Find ideas in my reading" }).click();
  await page.getByText(/No new themes yet/).waitFor({ timeout: 60000 });
  check("a second run doesn't file the same ideas again", (await get("/ideas?filter=inbox")).ideas.length === 2);

  // The weekly schedule exists and starts off
  const trig = (await get("/triggers")).triggers.find((t) => t.key === "idea-miner-weekly");
  check("a weekly 'Find post ideas in my reading' helper exists, switched off", Boolean(trig) && trig.enabled === false);

  // 2. Start writing carries the articles into the post's sources
  await card.getByRole("button", { name: /^Start writing/ }).click();
  await page.waitForURL(/\/admin\/stories\/[0-9a-f-]{36}/);
  const docId = new URL(page.url()).pathname.split("/").pop();
  const srcs = (await get(`/documents/${docId}/sources`)).sources;
  check("Start writing puts the idea's articles in the post's sources", migIdea.sources.every((s) => srcs.some((x) => x.url === s.url)) && srcs.every((x) => x.query === "From your reading"), `${srcs.length} sources`);

  // 3. Deep research from the other idea
  await page.goto(BASE + "/admin/stories");
  const fundCard = page.getByRole("region", { name: "Ideas" }).getByRole("listitem", { name: fundIdea.content.slice(0, 80) });
  await fundCard.getByRole("button", { name: "More for this idea" }).click();
  await page.getByRole("menuitem", { name: "Research this in depth" }).click();
  await page.waitForURL(/\/admin\/stories\/runs\//);
  const runId = new URL(page.url()).pathname.split("/").pop();
  await page.getByText("Your research report is ready").first().waitFor({ timeout: 90000 });
  let run = (await get(`/agent-runs/${runId}`)).run;
  const report = run.pendingApproval.proposal;
  check("deep research has its own, higher budget", run.budget.maxCostUsd === 2 && run.budget.maxFetches >= 20 && run.budget.maxToolCalls >= 12, JSON.stringify(run.budget));
  check("it planned sub-questions, shown as its steps", run.state.questions?.length === 3 && run.state.plan.length === 3);
  check("it checked the author's own reading first", run.state.sources.some((s) => s.url.includes("/articles/fund-")));
  check("the report has a section per sub-question, each finding cited with a confidence", report.sections.length === 3 && report.sections.every((s) => s.findings.every((f) => f.sources.length > 0 && ["high", "medium", "low"].includes(f.confidence))));
  check("the report rests on several sources", report.sources.length >= 4, String(report.sources.length));
  check("an editor reviewed it before the author saw it (asked for one fix)", report.review?.rounds === 2 && !report.summary.includes("(v1)"));
  const reportView = page.getByLabel("Research report");
  check("the report shows confidence labels and numbered citations", (await reportView.getByText("Well supported").count()) >= 1 && (await reportView.getByRole("link", { name: "[1]" }).count()) >= 1);
  await page.screenshot({ path: `${SHOTS}/deep-research-report.png`, fullPage: true });

  // Dig deeper with a note: it searches again and proposes a new report
  const searchesBefore = run.state.sources.length;
  await page.getByLabel("Or dig deeper").fill("look for counter evidence");
  await page.getByRole("button", { name: "Keep researching with this" }).click();
  await sleep(1500);
  await page.getByText("Your research report is ready").first().waitFor({ timeout: 90000 });
  run = (await get(`/agent-runs/${runId}`)).run;
  check("'dig deeper' keeps researching and comes back with an updated report", run.status === "WAITING_FOR_APPROVAL" && run.state.sources.length > searchesBefore && /Counter-evidence considered/.test(run.pendingApproval.proposal.summary));

  // Use it: start a draft from the report
  await page.getByRole("button", { name: "Use this report" }).click();
  await page.getByRole("button", { name: "Start a draft from this" }).waitFor({ timeout: 20000 });
  run = (await get(`/agent-runs/${runId}`)).run;
  check("approving finishes the run with the report", run.status === "COMPLETED" && Boolean(run.result.report) && run.result.html.includes("<h2>Research:"));
  await page.getByRole("button", { name: "Save as an idea" }).click();
  await page.getByText("Saved to your Ideas, with its sources").waitFor({ timeout: 10000 });
  const saved = (await get("/ideas?filter=inbox")).ideas.find((i) => i.content.startsWith("Why data migrations overrun"));
  check("the report can be saved as an idea, with its sources", Boolean(saved) && saved.sources.length >= 4);
  await page.getByRole("button", { name: "Start a draft from this" }).click();
  await page.waitForURL(/\/admin\/stories\/[0-9a-f-]{36}$/);
  await page.locator(".ProseMirror").waitFor();
  const draftId = new URL(page.url()).pathname.split("/").pop();
  check("Start a draft opens a post with the report", (await page.locator(".ProseMirror h2").first().textContent()).startsWith("Research:"));
  const draftSources = (await get(`/documents/${draftId}/sources`)).sources;
  check("…and the report's sources in its library", draftSources.length === report.sources.length || draftSources.length >= 4, `${draftSources.length}`);

  // 4. AI → Deep research lists it; the editor has an "In depth" button
  await page.goto(BASE + "/admin/ai/research");
  await page.getByRole("region", { name: "Past research" }).getByRole("link").first().waitFor({ timeout: 10000 });
  check("AI → Deep research lists past research", (await page.getByRole("region", { name: "Past research" }).getByRole("link").count()) === 1);
  check("…with a question box and the cost limit", (await page.getByLabel("What do you want to understand?").isVisible()) && (await page.getByText(/stops at \$2\.00/).isVisible()));
  await page.goto(`${BASE}/admin/stories/${draftId}`);
  await page.locator(".ProseMirror").waitFor();
  await page.getByRole("tab", { name: "Assistant" }).click();
  await page.getByRole("tab", { name: "Workflows" }).click();
  const q = page.locator(`#research-q-${draftId}`);
  await q.fill("How often do data migrations overrun their schedule?");
  check("the editor offers research in depth next to quick research", await page.getByRole("button", { name: "In depth" }).isEnabled());

  check("no uncaught page errors", errors.length === 0, errors.join(" | "));
  await browser.close();
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error("SCRIPT ERROR:", e.message);
  process.exit(2);
});
