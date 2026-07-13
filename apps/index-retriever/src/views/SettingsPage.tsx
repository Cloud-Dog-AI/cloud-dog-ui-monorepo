// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
// Licensed under the Apache License, Version 2.0
// PS-73 Settings Page WebUI Standard - index-retriever implementation.

import * as React from "react";
import { SettingsPanel, type JsonExplorerSourceMap, type SettingsPanelServerTab } from "@cloud-dog/ui";
import { useConfig } from "@cloud-dog/config";
import { useIndexRetrieverState } from "../state/AppState";
import {
  SETTINGS_DEFAULT_CONFIG,
  SETTINGS_INVENTORY,
  SETTINGS_LEAF_KEY_PATHS,
  SETTINGS_SECRET_KEY_PATHS,
  SETTINGS_SOURCE_MAP,
} from "../data/settingsInventory";

const MASK_TOKEN = "--------";
const SERVER_TABS = ["all", "api", "mcp", "a2a", "webui"] as const;
type ServerTab = (typeof SERVER_TABS)[number];
type ServerScope = "API" | "MCP" | "A2A" | "WebUI" | "shared";

const SERVER_LABEL: Record<Exclude<ServerTab, "all">, Exclude<ServerScope, "shared">> = {
  api: "API",
  mcp: "MCP",
  a2a: "A2A",
  webui: "WebUI",
};

const SERVER_TOP_LEVEL: Record<Exclude<ServerScope, "shared">, string[]> = {
  API: ["api_server"],
  MCP: ["mcp_server"],
  A2A: ["a2a_server"],
  WebUI: ["web_server", "web_login"],
};

type RuntimeConfig = Readonly<{
  API_BASE_URL: string;
  AUTH_MODE?: string;
  APP_VERSION?: string;
}>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cloneRecord(value: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

function deepMergeDefaults(defaults: unknown, runtime: unknown): unknown {
  if (Array.isArray(defaults)) return Array.isArray(runtime) ? runtime : defaults;
  if (!isRecord(defaults)) return runtime === undefined || runtime === null ? defaults : runtime;
  const out: Record<string, unknown> = {};
  const runtimeRecord = isRecord(runtime) ? runtime : {};
  for (const [key, defaultValue] of Object.entries(defaults)) {
    out[key] = deepMergeDefaults(defaultValue, runtimeRecord[key]);
  }
  return out;
}

function rootScope(rootKey: string): ServerScope {
  if (SERVER_TOP_LEVEL.API.includes(rootKey)) return "API";
  if (SERVER_TOP_LEVEL.MCP.includes(rootKey)) return "MCP";
  if (SERVER_TOP_LEVEL.A2A.includes(rootKey)) return "A2A";
  if (SERVER_TOP_LEVEL.WebUI.includes(rootKey)) return "WebUI";
  return "shared";
}

function groupLabel(scope: ServerScope): string {
  return scope === "shared" ? "Shared" : scope;
}

function groupedConfig(config: Record<string, unknown>, tab: ServerTab): Record<string, unknown> {
  const grouped: Record<string, Record<string, unknown>> = {
    API: {},
    MCP: {},
    A2A: {},
    WebUI: {},
    Shared: {},
  };

  for (const [key, value] of Object.entries(config)) {
    const scope = rootScope(key);
    grouped[groupLabel(scope)][key] = value;
  }

  if (tab !== "all") {
    const label = SERVER_LABEL[tab];
    return { [label]: grouped[label] };
  }

  return {
    API: grouped.API,
    MCP: grouped.MCP,
    A2A: grouped.A2A,
    WebUI: grouped.WebUI,
    Shared: grouped.Shared,
  };
}

function groupPath(path: string): string {
  const root = path.split(/[.[\]]/, 1)[0] ?? path;
  return `${groupLabel(rootScope(root))}.${path}`;
}

function groupedSources(tab: ServerTab): JsonExplorerSourceMap {
  const out: Record<string, JsonExplorerSourceMap[string]> = {};
  for (const [path, meta] of Object.entries(SETTINGS_SOURCE_MAP)) {
    const groupedPath = groupPath(path);
    if (tab !== "all" && !groupedPath.startsWith(`${SERVER_LABEL[tab]}.`)) continue;
    out[groupedPath] = meta;
  }
  return out;
}

function maskedForExport(value: unknown, sourceMap: JsonExplorerSourceMap, path = ""): unknown {
  const meta = path ? sourceMap[path] : undefined;
  if (meta?.secret) return MASK_TOKEN;
  if (Array.isArray(value)) return value.map((item, index) => maskedForExport(item, sourceMap, `${path}[${index}]`));
  if (isRecord(value)) {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      out[key] = maskedForExport(item, sourceMap, path ? `${path}.${key}` : key);
    }
    return out;
  }
  return value;
}

