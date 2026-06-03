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

// @cloud-dog/app-imap-mcp — Playwright configuration.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

const configuredBaseUrl = process.env.E2E_BASE_URL ?? "http://127.0.0.1:28980";
const configuredApiBaseUrl = process.env.E2E_API_BASE_URL ?? configuredBaseUrl;
const configuredMcpBaseUrl = process.env.E2E_MCP_BASE_URL ?? configuredBaseUrl;
const configuredRuntimeEnvFile =
  process.env.E2E_RUNTIME_ENV_FILE ??
  "/opt/iac/Development/cloud-dog-ai/imap-mcp-server/tests/env-IT-local-server";
const workspaceRoot = "/opt/iac/Development/cloud-dog-ai";
const imapMcpRoot = `${workspaceRoot}/imap-mcp-server`;
const preprodEnvFile = process.env.E2E_PREPROD_ENV_FILE ?? `${imapMcpRoot}/private/env-PREPROD`;
const vaultEnvFile = process.env.E2E_VAULT_ENV_FILE ?? `${workspaceRoot}/env-vault`;

function readEnvFile(path: string): Record<string, string> {
  if (!existsSync(path)) return {};
  const env: Record<string, string> = {};
  for (const line of readFileSync(path, "utf-8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [key, ...parts] = trimmed.split("=");
    env[key.trim()] = parts.join("=").trim();
  }
  return env;
}

function resolveVaultRef(value: string): string {
  const match = value.match(/^\$\{(vault\.[^}]+)\}$/);
  if (!match) return value;

  const vaultEnv = readEnvFile(vaultEnvFile);
  return execFileSync(
    `${imapMcpRoot}/.venv/bin/python`,
    [
      "-c",
      [
        "import sys",
        "from cloud_dog_config.compiler.vault_resolver import resolve_vault_identifier",
        "from cloud_dog_config.vault.client import VaultClient, VaultConnectionConfig",
        "identifier = sys.argv[1]",
        "server = sys.argv[2].rstrip('/')",
        "token = sys.argv[3]",
        "mount = '/'.join(part.strip('/') for part in (sys.argv[4], sys.argv[5]) if part.strip('/'))",
        "value = resolve_vault_identifier(identifier, vault=VaultClient(VaultConnectionConfig(server=server, token=token, mount_point=mount, timeout_seconds=10.0)))",
        "print(str(value).strip(), end='')",
      ].join("; "),
      match[1],
      vaultEnv.VAULT_ADDR ?? "",
      vaultEnv.VAULT_TOKEN ?? "",
      vaultEnv.VAULT_MOUNT_POINT ?? "",
      vaultEnv.VAULT_CONFIG_PATH ?? "",
    ],
    {
      cwd: imapMcpRoot,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 15_000,
    },
  ).trim();
}

function isRemotePreprodRun(): boolean {
  return /^https:\/\/imapmcpserver0\.cloud-dog\.net(?:\/|$)/i.test(configuredBaseUrl);
}

function resolvePreprodApiKey(): string {
  const preprodEnv = readEnvFile(preprodEnvFile);
  const candidate =
    preprodEnv.IMAP_API_KEY ??
    preprodEnv.CLOUD_DOG__IMAP__API_KEY ??
    preprodEnv.API_KEY ??
    "";
  const resolved = resolveVaultRef(candidate).trim();
  if (!resolved || /^\$\{vault\.[^}]+\}$/.test(resolved)) {
    throw new Error("Unable to resolve IMAP MCP preprod E2E_API_KEY from approved env/Vault reference.");
  }
  return resolved;
}

process.env.E2E_API_BASE_URL = configuredApiBaseUrl;
process.env.E2E_MCP_BASE_URL = configuredMcpBaseUrl;
process.env.E2E_API_KEY = process.env.E2E_API_KEY ?? (isRemotePreprodRun() ? resolvePreprodApiKey() : "12345678");

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
    baseURL: configuredBaseUrl,
    trace: "retain-on-failure",
    screenshot: "off",
    video: "retain-on-failure",
  },
  webServer:
    process.env.E2E_SKIP_WEBSERVER === "1"
      ? undefined
      : [
        {
          command: `bash -lc 'set -a; source /opt/iac/Development/cloud-dog-ai/env-vault; set +a; cd /opt/iac/Development/cloud-dog-ai/imap-mcp-server && cleanup(){ ./server_control.sh --env "${configuredRuntimeEnvFile}" stop all >/dev/null 2>&1 || true; }; cleanup; ./server_control.sh --env "${configuredRuntimeEnvFile}" start all; trap cleanup EXIT INT TERM; while true; do sleep 3600 || true; done'`,
            url: `${configuredBaseUrl}/health`,
            reuseExistingServer: false,
            timeout: 180_000,
          },
        ],
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
