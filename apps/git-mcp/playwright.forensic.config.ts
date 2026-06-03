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

const localBaseUrl = process.env.FORENSIC_BASE_URL ?? "http://127.0.0.1:18686";
const useExisting = process.env.FORENSIC_USE_EXISTING === "1";
const ignoreHttpsErrors = process.env.FORENSIC_IGNORE_HTTPS_ERRORS === "1";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 240_000,
  expect: { timeout: 30_000 },
  use: {
    baseURL: localBaseUrl,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    ignoreHTTPSErrors: ignoreHttpsErrors,
  },
  webServer: useExisting ? undefined : {
    command:
      "bash -lc 'cd /opt/iac/Development/cloud-dog-ai/cloud-dog-ai-ui-monorepo && " +
      "npm run build --workspace=apps/git-mcp >/tmp/git-mcp-forensic-ui-build.log 2>&1 && " +
      "cd /opt/iac/Development/cloud-dog-ai/git-mcp-server && " +
      "mkdir -p ui && rm -rf ui/dist forensic-data && " +
      "cp -r /opt/iac/Development/cloud-dog-ai/cloud-dog-ai-ui-monorepo/apps/git-mcp/dist ui/dist && " +
      "set -a; source /opt/iac/Development/cloud-dog-ai/env-vault; source tests/env-FORENSIC-WEB; set +a; " +
      "./server_control.sh --env tests/env-AT stop all >/dev/null 2>&1 || true; " +
      "./server_control.sh --env tests/env-AT start api; " +
      "./server_control.sh --env tests/env-AT start mcp; " +
      "./server_control.sh --env tests/env-AT start a2a; " +
      "./server_control.sh --env tests/env-AT start web; " +
      "trap \"./server_control.sh --env tests/env-AT stop all >/dev/null 2>&1 || true\" EXIT INT TERM; " +
      "while true; do sleep 3600; done'",
    url: `${localBaseUrl}/login`,
    reuseExistingServer: false,
    timeout: 180_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
