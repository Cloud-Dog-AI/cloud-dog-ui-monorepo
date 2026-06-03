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

// @cloud-dog/app-chat-client — Playwright configuration.

import { defineConfig, devices } from '@playwright/test';

const useExistingServer = process.env.E2E_USE_EXISTING_SERVER === '1' || process.env.CI === 'true';

export default defineConfig({
  forbidOnly: true,
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  timeout: 120_000,
  expect: {
    timeout: 15_000,
  },
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:8051',
    trace: 'on-first-retry',
    video: 'retain-on-failure',
  },
  webServer: useExistingServer
    ? undefined
    : {
        command:
          "bash -lc 'set -a; source /opt/iac/Development/cloud-dog-ai/env-vault; source /opt/iac/Development/cloud-dog-ai/chat-client/tests/env-FORENSIC-WEB; export E2E_WEB_USERNAME=\"${CLOUD_DOG_WEB_LOGIN_USERNAME:-admin}\" E2E_WEB_PASSWORD=\"${CLOUD_DOG_WEB_LOGIN_PASSWORD:-example-password}\" E2E_ADMIN_API_KEY_HEADER=\"${CLOUD_DOG__CLIENT_API__ADMIN_API_KEY_HEADER:-X-Admin-Key}\" E2E_ADMIN_API_KEY=\"${CLOUD_DOG__CLIENT_API__ADMIN_API_KEY:-example-api-key}\"; set +a; rm -f /opt/iac/Development/cloud-dog-ai/chat-client/working/w28a454-local.db /opt/iac/Development/cloud-dog-ai/chat-client/working/w28a454-local.db-shm /opt/iac/Development/cloud-dog-ai/chat-client/working/w28a454-local.db-wal; cleanup(){ cd /opt/iac/Development/cloud-dog-ai/chat-client; ./server_control.sh --env tests/env-IT stop all >/dev/null 2>&1 || true; cd /opt/iac/Development/cloud-dog-ai/file-mcp-server; ./server_control.sh --env /opt/iac/Development/cloud-dog-ai/chat-client/working/file-mcp-runtime/env --config /opt/iac/Development/cloud-dog-ai/chat-client/working/file-mcp-runtime/config.yaml --defaults /opt/iac/Development/cloud-dog-ai/chat-client/working/file-mcp-runtime/defaults.yaml --pidfile /opt/iac/Development/cloud-dog-ai/chat-client/working/file-mcp-runtime/file-mcp-playwright.pid stop mcp >/dev/null 2>&1 || true; }; trap cleanup EXIT INT TERM; cleanup; cd /opt/iac/Development/cloud-dog-ai/file-mcp-server; ./server_control.sh --env /opt/iac/Development/cloud-dog-ai/chat-client/working/file-mcp-runtime/env --config /opt/iac/Development/cloud-dog-ai/chat-client/working/file-mcp-runtime/config.yaml --defaults /opt/iac/Development/cloud-dog-ai/chat-client/working/file-mcp-runtime/defaults.yaml --pidfile /opt/iac/Development/cloud-dog-ai/chat-client/working/file-mcp-runtime/file-mcp-playwright.pid start mcp; cd /opt/iac/Development/cloud-dog-ai/chat-client; ./server_control.sh --env tests/env-IT start api; ./server_control.sh --env tests/env-IT start mcp; ./server_control.sh --env tests/env-IT start a2a; ./server_control.sh --env tests/env-IT start web; for i in $(seq 1 60); do curl -sf http://127.0.0.1:8090/health >/dev/null && break; sleep 1; done; curl -sf -H \"X-API-Key: ${CLOUD_DOG__CLIENT_API__API_KEY:-example-api-key}\" -H \"X-Admin-Key: ${CLOUD_DOG__CLIENT_API__ADMIN_API_KEY:-example-api-key}\" http://127.0.0.1:8090/mcp/servers | grep -q \"file-mcp\" || curl -sf -H \"X-API-Key: ${CLOUD_DOG__CLIENT_API__API_KEY:-example-api-key}\" -H \"X-Admin-Key: ${CLOUD_DOG__CLIENT_API__ADMIN_API_KEY:-example-api-key}\" -H \"Content-Type: application/json\" --data-binary \"{\\\"server\\\":{\\\"name\\\":\\\"file-mcp\\\",\\\"transport\\\":\\\"streamable_http\\\",\\\"base_url\\\":\\\"http://127.0.0.1:8062\\\",\\\"mcp_path\\\":\\\"/mcp\\\",\\\"health_path\\\":\\\"/health\\\",\\\"accept_header\\\":\\\"application/json, text/event-stream\\\",\\\"sse_accept_header\\\":\\\"application/json, text/event-stream\\\",\\\"timeout_seconds\\\":180,\\\"verify_tls\\\":false,\\\"enable_sse\\\":false,\\\"auth_bearer_token\\\":\\\"secret\\\"}}\" http://127.0.0.1:8090/mcp/servers >/dev/null; while true; do sleep 3600; done'",
        url: 'http://127.0.0.1:8051/ui/config',
        reuseExistingServer: true,
        timeout: 180_000,
      },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
