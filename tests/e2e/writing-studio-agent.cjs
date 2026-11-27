// End-to-end check of M3: ideas, agent workflows with checkpoints, research
// with sources, editorial review, publish prep, chat, cancel, resume, audit.
// Needs the app running against a freshly seeded database (see README.md),
// with OPENAI_BASE_URL=http://localhost:3999/v1 and TAVILY_BASE_URL=http://localhost:3999.
const { chromium } = require("playwright");

const BASE = process.env.BASE_URL || "http://localhost:3100";
const MOCK = process.env.MOCK_URL || "http://localhost:3999";
const SHOTS = process.argv[2] || "test-results";
require("fs").mkdirSync(SHOTS, { recursive: true });
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
};
const mock = async (path) => (await fetch(`${MOCK}${path}`)).json();
const lastTask = async (task) => (await mock("/__requests")).filter((r) => r.messages.some((m) => m.content.includes(`Task id: ${task}`))).pop();

let currentPage = null;
(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  currentPage = page;
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("dialog", (d) => d.accept());
  const api = (path, init) => page.request.fetch(`${BASE}/api/admin/writing${path}`, init);
  const saved = () => page.getByRole("status").filter({ hasText: /^\s*Saved\s*$/ }).waitFor({ timeout: 15000 });

  // Login, setup, point AI at the mock models
  await page.goto(BASE + "/login");
  await page.fill("#email", "admin@example.com");
  await page.fill("#password", "e2e-password");
  await page.getByRole("button", { name: /sign in|log in/i }).click();
  await page.waitForURL(/\/admin/);
  await page.goto(BASE + "/admin/stories");
  await page.getByRole("button", { name: "Set up now" }).click();
  await page.getByText("Lessons from a migration").waitFor();
  const settings = (await (await api("/ai/settings")).json()).settings;
  const aiSettings = {
    ...settings,
    models: { fast: "mock-fast", quality: "mock-quality" },
    prices: { "mock-fast": { input: 1, output: 2 }, "mock-quality": { input: 3, output: 6 } },
  };
  await api("/ai/settings", { method: "PUT", data: aiSettings });

  // Quick capture
  const t0 = Date.now();
  await page.locator("#quick-capture").fill("Why our migration plan failed even though everyone agreed to it #engineering");
  await page.keyboard.press("Enter");
  await page.getByText("Idea saved").waitFor();
  check("quick capture saves an idea in under 10 seconds", Date.now() - t0 < 10_000, `${Date.now() - t0} ms`);
  // The Thoughts board: posts by stage, ideas in the first column
  const board = (name) => page.getByRole("region", { name });
  check("Thoughts shows posts by stage", (await board("Ideas").isVisible()) && (await board("Outlining").isVisible()) && (await board("Drafting").isVisible()) && (await board("Published").isVisible()));
  check("a published post sits under Published", (await board("Published").getByText("Lessons from a migration").count()) === 1);
  const ideaItem = page.getByRole("list", { name: "Ideas" }).locator("li").first();
  await ideaItem.waitFor();
  check("the idea is listed with its #tag", (await ideaItem.textContent()).includes("engineering"));
  await page.screenshot({ path: `${SHOTS}/ideas.png` });

  // WF-001 Idea → outline, from the inbox (on its own page)
  await ideaItem.getByRole("button", { name: "More for this idea" }).click();
  await page.getByRole("menuitem", { name: "Explore and outline first" }).click();
  await page.waitForURL(/\/admin\/stories\/runs\//);
  await page.getByText("Waiting for you: Choose a direction").waitFor({ timeout: 30000 });
  check("explore step proposes angles, theses and audiences", (await page.getByText("The plan nobody read").count()) >= 1);
  const exploreEvents = (await (await api(`/agent-runs/${page.url().split("/").pop()}`)).json()).events;
  const exploreCall = exploreEvents.find((e) => e.type === "model_call");
  check("an invalid AI reply was repaired automatically (2 attempts)", exploreCall && exploreCall.payload.attempts === 2);
  await page.getByText("Lessons from a long migration").click();
  await page.getByLabel("Your own thesis").fill("Planning beats heroics, every single time.");
  // A note to the assistant at a checkpoint (AP-003) reaches the next step
  await page.getByRole("button", { name: "Add a note" }).click();
  await page.getByLabel("Note for the assistant").fill("Keep it under 800 words");
  await page.getByRole("button", { name: "Outline this" }).click();
  await page.getByText("Waiting for you: Choose an outline").waitFor({ timeout: 30000 });
  const outlineReq = await lastTask("outline_candidates");
  check("the chosen direction (own thesis) is sent to the outline step", outlineReq.messages[1].content.includes("Planning beats heroics, every single time."));
  check("the author's note goes to the next step, fenced as their note", /<author_note>[^<]*Keep it under 800 words/.test(outlineReq.messages[1].content));
  await page.screenshot({ path: `${SHOTS}/outline-choice.png` });
  await page.getByRole("button", { name: "Use this outline" }).click();
  await page.getByRole("button", { name: "Start a draft from this outline" }).click();
  await page.waitForURL(/\/admin\/stories\/[0-9a-f-]{36}$/);
  const editor = page.locator(".ProseMirror");
  await editor.waitFor();
  check("a new draft is created from the outline", (await editor.locator("h2").first().textContent()) === "The plan nobody read");
  const newDocId = page.url().split("/").pop();
  const runs = (await (await api("/agent-runs?limit=5")).json()).runs;
  const exploreRun = runs.find((r) => r.workflow === "explore");
  const again = await (await api(`/agent-runs/${exploreRun.id}/apply`, { method: "POST" })).json();
  check("creating the draft again returns the same document (no duplicate)", again.documentId === newDocId);
  const converted = (await (await api("/ideas?filter=converted")).json()).ideas;
  check("the idea is marked as turned into a draft, its text unchanged", converted.length === 1 && converted[0].linkedDocumentId === newDocId && converted[0].content.startsWith("Why our migration plan failed"));

  // WF-002 Outline → draft
  await page.getByRole("tab", { name: "Assistant" }).click();
  await page.getByRole("button", { name: "Write a draft from the outline", exact: true }).click();
  await page.getByText("Waiting for you: Review the draft").waitFor({ timeout: 30000 });
  await page.screenshot({ path: `${SHOTS}/draft-review.png` });
  // Self-critique (AG-004): the editor checked the draft, asked for one change, and checked the revision
  check("the draft was checked and revised before reaching the author", await page.getByText("Checked by the editor 2 times, revised 1 time").isVisible());
  await page.getByRole("button", { name: "Add below my notes" }).click();
  await page.getByText("Added to your post").waitFor();
  check("the approved draft is added to the post", (await editor.textContent()).includes("Drafted background paragraph."));
  check("…and it's the revised version", (await editor.textContent()).includes("One concrete example: the cutover weekend."));
  await saved();
  await editor.click();
  await page.keyboard.press("Control+z");
  check("Ctrl+Z removes the inserted draft in one step", !(await editor.textContent()).includes("Drafted background paragraph."));
  await page.keyboard.press("Control+Shift+z");
  await page.keyboard.press("ArrowRight");
  await saved();
  check("redo brings it back", (await editor.textContent()).includes("Drafted background paragraph."));
  await page.getByText("Done", { exact: true }).waitFor();
  check("after inserting, the finished run doesn't offer to insert again", (await page.getByRole("button", { name: "Add to my post" }).count()) === 0);
  await page.getByRole("region", { name: "Outline → draft" }).getByRole("button", { name: "Close" }).click();

  // WF-004 Editorial review
  await page.getByRole("button", { name: "Editorial review", exact: true }).click();
  const findingsList = page.getByRole("list", { name: "Review findings" });
  await findingsList.waitFor({ timeout: 30000 });
  check("review findings point at real passages; invented quotes are dropped", (await findingsList.locator("li").count()) === 1);
  await findingsList.getByRole("button", { name: "Show in text" }).click();
  await page.waitForTimeout(200);
  const shownText = await page.evaluate(() => document.getSelection().toString());
  check("'Show in text' selects the quoted passage", shownText === "Drafted background paragraph.", JSON.stringify(shownText));
  await page.screenshot({ path: `${SHOTS}/review.png` });

  // WF-003 Research, started from a finding that needs evidence
  await findingsList.getByRole("button", { name: "Research this" }).click();
  await page.getByText("Waiting for you: Choose findings to add to your post").waitFor({ timeout: 30000 });
  const searchesDone = await mock("/__searches");
  check("research searched the web through Tavily", searchesDone.length >= 1 && searchesDone[0].query === "data migration failure rate");
  const unsupportedBadge = page.getByText("No retrieved source");
  check("a finding that cites a non-existent source is flagged", (await unsupportedBadge.count()) === 1);
  check("non-web URLs from search are never stored", (await page.locator('a[href^="ftp:"]').count()) === 0);
  await page.screenshot({ path: `${SHOTS}/research.png` });
  await page.getByRole("button", { name: /Add 1 to my post/ }).click();
  await editor.locator("h2", { hasText: "Research notes" }).waitFor({ timeout: 15000 });
  const notes = await editor.innerHTML();
  check("selected findings are added as research notes with source links", notes.includes("Research notes") && notes.includes('href="https://research.example/migrations"'));
  check("the unsupported finding was not added", !notes.includes("cites nothing real"));
  await saved();
  await page.getByRole("tab", { name: "Sources" }).click();
  await page.getByText("Migration study").waitFor();
  check("the research library lists the retrieved sources", (await page.getByText("Industry survey").count()) === 1);

  // WF-005 Prepare to publish
  await page.getByRole("tab", { name: "Workflows" }).click();
  await page.getByRole("region", { name: "Research", exact: true }).getByRole("button", { name: "Close" }).click();
  await page.getByRole("button", { name: "Prepare to publish", exact: true }).click();
  await page.getByText("Waiting for you: Choose title, excerpt and tags").waitFor({ timeout: 30000 });
  await page.getByText("What a migration taught me").click();
  await page.getByRole("button", { name: "Use these" }).click();
  await page.locator("#doc-title").waitFor();
  check("chosen title and excerpt fill the post's fields", (await page.locator("#doc-title").inputValue()) === "What a migration taught me" && (await page.locator("#doc-excerpt").inputValue()) === "A short excerpt about plans.");
  check("the suggested URL is checked against existing posts", (await page.locator("#doc-slug").inputValue()) === "lessons-from-a-migration-2");
  await saved();
  check("publishing still needs its own click (post is not live)", (await (await api(`/documents/${newDocId}`)).json()).status === "DRAFT");

  // Chat
  await page.getByRole("tab", { name: "Assistant" }).click();
  await page.getByRole("tab", { name: "Chat" }).click();
  await page.getByLabel("Message").fill("What's my strongest point?");
  await page.keyboard.press("Enter");
  await page.getByText("Consider opening with it.").waitFor({ timeout: 20000 });
  const chatReq = (await mock("/__requests")).filter((r) => r.messages[0].content.includes("writing partner")).pop();
  check("the writing partner sees the post, fenced as data", chatReq.messages[0].content.includes("<document") && chatReq.messages[0].content.includes("Drafted background paragraph."));
  await page.screenshot({ path: `${SHOTS}/chat.png` });
  await page.reload();
  await editor.waitFor();
  await page.getByRole("tab", { name: "Assistant" }).click();
  await page.getByRole("tab", { name: "Chat" }).click();
  await page.getByText("Consider opening with it.").waitFor();
  check("the conversation is saved and comes back after a reload", true);

  // Cancel a running step
  await page.getByRole("tab", { name: "Workflows" }).click();
  const closeBtn = page.getByRole("button", { name: "Close", exact: true });
  if (await closeBtn.count()) await closeBtn.first().click();
  await page.getByLabel("Research a question or claim").fill("SLOW question about migration budgets");
  await page.getByRole("button", { name: "Research", exact: true }).click();
  await page.getByText("Planning searches…").waitFor();
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: "Stop" }).click();
  await page.getByText("Stopped. Finished steps are kept").waitFor({ timeout: 15000 });
  check("stopping a running step cancels it within seconds", true);
  await page.getByRole("region", { name: "Research" }).getByRole("button", { name: "Close" }).click();

  // Resume after a reload mid-run
  await page.getByRole("button", { name: "Editorial review", exact: true }).click();
  await page.getByText("Reading critically…").waitFor();
  await page.reload();
  await editor.waitFor();
  await page.getByRole("tab", { name: "Assistant" }).click();
  await page.getByRole("list", { name: "Review findings" }).waitFor({ timeout: 30000 });
  check("a run continues after the page is reloaded", true);

  // Approval and auth boundaries
  const reviewRun = (await (await api(`/agent-runs?documentId=${newDocId}&limit=1`)).json()).runs[0];
  const bypass = await api(`/agent-runs/${reviewRun.id}/decide`, { method: "POST", data: { action: "approve", stepIndex: 0, idempotencyKey: "bypass-attempt-1" } });
  check("a finished run can't be 'approved' again (409)", bypass.status() === 409);
  const anon = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const anonCtx = await anon.newContext();
  const anonRes = await anonCtx.request.post(`${BASE}/api/admin/writing/agent-runs/${reviewRun.id}/advance`);
  check("runs can't be driven without logging in (401)", anonRes.status() === 401);
  await anon.close();

  // Per-run budget
  await api("/ai/settings", { method: "PUT", data: { ...aiSettings, runBudgetUsd: 0.000001 } });
  await page.getByRole("region", { name: "Editorial review" }).getByRole("button", { name: "Close" }).click();
  await page.getByRole("button", { name: "Editorial review", exact: true }).click();
  await page.getByText(/Stopped: the next step could take this run over/).waitFor({ timeout: 20000 });
  check("a run stops before exceeding its cost limit", true);
  await api("/ai/settings", { method: "PUT", data: aiSettings });

  // Activity and audit trail
  await page.goto(BASE + "/admin/ai/history");
  const runsTable = page.getByRole("table", { name: "Workflow runs" });
  await runsTable.waitFor();
  const rows = await runsTable.locator("tbody tr").count();
  check("the activity page lists every run", rows >= 7, `${rows} runs`);
  check("cancelled and failed runs are shown as such", (await runsTable.getByText("Stopped", { exact: true }).count()) >= 1 && (await runsTable.getByText("Failed", { exact: true }).count()) >= 1);
  const health = page.getByRole("region", { name: "Last 30 days" });
  await health.waitFor();
  const stats = await (await api("/stats?days=30")).json();
  check(
    "the health panel shows spend, acceptance and run outcomes from real data",
    stats.requests > 10 && stats.costUsd > 0 && stats.runs.failed >= 1 && stats.runs.cancelled >= 1 && (await health.getByText("AI spend").count()) === 1,
    `${stats.requests} requests, ${stats.runs.completed} done / ${stats.runs.failed} failed`
  );
  check("cost is broken down by feature, including web search", stats.operations.some((o) => o.operation === "tool:web.search") && (await health.getByText("Web search (Tavily)").count()) === 1);
  await page.screenshot({ path: `${SHOTS}/activity.png`, fullPage: true });
  await runsTable.locator("tbody tr").filter({ hasText: "Research" }).filter({ hasText: "Done" }).getByRole("link", { name: "Research" }).click();
  await page.waitForURL(/\/runs\//);
  await page.getByRole("list", { name: "Activity" }).waitFor();
  const log = await page.getByRole("list", { name: "Activity" }).textContent();
  check("a run's log shows model calls, searches and the approval with who approved", log.includes("tokens") && log.includes("Searched:") && log.includes("approved by admin@example.com"));

  // Related reading: the author's saved articles that match the post, one press to add as a source
  await page.request.post(`${BASE}/api/admin/reading`, { headers: { origin: BASE }, data: { url: `${MOCK}/articles/migration-lessons`, titleOverride: "What a ten-year legacy migration taught us", note: "Migration planning, legacy systems and data cut-over lessons." } });
  await page.request.post(`${BASE}/api/admin/reading`, { headers: { origin: BASE }, data: { url: `${MOCK}/articles/sourdough-notes`, titleOverride: "Sourdough starter notes", note: "Flour, water and patience." } });
  const legacyId = (await (await api("/documents")).json()).documents.find((d) => d.title === "Lessons from a migration").id;
  await page.goto(`${BASE}/admin/stories/${legacyId}`);
  await page.locator(".ProseMirror").waitFor();
  await page.getByRole("tab", { name: "Assistant" }).click();
  await page.getByRole("tab", { name: "Sources" }).click();
  const fromReading = page.getByRole("region", { name: "From your reading" });
  await fromReading.waitFor({ timeout: 10000 });
  const related = fromReading.getByRole("listitem", { name: /ten-year legacy migration/ });
  check("the editor shows related articles from your reading", (await related.count()) === 1 && (await fromReading.getByRole("listitem", { name: /Sourdough/ }).count()) === 0);
  check("…saying which words they share", /shares/.test(await related.textContent()));
  await related.getByRole("button", { name: /as a source$/ }).click();
  await related.getByText("Source", { exact: true }).waitFor({ timeout: 10000 });
  const srcs = (await (await api(`/documents/${legacyId}/sources`)).json()).sources;
  check("Add as source puts it in the post's sources, once", srcs.filter((x) => x.url.includes("migration-lessons")).length === 1 && srcs.some((x) => x.query === "From your reading"));
  const again2 = await api(`/documents/${legacyId}/related-reading`, { method: "POST", headers: { origin: BASE }, data: { key: (await (await api(`/documents/${legacyId}/related-reading`)).json()).items[0].key } });
  check("adding it twice doesn't duplicate", (await again2.json()).added === false && (await (await api(`/documents/${legacyId}/sources`)).json()).sources.filter((x) => x.url.includes("migration-lessons")).length === 1);
  await page.screenshot({ path: `${SHOTS}/related-reading.png` });

  // Start writing: an idea becomes a post, and the outline starts in the editor's side panel
  await page.goto(BASE + "/admin/stories");
  await page.locator("#quick-capture").fill("Notes on why small teams ship faster than big ones");
  await page.keyboard.press("Enter");
  await page.getByText("Idea saved").waitFor();
  const fresh = page.getByRole("list", { name: "Ideas" }).getByRole("listitem", { name: /small teams ship faster/ });
  await fresh.getByRole("button", { name: /^Start writing/ }).click();
  await page.waitForURL(/\/admin\/stories\/[0-9a-f-]{36}\?run=/);
  await page.locator(".ProseMirror").waitFor();
  check("Start writing opens the new post with the idea's text", (await page.locator(".ProseMirror").textContent()).includes("small teams ship faster"));
  check("…and the outline step runs in the side panel, not on another page", await page.getByText("Waiting for you: Choose a direction").waitFor({ timeout: 30000 }).then(() => true, () => false));
  await page.screenshot({ path: `${SHOTS}/start-writing.png` });
  const startedId = page.url().split("/").pop().split("?")[0];
  const outlining = (await (await api("/ideas?filter=converted")).json()).ideas.find((i) => i.content.startsWith("Notes on why small teams"));
  check("the idea is linked to its new post", outlining?.linkedDocumentId === startedId);
  await page.goto(BASE + "/admin/stories");
  check("the new post is under Outlining (a few words so far)", await board("Outlining").getByRole("listitem", { name: /small teams ship faster/ }).waitFor({ timeout: 10000 }).then(() => true, () => false));
  check("the idea left the Ideas column", (await page.getByRole("list", { name: "Ideas" }).getByRole("listitem", { name: /small teams ship faster/ }).count()) === 0);
  await page.getByRole("button", { name: "List view" }).click();
  check("the list view is still there", await page.getByRole("tab", { name: "Drafts" }).isVisible());
  await page.reload();
  check("…and remembered", await page.getByRole("tab", { name: "Drafts" }).waitFor({ timeout: 10000 }).then(() => true, () => false));
  await page.getByRole("button", { name: "Board view" }).click();

  check("no uncaught page errors", errors.length === 0, errors.join(" | "));
  await browser.close();
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  process.exit(failed ? 1 : 0);
})().catch(async (e) => {
  console.error("SCRIPT ERROR:", e.message);
  if (currentPage) await currentPage.screenshot({ path: `${SHOTS}/failure.png` }).catch(() => {});
  process.exit(2);
});
