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

// @cloud-dog/app-git-mcp — Playwright configuration.

import { defineConfig, devices } from "@playwright/test";

process.env.E2E_API_KEY_RETRY_ATTEMPTS = process.env.E2E_API_KEY_RETRY_ATTEMPTS ?? "0";
process.env.E2E_SEED_KEY_FILE =
  process.env.E2E_SEED_KEY_FILE ??
  "/opt/iac/Development/cloud-dog-ai/git-mcp-server/working/it/seed_api_key.txt";

const serverEnvFile = process.env.E2E_SERVER_ENV_FILE ?? "tests/env-IT-local-server";
const apiProxyTarget = process.env.GIT_MCP_API_PROXY_TARGET ?? "http://127.0.0.1:19031";
const mcpProxyTarget = process.env.GIT_MCP_MCP_PROXY_TARGET ?? "http://127.0.0.1:19033";
const a2aProxyTarget = process.env.GIT_MCP_A2A_PROXY_TARGET ?? "http://127.0.0.1:19034";
const apiHealthUrl = process.env.E2E_API_HEALTH_URL ?? `${apiProxyTarget.replace(/\/$/, "")}/health`;

export default defineConfig({
  forbidOnly: true,
  testDir: "./tests",
  outputDir: "./test-results",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 180_000,
  expect: {
    timeout: 20_000,
  },
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://127.0.0.1:5177",
    trace: "on-first-retry",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: process.env.E2E_SKIP_WEBSERVER === '1' ? undefined : [
    {
      command:
        `bash -lc 'cd /opt/iac/Development/cloud-dog-ai/git-mcp-server && set -a; source /opt/iac/Development/cloud-dog-ai/env-vault; set +a; cleanup(){ ./server_control.sh --env ${serverEnvFile} stop all >/dev/null 2>&1 || true; }; cleanup; ./server_control.sh --env ${serverEnvFile} start all; trap cleanup EXIT INT TERM; while true; do sleep 3600; done'`,
      url: apiHealthUrl,
      reuseExistingServer: true,
      timeout: 180_000,
    },
    {
      command:
        `GIT_MCP_API_PROXY_TARGET=${apiProxyTarget} GIT_MCP_MCP_PROXY_TARGET=${mcpProxyTarget} GIT_MCP_A2A_PROXY_TARGET=${a2aProxyTarget} npm run build && GIT_MCP_API_PROXY_TARGET=${apiProxyTarget} GIT_MCP_MCP_PROXY_TARGET=${mcpProxyTarget} GIT_MCP_A2A_PROXY_TARGET=${a2aProxyTarget} npm run preview -- --port 5177`,
      url: "http://127.0.0.1:5177",
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
