// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// @cloud-dog/app-expert-agent — Playwright configuration.

import { defineConfig, devices } from '@playwright/test';

const realMode = process.env.E2E_REAL === '1';
const realModeTimeoutMs = Number(process.env.E2E_TEST_TIMEOUT_MS ?? 60_000);

export default defineConfig({
  forbidOnly: true,
  testDir: './tests',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  timeout: realMode ? realModeTimeoutMs : 30_000,
  workers: realMode && process.env.CI ? 1 : undefined,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5176',
    trace: 'on-first-retry',
    ignoreHTTPSErrors: realMode,
  },
  webServer: realMode
    ? undefined
    : {
        command: 'npm run build && npm run preview -- --port 5176',
        url: 'http://localhost:5176',
        reuseExistingServer: !process.env.CI,
      },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
