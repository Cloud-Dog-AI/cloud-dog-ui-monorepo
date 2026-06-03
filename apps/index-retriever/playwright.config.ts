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

// @cloud-dog/app-index-retriever — Playwright configuration.

import { defineConfig, devices } from "@playwright/test";

const configuredBaseUrl =
  process.env.E2E_BASE_URL ?? "http://127.0.0.1:5197";
const backendApiProxyTarget =
  process.env.E2E_BACKEND_API_BASE_URL ?? "http://127.0.0.1:8074";
const configuredApiBaseUrl =
  process.env.E2E_API_BASE_URL ?? configuredBaseUrl;
const configuredMcpBaseUrl =
  process.env.E2E_MCP_BASE_URL?.trim() || undefined;
const configuredA2aBaseUrl =
  process.env.E2E_A2A_BASE_URL?.trim() || undefined;
function urlOrigin(value: string | undefined, fallback: string): string {
  try {
    return new URL(value ?? fallback).origin;
  } catch {
    return new URL(fallback).origin;
  }
}
const configuredA2aProxyTarget = urlOrigin(configuredA2aBaseUrl, "http://127.0.0.1:8077/a2a");
const configuredRuntimeEnvFile =
  process.env.E2E_RUNTIME_ENV_FILE ??
  "/opt/iac/Development/cloud-dog-ai/index-retriever-mcp-server/tests/env-IT";
process.env.E2E_API_BASE_URL = configuredApiBaseUrl;
if (configuredMcpBaseUrl) {
  process.env.E2E_MCP_BASE_URL = configuredMcpBaseUrl;
} else {
  delete process.env.E2E_MCP_BASE_URL;
}
if (configuredA2aBaseUrl) {
  process.env.E2E_A2A_BASE_URL = configuredA2aBaseUrl;
} else {
  delete process.env.E2E_A2A_BASE_URL;
}
process.env.E2E_API_KEY = process.env.E2E_API_KEY ?? "valid-admin-token";
process.env.E2E_READER_API_KEY = process.env.E2E_READER_API_KEY ?? "valid-reader-token";
process.env.E2E_WRITER_API_KEY = process.env.E2E_WRITER_API_KEY ?? "valid-writer-token";
process.env.E2E_USE_RUNTIME_INJECTION =
  process.env.E2E_USE_RUNTIME_INJECTION ?? "1";
process.env.E2E_AUTH_MODE =
  process.env.E2E_AUTH_MODE ?? "api_key";
process.env.E2E_WEB_LOGIN_USERNAME =
  process.env.E2E_WEB_LOGIN_USERNAME ?? "admin";
process.env.E2E_WEB_LOGIN_PASSWORD =
  process.env.E2E_WEB_LOGIN_PASSWORD ?? "example-password";
const useExistingServer = process.env.E2E_USE_EXISTING_SERVER === "1";

export default defineConfig({
  forbidOnly: true,
  testDir: "./tests",
  outputDir: "./test-results",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 300_000,
  expect: {
    timeout: 15_000,
  },
  use: {
    baseURL: configuredBaseUrl,
    trace: "on-first-retry",
    video: "retain-on-failure",
  },
  webServer: useExistingServer
    ? undefined
    : [
        {
          command:
            `bash -lc 'set -a; source /opt/iac/Development/cloud-dog-ai/env-vault; set +a; cd /opt/iac/Development/cloud-dog-ai/index-retriever-mcp-server && cleanup(){ ./server_control.sh --env "${configuredRuntimeEnvFile}" stop all >/dev/null 2>&1 || true; }; cleanup; CLOUD_DOG__INDEX__AUTH__API_KEYS=test-api-key,12345678,valid-reader-token:reader,valid-writer-token:writer,valid-admin-token:admin CLOUD_DOG_WEB_LOGIN_USERNAME=dummy CLOUD_DOG_WEB_LOGIN_PASSWORD=example-password ./server_control.sh --env "${configuredRuntimeEnvFile}" start all && python3 - <<\"PY\"\nfrom __future__ import annotations\n\nimport time\nimport urllib.error\nimport urllib.request\n\nheaders = {\n    \"Authorization\": \"Bearer valid-admin-token\",\n    \"X-API-Key\": \"valid-admin-token\",\n}\n\ndef status(url: str, *, headers: dict[str, str] | None = None) -> int:\n    req = urllib.request.Request(url, headers=headers or {})\n    try:\n        with urllib.request.urlopen(req, timeout=5) as response:\n            response.read()\n            return int(response.status)\n    except urllib.error.HTTPError as exc:\n        return int(exc.code)\n    except Exception:\n        return 0\n\ndeadline = time.time() + 90\nwhile time.time() < deadline:\n    if status(\"${backendApiProxyTarget}/health\") == 200 and status(\"${backendApiProxyTarget}/api/v1/tools\", headers=headers) == 200 and status(\"${backendApiProxyTarget}/auth/me\", headers=headers) == 200:\n        break\n    time.sleep(1)\nelse:\n    raise SystemExit(\"index-retriever Playwright runtime did not become auth-ready within 90s\")\nPY\ntrap cleanup EXIT INT TERM; while true; do sleep 3600; done'`,
          url: `${backendApiProxyTarget}/health`,
          reuseExistingServer: false,
          timeout: 180_000,
        },
        {
          command:
            `INDEX_RETRIEVER_API_PROXY_TARGET=${backendApiProxyTarget} INDEX_RETRIEVER_A2A_PROXY_TARGET=${configuredA2aProxyTarget} npm run build && INDEX_RETRIEVER_API_PROXY_TARGET=${backendApiProxyTarget} INDEX_RETRIEVER_A2A_PROXY_TARGET=${configuredA2aProxyTarget} npm run preview -- --port 5197`,
          url: "http://127.0.0.1:5197",
          reuseExistingServer: false,
          timeout: 120_000,
        },
      ],
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
