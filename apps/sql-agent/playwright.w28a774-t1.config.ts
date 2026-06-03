import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: 'tests/e2e', testMatch: ['w28a774-t1-evidence.spec.ts'],
  workers: 1, retries: 0, timeout: 120000, expect: { timeout: 20000 },
  use: { baseURL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:8041', trace: 'off' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
