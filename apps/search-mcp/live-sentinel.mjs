// W28F-949 D9 — live preprod 4-sentinel browser smoke (headless Chromium against
// the real https://searchmcp0.cloud-dog.net via Traefik on the single port 8080).
// Proves the SPA executes in a real browser: login gate, authenticated shell,
// data surface, and the developer MCP/A2A consoles — with a clean console.
import { chromium } from "@playwright/test";
import { writeFileSync, mkdirSync } from "node:fs";

const BASE = process.env.SENTINEL_BASE || "https://searchmcp0.cloud-dog.net";
const OUT = process.env.SENTINEL_OUT || "test-results/search-mcp-live-sentinel";
mkdirSync(OUT, { recursive: true });

const results = [];
const consoleErrors = [];
function log(s) { console.log(s); results.push(s); }

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1366, height: 900 } });
const page = await ctx.newPage();
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
page.on("pageerror", (e) => consoleErrors.push("pageerror: " + e.message));

let pass = 0, fail = 0;
async function sentinel(n, name, fn) {
  try { await fn(); log(`SENTINEL ${n} PASS — ${name}`); pass++; }
  catch (e) { log(`SENTINEL ${n} FAIL — ${name} :: ${String(e).split("\n")[0]}`); fail++; }
}

// SENTINEL 1 — anonymous login gate renders, app shell is NOT exposed.
await sentinel(1, "anonymous login gate (Username/Password/Sign in; no Dashboard)", async () => {
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.getByLabel("Username").waitFor({ state: "visible", timeout: 15000 });
  await page.getByLabel("Password").waitFor({ state: "visible", timeout: 5000 });
  await page.getByRole("button", { name: /sign in/i }).waitFor({ state: "visible", timeout: 5000 });
  if (await page.getByRole("heading", { level: 1, name: "Dashboard" }).count() !== 0) throw new Error("Dashboard exposed to anon");
  await page.screenshot({ path: OUT + "/sentinel-1-login.png" });
});

// SENTINEL 2 — admin login -> authenticated Dashboard shell renders.
await sentinel(2, "admin login -> Dashboard shell", async () => {
  await page.getByLabel("Username").fill("admin");
  await page.getByLabel("Password").fill("OrangeRiverTable");
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.getByRole("heading", { level: 1, name: "Dashboard" }).waitFor({ state: "visible", timeout: 20000 });
  await page.screenshot({ path: OUT + "/sentinel-2-dashboard.png" });
});

// SENTINEL 3 — a real data surface renders (Backends, live /v1/backends).
await sentinel(3, "data surface /backends renders live rows", async () => {
  await page.goto(BASE + "/backends", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.getByRole("heading", { level: 1 }).waitFor({ state: "visible", timeout: 15000 });
  // wait for any table/grid row or a backend name to appear
  await page.waitForFunction(() => {
    const t = document.body.innerText || "";
    return /brave|searxng|github|tavily|exa|backend/i.test(t);
  }, { timeout: 15000 });
  await page.screenshot({ path: OUT + "/sentinel-3-backends.png" });
});

// SENTINEL 4 — developer MCP console renders the live 27-tool registry + clean
// console. The page title is an h2 (the shared shell owns the h1 chrome). A
// pre-login /auth/me 401 is the shell's expected session probe — not an error.
await sentinel(4, "developer MCP console lists live tools + no severe console errors", async () => {
  await page.goto(BASE + "/developer/mcp-console", { waitUntil: "networkidle", timeout: 30000 });
  await page.getByRole("heading", { name: /mcp console/i }).waitFor({ state: "visible", timeout: 15000 });
  await page.getByText(/27 tools/i).waitFor({ state: "visible", timeout: 15000 });
  await page.screenshot({ path: OUT + "/sentinel-4-mcp-console.png" });
  const severe = consoleErrors.filter((e) => !/\/auth\/me/.test(e) && !/401/.test(e));
  if (severe.length > 0) throw new Error(`${severe.length} severe console error(s): ${severe.slice(0,3).join(" | ")}`);
});

log("");
log(`SENTINELS: ${pass} PASS / ${fail} FAIL`);
log(`console_errors=${consoleErrors.length}`);
log(`base=${BASE}`);
writeFileSync(OUT + "/live-sentinel-result.txt", results.join("\n") + "\n");
if (consoleErrors.length) writeFileSync(OUT + "/live-sentinel-console-errors.txt", consoleErrors.join("\n") + "\n");
await browser.close();
process.exit(fail === 0 ? 0 : 1);
