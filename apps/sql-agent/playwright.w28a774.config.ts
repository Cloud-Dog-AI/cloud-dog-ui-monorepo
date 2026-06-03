// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
// SPDX-License-Identifier: Apache-2.0
// W28A-774 — conformance run config against the live local stack (8041).

import { defineConfig, devices } from '@playwright/test';

const EV =
  '/opt/iac/Development/cloud-dog-ai/cloud-dog-ai-platform-standards/working/evidence/' +
  'W28A-774-sql-agent-mcp-a2a-webui-compliance/current/03-t2-playwright';

export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: ['w28a774-ps72-conformance.spec.ts'],
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  outputDir: `${EV}/test-results`,
  reporter: [
    ['list'],
    ['html', { outputFolder: `${EV}/html-report`, open: 'never' }],
    ['json', { outputFile: `${EV}/results.json` }],
    ['junit', { outputFile: `${EV}/junit.xml` }],
  ],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:8041',
    trace: 'on',
    screenshot: 'on',
    video: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
