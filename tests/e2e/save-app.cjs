// "Save to Reading" home-screen app (/save): connect once, Paste & save,
// paste a link, publish now, a shared link saves itself, a revoked token
// disconnects, and the manifest and icon an installed app needs.
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
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  // The installable bits
  const manifest = await (await ctx.request.get(BASE + "/save/manifest.webmanifest")).json();
  check("the app has a manifest that opens /save on its own", manifest.start_url === "/save" && manifest.display === "standalone");
  check("on Android it can be a share target", manifest.share_target?.params?.url === "url");
  const icon = await ctx.request.get(BASE + "/save/icon?size=180");
  check("the home-screen icon is a PNG", icon.ok() && icon.headers()["content-type"].includes("image/png"));

  // Not signed in: connecting asks to sign in, then comes back
  await page.goto(BASE + "/save");
  check("the page is just the app (no site header)", (await page.getByRole("navigation", { name: "Main" }).count()) === 0);
  check("it explains how to add it to the home screen", await page.getByText("Put this on your home screen").isVisible());
  await page.getByRole("button", { name: "Connect this phone" }).click();
  await page.getByRole("link", { name: "Sign in to connect" }).click();
  await page.fill("#email", "admin@example.com");
  await page.fill("#password", "e2e-password");
  await page.getByRole("button", { name: /sign in|log in/i }).click();
  // The login page's own address ends in "next=/save": wait for the real /save page
  await page.waitForURL((u) => u.pathname === "/save");
  await ctx.request.post(BASE + "/api/admin/writing/setup", { headers: { origin: BASE } });
  await page.getByRole("button", { name: "Connect this phone" }).click();
  await page.getByRole("button", { name: /Paste & save/ }).waitFor();
  check("after signing in it connects with one tap", true);
  const token = await page.evaluate(() => localStorage.getItem("reading-save:token"));
  check("it keeps its own reading token (survives the admin login expiring)", /^rd_/.test(token || ""), String(token).slice(0, 4));
  await page.screenshot({ path: `${SHOTS}/save-app.png` });

  // Paste & save from the clipboard
  await page.evaluate((u) => navigator.clipboard.writeText(`Worth a read: ${u}`), `${MOCK}/articles/save-app-one`);
  await page.getByRole("button", { name: /Paste & save/ }).click();
  await page.getByRole("status").getByText(/Saved/).waitFor({ timeout: 20000 });
  const inbox = async () => (await (await ctx.request.get(BASE + "/api/admin/reading?status=inbox")).json()).items ?? [];
  check("Paste & save saves the copied link to the inbox", (await inbox()).some((i) => (i.articleUrl || "").includes("save-app-one")));
  check("it lists what was saved recently", await page.getByRole("region", { name: "Saved recently" }).isVisible());
  await page.screenshot({ path: `${SHOTS}/save-app-saved.png` });

  // A clipboard without a link
  await page.evaluate(() => navigator.clipboard.writeText("just some words"));
  await page.getByRole("button", { name: /Paste & save/ }).click();
  check("a clipboard without a link explains what to do", await page.getByText("The clipboard doesn't hold a link").waitFor({ timeout: 5000 }).then(() => true, () => false));

  // Paste a link by hand and publish now
  await page.getByRole("radio", { name: /Publish now/ }).click();
  await page.getByLabel("Article link").fill(`${MOCK}/articles/save-app-two`);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("status").getByText(/published on your Reading list/).waitFor({ timeout: 20000 });
  check("a pasted link can be published straight away", true);

  // A shared link (Android share sheet, or /save?url=…) saves itself
  await page.goto(`${BASE}/save?url=${encodeURIComponent(`${MOCK}/articles/save-app-three`)}`);
  await page.getByRole("status").getByText(/Saved/).waitFor({ timeout: 20000 });
  check("a shared link saves on arrival", (await inbox()).some((i) => (i.articleUrl || "").includes("save-app-three")));
  check("…and the address is cleaned up so a reload doesn't save it again", page.url().endsWith("/save"));

  // Revoking the token in Admin disconnects the phone
  const tokens = (await (await ctx.request.get(BASE + "/api/admin/reading/tokens")).json()).tokens;
  const mine = tokens.find((t) => t.name === "Home screen app" && !t.revokedAt);
  await ctx.request.delete(`${BASE}/api/admin/reading/tokens/${mine.id}`, { headers: { origin: BASE } });
  await page.getByLabel("Article link").fill(`${MOCK}/articles/save-app-four`);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByText("This phone was disconnected").waitFor({ timeout: 10000 });
  check("a revoked phone is told to connect again", await page.getByRole("button", { name: "Connect this phone" }).isVisible());

  check("no uncaught page errors", errors.length === 0, errors.join(" | "));
  await browser.close();
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error("SCRIPT ERROR:", e.message);
  process.exit(2);
});
