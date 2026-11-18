// End-to-end check of M4: writing samples, feedback capture (reasons, edits),
// learning style changes from feedback with approval, export and deletion.
// Needs the app running against a freshly seeded database with the mock AI
// (OPENAI_BASE_URL=http://localhost:3999/v1, TAVILY_BASE_URL=http://localhost:3999).
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
const lastRequest = async () => (await (await fetch(`${MOCK}/__requests`)).json()).pop();

let currentPage = null;
(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const page = await context.newPage();
  currentPage = page;
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("dialog", (d) => d.accept());
  const api = (path, init) => page.request.fetch(`${BASE}/api/admin/writing${path}`, init);
  const saved = () => page.getByRole("status").filter({ hasText: /^\s*Saved\s*$/ }).waitFor({ timeout: 15000 });

  await page.goto(BASE + "/login");
  await page.fill("#email", "admin@example.com");
  await page.fill("#password", "e2e-password");
  await page.getByRole("button", { name: /sign in|log in/i }).click();
  await page.waitForURL(/\/admin/);
  await page.goto(BASE + "/admin/stories");
  await page.getByRole("button", { name: "Set up now" }).click();
  await page.getByText("Lessons from a migration").waitFor();
  const settings = (await (await api("/ai/settings")).json()).settings;
  await api("/ai/settings", {
    method: "PUT",
    data: { ...settings, models: { fast: "mock-fast", quality: "mock-quality" }, prices: { "mock-fast": { input: 1, output: 2 }, "mock-quality": { input: 3, output: 6 } } },
  });
  const styles = (await (await api("/styles")).json()).styles;
  const reflective = styles.find((s) => s.name === "Reflective personal");

  // Add several paragraphs to work with
  await page.getByText("Lessons from a migration").click();
  const editor = page.locator(".ProseMirror");
  await editor.waitFor();
  await editor.locator("img").first().click();
  await page.keyboard.press("ArrowRight");
  const paragraphs = [
    "Honestly I think the migration went wrong long before anyone noticed, and basically nobody wanted to say it out loud.",
    "We kept moving dates instead of moving scope, which is the most expensive way to stay optimistic.",
    "The checklist we wrote afterwards was short, boring and the single most useful thing the team produced that year.",
    "I would tell my earlier self to write the plan for the people who will read it at two in the morning.",
    "Basically the lesson is simple: a plan nobody reads is a wish with a table of contents.",
  ];
  for (const text of paragraphs) {
    await page.keyboard.press("Enter");
    await page.keyboard.type(text);
  }
  await saved();
  const para = (i) => editor.locator("p", { hasText: paragraphs[i].slice(0, 30) });
  const menu = page.getByRole("menu", { name: "AI edits for the selected text" });
  const panel = page.getByRole("region", { name: "AI suggestion" });

  // Save a sample from the editor
  await para(3).click({ clickCount: 3 });
  await menu.getByRole("button", { name: "More" }).click();
  await menu.getByRole("menuitem", { name: "Save as writing sample" }).click();
  await page.getByText("Saved to your writing samples").waitFor();
  const samples = (await (await api("/samples")).json()).samples;
  check("a selection can be saved as a writing sample, linked to the post's style", samples.length === 1 && samples[0].sourceTitle === "Lessons from a migration" && samples[0].styleIds[0] === reflective.id);
  await page.keyboard.press("End");

  // Feedback: reject with a reason
  await para(0).click({ clickCount: 3 });
  await menu.getByRole("menuitem", { name: "Shorten" }).click();
  await panel.getByRole("button", { name: "Reject" }).click();
  const req0 = await lastRequest();
  check("the most relevant writing sample is shown to the AI as a voice example", req0.messages[1].content.includes("<example title=\"Sample: From &quot;Lessons from a migration&quot;\">") && req0.messages[1].content.includes("two in the morning"));
  await page.screenshot({ path: `${SHOTS}/reject-reasons.png` });
  await panel.getByRole("button", { name: "Too formal" }).click();

  // Edit before accepting (modified)
  await para(1).click({ clickCount: 3 });
  await menu.getByRole("menuitem", { name: "Improve" }).click();
  await panel.getByRole("button", { name: "Edit" }).click();
  await page.locator("#edit-suggestion").fill("We moved dates instead of scope: the priciest way to stay hopeful.");
  await page.screenshot({ path: `${SHOTS}/edit-suggestion.png` });
  await panel.getByRole("button", { name: "Accept edited" }).click();
  await page.getByText("Suggestion applied").waitFor();
  check("an edited suggestion goes into the post as edited", (await editor.textContent()).includes("the priciest way to stay hopeful"));
  await saved();

  // A plain accept and three more rejections
  await para(2).click({ clickCount: 3 });
  await menu.getByRole("menuitem", { name: "Shorten" }).click();
  await panel.getByRole("button", { name: "Accept" }).click();
  await page.getByText("Suggestion applied").last().waitFor();
  await saved();
  for (const [i, op, reason] of [
    [3, "Simplify", "Lost my voice"],
    [4, "Fix grammar", null],
    [4, "Improve", "Keeps saying basically"],
  ]) {
    await para(i).click({ clickCount: 3 });
    await menu.getByRole("menuitem", { name: op }).click();
    await panel.getByRole("button", { name: "Reject" }).click();
    if (reason === null) await panel.getByRole("button", { name: "Skip" }).click();
    else if (reason === "Keeps saying basically") {
      await page.locator("#reject-reason").fill(reason);
      await panel.getByRole("button", { name: "Reject" }).click();
    } else await panel.getByRole("button", { name: reason }).click();
    await panel.waitFor({ state: "detached" });
  }
  const feedback = (await (await api("/feedback")).json()).feedback;
  const by = (status) => feedback.filter((f) => f.status === status);
  check("feedback records accepted, edited and rejected suggestions", by("accepted").length === 1 && by("modified").length === 1 && by("rejected").length === 4, `${feedback.length} records`);
  check("rejection reasons are kept (chips and typed)", ["Too formal", "Lost my voice", "Keeps saying basically"].every((r) => feedback.some((f) => f.reason === r)) && feedback.some((f) => f.status === "rejected" && !f.reason));
  check("the edited version is stored alongside the AI's proposal", by("modified")[0].final.includes("priciest way") && by("modified")[0].proposal.includes("Rewritten by the mock AI"));
  const styleAfter = (await (await api(`/styles/${reflective.id}`)).json());
  check("feedback alone never changes a style", styleAfter.version === reflective.version && JSON.stringify(styleAfter.rules) === JSON.stringify(reflective.rules));

  // Memory page: samples
  await page.goto(BASE + "/admin/stories/memory");
  const sampleList = page.getByRole("list", { name: "Writing samples" });
  await sampleList.waitFor();
  check("the samples tab shows provenance (source post)", (await sampleList.getByRole("link", { name: "Lessons from a migration" }).count()) === 1);
  await page.screenshot({ path: `${SHOTS}/memory-samples.png`, fullPage: true });
  await sampleList.getByRole("switch").click();
  await page.waitForTimeout(400);
  await page.getByLabel("Search samples").fill("two in the morning");
  await page.waitForTimeout(600);
  check("samples are searchable", (await sampleList.locator("li").count()) === 1);
  await page.getByLabel("Search samples").fill("nothing like this");
  await page.waitForTimeout(600);
  check("search with no match shows nothing", (await page.getByRole("list", { name: "Writing samples" }).count()) === 0);

  // Disabled sample is no longer used
  const docs = (await (await api("/documents")).json()).documents;
  const docId = docs.find((d) => d.title === "Lessons from a migration").id;
  const doc = await (await api(`/documents/${docId}`)).json();
  await api("/ai/rewrite", {
    method: "POST",
    data: { documentId: docId, baseRevision: doc.currentRevision, operation: "shorten", passageKind: "blocks", passageHtml: "<p>We kept moving dates instead of moving scope, at two in the morning.</p>", contextBefore: "", contextAfter: "" },
  });
  check("a disabled sample isn't sent to the AI", !(await lastRequest()).messages[1].content.includes("<example title=\"Sample:"));

  // Feedback tab
  await page.getByRole("tab", { name: "Feedback" }).click();
  const fbList = page.getByRole("list", { name: "Feedback" });
  await fbList.waitFor();
  check("the feedback tab lists every resolved suggestion", (await fbList.locator("> li").count()) >= 6);
  await page.getByRole("group", { name: "Filter feedback" }).getByRole("button", { name: "Rejected" }).click();
  await page.waitForTimeout(500);
  check("feedback can be filtered", (await fbList.locator("> li").count()) === 4);
  await page.getByRole("group", { name: "Filter feedback" }).getByRole("button", { name: "All" }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${SHOTS}/memory-feedback.png` });

  // Learn: propose, approve, apply as a new version
  await page.getByRole("tab", { name: "Learn" }).click();
  const learnRow = page.getByRole("list", { name: "Styles" }).locator("li", { hasText: "Reflective personal" });
  await learnRow.getByText(/pieces of feedback/).waitFor();
  check("styles with too little feedback can't be learned from yet", await page.getByRole("list", { name: "Styles" }).locator("li", { hasText: "Technical deep-dive" }).getByRole("button").isDisabled());
  await learnRow.getByRole("button", { name: "Suggest style changes" }).click();
  await page.getByText(/Waiting for you: Choose which changes/).waitFor({ timeout: 30000 });
  const proposals = page.getByRole("list", { name: "Proposed style changes" });
  check("only proposals backed by at least two pieces of feedback are offered", (await proposals.locator("> li").count()) === 2);
  check("a proposal that conflicts with a current rule is flagged and not preselected", (await page.getByText(/Conflicts with your current rule/).count()) === 1 && !(await proposals.locator("> li", { hasText: "third person" }).getByRole("checkbox").isChecked()));
  await page.getByText(/idea\(s\) set aside/).click();
  check("weakly supported ideas are shown as set aside, with why", (await page.getByText(/needs 2/).count()) === 1);
  await proposals.locator("> li", { hasText: "basically" }).getByText(/Evidence/).click();
  check("each proposal shows the feedback behind it", (await proposals.locator("> li", { hasText: "basically" }).locator("details li").count()) >= 2);
  await page.screenshot({ path: `${SHOTS}/learn-proposals.png`, fullPage: true });
  await page.getByRole("button", { name: "Apply 1 change" }).click();
  await page.getByText(/Saved as version 2 with 1 change/).waitFor({ timeout: 20000 });
  const learned = await (await api(`/styles/${reflective.id}`)).json();
  check("the approved change is saved as a new style version", learned.version === 2 && learned.rules.avoid.includes("basically") && !String(learned.rules.voice).includes("third person"));
  const versions = (await (await api(`/styles/${reflective.id}/versions`)).json()).versions;
  check("the version records where it came from (note and run)", Boolean(versions[0].note?.startsWith("Learned from feedback") && versions[0].sourceRunId));

  // Stale protection: style edited while proposals wait
  await page.getByRole("button", { name: "Close" }).click();
  await learnRow.getByRole("button", { name: "Suggest style changes" }).click();
  await page.getByText(/Waiting for you: Choose which changes/).waitFor({ timeout: 30000 });
  await api(`/styles/${reflective.id}`, { method: "PUT", data: { name: learned.name, description: learned.description, rules: { ...learned.rules, other: "Edited by hand meanwhile." }, exampleDocumentIds: [] } });
  const applyBtn = page.getByRole("button", { name: /Apply \d change/ });
  if (await applyBtn.isDisabled()) await page.getByRole("list", { name: "Proposed style changes" }).getByRole("checkbox").first().check();
  await page.getByRole("button", { name: /Apply \d change/ }).click();
  await page.getByText(/was edited after these suggestions were made/).waitFor({ timeout: 20000 });
  const afterStale = await (await api(`/styles/${reflective.id}`)).json();
  check("changes aren't applied over a style edited in the meantime", afterStale.version === 3 && afterStale.rules.other === "Edited by hand meanwhile.");

  // Style history shows provenance
  await page.goto(BASE + "/admin/stories/styles");
  await page.getByRole("button", { name: "History" }).click();
  await page.getByText(/Learned from feedback: 1 change/).waitFor();
  check("style history links learned versions to their run", (await page.getByRole("link", { name: "see why" }).count()) === 1);

  // Export
  const exportRes = await api("/memory/export");
  const exported = await exportRes.json();
  check(
    "memory exports as one JSON file with styles (and history), samples and feedback",
    exportRes.headers()["content-disposition"]?.includes("attachment") && exported.format === "writing-studio-memory" && exported.styles.find((s) => s.id === reflective.id).history.length >= 3 && exported.samples.length === 1 && exported.feedback.length >= 6
  );

  // Delete feedback
  await page.goto(BASE + "/admin/stories/memory");
  await page.getByRole("tab", { name: "Feedback" }).click();
  const list = page.getByRole("list", { name: "Feedback" });
  await list.waitFor();
  const before = await list.locator("> li").count();
  await list.locator("> li").first().getByRole("button", { name: "Delete this feedback" }).click();
  await page.waitForTimeout(400);
  check("one feedback record can be deleted", (await list.locator("> li").count()) === before - 1);
  await page.getByRole("button", { name: "Delete all feedback" }).click();
  await page.getByText(/Deleted \d+ feedback records/).waitFor();
  check("all feedback can be deleted at once", (await (await api("/feedback")).json()).feedback.length === 0);

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
