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

// @cloud-dog/app-imap-mcp — Settings page built on shared settings, explorer, and editor patterns.

import * as React from "react";
import { useConfig } from "@cloud-dog/config";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CodeEditor,
  JsonExplorer,
  SettingsPanel,
  type SettingGroupDef,
} from "@cloud-dog/ui";
import type { JsonRecord } from "../lib/types";
import { useImapMcpState } from "../state/AppState";

const SECRET_PATTERNS = /password|secret|token|api_key|credential|private_key/i;
const MUTATION_GATE_STORAGE_KEY = "imap-mcp.mutation-gates";

type RuntimeConfig = Readonly<{
  API_BASE_URL: string;
  MCP_BASE_URL?: string;
  A2A_BASE_URL?: string;
  AUTH_MODE?: string;
  UI_BASE_PATH?: string;
  CLOUD_DOG_SESSION_TIMEOUT_MINUTES?: number;
}>;

type MutableSettings = Readonly<{
  polling_interval_seconds: number;
  request_timeout_seconds: number;
  allowSetSeen: boolean;
  allowMoveDuplicates: boolean;
  allowMoveMessages: boolean;
  allowDeleteMessages: boolean;
}>;

const DEFAULT_MUTABLE_SETTINGS: MutableSettings = {
  polling_interval_seconds: 30,
  request_timeout_seconds: 15,
  allowSetSeen: true,
  allowMoveDuplicates: false,
  allowMoveMessages: false,
  allowDeleteMessages: false,
};

function maskSecrets(obj: unknown, depth = 0): unknown {
  if (depth > 10) return obj;
  if (typeof obj === "string") return obj;
  if (Array.isArray(obj)) return obj.map((item) => maskSecrets(item, depth + 1));
  if (obj && typeof obj === "object") {
    const masked: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (SECRET_PATTERNS.test(key) && typeof value === "string" && value.length > 0) {
        masked[key] = "****";
      } else {
        masked[key] = maskSecrets(value, depth + 1);
      }
    }
    return masked;
  }
  return obj;
}

function loadMutationGates(): Pick<
  MutableSettings,
  "allowSetSeen" | "allowMoveDuplicates" | "allowMoveMessages" | "allowDeleteMessages"
> {
  try {
    const raw = window.localStorage.getItem(MUTATION_GATE_STORAGE_KEY);
    if (!raw) {
      return DEFAULT_MUTABLE_SETTINGS;
    }
    return {
      ...DEFAULT_MUTABLE_SETTINGS,
      ...(JSON.parse(raw) as Record<string, boolean>),
    };
  } catch {
    return DEFAULT_MUTABLE_SETTINGS;
  }
}

function saveMutationGates(value: MutableSettings): void {
  window.localStorage.setItem(
    MUTATION_GATE_STORAGE_KEY,
    JSON.stringify({
      allowSetSeen: value.allowSetSeen,
      allowMoveDuplicates: value.allowMoveDuplicates,
      allowMoveMessages: value.allowMoveMessages,
      allowDeleteMessages: value.allowDeleteMessages,
    }),
  );
}

function normaliseBoolean(value: string): boolean {
  return value.trim().toLowerCase() === "true";
}

function toYaml(value: Record<string, unknown>): string {
  return Object.entries(value)
    .map(([key, item]) => `${key}: ${JSON.stringify(item)}`)
    .join("\n");
}

function fromYaml(source: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const line of source.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf(":");
    if (separator <= 0) continue;
    const key = trimmed.slice(0, separator).trim();
    const rawValue = trimmed.slice(separator + 1).trim();
    if (!rawValue.length) continue;
    if (rawValue === "true" || rawValue === "false") {
      result[key] = normaliseBoolean(rawValue);
    } else if (!Number.isNaN(Number(rawValue))) {
      result[key] = Number(rawValue);
    } else {
      result[key] = rawValue.replace(/^"(.*)"$/, "$1");
    }
  }
  return result;
}

