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

// @cloud-dog/app-file-mcp — Playwright configuration.

import { defineConfig, devices } from "@playwright/test";

const e2eBaseUrl = process.env.E2E_BASE_URL ?? "http://127.0.0.1:5186";
const useLocalServer = process.env.E2E_USE_LOCAL_SERVER !== "0";

process.env.E2E_DEFAULT_BROWSE_PATH ??= ".";

export default defineConfig({
  forbidOnly: true,
  testDir: "./tests",
  outputDir: "./test-results",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  expect: {
    timeout: 15_000,
  },
  use: {
    baseURL: e2eBaseUrl,
    trace: "on-first-retry",
    video: "retain-on-failure",
  },
  webServer: useLocalServer
    ? [
        {
          command:
            "bash -lc 'set -a; source /opt/iac/Development/cloud-dog-ai/env-vault; set +a; cd /opt/iac/Development/cloud-dog-ai/file-mcp-server && ./server_control.sh --env tests/env-ST stop all >/dev/null 2>&1 || true; FILE_MCP_SEARCH_TIMEOUT_S=90 FILE_MCP_STORAGE_TIMEOUT_S=90 FILE_MCP_GDRIVE_TOKEN_URI=https://oauth2.googleapis.com/token FILE_MCP_ADMIN_UI_ENABLED=true FILE_MCP_ADMIN_UI_TOKEN=admin-token ./server_control.sh --env tests/env-ST start all; trap \"./server_control.sh --env tests/env-ST stop all >/dev/null 2>&1 || true\" EXIT INT TERM; while true; do sleep 3600; done'",
          url: "http://127.0.0.1:8061/health",
          reuseExistingServer: true,
          timeout: 240_000,
        },
        {
          command:
            "FILE_MCP_API_PROXY_TARGET=http://127.0.0.1:8061 npm run build && FILE_MCP_API_PROXY_TARGET=http://127.0.0.1:8061 npm run preview -- --port 5186 --host 127.0.0.1",
          url: "http://127.0.0.1:5186",
          reuseExistingServer: false,
          timeout: 120_000,
        },
      ]
    : undefined,
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
