// Agent PRD A2: the tool-calling agent loop on the Research playbook. The
// mock AI plays the agent (tests/e2e/mock-openai.cjs agentTurnReply), so this
// checks the loop's plumbing and guards, not the model's judgement:
// plan → search → search again → read in full → propose; findings approval;
// tool-call audit; loop and no-progress stops; web.fetch refusing addresses
// no search returned. Needs AGENT_FETCH_REPLAY_URL (see run-all.sh).
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
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
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
  const post = (path, data) => api.post(BASE + path, { headers: H, data });
  await post("/api/admin/writing/setup");
  const docId = (await get("/api/admin/writing/documents")).documents.find((d) => d.title.startsWith("Lessons")).id;

  const waitRun = async (id, ms = 40000) => {
    const end = Date.now() + ms;
    let data;
    while (Date.now() < end) {
      data = await get(`/api/admin/writing/agent-runs/${id}`);
      if (!ACTIVE.has(data.run.status)) return data;
      await sleep(600);
    }
    return data;
  };
  const start = async (question) => (await (await post("/api/admin/writing/agent-runs", { workflow: "research_agent", documentId: docId, input: { question } })).json()).id;

  // 1. A normal research goal
  const id1 = await start("How often do large data migrations overrun?");
  const { run: r1, events: e1 } = await waitRun(id1);
  check("the agent reaches the findings checkpoint on its own", r1.status === "WAITING_FOR_APPROVAL" && r1.pendingApproval?.kind === "findings", r1.status);
  const turns = e1.filter((e) => /^Turn \d+: /.test(e.message) && e.type === "note").map((e) => e.payload?.tool);
  check("it chose its own sequence of tools", turns.join(",") === "web.search,web.search,web.fetch,research.propose_findings", turns.join(","));
  check("it searched again when the first results were thin", turns.filter((t) => t === "web.search").length === 2);
  check("it read a source in full before proposing", (await (await fetch(`${MOCK}/__pages`)).json()).length >= 1);
  check("its plan is shown in place of fixed steps", r1.agent === true && r1.steps.length >= 2 && r1.steps.some((s) => s.done), JSON.stringify(r1.steps));
  check("the goal is stored on the run", r1.goal === "How often do large data migrations overrun?");
  const facts = r1.pendingApproval.proposal.findings.filter((f) => f.kind === "fact");
  check("every proposed fact cites a retrieved source", facts.length > 0 && facts.every((f) => f.sourceIds.length > 0 && !f.unsupported));
  check("usage counts AI calls, searches and pages read", r1.usage.modelCalls === 4 && r1.usage.toolCalls === 2 && r1.usage.fetches === 1, JSON.stringify(r1.usage));

  // 2. Approving completes the run with the same result shape as scripted research
  await post(`/api/admin/writing/agent-runs/${id1}/decide`, { action: "approve", stepIndex: r1.pendingApproval.stepIndex, decision: { selected: [0, 1] }, idempotencyKey: `e2e-a-${Date.now()}` });
  const done = await waitRun(id1);
  check("approving the findings completes the run with cited research notes", done.run.status === "COMPLETED" && String(done.run.result?.html).includes("Research notes") && String(done.run.result?.html).includes("href="), done.run.status);

  // 3. In the editor: the Research form's agent option, then approve and insert
  await page.goto(`${BASE}/admin/stories/${docId}`);
  await page.getByRole("tab", { name: "Assistant" }).click();
  await page.getByLabel(/Let the agent plan the research/).check();
  await page.getByLabel("Research a question or claim").fill("Are rollback plans usually tested?");
  await page.getByRole("button", { name: "Research", exact: true }).click();
  await page.getByText("Waiting for you: Choose findings to add to your post").first().waitFor({ timeout: 30000 });
  const latest = (await get(`/api/admin/writing/agent-runs?documentId=${docId}&limit=1`)).runs[0];
  check("the Research form's agent option starts an agent run", latest.workflow === "research_agent");
  check("the run shows the agent's plan", await page.getByRole("list", { name: "Plan" }).first().isVisible());
  await page.screenshot({ path: `${SHOTS}/agent-research-panel.png` });
  await page.getByRole("button", { name: /Add \d+ to my post/ }).first().click();
  await page.locator(".ProseMirror h2", { hasText: "Research notes" }).waitFor({ timeout: 20000 });
  check("its findings go into the post like scripted research", (await page.locator(".ProseMirror").innerHTML()).includes("research.example"));
  check("the agent option is remembered in this browser", (await page.evaluate(() => localStorage.getItem("writing-studio:agent-research"))) === "1");

  // 4. Guards
  const loop = await waitRun(await start("LOOPTEST repeat yourself"));
  check("repeating the same action three times stops the run", loop.run.status === "FAILED" && loop.events.some((e) => e.type === "loop_detected") && /same action/.test(loop.run.error), loop.run.error);
  const stall = await waitRun(await start("STALLTEST make no progress"));
  check("four turns without progress stop the run", stall.run.status === "FAILED" && /no progress/.test(stall.run.error), stall.run.error);
  const before = (await (await fetch(`${MOCK}/__pages`)).json()).length;
  const evil = await waitRun(await start("FETCHEVIL read a planted address"));
  const pages = (await (await fetch(`${MOCK}/__pages`)).json()).slice(before);
  check("web.fetch refuses an address no search returned", !pages.some((u) => u.includes("evil.example")) && evil.events.some((e) => e.type === "note" && e.payload?.tool === "web.fetch" && e.payload?.ok === false));
  check("…and the agent carries on to propose findings", evil.run.status === "WAITING_FOR_APPROVAL", evil.run.status);

  // 5. Regenerate with an instruction keeps the run going
  await post(`/api/admin/writing/agent-runs/${evil.run.id}/decide`, { action: "regenerate", stepIndex: evil.run.pendingApproval.stepIndex, decision: { instruction: "Prefer sources from 2026" }, idempotencyKey: `e2e-${Date.now()}` });
  const again = await waitRun(evil.run.id);
  const lastPrompt = (await (await fetch(`${MOCK}/__requests`)).json()).filter((r) => JSON.stringify(r.messages).includes("Task id: agent_turn")).pop();
  check("asking for another try passes the author's instruction to the agent", again.run.status === "WAITING_FOR_APPROVAL" && JSON.stringify(lastPrompt.messages).includes("Prefer sources from 2026"));

  // 6. Audit: every tool call is on the activity log page
  await page.goto(`${BASE}/admin/stories/runs/${id1}`);
  await page.getByText("Turn 1: web.search").first().waitFor({ timeout: 10000 }).catch(() => {});
  check("each turn's tool call is in the run's log", (await page.getByText(/Turn \d: (web\.search|web\.fetch|research\.propose_findings)/).count()) >= 4);
  await page.screenshot({ path: `${SHOTS}/agent-run-page.png`, fullPage: true });

  check("no uncaught page errors", errors.length === 0, errors.join(" | "));
  await browser.close();
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error("SCRIPT ERROR:", e.message);
  process.exit(2);
});
