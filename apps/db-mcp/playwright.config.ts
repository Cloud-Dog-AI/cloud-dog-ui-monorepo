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

import { defineConfig, devices } from "@playwright/test";

const backendRoot = "/opt/iac/Development/cloud-dog-ai/db-mcp-server";
const appRoot = "/opt/iac/Development/cloud-dog-ai/cloud-dog-ai-ui-monorepo/apps/db-mcp";
const externalBaseUrl = process.env.E2E_BASE_URL;

export default defineConfig({
  forbidOnly: true,
  testDir: "./tests",
  outputDir: "./test-results",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 180_000,
  expect: {
    timeout: 15_000,
  },
  use: {
    baseURL: externalBaseUrl ?? "http://127.0.0.1:8087",
    trace: "retain-on-failure",
    screenshot: "off",
    video: "retain-on-failure",
  },
  webServer: externalBaseUrl
    ? undefined
    : {
        command: `bash -lc 'set -euo pipefail; cd ${appRoot} && npm run build && ${backendRoot}/scripts/sync-ui-dist.sh ${appRoot}/dist; cd ${backendRoot}; rm -f data/dbmcp_webui_metadata.db data/dbmcp_webui_audit.db data/test-webui-discovery-index.db working/ui-e2e-state.json; ./server_control.sh --env tests/env-ST-WEBUI stop all >/dev/null 2>&1 || true; ./server_control.sh --env tests/env-ST-WEBUI start all; DB_MCP_UI_API_BASE_URL=http://127.0.0.1:8086 DB_MCP_UI_MCP_BASE_URL=http://127.0.0.1:8088 DB_MCP_UI_API_KEY=test-api-key venv/bin/python scripts/prepare_ui_test_env.py; trap "${backendRoot}/server_control.sh --env ${backendRoot}/tests/env-ST-WEBUI stop all >/dev/null 2>&1 || true" EXIT; while true; do sleep 5; done'`,
        url: "http://127.0.0.1:8087/health",
        reuseExistingServer: false,
        timeout: 300_000,
      },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
