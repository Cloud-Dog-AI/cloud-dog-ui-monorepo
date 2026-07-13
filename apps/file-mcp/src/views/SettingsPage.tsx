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

// @cloud-dog/app-file-mcp — Settings page (PS-73 v2 / W28A-799).
//
// Renders 100% of the effective configuration (every defaults.yaml key overlaid
// by config.yaml + env) via the PS-81 JsonExplorer widget, with per-leaf source
// attribution (SW8), secret masking (SW4), per-server segmentation (SW9),
// page-level search (SW11), and masked effective-config export (SW12).

import * as React from "react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  JsonBlock,
  SettingsPanel,
  type JsonExplorerSourceMap,
  type SettingsPanelServerTab,
} from "@cloud-dog/ui";
import type { EffectiveConfigResponse } from "../lib/types";
import { useFileMcpState } from "../state/AppState";

const SERVERS = ["all", "api", "mcp", "a2a", "webui"] as const;
type ServerTab = (typeof SERVERS)[number];

/** Recursively prune the effective config tree to a single server's leaves. */
function pruneForServer(
  value: unknown,
  sources: JsonExplorerSourceMap,
  server: ServerTab,
  path = ""
): unknown {
  if (server === "all") return value;
  const applies = (leafPath: string): boolean => {
    const meta = sources[leafPath];
    const servers = meta?.servers ?? ["shared"];
    return servers.includes(server) || servers.includes("shared");
  };
  if (Array.isArray(value)) {
    const kept = value
      .map((item, index) => pruneForServer(item, sources, server, `${path}[${index}]`))
      .filter((v) => v !== undefined);
    return kept.length > 0 ? kept : undefined;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      const childPath = path ? `${path}.${key}` : key;
      const pruned = pruneForServer(child, sources, server, childPath);
      if (pruned !== undefined) out[key] = pruned;
    }
    return Object.keys(out).length > 0 ? out : undefined;
  }
  return applies(path) ? value : undefined;
}

function downloadJson(filename: string, payload: unknown) {
  const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function SettingsPage() {
  const { api, adminToken } = useFileMcpState();
  const isAdmin = Boolean(adminToken && adminToken.trim());

  const [effective, setEffective] = React.useState<EffectiveConfigResponse | null>(null);
  const [revealedConfig, setRevealedConfig] = React.useState<unknown | null>(null);
  const [revealedPaths, setRevealedPaths] = React.useState<ReadonlySet<string>>(new Set());
  const [activeTab, setActiveTab] = React.useState<ServerTab>("all");
  const [search, setSearch] = React.useState("");
  const [healthData, setHealthData] = React.useState<Record<string, unknown> | null>(null);
  const [healthOk, setHealthOk] = React.useState(false);
  const [status, setStatus] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const loadedRef = React.useRef(false);
  const loadConfig = React.useCallback(async () => {
    try {
      const payload = await api.getEffectiveConfig();
      setEffective(payload);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load effective config.");
    }
  }, [api]);

  React.useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    void loadConfig();
  }, [loadConfig]);
  const sources = React.useMemo<JsonExplorerSourceMap>(
    () => (effective?.sources ?? {}) as JsonExplorerSourceMap,
    [effective]
  );
  const secretPaths = React.useMemo(
    () => Object.entries(sources).filter(([, m]) => m.secret).map(([p]) => p),
    [sources]
  );

  const baseConfig = revealedConfig ?? effective?.config ?? {};
  const serverTabs = React.useMemo<SettingsPanelServerTab[]>(
    () =>
      SERVERS.map((server) => ({
        id: server,
        label: server === "all" ? "ALL" : server.toUpperCase(),
        data: pruneForServer(baseConfig, sources, server) ?? {},
        sources,
        description: `Effective config - ${server.toUpperCase()}`,
      })),
    [baseConfig, sources],
  );

  const runHealthCheck = async () => {
    setError(null);
    try {
      const health = (await api.getHealth()) as unknown as Record<string, unknown>;
      setHealthData(health);
      setHealthOk(String(health.status ?? "").toLowerCase() === "ok");
      setStatus(`Health check passed (${health.status}).`);
    } catch (e) {
      setHealthData({ status: "error" });
      setHealthOk(false);
      setError(e instanceof Error ? e.message : "Health check failed.");
    }
  };

  // SW4B: admin-only reveal — explicit action, audit-logged server-side.
  const revealSecrets = async () => {
    if (!isAdmin) return;
    if (typeof window !== "undefined" && !window.confirm("Reveal masked secrets? This action is audit-logged.")) return;
    try {
      const payload = await api.getEffectiveConfig(true);
      setRevealedConfig(payload.config);
      setRevealedPaths(new Set(secretPaths));
      setStatus("Secrets revealed (ephemeral, audit-logged).");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reveal failed.");
    }
  };
  const hideSecrets = () => {
    setRevealedConfig(null);
    setRevealedPaths(new Set());
  };

  const exportConfig = () => {
    if (!isAdmin || !effective) return;
    downloadJson("file-mcp-effective-config.masked.json", effective.config);
    setStatus("Effective config exported (secrets masked).");
  };

  const counts = effective?.counts;

  return (
    <div className="space-y-6" data-testid="settings-page">
      <SettingsPanel
        title="Settings"
        serviceName="file-mcp"
        description="Effective configuration with source attribution and masked secrets."
        statusItems={counts ? [
          { label: "keys", value: counts.total_keys },
          { label: "secrets", value: counts.secret_keys },
        ] : undefined}
        serverTabs={serverTabs}
        activeServerId={activeTab}
        onActiveServerChange={(serverId) => setActiveTab(serverId as ServerTab)}
        searchTerm={search}
        onSearchTermChange={setSearch}
        revealedSecrets={revealedPaths}
        loading={!effective}
        error={error}
        canExport={isAdmin}
        onExport={exportConfig}
        canRefresh
        onRefresh={() => {
          void loadConfig();
        }}
        canRevealSecrets={isAdmin}
        secretsRevealed={revealedPaths.size > 0}
        onRevealSecrets={revealedPaths.size > 0 ? hideSecrets : () => void revealSecrets()}
        revealSecretsLabel="Reveal secrets"
        hideSecretsLabel="Hide secrets"
        footer={status ? <p role="status" className="text-sm text-foreground/80">{status}</p> : null}
      >

      {/* SW2.1 Service Info (shallow display — JsonBlock allowed by SW1) */}
      <Card>
        <CardHeader><h2 className="text-lg font-semibold">Service Info</h2></CardHeader>
        <CardContent>
          <JsonBlock
            title="Service Info"
            value={{ service: "file-mcp", ports: { api: 8060, web: 8061, mcp: 8062, a2a: 8063 }, status: "running" }}
            defaultCollapsed={false}
          />
        </CardContent>
      </Card>

      {/* SW2.7 Health */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">Health</h2>
            <Badge variant={healthOk ? "default" : "destructive"} className={healthOk ? "bg-emerald-600 text-white" : "text-white"}>
              {healthOk ? "ok" : "unknown"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <JsonBlock title="Health Status" value={healthData ?? { status: "not checked" }} defaultCollapsed={false} />
          <Button onClick={() => void runHealthCheck()} className="mt-2">Refresh</Button>
        </CardContent>
      </Card>
      </SettingsPanel>
    </div>
  );
}
