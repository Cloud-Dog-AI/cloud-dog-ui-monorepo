import fs from "node:fs";
import { chromium, request as playwrightRequest } from "playwright";

const baseUrl = "http://127.0.0.1:8087";
const envMongo = Object.fromEntries(
  fs.readFileSync("/opt/iac/Development/cloud-dog-ai/db-mcp-server/tests/env-mongodb", "utf-8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const index = line.indexOf("=");
      return [line.slice(0, index), line.slice(index + 1)];
    })
);

function unwrap(body) {
  if (body && typeof body === "object" && "data" in body) {
    return body.data;
  }
  return body;
}

const profileName = `diag-${Date.now()}`;
const username = process.env.E2E_WEB_USERNAME || "admin";
const password = process.env.E2E_WEB_PASSWORD || "test-password";

const api = await playwrightRequest.newContext({ baseURL: baseUrl });
let profileId = "";

try {
  const loginResp = await api.fetch("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    data: JSON.stringify({ username, password }),
  });
  console.log("[API] login", loginResp.status());

  const createResp = await api.fetch("/webapi/v1/profiles", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    data: JSON.stringify({
      name: profileName,
      source_type: "mongodb",
      source_connection: envMongo.DB_MCP_TEST_MONGODB_URI,
      description: "diagnostic profile",
      namespaces: [],
      entities: [],
      enabled_tools: [],
      allowed_permissions: [],
      field_masks: {},
      field_exclusions: [],
      index_policy: {},
    }),
  });
  const createBody = unwrap(await createResp.json());
  profileId = String(createBody.profile_id || "");
  console.log("[API] create profile", createResp.status(), profileId);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ baseURL: baseUrl });
  const page = await context.newPage();

  page.on("console", (msg) => {
    console.log(`[BROWSER ${msg.type()}] ${msg.text()}`);
  });
  page.on("request", (req) => {
    const url = req.url();
    if (url.includes("/webapi/v1/profiles")) {
      console.log("[REQ]", req.method(), url);
    }
    if (url.includes("/webmcp/tools/catalog.list_namespaces")) {
      console.log("[REQ]", req.method(), url, req.postData() ?? "");
    }
  });
  page.on("response", async (res) => {
    const url = res.url();
    if (url.includes("/webapi/v1/profiles")) {
      console.log("[RES]", res.status(), res.request().method(), url);
    }
    if (url.includes("/webmcp/tools/catalog.list_namespaces")) {
      const body = await res.text().catch(() => "");
      console.log("[RES]", res.status(), res.request().method(), url, body.slice(0, 400));
    }
  });

  await page.goto("/login");
  const apiKeyInput = page.getByRole("textbox", { name: /^api key$/i });
  if (await apiKeyInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await apiKeyInput.fill(process.env.E2E_API_KEY || "test-api-key");
  } else {
    await page.getByRole("textbox", { name: /^username$/i }).fill(username);
    await page.getByLabel(/^password$/i).fill(password);
  }
  await page.getByRole("button", { name: /^sign in$/i }).click();

  await page.goto("/catalogue");
  await page.getByLabel(/^profile$/i).selectOption(profileId);
  console.log("[UI] selected profile", profileId);
  await page.waitForTimeout(35000);

  const bodyText = await page.locator("body").innerText();
  console.log("[BODY HAS NAMESPACE]", bodyText.includes(envMongo.DB_MCP_TEST_MONGODB_DB));
  const alert = await page.getByRole("alert").textContent().catch(() => "");
  console.log("[ALERT TEXT]", alert ?? "");

  await browser.close();
} finally {
  if (profileId) {
    const deleteResp = await api.fetch(`/webapi/v1/profiles/${profileId}`, { method: "DELETE" });
    console.log("[API] delete profile", deleteResp.status(), profileId);
  }
  await api.dispose();
}
