// The admin app shell (UX pass): grouped sidebar and icon rail on desktop,
// top bar + bottom tab bar + menu sheet on phones, ⌘K command menu,
// Capture (idea or link), the Home page, and layouts that fit a phone.
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
const PAGES = ["/admin", "/admin/stories", "/admin/reading", "/admin/reading/inbox", "/admin/reading/week", "/admin/reading/published", "/admin/reading/settings", "/admin/ai", "/admin/ai/memory", "/admin/ai/helpers", "/admin/ai/history", "/admin/ai/settings", "/admin/settings", "/admin/projects", "/admin/experience", "/admin/photos"];

async function login(ctx) {
  const page = await ctx.newPage();
  await page.goto(BASE + "/login");
  await page.fill("#email", "admin@example.com");
  await page.fill("#password", "e2e-password");
  await page.getByRole("button", { name: /sign in|log in/i }).click();
  await page.waitForURL(/\/admin/);
  await page.request.post(BASE + "/api/admin/writing/setup", { headers: { origin: BASE } });
  return page;
}

(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const errors = [];

  // Desktop
  const desk = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await login(desk);
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(BASE + "/admin");
  check("Home greets and lists what to continue", await page.getByRole("heading", { level: 1, name: /Good (morning|afternoon|evening)|Working late/ }).isVisible());
  const nav = page.getByRole("navigation", { name: "Admin" });
  for (const group of ["Studio", "Site", "More"]) check(`the sidebar has a ${group} group`, await nav.getByText(group, { exact: true }).isVisible());
  const visibleLinks = await nav.getByRole("link").count();
  check("the sidebar is short: 8 pages, the rest folded under More", visibleLinks === 8, String(visibleLinks));
  await nav.getByRole("button", { name: "More" }).click();
  check("More opens to the rarely used pages", await nav.getByRole("link", { name: "Analytics" }).isVisible());
  await nav.getByRole("button", { name: "More" }).click();
  const steps = page.getByRole("region", { name: "Getting started" });
  check("Home shows a getting-started checklist", (await steps.isVisible()) && /of 6 done/.test(await steps.textContent()));
  check("…with setup already ticked", (await steps.getByRole("link", { name: /Finish setting up the Studio.*\(done\)/ }).count()) === 1);
  check("one navigation: no second Studio tab bar", (await page.getByRole("navigation", { name: "Writing Studio" }).count()) === 0);

  // Content never sits under the sidebar, on any page
  for (const path of PAGES) {
    await page.goto(BASE + path);
    await page.locator("#main h1").first().waitFor({ timeout: 15000 }).catch(() => {});
    const aside = await page.getByRole("complementary", { name: "Main" }).boundingBox();
    const h1 = await page.locator("#main h1").first().boundingBox();
    check(`${path}: content starts right of the sidebar`, Boolean(aside && h1 && h1.x >= aside.x + aside.width + 16), `${h1?.x} vs ${aside && aside.x + aside.width}`);
  }
  await page.goto(BASE + "/admin/ai/memory");
  const active = page.getByRole("navigation", { name: "Admin" }).getByRole("link", { name: "AI", exact: true });
  check("the current page is marked in the sidebar", (await active.getAttribute("aria-current")) === "page");
  check("the AI page has its six parts", (await page.getByRole("navigation", { name: "AI" }).getByRole("link").count()) === 6);
  await page.goto(BASE + "/admin/stories/automations");
  check("old addresses open the right AI tab", new URL(page.url()).pathname === "/admin/ai/helpers");

  // Rail: collapse, remembered after reload
  await page.getByRole("button", { name: "Collapse the sidebar" }).click();
  await page.reload();
  await page.getByRole("button", { name: "Expand the sidebar" }).waitFor();
  await page.waitForTimeout(400); // the width animates
  const railWidth = (await page.getByRole("complementary", { name: "Main" }).boundingBox()).width;
  check("the sidebar collapses to an icon rail and remembers it", railWidth < 80, `${railWidth}px`);
  await page.getByRole("button", { name: "Expand the sidebar" }).click();

  // ⌘K: jump to a page by a keyword
  await page.goto(BASE + "/admin");
  await page.keyboard.press("Control+k");
  await page.getByPlaceholder("Jump to a page or run an action…").fill("shortlist");
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/admin\/reading\/week/);
  check("⌘K finds a page by what it's for and opens it", page.url().endsWith("/admin/reading/week"));

  // Capture: an idea with a #tag, and a link to read
  await page.goto(BASE + "/admin");
  await page.getByRole("complementary", { name: "Main" }).getByRole("button", { name: "Capture" }).click();
  await page.getByLabel("Your idea").fill("Shell test idea about rollback drills #ops");
  await page.getByRole("button", { name: "Save idea" }).click();
  await page.getByText("Idea saved").waitFor();
  const ideas = (await (await page.request.get(BASE + "/api/admin/writing/ideas?filter=inbox")).json()).ideas;
  check("Capture saves an idea with its #tag", ideas.some((i) => i.content.startsWith("Shell test idea") && i.tags.includes("ops")));
  await page.getByRole("complementary", { name: "Main" }).getByRole("button", { name: "Capture" }).click();
  await page.getByLabel("Your idea").fill(`${MOCK}/articles/shell-capture`);
  await page.getByLabel("Article link").waitFor();
  check("pasting a link switches Capture to 'Link to read'", await page.getByRole("radio", { name: /Link to read/ }).getAttribute("aria-checked") === "true");
  await page.getByRole("button", { name: "Save to inbox" }).click();
  await page.getByText(/Saved to your reading inbox/).waitFor({ timeout: 20000 });
  check("Capture saves a link to the reading inbox", true);
  await page.goto(BASE + "/admin");
  check("Home shows the reading inbox waiting", await page.getByText(/article(s)? in your reading inbox/).isVisible());
  await page.screenshot({ path: `${SHOTS}/home-desktop.png` });

  // The editor: the sidebar steps back to a rail; the editor keeps its own ⌘K
  const docId = (await (await page.request.get(BASE + "/api/admin/writing/documents")).json()).documents[0].id;
  await page.goto(`${BASE}/admin/stories/${docId}`);
  await page.locator(".ProseMirror").waitFor();
  await page.waitForTimeout(400);
  check("in the editor the sidebar is a rail", (await page.getByRole("complementary", { name: "Main" }).boundingBox()).width < 80);
  await desk.close();

  // Phone
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const p = await login(phone);
  p.on("pageerror", (e) => errors.push(e.message));
  const tooWide = [];
  for (const path of PAGES) {
    await p.goto(BASE + path);
    await p.waitForTimeout(700);
    const over = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (over > 1) tooWide.push(`${path} (+${over}px)`);
  }
  check("every admin page fits a phone screen (no sideways scrolling)", tooWide.length === 0, tooWide.join(", "));
  await p.goto(BASE + "/admin");
  check("phones get a bottom tab bar, not the sidebar", (await p.getByRole("navigation", { name: "Quick" }).isVisible()) && !(await p.getByRole("complementary", { name: "Main" }).isVisible()));
  const plus = await p.getByRole("button", { name: "Capture an idea or a link" }).boundingBox();
  check("the capture button is in thumb reach and big enough to tap", plus.y > 700 && plus.width >= 48 && plus.height >= 48, JSON.stringify(plus));
  await p.getByRole("button", { name: "Menu" }).click();
  await p.getByRole("dialog", { name: "Menu" }).getByRole("link", { name: "Analytics" }).click();
  await p.waitForURL(/analytics/);
  check("the menu sheet reaches every page", p.url().endsWith("/admin/analytics"));
  await p.screenshot({ path: `${SHOTS}/automations-phone.png` });
  await p.goto(`${BASE}/admin/stories/${docId}`);
  await p.locator(".ProseMirror").waitFor();
  const editorBox = await p.locator(".ProseMirror").boundingBox();
  check("on a phone the editor gets the full width (the side panel starts closed)", editorBox.width > 300 && !(await p.getByRole("complementary", { name: "Post details" }).isVisible()), `${editorBox.width}px`);
  check("the editor hides the tab bar so the keyboard has room", !(await p.getByRole("navigation", { name: "Quick" }).isVisible()));
  await p.screenshot({ path: `${SHOTS}/editor-phone.png` });
  await phone.close();

  check("no uncaught page errors", errors.length === 0, errors.join(" | "));
  await browser.close();
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error("SCRIPT ERROR:", e.message);
  process.exit(2);
});
