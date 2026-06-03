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

// @cloud-dog/app-notification-agent — Playwright configuration.

import { defineConfig, devices } from '@playwright/test';

const configuredBaseUrl =
  process.env.BASE_URL ?? process.env.E2E_BASE_URL ?? 'http://localhost:5188';
const configuredApiBaseUrl =
  process.env.E2E_API_BASE_URL ?? 'http://127.0.0.1:8020';
const configuredDirectApiBaseUrl =
  process.env.E2E_DIRECT_API_BASE_URL ?? 'http://127.0.0.1:8020';
const configuredUsername =
  process.env.E2E_USERNAME ?? process.env.CLOUD_DOG__NOTIFY__WEB_SERVER__USERNAME ?? 'web_test';
const configuredPassword =
  process.env.E2E_PASSWORD ?? process.env.CLOUD_DOG__NOTIFY__WEB_SERVER__PASSWORD ?? 'st-local-secret';
const configuredApiKey =
  process.env.E2E_API_KEY ?? process.env.CLOUD_DOG__NOTIFY__API_SERVER__API_KEY ?? 'st-local-secret';
process.env.BASE_URL = configuredBaseUrl;
process.env.E2E_BASE_URL = configuredBaseUrl;
process.env.E2E_API_BASE_URL = configuredApiBaseUrl;
process.env.E2E_DIRECT_API_BASE_URL = configuredDirectApiBaseUrl;
process.env.E2E_USERNAME = configuredUsername;
process.env.E2E_PASSWORD = configuredPassword;
process.env.E2E_API_KEY = configuredApiKey;
process.env.CLOUD_DOG__NOTIFY__WEB_SERVER__USERNAME = configuredUsername;
process.env.CLOUD_DOG__NOTIFY__WEB_SERVER__PASSWORD = configuredPassword;
process.env.CLOUD_DOG__NOTIFY__API_SERVER__API_KEY = configuredApiKey;
process.env.W28A825_FILE_CHANNEL_CONTAINER_PATH =
  process.env.W28A825_FILE_CHANNEL_CONTAINER_PATH
  ?? '/tmp/cloud-dog-notification-agent-w28a825-file-channel';

function shouldStartLocalDevServer(baseUrl: string): boolean {
  try {
    const parsed = new URL(baseUrl);
    return (
      (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') &&
      parsed.port === '5188'
    );
  } catch {
    return true;
  }
}

const testTimeout = Number(process.env.E2E_TEST_TIMEOUT_MS) || 30_000;
const expectTimeout = Number(process.env.E2E_EXPECT_TIMEOUT_MS) || 10_000;
const actionTimeout = Number(process.env.E2E_ACTION_TIMEOUT_MS) || 10_000;

export default defineConfig({
  forbidOnly: true,
  testDir: './tests',
  fullyParallel: true,
  retries: 0,
  timeout: testTimeout,
  expect: { timeout: expectTimeout },
  use: {
    baseURL: configuredBaseUrl,
    trace: 'on-first-retry',
    actionTimeout,
  },
  webServer: (process.env.E2E_USE_EXISTING_SERVER === '1' ? false : shouldStartLocalDevServer(configuredBaseUrl))
    ? [
        {
          command:
            "bash -lc 'set -a; source /opt/iac/Development/cloud-dog-ai/env-vault; set +a; cd /opt/iac/Development/cloud-dog-ai/notification-agent-mcp-server && rm -f .pids/api_server.pid && cleanup(){ ./server_control.sh --env tests/env-ST stop api >/dev/null 2>&1 || true; }; cleanup; ./server_control.sh --env tests/env-ST start api; trap cleanup EXIT INT TERM; while true; do sleep 3600; done'",
          url: configuredApiBaseUrl.replace(/\/$/, '') + '/health',
          reuseExistingServer: !process.env.CI,
          timeout: 180_000,
        },
        {
          command:
            "bash -lc 'ulimit -n 65535; npm --workspace @cloud-dog/app-notification-agent run dev -- --host localhost --port 5188'",
          url: 'http://localhost:5188',
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
      ]
    : undefined,
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