export function SettingsPage() {
  const cfg = useConfig<RuntimeConfig>();
  const { api } = useImapMcpState();
  const [settings, setSettings] = React.useState<MutableSettings>(DEFAULT_MUTABLE_SETTINGS);
  const [status, setStatus] = React.useState("Loading settings...");
  const [error, setError] = React.useState("");
  // IMAP-520: start with a valid empty-object so the CodeEditor doesn't show a parse-error placeholder on fresh load.
  const [importExportValue, setImportExportValue] = React.useState("{}");
  const [importExportLanguage, setImportExportLanguage] = React.useState<"json" | "yaml">("json");
  const [healthData, setHealthData] = React.useState<Record<string, unknown> | null>(null);
  const [adminConfig, setAdminConfig] = React.useState<Record<string, unknown> | null>(null);
  const [adminConfigError, setAdminConfigError] = React.useState<string>("");
  const healthOk = healthData !== null && String((healthData as Record<string, unknown>).status ?? "").toLowerCase() === "ok";

  React.useEffect(() => {
    fetch("/health")
      .then((response) => response.json())
      .then(setHealthData)
      .catch(() => setHealthData({ status: "unreachable" }));
  }, []);

  // Pull the full server-side config tree (os.environ + env-file + config.yaml
  // + defaults.yaml) so the Settings page shows every setting that drives the
  // running services — what the coordinator feedback called out as missing.
  // Admin-only; non-admin viewers see an empty-state hint.
  React.useEffect(() => {
    fetch("/webapi/v1/admin/effective-config", { credentials: "include" })
      .then(async (response) => {
        if (response.status === 403) {
          setAdminConfigError("Admin role required to view the full runtime config tree.");
          return null;
        }
        if (!response.ok) {
          setAdminConfigError(`Admin config fetch failed (${response.status})`);
          return null;
        }
        return await response.json();
      })
      .then((body) => {
        if (body && body.result) {
          setAdminConfig(body.result as Record<string, unknown>);
        }
      })
      .catch((err) => {
        setAdminConfigError(err instanceof Error ? err.message : "Admin config fetch failed");
      });
  }, []);

  const loadSettings = React.useCallback(async () => {
    setError("");
    const result = await api.getSettings();
    const mutationGates = loadMutationGates();
    if (!result.ok || !result.data) {
      setSettings({ ...DEFAULT_MUTABLE_SETTINGS, ...mutationGates });
      setError(result.errorMessage || "Failed to load settings.");
      setStatus("Loaded local defaults only.");
      return;
    }
    setSettings({
      polling_interval_seconds: Number(result.data.polling_interval_seconds ?? DEFAULT_MUTABLE_SETTINGS.polling_interval_seconds),
      request_timeout_seconds: Number(result.data.request_timeout_seconds ?? DEFAULT_MUTABLE_SETTINGS.request_timeout_seconds),
      ...mutationGates,
    });
    setStatus("Settings loaded.");
  }, [api]);

  React.useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const updateDraft = (key: string, value: unknown) => {
    setSettings((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const saveSettings = async () => {
    const payload: JsonRecord = {
      polling_interval_seconds: Number(settings.polling_interval_seconds),
      request_timeout_seconds: Number(settings.request_timeout_seconds),
    };
    const result = await api.updateSettings(payload);
    if (!result.ok) {
      setError(result.errorMessage || "Failed to save settings.");
      return;
    }
    saveMutationGates(settings);
    setStatus("Settings saved.");
    setError("");
  };

  const exportJson = () => {
    setImportExportLanguage("json");
    setImportExportValue(JSON.stringify(settings, null, 2));
    setStatus("Exported settings as JSON.");
  };

  const exportYaml = () => {
    setImportExportLanguage("yaml");
    setImportExportValue(toYaml(settings));
    setStatus("Exported settings as YAML.");
  };

  const importSettings = async () => {
    try {
      const parsed = importExportValue.trim().startsWith("{")
        ? (JSON.parse(importExportValue) as Record<string, unknown>)
        : fromYaml(importExportValue);
      const nextSettings: MutableSettings = {
        polling_interval_seconds: Number(parsed.polling_interval_seconds ?? settings.polling_interval_seconds),
        request_timeout_seconds: Number(parsed.request_timeout_seconds ?? settings.request_timeout_seconds),
        allowSetSeen: Boolean(parsed.allowSetSeen ?? settings.allowSetSeen),
        allowMoveDuplicates: Boolean(parsed.allowMoveDuplicates ?? settings.allowMoveDuplicates),
        allowMoveMessages: Boolean(parsed.allowMoveMessages ?? settings.allowMoveMessages),
        allowDeleteMessages: Boolean(parsed.allowDeleteMessages ?? settings.allowDeleteMessages),
      };
      setSettings(nextSettings);
      saveMutationGates(nextSettings);
      const result = await api.updateSettings({
        polling_interval_seconds: nextSettings.polling_interval_seconds,
        request_timeout_seconds: nextSettings.request_timeout_seconds,
      });
      if (!result.ok) {
        setError(result.errorMessage || "Failed to apply imported settings.");
        return;
      }
      setStatus("Imported settings applied.");
      setError("");
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Import failed.");
    }
  };

  const groups: SettingGroupDef[] = [
    {
      id: "server",
      label: "Server",
      settings: [
        { key: "api_base_url", label: "API base URL", type: "text", value: cfg.API_BASE_URL, readOnly: true, description: "Runtime-config.js supplied value." },
        { key: "mcp_base_url", label: "MCP base URL", type: "text", value: cfg.MCP_BASE_URL ?? cfg.API_BASE_URL, readOnly: true, description: "Runtime-config.js supplied value." },
        { key: "a2a_base_url", label: "A2A base URL", type: "text", value: cfg.A2A_BASE_URL ?? cfg.API_BASE_URL, readOnly: true, description: "Runtime-config.js supplied value." },
      ],
    },
    {
      id: "auth",
      label: "Auth",
      settings: [
        { key: "auth_mode", label: "Auth mode", type: "text", value: cfg.AUTH_MODE ?? "cookie", readOnly: true, description: "Auth transport is environment-managed." },
        { key: "session_timeout", label: "Session timeout minutes", type: "number", value: cfg.CLOUD_DOG_SESSION_TIMEOUT_MINUTES ?? 30, readOnly: true, description: "Session timeout is runtime-config.js supplied." },
      ],
    },
    {
      id: "imap",
      label: "IMAP",
      settings: [
        { key: "request_timeout_seconds", label: "Request timeout seconds", type: "number", value: settings.request_timeout_seconds, description: "Mutable setting persisted via /webapi/v1/admin/settings." },
      ],
    },
    {
      id: "search",
      label: "Search",
      settings: [
        { key: "polling_interval_seconds", label: "Polling interval seconds", type: "number", value: settings.polling_interval_seconds, description: "Mutable setting persisted via /webapi/v1/admin/settings." },
      ],
    },
    {
      id: "mutation",
      label: "Mutation Gating",
      settings: [
        { key: "allowSetSeen", label: "Allow Set Seen", type: "boolean", value: settings.allowSetSeen, description: "Browser-side UI mutation gate." },
        { key: "allowMoveDuplicates", label: "Allow Move Duplicates", type: "boolean", value: settings.allowMoveDuplicates, description: "Browser-side UI mutation gate." },
        { key: "allowMoveMessages", label: "Allow Move Messages", type: "boolean", value: settings.allowMoveMessages, description: "Browser-side UI mutation gate." },
        { key: "allowDeleteMessages", label: "Allow Delete Messages", type: "boolean", value: settings.allowDeleteMessages, description: "Browser-side UI mutation gate." },
      ],
    },
    {
      id: "logging",
      label: "Logging",
      settings: [
        { key: "ui_base_path", label: "UI base path", type: "text", value: cfg.UI_BASE_PATH ?? "/ui", readOnly: true, description: "Served from runtime-config.js." },
        { key: "audit_endpoint", label: "Audit endpoint", type: "text", value: "/webapi/v1/admin/audit/events", readOnly: true, description: "Cookie-authenticated browser audit API." },
      ],
    },
  ];

  const serviceInfo = maskSecrets({
    api_base_url: cfg.API_BASE_URL,
    mcp_base_url: cfg.MCP_BASE_URL ?? "",
    a2a_base_url: cfg.A2A_BASE_URL ?? "",
    auth_mode: cfg.AUTH_MODE ?? "cookie",
    session_timeout_minutes: cfg.CLOUD_DOG_SESSION_TIMEOUT_MINUTES ?? 30,
  });

  const backendInfo = maskSecrets({
    cache_backend: "local",
    imap_provider: "generic",
    request_timeout_seconds: settings.request_timeout_seconds,
    polling_interval_seconds: settings.polling_interval_seconds,
    note: "Credentials and secret-backed values are masked.",
  });

  const loggingInfo = {
    log_format: "json",
    api_server_log: "logs/api_server.log",
    web_server_log: "logs/web_server.log",
    mcp_server_log: "logs/mcp_server.log",
    a2a_server_log: "logs/a2a_server.log",
    audit_log: "logs/audit.log.jsonl",
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold">Settings</h1>
            <Badge variant={healthOk ? "default" : "secondary"}>{healthOk ? "connected" : "degraded"}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Shared settings controls, governed import/export, and structured configuration explorers.
          </p>
        </div>
        <Button onClick={() => void saveSettings()}>Save</Button>
      </header>

      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      <p role="status" className="text-sm text-foreground/80">{status}</p>

      <SettingsPanel
        groups={groups}
        onSave={updateDraft}
      />

      {/* IMAP-232: single Import/Export surface. SettingsPanel's built-in
          export/import buttons removed to eliminate the duplicate; the
          explicit editor below is the canonical control because it lets
          the operator see + modify the payload before applying. */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Import / Export settings</h2>
          <p className="text-sm text-muted-foreground">
            Export current settings to JSON or YAML, or paste a new payload and click Apply Import.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={exportJson}>Export JSON</Button>
            <Button variant="secondary" onClick={exportYaml}>Export YAML</Button>
            <Button onClick={() => void importSettings()}>Apply Import</Button>
            <Button variant="secondary" onClick={() => void loadSettings()}>Reload</Button>
          </div>
          <CodeEditor
            value={importExportValue}
            onChange={setImportExportValue}
            language={importExportLanguage}
            height={320}
          />
        </CardContent>
      </Card>

      {/* IMAP-033: Build metadata in its own platform Card panel. */}
      {adminConfig ? (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Build metadata</h2>
            <p className="text-sm text-muted-foreground">
              Version, git revision, build-host and bake-time of the running container.
            </p>
          </CardHeader>
          <CardContent>
            <JsonExplorer
              title=""
              data={(adminConfig.build as Record<string, unknown>) ?? {}}
              defaultExpanded
              maxDepth={3}
              viewMode="table"
            />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Diagnostics</h2>
          <p className="text-sm text-muted-foreground">
            Service identity, storage backend, logging, and health snapshot.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <JsonExplorer title="Service Information" data={serviceInfo} maxDepth={5} viewMode="table" />
          <JsonExplorer title="Storage and Backend" data={backendInfo} maxDepth={5} viewMode="table" />
          <JsonExplorer title="Logging" data={loggingInfo} maxDepth={5} viewMode="table" />
          <JsonExplorer title="Mutable IMAP Settings" data={maskSecrets(settings)} defaultExpanded maxDepth={5} viewMode="table" />
          <JsonExplorer title="Health" data={maskSecrets(healthData ?? { status: "loading" })} defaultExpanded maxDepth={5} viewMode="table" />
        </CardContent>
      </Card>

      {/* W28C-434E2 Pass 2: full runtime config tree (os.environ + env-file +
          config.yaml + defaults.yaml) sourced from /webapi/v1/admin/effective-config
          (W28E-1863 fix-wave-b: was /webapi/v1/admin/config which 404'd — the API
          serves /admin/effective-config). Secrets redacted server-side. Admin-only. */}
      {adminConfigError ? (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Runtime Configuration</h2>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{adminConfigError}</p>
          </CardContent>
        </Card>
      ) : null}
      {adminConfig ? (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Runtime configuration</h2>
            <p className="text-sm text-muted-foreground">
              Full merged config tree (env vars, env-files, config.yaml, defaults.yaml). Secrets are redacted server-side.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <JsonExplorer
              title={`Process environment (${Object.keys((adminConfig.environ as object) ?? {}).length} keys)`}
              data={(adminConfig.environ as Record<string, unknown>) ?? {}}
              defaultExpanded={false}
              maxDepth={3}
              viewMode="table"
            />
            <JsonExplorer
              title={`Env files (${((adminConfig.env_files as unknown[]) ?? []).length})`}
              data={{ files: adminConfig.env_files ?? [] }}
              defaultExpanded={false}
              maxDepth={3}
              viewMode="table"
            />
            <JsonExplorer
              title="config.yaml + defaults.yaml (merged Pydantic snapshot)"
              data={(adminConfig.config as Record<string, unknown>) ?? {}}
              defaultExpanded={false}
              maxDepth={7}
              viewMode="table"
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
