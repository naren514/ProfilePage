// Agent PRD A1: runs execute on the server with no tab open; cron and event
// triggers; duplicate protection; the kill switch; approvals resume on the
// server. Needs the app started with CRON_SECRET=e2e-cron-secret and
// AGENT_TEST_CLOCK=1 (see tests/e2e/run-all.sh), the mock AI server, and a
// freshly seeded database. AGENT_DRIVER may be workflow (default) or inline.
const fs = require("fs");
const { chromium } = require("playwright");

const BASE = process.env.BASE_URL || "http://localhost:3100";
const MOCK = process.env.MOCK_URL || "http://localhost:3999";
const CRON = process.env.CRON_SECRET || "e2e-cron-secret";
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
  const anon = await browser.newContext();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
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
  const patch = (path, data) => api.patch(BASE + path, { headers: H, data });
  await post("/api/admin/writing/setup");

  const runOf = async (id) => (await get(`/api/admin/writing/agent-runs/${id}`)).run;
  const waitRun = async (id, until = (r) => !ACTIVE.has(r.status), ms = 40000) => {
    const end = Date.now() + ms;
    let r;
    while (Date.now() < end) {
      r = await runOf(id);
      if (until(r)) return r;
      await sleep(700);
    }
    return r;
  };
  const cron = (now, secret = CRON) => anon.request.get(`${BASE}/api/cron/agent${now ? `?now=${encodeURIComponent(now)}` : ""}`, { headers: secret ? { authorization: `Bearer ${secret}` } : {} });
  const docs = (await get("/api/admin/writing/documents")).documents;
  const docId = docs.find((d) => d.title.startsWith("Lessons")).id;

  // 1. A run started through the API completes with no page open
  const created = await (await post("/api/admin/writing/agent-runs", { workflow: "research", documentId: docId, input: { question: "Do data migrations overrun?" } })).json();
  check("a new run is executed on the server", created.driver && created.driver !== "browser", created.driver);
  const r1 = await waitRun(created.id);
  check("it reaches its checkpoint with no page open", r1.status === "WAITING_FOR_APPROVAL", r1.status);

  // 2. Approve in the UI, close the tab, and it still finishes
  const runPage = await ctx.newPage();
  await runPage.goto(`${BASE}/admin/stories/runs/${created.id}`);
  await runPage.getByText("Waiting for you: Choose findings to add to your post").waitFor({ timeout: 20000 });
  await runPage.close();
  // Decide exactly as the page does, then nobody is watching
  await post(`/api/admin/writing/agent-runs/${created.id}/decide`, { action: "approve", stepIndex: r1.pendingApproval.stepIndex, decision: { selected: [0] }, idempotencyKey: `e2e-${Date.now()}` });
  const r2 = await waitRun(created.id);
  check("after approving, it finishes on the server with the tab closed", r2.status === "COMPLETED", r2.status);

  // 3. Closing the tab mid-step doesn't pause a run
  const slow = await (await post("/api/admin/writing/agent-runs", { workflow: "research", documentId: docId, input: { question: "SLOW question about rollouts" } })).json();
  const watch = await ctx.newPage();
  await watch.goto(`${BASE}/admin/stories/runs/${slow.id}`);
  await sleep(1500);
  await watch.close();
  const r3 = await waitRun(slow.id, (r) => r.status === "WAITING_FOR_APPROVAL" || !ACTIVE.has(r.status), 60000);
  check("a run keeps going after its page is closed mid-step", r3.status === "WAITING_FOR_APPROVAL", r3.status);

  // 4. Cron: the nightly digest (the A1 gate)
  check("the cron endpoint refuses a missing or wrong secret", (await cron(null, null)).status() === 401 && (await cron(null, "wrong")).status() === 401);
  for (const slug of ["tms-data", "edi-outages", "rollback-plans"]) {
    await post("/api/admin/reading", { url: `${MOCK}/articles/${slug}`, suggest: false });
  }
  let triggers = (await get("/api/admin/writing/triggers")).triggers;
  const nightly = triggers.find((t) => t.key === "nightly-digest");
  check("built-in automations exist and start switched off", triggers.length >= 3 && triggers.every((t) => !t.enabled));
  const enabled = await (await patch(`/api/admin/writing/triggers/${nightly.id}`, { enabled: true })).json();
  check("switching the nightly digest on schedules its next run", Boolean(enabled.trigger.nextRunAt));
  check("a bad schedule is refused", (await patch(`/api/admin/writing/triggers/${nightly.id}`, { schedule: "every night" })).status() === 400);
  const tomorrow = new Date(new Date(enabled.trigger.nextRunAt).getTime() + 60_000).toISOString();
  const tick = await (await cron(tomorrow)).json();
  const fired = tick.fired.find((f) => f.trigger === "Nightly reading digest");
  check("the cron tick starts the digest", fired?.outcome.status === "started", JSON.stringify(tick.fired));
  const again = await (await cron(tomorrow)).json();
  check("a repeated tick for the same night starts nothing", again.fired.length === 0, JSON.stringify(again.fired));
  const digest = await waitRun(fired.outcome.runId);
  check("the digest finishes with no page open (gate)", digest.status === "COMPLETED" && digest.origin === "cron", `${digest.status} ${digest.origin}`);
  check("it read the saved articles and wrote a brief", digest.result?.articles === 3 && digest.result?.brief?.length > 0, JSON.stringify(digest.result));
  const ideas = (await get("/api/admin/writing/ideas")).ideas;
  check("strong pieces were added to the ideas inbox", ideas.filter((i) => i.content.startsWith("From my reading")).length === 2);
  const reading = (await get("/api/admin/reading?status=inbox")).items;
  check("topic suggestions were saved privately (not applied)", reading.some((i) => i.suggestedTags.length) && reading.every((i) => i.tags.length === 0));
  check("the Activity page labels scheduled runs", (await (async () => { await page.goto(BASE + "/admin/stories/activity"); await page.getByText("scheduled").first().waitFor({ timeout: 10000 }); return true; })().catch(() => false)));

  // 5. Event triggers: once per article, once per version
  triggers = (await get("/api/admin/writing/triggers")).triggers;
  const onSave = triggers.find((t) => t.key === "digest-on-save");
  const onPublish = triggers.find((t) => t.key === "fact-check-on-publish");
  await patch(`/api/admin/writing/triggers/${onSave.id}`, { enabled: true });
  await patch(`/api/admin/writing/triggers/${onPublish.id}`, { enabled: true });
  const before = (await get("/api/admin/writing/agent-runs?limit=200")).runs.length;
  await post("/api/admin/reading", { url: `${MOCK}/articles/event-piece`, suggest: false });
  await sleep(1500);
  await post("/api/admin/reading", { url: `${MOCK}/articles/event-piece`, suggest: false });
  await sleep(1500);
  const afterSave = (await get("/api/admin/writing/agent-runs?limit=200")).runs;
  const saveRuns = afterSave.filter((r) => r.origin === "event" && r.workflow === "digest");
  check("saving an article fires its automation once (saving again doesn't)", afterSave.length === before + 1 && saveRuns.length === 1, `${afterSave.length - before} new`);
  const p1 = await (await post(`/api/admin/writing/documents/${docId}/publish-opened`)).json();
  const p2 = await (await post(`/api/admin/writing/documents/${docId}/publish-opened`)).json();
  check("opening Publish twice on the same version starts one fact-check", p1.started.length === 1 && p2.started.length === 0);
  const fc = await waitRun(p1.started[0]);
  check("the fact-check waits for the author's choice", fc.status === "WAITING_FOR_APPROVAL", fc.status);

  // 6. Run now (counts as a click)
  const now = await (await post(`/api/admin/writing/triggers/${nightly.id}/run`)).json();
  const nowRun = await waitRun(now.runId);
  check("Run now starts the automation as a manual run", nowRun.origin === "manual" && nowRun.status === "COMPLETED", `${nowRun.origin} ${nowRun.status}`);

  // 7. Daily budget per automation
  await patch(`/api/admin/writing/triggers/${nightly.id}`, { dailyBudgetUsd: 0 });
  const capped = await post(`/api/admin/writing/triggers/${nightly.id}/run`);
  check("an automation over its daily budget doesn't start", capped.status() === 409, String(capped.status()));
  await patch(`/api/admin/writing/triggers/${nightly.id}`, { dailyBudgetUsd: 0.5 });

  // 8. Kill switch
  const settings = (await get("/api/admin/writing/ai/settings")).settings;
  await api.put(`${BASE}/api/admin/writing/ai/settings`, { headers: H, data: { ...settings, agentsEnabled: false } });
  const refused = await post("/api/admin/writing/agent-runs", { workflow: "review", documentId: docId, input: {} });
  check("with agents paused, no run can start", refused.status() === 403);
  const later = new Date(new Date(tomorrow).getTime() + 86_400_000 + 60_000).toISOString();
  const pausedTick = await (await cron(later)).json();
  check("with agents paused, a due automation is skipped", pausedTick.fired.every((f) => f.outcome.status === "skipped"), JSON.stringify(pausedTick.fired));
  await page.goto(BASE + "/admin/stories/automations");
  check("the Automations page says agents are paused", await page.getByText("Agents are paused in").waitFor({ timeout: 10000 }).then(() => true, () => false));
  await api.put(`${BASE}/api/admin/writing/ai/settings`, { headers: H, data: { ...settings, agentsEnabled: true } });

  // 9. Automations page
  await page.goto(BASE + "/admin/stories/automations");
  const card = page.getByRole("listitem", { name: "Nightly reading digest" });
  await card.waitFor();
  check("the Automations page lists each automation with its state", (await card.textContent()).includes("Every night at 2 am") || (await card.getByRole("combobox").inputValue()) === "0 2 * * *");
  await card.getByRole("switch").click();
  await page.waitForTimeout(800);
  check("an automation can be switched off from the page", (await get("/api/admin/writing/triggers")).triggers.find((t) => t.key === "nightly-digest").enabled === false);
  await page.screenshot({ path: `${SHOTS}/automations.png`, fullPage: true });

  // 10. Runs that wait too long expire
  const far = new Date(Date.now() + 8 * 86_400_000).toISOString();
  const sweep = await (await cron(far)).json();
  const expired = await runOf(slow.id);
  check("a run waiting more than 7 days for a decision expires", sweep.expired >= 1 && expired.status === "CANCELLED", `${sweep.expired} ${expired.status}`);

  // 11. Login boundaries
  check("automations need a login", (await anon.request.get(`${BASE}/api/admin/writing/triggers`)).status() === 401);

  check("no uncaught page errors", errors.length === 0, errors.join(" | "));
  await browser.close();
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error("SCRIPT ERROR:", e.message);
  process.exit(2);
});
