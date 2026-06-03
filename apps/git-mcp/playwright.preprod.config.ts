import { defineConfig, devices } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const workspaceRoot = "/opt/iac/Development/cloud-dog-ai";
const gitMcpRoot = `${workspaceRoot}/git-mcp-server`;
const preprodEnvFile = process.env.E2E_PREPROD_ENV_FILE ?? `${gitMcpRoot}/private/env-PREPROD`;
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
    `${gitMcpRoot}/.venv/bin/python`,
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
      cwd: gitMcpRoot,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 15_000,
    },
  ).trim();
}

function resolvePreprodApiKey(): string {
  const direct = process.env.E2E_API_KEY?.trim();
  if (direct) return direct;
  const preprodEnv = readEnvFile(preprodEnvFile);
  const candidate =
    preprodEnv.CLOUD_DOG__GIT__API_KEY ??
    preprodEnv.CLOUD_DOG__RUNTIME__A2A_TEST_API_KEY ??
    "";
  const resolved = resolveVaultRef(candidate).trim();
  if (!resolved || /^\$\{vault\.[^}]+\}$/.test(resolved)) {
    throw new Error("Unable to resolve Git MCP preprod E2E_API_KEY from approved env/Vault reference.");
  }
  return resolved;
}

process.env.E2E_API_KEY = resolvePreprodApiKey();
process.env.E2E_AUTH_MODE = process.env.E2E_AUTH_MODE ?? "api_key";

export default defineConfig({
  testDir: "./tests",
  outputDir: "./test-results/preprod",
  fullyParallel: false,
  workers: 1,
  timeout: 180_000,
  expect: {
    timeout: 20_000,
  },
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "https://example.com",
    trace: "retain-on-failure",
    video: "retain-on-failure",
    screenshot: "off",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
