import { defineConfig, devices } from "@playwright/test";
const EV = "/opt/iac/Development/cloud-dog-ai/cloud-dog-ai-platform-standards/working/evidence/W28A-799-settings-webui-file-mcp-server/current/03-playwright-test-matrix";
export default defineConfig({
  testDir: "tests/e2e/w28a-799",
  testMatch: ["**/*.spec.ts"],
  fullyParallel: false, workers: 1, retries: 0, timeout: 120000,
  expect: { timeout: 20000 },
  outputDir: `${EV}/test-results`,
  reporter: [["list"], ["html", { outputFolder: `${EV}/html-report`, open: "never" }], ["json", { outputFile: `${EV}/results.json` }], ["junit", { outputFile: `${EV}/junit.xml` }]],
  use: { baseURL: process.env.E2E_BASE_URL, trace: "on", screenshot: "on", video: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
