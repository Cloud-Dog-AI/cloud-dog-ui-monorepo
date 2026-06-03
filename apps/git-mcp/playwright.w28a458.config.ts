import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/w28a458",
  outputDir: "./test-results/w28a458",
  fullyParallel: false,
  workers: 1,
  timeout: 180_000,
  expect: { timeout: 20_000 },
  use: {
    baseURL: process.env.W28A458_BASE_URL ?? "http://127.0.0.1:18686",
    trace: "on-first-retry",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
