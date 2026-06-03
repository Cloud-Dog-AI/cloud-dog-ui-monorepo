import { defineConfig, devices } from "@playwright/test";
export default defineConfig({ testDir:"tests/e2e/w28a-799", testMatch:["**/secret-masking-capture.spec.ts"],
  workers:1, retries:0, timeout:120000, expect:{timeout:20000},
  use:{ baseURL: process.env.E2E_BASE_URL, trace:"off" },
  projects:[{name:"chromium",use:{...devices["Desktop Chrome"]}}] });
