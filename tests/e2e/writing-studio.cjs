const { chromium } = require("playwright");
const BASE = process.env.BASE_URL || "http://localhost:3100";
const SHOTS = process.argv[2] || "test-results";
require("fs").mkdirSync(SHOTS, { recursive: true });
const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok }); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`); };
const text = async (url) => (await fetch(BASE + url)).text();
const status = async (url) => (await fetch(BASE + url, { redirect: "manual" })).status;

(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const saved = (p = page) => p.getByRole("status").filter({ hasText: /^\s*Saved\s*$/ }).waitFor({ timeout: 15000 });

  // Login
  await page.goto(BASE + "/login");
  await page.fill("#email", "admin@example.com");
  await page.fill("#password", "e2e-password");
  await page.getByRole("button", { name: /sign in|log in/i }).click();
  await page.waitForURL(/\/admin/);

  // Setup + import
  await page.goto(BASE + "/admin/stories");
  await page.getByRole("button", { name: "Set up now" }).click();
  await page.getByText("Lessons from a migration").waitFor();
  check("setup creates tables and imports existing posts", await page.getByText("Unfinished idea").isVisible());
  await page.screenshot({ path: `${SHOTS}/studio-list.png` });

  // Open legacy post: content converted
  await page.getByText("Lessons from a migration").click();
  await page.waitForURL(/\/admin\/stories\/[0-9a-f-]+$/);
  const editorEl = page.locator(".ProseMirror");
  await editorEl.waitFor();
  check("imported post opens with heading, link and image", (await editorEl.locator("h2").textContent()) === "Background" && (await editorEl.locator("a[href='https://example.com']").count()) === 1 && (await editorEl.locator("img[alt='Diagram']").count()) === 1);
  const docUrl = page.url();
  const docId = docUrl.split("/").pop();
  check("slug of live post is locked", (await page.locator("#doc-slug").getAttribute("readonly")) !== null);

  // Edit published post: autosave, live unchanged
  await editorEl.locator("p").first().click();
  await page.keyboard.press("End");
  await page.keyboard.type(" Draft-only sentence.");
  await saved();
  check("autosave reports Saved", true);
  check("editing a published post doesn't change the live page", !(await text("/thoughts/lessons-from-a-migration")).includes("Draft-only sentence"));
  check("shows 'Unpublished changes'", await page.getByText("Unpublished changes").isVisible());
  await page.reload();
  await editorEl.waitFor();
  check("autosaved text survives a reload", (await editorEl.textContent()).includes("Draft-only sentence."));

  // Republish
  await page.getByRole("button", { name: "Update live post" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Update live post" }).click();
  await page.getByText("Published", { exact: true }).first().waitFor();
  await page.waitForTimeout(500);
  const live = await text("/thoughts/lessons-from-a-migration");
  check("publishing updates the live page", live.includes("Draft-only sentence."));
  check("legacy STAR section and image survive republish", live.includes("A legacy STAR context paragraph.") && live.includes('alt="Diagram"'));

  // API: stale revision is rejected
  const stale = await page.request.patch(`${BASE}/api/admin/writing/documents/${docId}`, { data: { baseRevision: 1, title: "clobber" } });
  check("API rejects a save based on an old revision (409)", stale.status() === 409, `got ${stale.status()}`);

  // Conflict between two tabs
  const page2 = await context.newPage();
  await page2.goto(docUrl);
  await page2.locator(".ProseMirror").waitFor();
  await page2.locator("#doc-excerpt").fill("Excerpt edited in tab two.");
  await saved(page2);
  await page.locator("#doc-excerpt").fill("Excerpt edited in tab one.");
  await page.getByText(/saved somewhere else/).waitFor({ timeout: 10000 });
  check("second tab's edit triggers a conflict banner instead of overwriting", true);
  await page.getByRole("button", { name: "Keep my version" }).click();
  await saved();
  await page2.close();
  const afterConflict = await (await page.request.get(`${BASE}/api/admin/writing/documents/${docId}`)).json();
  check("'Keep my version' saves on top of the latest revision", afterConflict.excerpt === "Excerpt edited in tab one.");

  // Offline then back online
  await context.setOffline(true);
  await editorEl.locator("p").first().click();
  await page.keyboard.press("End");
  await page.keyboard.type(" Typed offline.");
  await page.getByText("Not saved, retrying").waitFor({ timeout: 10000 });
  check("offline save shows an error and keeps the text", true);
  await context.setOffline(false);
  await saved();
  const afterOffline = await (await page.request.get(`${BASE}/api/admin/writing/documents/${docId}`)).json();
  check("text typed offline is saved after reconnecting", JSON.stringify(afterOffline.bodyJson).includes("Typed offline."));

  // Crash recovery from browser backup
  await page.route("**/api/admin/writing/documents/*", (route) => (route.request().method() === "PATCH" ? route.abort() : route.continue()));
  await editorEl.locator("p").first().click();
  await page.keyboard.press("End");
  await page.keyboard.type(" Unsaved before crash.");
  await page.waitForTimeout(1200);
  const page3 = await context.newPage();
  await page.close({ runBeforeUnload: false });
  await page3.goto(docUrl);
  await page3.getByRole("button", { name: "Recover them" }).click();
  await saved(page3);
  const afterRecovery = await (await page3.request.get(`${BASE}/api/admin/writing/documents/${docId}`)).json();
  check("unsaved text is recovered from the browser backup after a crash", JSON.stringify(afterRecovery.bodyJson).includes("Unsaved before crash."));
  const p = page3;
  p.on("dialog", (d) => d.accept());

  // Versions + restore
  await p.getByRole("button", { name: "Versions" }).click();
  await p.getByText("Imported from the old editor").click();
  await p.getByRole("button", { name: "Restore this version" }).click();
  await p.getByText("Version restored").waitFor();
  await p.locator(".ProseMirror").waitFor();
  await p.waitForFunction(() => !document.querySelector(".ProseMirror")?.textContent?.includes("Draft-only sentence."), null, { timeout: 10000 }).catch(() => {});
  const restored = await p.locator(".ProseMirror").textContent();
  check("restoring the imported version brings back the original text", !restored.includes("Draft-only sentence.") && restored.includes("ten years"));
  await p.getByRole("button", { name: "Versions" }).click();
  await p.getByText("Restored an older version").first().waitFor();
  check("restore is recorded as a new version; history kept", (await p.getByText("Published", { exact: true }).count()) >= 1);
  await p.keyboard.press("Escape");

  // New post from scratch
  await p.goto(BASE + "/admin/stories");
  await p.getByRole("button", { name: "New thought" }).click();
  await p.waitForURL(/\/admin\/stories\/[0-9a-f-]+$/);
  await p.locator(".ProseMirror").waitFor();
  await p.locator("#doc-title").fill("A brand new thought");
  check("slug follows the title for a new post", (await p.locator("#doc-slug").inputValue()) === "a-brand-new-thought");
  await p.locator("#doc-excerpt").fill("Short excerpt.");
  await p.locator(".ProseMirror").click();
  await p.keyboard.type("Written in the Studio. ");
  await p.keyboard.press("Control+b");
  await p.keyboard.type("Bold bit.");
  await p.keyboard.press("Control+s");
  await p.getByText("Version saved").waitFor();
  check("Ctrl+S saves a version", true);
  await p.screenshot({ path: `${SHOTS}/studio-editor.png` });
  await p.getByRole("button", { name: "Publish" }).first().click();
  await p.getByRole("dialog").screenshot({ path: `${SHOTS}/publish-dialog.png` });
  await p.getByRole("dialog").getByRole("button", { name: "Publish" }).click();
  await p.getByText("Published", { exact: true }).first().waitFor();
  await p.waitForTimeout(500);
  const newLive = await text("/thoughts/a-brand-new-thought");
  check("new post is live with formatting", newLive.includes("<strong>Bold bit.</strong>"));
  check("new post appears on /thoughts", (await text("/thoughts")).includes("A brand new thought"));

  // Preview route
  const previewUrl = p.url() + "/preview";
  const preview = await p.context().newPage();
  await preview.goto(previewUrl);
  check("preview renders the draft with the public layout", (await preview.content()).includes("Bold bit."));
  await preview.screenshot({ path: `${SHOTS}/preview.png` });
  await preview.close();

  // Side panel width: drag, remembered after reload, keyboard, double-click reset
  const aside = p.getByRole("complementary", { name: "Post details" });
  const width = async () => Math.round((await aside.boundingBox()).width);
  const autoWidth = await width();
  const handle = p.getByRole("separator", { name: "Resize side panel" });
  const hb = await handle.boundingBox();
  await p.mouse.move(hb.x + 3, hb.y + 200);
  await p.mouse.down();
  await p.mouse.move(hb.x - 250, hb.y + 200, { steps: 8 });
  await p.mouse.up();
  const dragged = await width();
  check("dragging the panel's edge widens it", dragged >= autoWidth + 200, `${autoWidth} → ${dragged}`);
  await p.reload();
  await aside.waitFor();
  check("the panel width is remembered", Math.abs((await width()) - dragged) <= 2);
  await handle.focus();
  await p.keyboard.press("ArrowRight");
  check("the arrow keys resize the panel", (await width()) < dragged);
  await handle.dblclick();
  check("double-click returns to the automatic width", (await width()) === autoWidth);

  // Unpublish
  await p.getByRole("button", { name: "More actions" }).click();
  await p.getByRole("menuitem", { name: "Unpublish" }).click();
  await p.getByText(/no longer on the site/).waitFor();
  check("unpublish takes the post off the site (404)", (await status("/thoughts/a-brand-new-thought")) === 404);

  // Drafts never reach the public site
  check("never-published draft stays private", !(await text("/thoughts")).includes("Unfinished idea") && (await status("/thoughts/unfinished-idea")) === 404);

  // Delete a draft from the list
  await p.goto(BASE + "/admin/stories");
  await p.getByRole("button", { name: "Delete Unfinished idea" }).click();
  await p.getByText("Draft deleted").waitFor();
  check("deleting a draft removes it", !(await p.getByText("Unfinished idea").isVisible()));

  // Search
  await p.getByLabel("Search titles and text").fill("ten years");
  await p.waitForTimeout(800);
  check("search matches body text", (await p.locator("li").filter({ hasText: "Lessons from a migration" }).count()) === 1 && (await p.locator("li").filter({ hasText: "A brand new thought" }).count()) === 0);

  check("no uncaught page errors", errors.length === 0, errors.join(" | "));
  await browser.close();
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error("SCRIPT ERROR:", e.message); process.exit(2); });
