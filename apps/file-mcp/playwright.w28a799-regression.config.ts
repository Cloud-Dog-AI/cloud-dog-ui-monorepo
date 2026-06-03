import { defineConfig, devices } from "@playwright/test";
const EVR="/opt/iac/Development/cloud-dog-ai/cloud-dog-ai-platform-standards/working/evidence/W28A-799-settings-webui-file-mcp-server/current/05-regression";
export default defineConfig({
  testDir: "tests", testMatch: ["smoke/all-pages.spec.ts","a11y.spec.ts"],
  fullyParallel:false, workers:1, retries:0, timeout:120000, expect:{timeout:20000},
  outputDir: `${EVR}/test-results`,
  reporter: [["list"],["json",{outputFile:`${EVR}/regression-results.json`}],["junit",{outputFile:`${EVR}/regression-junit.xml`}]],
  use: { baseURL: process.env.E2E_BASE_URL, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
