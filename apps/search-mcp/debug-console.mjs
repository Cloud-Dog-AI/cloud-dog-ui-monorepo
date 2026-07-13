import { chromium } from "@playwright/test";
const BASE = "https://searchmcp0.cloud-dog.net";
const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ ignoreHTTPSErrors: true });
const p = await ctx.newPage();
const errs = [], reqs = [];
p.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
p.on("pageerror", (e) => errs.push("PAGEERROR: " + e.message));
p.on("requestfailed", (r) => reqs.push(`FAILED ${r.method()} ${r.url()} :: ${r.failure()?.errorText}`));
p.on("response", (r) => { if (r.status() >= 400) reqs.push(`${r.status()} ${r.request().method()} ${new URL(r.url()).pathname}`); });
// login
await p.goto(BASE + "/", { waitUntil: "domcontentloaded" });
await p.getByLabel("Username").fill("admin");
await p.getByLabel("Password").fill("OrangeRiverTable");
await p.getByRole("button", { name: /sign in/i }).click();
await p.getByRole("heading", { level: 1, name: "Dashboard" }).waitFor({ timeout: 15000 });
// go to mcp console
await p.goto(BASE + "/developer/mcp-console", { waitUntil: "networkidle", timeout: 30000 });
await p.waitForTimeout(2500);
const headings = await p.evaluate(() => Array.from(document.querySelectorAll("h1,h2,h3")).map(h => `${h.tagName}:${h.textContent?.trim().slice(0,50)}`));
const bodyText = await p.evaluate(() => (document.body.innerText || "").slice(0, 400));
console.log("HEADINGS:", JSON.stringify(headings));
console.log("HTTP>=400:", JSON.stringify(reqs));
console.log("CONSOLE ERRORS:", JSON.stringify(errs));
console.log("BODY (400c):", bodyText.replace(/\n/g, " | "));
await p.screenshot({ path: process.env.DEBUG_SCREENSHOT_PATH || "test-results/search-mcp-debug-console.png" });
// also a2a console
await p.goto(BASE + "/developer/a2a-console", { waitUntil: "networkidle", timeout: 30000 });
await p.waitForTimeout(2000);
const h2 = await p.evaluate(() => Array.from(document.querySelectorAll("h1,h2,h3")).map(h => `${h.tagName}:${h.textContent?.trim().slice(0,40)}`));
console.log("A2A HEADINGS:", JSON.stringify(h2));
await b.close();
