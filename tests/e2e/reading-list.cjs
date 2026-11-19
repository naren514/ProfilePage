// Reading list: saving articles from the iPhone Shortcut (token API) and the
// browser bookmarklet popup, the admin inbox, and the public page.
// Needs the app running against a freshly seeded database, the mock server
// (tests/e2e/mock-openai.cjs on port 3999, which also serves the fixture
// article) and READING_ALLOW_PRIVATE_HOSTS=1 so the app may fetch it.
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
const TITLE = "Why your TMS project is really a data project";

(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const anon = await browser.newContext();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const text = async (url) => (await anon.request.get(BASE + url)).text();

  // The popup asks you to log in first, then comes back to the article
  const popupUrl = `/reading-save?url=${encodeURIComponent(`${MOCK}/articles/tms-data?utm_source=x`)}&title=${encodeURIComponent("Freight Weekly page")}&quote=${encodeURIComponent("Master data decides the rollout.")}`;
  await page.goto(BASE + popupUrl);
  check("the save popup sends you to log in when signed out", page.url().includes("/login?next="));
  await page.fill("#email", "admin@example.com");
  await page.fill("#password", "e2e-password");
  await page.getByRole("button", { name: /sign in|log in/i }).click();
  // (the login URL itself mentions reading-save in ?next=, so match on the path)
  await page.waitForURL((url) => url.pathname === "/reading-save", { timeout: 30000 }).catch(() => {});
  check("after logging in, you're back at the save popup", new URL(page.url()).pathname === "/reading-save", page.url());

  // First visit: the reading list asks for its one-time update
  await page.goto(BASE + "/admin/reading");
  await page.getByRole("button", { name: "Set up now" }).click({ timeout: 15000 });
  await page.getByText("Your inbox is empty").waitFor({ timeout: 15000 });
  check("the inbox starts empty after the one-time setup", true);
  check("the old admin address redirects", (await (await page.goto(BASE + "/admin/certifications")).url()).includes("/admin/reading"));

  // Bookmarklet popup
  await page.goto(BASE + popupUrl);
  const suggestion = page.getByRole("group", { name: "Suggested note" });
  await suggestion.waitFor({ timeout: 20000 });
  check("the popup reads the article title from the page", (await page.locator("#save-title").inputValue()) === TITLE);
  check("the highlighted passage is kept as a quote", (await page.locator("#save-quote").inputValue()) === "Master data decides the rollout.");
  check("an AI note is suggested", (await suggestion.textContent()).includes("master data"));
  const suggestedTopics = page.getByRole("group", { name: "Suggested topics" });
  check("topics are suggested too", (await suggestedTopics.textContent()).includes("Supply chain"));
  await page.getByRole("button", { name: "Add suggested topic Supply chain" }).click();
  await page.fill("#save-tag-input", "Master data");
  await page.keyboard.press("Enter");
  check("topics can be added from suggestions and typed", (await page.getByRole("list", { name: "Topics for this article" }).textContent()).includes("Master data"));
  await page.screenshot({ path: `${SHOTS}/reading-popup.png` });
  await page.getByRole("button", { name: "Keep private" }).click();
  await page.getByText("It's in your Reading inbox").waitFor({ timeout: 15000 });
  check("Keep private saves to the inbox", true);
  check("a private article is not on the public page", !(await text("/certifications")).includes(TITLE));

  // Inbox: use the suggestion, publish
  await page.goto(BASE + "/admin/reading");
  const row = page.getByRole("list", { name: "inbox articles" }).getByRole("listitem").first();
  await row.waitFor();
  check("the inbox shows the source and how it was saved", (await row.textContent()).includes("Freight Weekly") && (await row.textContent()).includes("via browser"));
  await row.getByRole("group", { name: "Suggested note" }).getByRole("button", { name: "Use" }).click();
  await page.waitForTimeout(800);
  check("Use copies the suggestion into the note", (await row.locator("textarea").inputValue()).includes("master data"));
  await page.screenshot({ path: `${SHOTS}/reading-inbox.png`, fullPage: true });
  await row.getByRole("button", { name: "Publish" }).click();
  await page.getByText("Your inbox is empty").waitFor({ timeout: 10000 });
  const live = await text("/certifications");
  check("publishing puts it on the public page with the note and quote", live.includes(TITLE) && live.includes("master data") && live.includes("Master data decides the rollout."));
  const topic = await text("/topics/supply-chain");
  check("the article appears on its topic page", topic.includes(TITLE) && topic.includes("Worth reading"));
  check("topics are listed on the topics index", (await text("/topics")).includes("Master data"));
  check("the reading page links its topics", live.includes('href="/topics/master-data"'));
  check("the public link has no tracking parameters", live.includes(`${MOCK}/articles/tms-data"`) && !live.includes("utm_source"));

  // iPhone Shortcut: token API
  await page.getByRole("tab", { name: "Ways to save" }).click();
  await page.getByRole("button", { name: /Create token/ }).click();
  const token = (await page.getByTestId("new-token").textContent({ timeout: 10000 })).trim();
  check("a token is shown once after creating it", token.startsWith("rd_"));
  await page.screenshot({ path: `${SHOTS}/reading-ways.png`, fullPage: true });

  const save = (body, auth = `Bearer ${token}`) =>
    anon.request.post(`${BASE}/api/reading/save`, { headers: { authorization: auth, "content-type": "application/json" }, data: body });

  let res = await save({ url: "https://example.com/x" }, "Bearer rd_not-a-real-token");
  check("an invalid token is refused", res.status() === 401);
  res = await save({ url: "https://example.com/x" }, "");
  check("a missing token is refused", res.status() === 401);

  // A short link shared as text, kept private: resolves to the same article (a duplicate)
  res = await save({ text: `Worth a read ${MOCK}/go/abc`, publish: "Keep private" });
  let body = await res.json();
  check("the Shortcut can save a link shared inside text", res.ok() && body.title === TITLE, JSON.stringify(body));
  check("saving the same article again updates it instead of duplicating", body.created === false && /Already saved/.test(body.message));

  // A new article published straight away with a typed note
  const fixture2 = `${MOCK}/articles/second-piece`;
  res = await save({ url: fixture2, publish: "Publish now", note: "My own note from the phone.", tags: "Leadership, #supply chain" });
  body = await res.json();
  check("Publish now from the Shortcut goes live", res.ok() && body.status === "published" && body.created === true);
  const live2 = await text("/certifications");
  check("the typed note is published", live2.includes("My own note from the phone."));
  const leadership = await text("/topics/leadership");
  check("topics sent from the Shortcut are applied (and merge with existing ones)", leadership.includes("(second-piece)") && (await text("/topics/supply-chain")).includes("(second-piece)"));
  check("an unknown topic is a 404", (await anon.request.get(`${BASE}/topics/no-such-topic`)).status() === 404);

  // Kept private with no note: the AI suggestion stays private
  res = await save({ url: `${MOCK}/articles/third`, publish: "Keep private" });
  body = await res.json();
  check("Keep private from the Shortcut goes to the inbox", body.status === "inbox");
  const admin = await (await page.request.get(`${BASE}/api/admin/reading?status=inbox`)).json();
  const third = admin.items.find((i) => i.id === body.id);
  check("the AI suggestion is stored but not used as the note", Boolean(third?.suggestedNote) && !third?.note);

  // Publishing from the Shortcut without a note never uses the AI suggestion
  res = await save({ url: `${MOCK}/articles/third`, publish: "Publish now" });
  const published = (await (await page.request.get(`${BASE}/api/admin/reading?status=published`)).json()).items.find((i) => i.id === body.id);
  check("publishing without a note doesn't publish the AI suggestion", published && !published.note);

  // Option 2 Shortcut: only a url, plain-text reply for the notification
  res = await anon.request.post(`${BASE}/api/reading/save?format=text`, {
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    data: { url: `${MOCK}/articles/fourth` },
  });
  const plain = await res.text();
  check("?format=text replies with a plain notification line", res.ok() && /text\/plain/.test(res.headers()["content-type"]) && plain.startsWith("Saved: ") && plain.includes("(fourth)") && plain.includes("in your Reading inbox"), plain);
  res = await anon.request.post(`${BASE}/api/reading/save?format=text`, { headers: { authorization: "Bearer rd_nope", "content-type": "application/json" }, data: { url: fixture2 } });
  check("errors are plain text too", res.status() === 401 && (await res.text()).startsWith("Not saved: "));

  // Option 1 Shortcut: the article link pasted without encoding
  await page.goto(`${BASE}/reading-save?url=${MOCK}/articles/raw?id=7&page=2`);
  await page.locator("#save-title").waitFor();
  await page.waitForFunction(() => document.querySelector("#save-title")?.value?.includes("(raw)"), null, { timeout: 20000 });
  await page.getByRole("button", { name: "Keep private" }).click();
  await page.getByText("It's in your Reading inbox").waitFor({ timeout: 15000 });
  const rawItem = (await (await page.request.get(`${BASE}/api/admin/reading?status=inbox`)).json()).items.find((i) => i.articleTitle.includes("(raw)"));
  check("an unencoded link keeps its own parameters", rawItem?.articleUrl === `${MOCK}/articles/raw?id=7&page=2`, rawItem?.articleUrl);

  // Revoking a token stops it working
  const tokens = (await (await page.request.get(`${BASE}/api/admin/reading/tokens`)).json()).tokens;
  await page.request.delete(`${BASE}/api/admin/reading/tokens/${tokens[0].id}`, { headers: { origin: BASE } });
  res = await save({ url: fixture2 });
  check("a revoked token is refused", res.status() === 401);
  check("the token list shows when it was last used", Boolean(tokens[0].lastUsedAt));

  // Admin APIs need a session
  check("the admin reading API needs a login", (await anon.request.get(`${BASE}/api/admin/reading`)).status() === 401);
  check("creating tokens needs a login", (await anon.request.post(`${BASE}/api/admin/reading/tokens`, { data: {} })).status() === 401);

  // Archive and delete
  await page.goto(BASE + "/admin/reading");
  await page.getByRole("tab", { name: /Published/ }).click();
  const pub = page.getByRole("list", { name: "published articles" });
  await pub.waitFor();
  const before = await pub.getByRole("listitem").count();
  await pub.getByRole("listitem").first().getByRole("button", { name: "Archive" }).click();
  await page.waitForTimeout(800);
  check("archiving removes it from the published list", (await pub.getByRole("listitem").count()) === before - 1);

  const shot = await anon.newPage();
  await shot.goto(BASE + "/certifications");
  await shot.screenshot({ path: `${SHOTS}/reading-public.png`, fullPage: true });

  check("no uncaught page errors", errors.length === 0, errors.join(" | "));
  await browser.close();
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error("SCRIPT ERROR:", e.message);
  process.exit(2);
});