function downloadJson(filename: string, value: unknown) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(href);
}

export function SettingsPage() {
  const cfg = useConfig<RuntimeConfig>();
  const app = useIndexRetrieverState();
  const { api } = app;
  const [activeServer, setActiveServer] = React.useState<ServerTab>("all");
  const [searchTerm, setSearchTerm] = React.useState("");
  const [runtimeConfig, setRuntimeConfig] = React.useState<Record<string, unknown>>({});
  const [healthOk, setHealthOk] = React.useState(false);
  const [status, setStatus] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    api.getHealth()
      .then((health) => setHealthOk(String((health as Record<string, unknown>).status) === "ok"))
      .catch(() => setHealthOk(false));
  }, [api]);

  React.useEffect(() => {
    api.getConfig()
      .then((config) => setRuntimeConfig(isRecord(config) ? config : {}))
      .catch(() => setRuntimeConfig({}));
  }, [api]);

  const effectiveConfig = React.useMemo(
    () => deepMergeDefaults(cloneRecord(SETTINGS_DEFAULT_CONFIG), runtimeConfig) as Record<string, unknown>,
    [runtimeConfig],
  );
  const activeConfig = React.useMemo(() => groupedConfig(effectiveConfig, activeServer), [activeServer, effectiveConfig]);
  const activeSources = React.useMemo(() => groupedSources(activeServer), [activeServer]);
  const serverTabs = React.useMemo<SettingsPanelServerTab[]>(
    () =>
      SERVER_TABS.map((tab) => ({
        id: tab,
        label: tab === "all" ? "ALL" : SERVER_LABEL[tab],
        data: groupedConfig(effectiveConfig, tab),
        sources: groupedSources(tab),
        description: "Index Retriever effective config",
      })),
    [effectiveConfig],
  );
  const secretPaths = React.useMemo(() => SETTINGS_SECRET_KEY_PATHS.map((path) => groupPath(path)), []);
  const visibleLeafCount = activeServer === "all" ? SETTINGS_INVENTORY.rendered_leaf_total : SETTINGS_LEAF_KEY_PATHS.filter((path) => groupPath(path).startsWith(`${SERVER_LABEL[activeServer]}.`)).length;
  const isAdmin = app.roles.includes("admin");

  const runHealthCheck = async () => {
    setError(null);
    setStatus("");
    try {
      const health = await api.getHealth();
      const ok = String((health as Record<string, unknown>).status) === "ok";
      setHealthOk(ok);
      setStatus(`Health check ${ok ? "passed" : "returned non-ok"}: ${(health as Record<string, unknown>).status ?? "unknown"}`);
      app.recordActivity("settings.health_check", ok ? "ok" : "error", String((health as Record<string, unknown>).status ?? "unknown"));
    } catch (healthError) {
      setHealthOk(false);
      const message = app.captureFailure(healthError);
      setError(message);
      app.recordActivity("settings.health_check", "error", message);
    }
  };

  const recordRevealAudit = () => {
    const actor = app.userId || "admin";
    const line = `AU-3 actor=${actor} action=settings.secret_reveal_toggle count=${secretPaths.length} result=recorded`;
    setStatus(line);
    app.recordActivity("settings.secret_reveal_toggle", "ok", line);
  };

  const exportEffectiveConfig = () => {
    downloadJson("index-retriever-effective-config.json", maskedForExport(activeConfig, activeSources));
    setStatus("Exported masked effective config.");
    app.recordActivity("settings.export_effective_config", "ok", activeServer);
  };

  return (
    <div className="space-y-6" data-testid="settings-page-root">
      <SettingsPanel
        title="Settings"
        serviceName="index-retriever"
        version={cfg.APP_VERSION ?? "dev"}
        description={`PS-73 effective configuration. ${visibleLeafCount} visible leaves, ${SETTINGS_INVENTORY.secret_total} secret leaves masked by default.`}
        statusItems={[
          { label: healthOk ? "health ok" : "health unknown", variant: healthOk ? "default" : "destructive" },
        ]}
        serverTabs={serverTabs}
        activeServerId={activeServer}
        onActiveServerChange={(serverId) => setActiveServer(serverId as ServerTab)}
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
        maxDepth={18}
        error={error}
        canRevealSecrets={isAdmin}
        onRevealSecrets={recordRevealAudit}
        revealSecretsLabel="Reveal audit"
        canExport={isAdmin}
        onExport={exportEffectiveConfig}
        onRefresh={() => void runHealthCheck()}
        footer={status ? (
          <p role="status" data-testid="settings-secret-reveal-audit" className="font-mono text-xs text-foreground/80">
            {status}
          </p>
        ) : null}
      />
    </div>
  );
}
