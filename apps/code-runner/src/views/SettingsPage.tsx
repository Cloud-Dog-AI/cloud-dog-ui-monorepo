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

// PS-73 v2 Settings Page — code-runner implementation (W28A-803).
//
// Renders 100% of the effective global config across all four servers
// (API / MCP / A2A / WebUI) using the PS-81 JsonExplorer widget, with per-leaf
// source attribution (default/config/env/vault), secrets masked by default,
// per-server segmentation tabs, page-level search, and an admin-only
// effective-config export. Source attribution + secret flags + server scope
// come from the backend GET /v1/config/sources endpoint (no provenance is
// guessed in the browser).

import * as React from "react";
import { Badge, Button, Card, CardContent, CardHeader, SettingsPanel } from "@cloud-dog/ui";
import type { JsonExplorerSourceMap, SettingsPanelServerTab } from "@cloud-dog/ui";
import { useCodeRunnerState } from "../state/AppState";
import type { ConfigSourceMeta } from "../lib/api";

/** PS-73 v2 SW9 server tabs for code-runner (API + MCP + A2A + WebUI). */
const SERVER_TABS = [
  { id: "all", label: "ALL" },
  { id: "api", label: "API" },
  { id: "mcp", label: "MCP" },
  { id: "a2a", label: "A2A" },
  { id: "webui", label: "WebUI" },
] as const;

type ServerTab = (typeof SERVER_TABS)[number]["id"];

/** Top-level namespace -> owning server(s). Mirrors src/common/config_provenance.py. */
const SERVER_NAMESPACES: Record<string, ServerTab[]> = {
  api_server: ["api"],
  mcp_server: ["mcp"],
  a2a_server: ["a2a"],
  web_server: ["webui"],
  web_login: ["webui"],
};

function scopeOfTopKey(topKey: string): ServerTab[] {
  return SERVER_NAMESPACES[topKey] ?? ["api", "mcp", "a2a", "webui"];
}

/** Keep only the top-level config sections that belong to the selected server. */
function filterByServer(config: Record<string, unknown>, server: ServerTab): Record<string, unknown> {
  if (server === "all") {
    return config;
  }
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(config)) {
    if (scopeOfTopKey(key).includes(server)) {
      out[key] = value;
    }
  }
  return out;
}

/** Redact secret leaves for the masked effective-config export (PS-73 v2 SW12). */
function redactForExport(value: unknown, sources: JsonExplorerSourceMap, path: string): unknown {
  if (Array.isArray(value)) {
    return value.map((item, index) => redactForExport(item, sources, `${path}[${index}]`));
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      out[key] = redactForExport(child, sources, path ? `${path}.${key}` : key);
    }
    return out;
  }
  return sources[path]?.secret ? "--------" : value;
}

function listSecretPaths(sources: JsonExplorerSourceMap): string[] {
  return Object.entries(sources)
    .filter(([, meta]) => meta.secret)
    .map(([path]) => path);
}

export function SettingsPage() {
  const { api, apiBaseUrl, appVersion } = useCodeRunnerState();
  const [config, setConfig] = React.useState<Record<string, unknown>>({});
  const [sources, setSources] = React.useState<JsonExplorerSourceMap>({});
  const [counts, setCounts] = React.useState<Record<string, unknown>>({});
  const [isAdmin, setIsAdmin] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<ServerTab>("all");
  const [search, setSearch] = React.useState("");
  const [revealed, setRevealed] = React.useState<ReadonlySet<string>>(new Set());
  const [confirmReveal, setConfirmReveal] = React.useState(false);
  const [status, setStatus] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [healthOk, setHealthOk] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    api.getConfig().then(setConfig).catch(() => setConfig({}));
    api
      .getConfigSources()
      .then((res) => {
        setSources((res.sources ?? {}) as JsonExplorerSourceMap);
        setCounts(res.counts ?? {});
      })
      .catch(() => {
        setSources({});
        setCounts({});
      });
    api
      .currentPrincipal()
      .then((p) => setIsAdmin((p.roles ?? []).includes("admin") || (p.permissions ?? []).includes("*")))
      .catch(() => setIsAdmin(false));
  }, [api]);

  const totalKeys = typeof counts.total === "number" ? (counts.total as number) : Object.keys(sources).length;
  const secretCount = typeof counts.secret === "number" ? (counts.secret as number) : listSecretPaths(sources).length;
  const serverTabs = React.useMemo<SettingsPanelServerTab[]>(
    () =>
      SERVER_TABS.map((server) => ({
        id: server.id,
        label: server.label,
        data: filterByServer(config, server.id),
        sources,
        description: "Effective configuration",
      })),
    [config, sources],
  );

  const onRevealConfirm = async () => {
    setConfirmReveal(false);
    try {
      // PS-73 v2 SW4B / PS-40: admin reveal is audited server-side before display.
      await api.auditSettingsReveal();
      setRevealed(new Set(listSecretPaths(sources)));
      setStatus("Secrets revealed (audited). Reveal is ephemeral — reload to re-mask.");
    } catch (revealError) {
      setError(revealError instanceof Error ? revealError.message : "Reveal failed.");
    }
  };

  const onHide = () => {
    setRevealed(new Set());
    setStatus("Secrets re-masked.");
  };

  const onExport = () => {
    const masked = redactForExport(config, sources, "");
    const blob = new Blob([JSON.stringify(masked, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "code-runner-effective-config.json";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    setStatus("Effective config exported (secrets masked).");
  };

  const runHealth = async () => {
    setError(null);
    try {
      const ping = await api.ping();
      setHealthOk(true);
      setStatus(`Ping OK: ${(ping as unknown as Record<string, unknown>).service ?? "code-runner-server"}`);
    } catch (healthError) {
      setHealthOk(false);
      setError(healthError instanceof Error ? healthError.message : "Health check failed.");
    }
  };

  return (
    <div className="space-y-6" data-testid="settings-page">
      <SettingsPanel
        title="Settings"
        serviceName="code-runner-server"
        version={appVersion}
        description={`Effective configuration across all servers. API base: ${apiBaseUrl}`}
        statusItems={[
          { label: "connected", variant: "default" },
          { label: "keys", value: totalKeys, testId: "settings-key-count" },
          { label: "secrets", value: secretCount },
        ]}
        serverTabs={serverTabs}
        activeServerId={activeTab}
        onActiveServerChange={(serverId) => setActiveTab(serverId as ServerTab)}
        searchTerm={search}
        onSearchTermChange={setSearch}
        revealedSecrets={revealed}
        maxDepth={20}
        error={error}
        canRevealSecrets={isAdmin}
        secretsRevealed={revealed.size > 0}
        onRevealSecrets={revealed.size > 0 ? onHide : () => setConfirmReveal(true)}
        revealSecretsLabel="Reveal secrets"
        hideSecretsLabel="Hide secrets"
        canExport={isAdmin}
        onExport={onExport}
        confirmRevealOpen={confirmReveal}
        onConfirmReveal={() => void onRevealConfirm()}
        onCancelReveal={() => setConfirmReveal(false)}
        footer={status ? <p role="status" className="text-sm text-foreground/80">{status}</p> : null}
      >
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">Health</h2>
              <Badge variant={healthOk ? "default" : "destructive"}>
                {healthOk === null ? "unknown" : healthOk ? "ok" : "error"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <Button onClick={() => void runHealth()}>Run ping</Button>
          </CardContent>
        </Card>
      </SettingsPanel>
    </div>
  );
}
