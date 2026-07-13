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

// PS-73 v2 Settings Page — chat-client implementation (W28A-798).
//
// Renders 100% of the effective global config across all four servers
// (API / MCP / A2A / WebUI) using the PS-81 JsonExplorer widget, with per-leaf
// source attribution (default/config/env/vault), secrets masked by default,
// per-server segmentation tabs, page-level search, and an operator-only masked
// effective-config export + audited reveal. Source attribution + secret flags +
// server scope come from GET /ui/config/sources (no provenance guessed in the
// browser). Operator preferences (theme/notifications/model) are preserved.

import * as React from "react";
import { useTheme } from "@cloud-dog/shell";
import { Badge, Card, CardContent, CardHeader, JsonBlock, SettingsPanel } from "@cloud-dog/ui";
import type { JsonExplorerSourceMap, SettingGroupDef, SettingsPanelServerTab } from "@cloud-dog/ui";
import { useAppState } from "../state/AppState";

const SERVER_TABS = [
  { id: "all", label: "ALL" },
  { id: "api", label: "API" },
  { id: "mcp", label: "MCP" },
  { id: "a2a", label: "A2A" },
  { id: "webui", label: "WebUI" },
] as const;
type ServerTab = (typeof SERVER_TABS)[number]["id"];

/** Top-level namespace -> owning server(s). Mirrors config/provenance.py. */
const SERVER_NAMESPACES: Record<string, ServerTab[]> = {
  api_server: ["api"],
  client_api: ["api"],
  mcp_server: ["mcp"],
  mcp: ["mcp"],
  a2a_server: ["a2a"],
  web_server: ["webui"],
  web_login: ["webui"],
};
function scopeOfTopKey(topKey: string): ServerTab[] {
  return SERVER_NAMESPACES[topKey] ?? ["api", "mcp", "a2a", "webui"];
}
function filterByServer(config: Record<string, unknown>, server: ServerTab): Record<string, unknown> {
  if (server === "all") return config;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(config)) {
    if (scopeOfTopKey(key).includes(server)) out[key] = value;
  }
  return out;
}
function redactForExport(value: unknown, sources: JsonExplorerSourceMap, path: string): unknown {
  if (Array.isArray(value)) return value.map((item, i) => redactForExport(item, sources, `${path}[${i}]`));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, child] of Object.entries(value as Record<string, unknown>)) {
      out[k] = redactForExport(child, sources, path ? `${path}.${k}` : k);
    }
    return out;
  }
  return sources[path]?.secret ? "--------" : value;
}
function listSecretPaths(sources: JsonExplorerSourceMap): string[] {
  return Object.entries(sources).filter(([, m]) => m.secret).map(([p]) => p);
}

const NOTIFICATION_PREF_KEY = "chat-client.notifications.enabled";
const MODEL_PREF_KEY = "chat-client.default-model";
const THEME_PREF_KEY = "cloud-dog.shell.theme";
function getSavedBoolean(key: string, def: boolean): boolean {
  try { const raw = localStorage.getItem(key); return raw == null ? def : raw === "1"; } catch { return def; }
}
function getSavedString(key: string, def: string): string {
  try { return localStorage.getItem(key) ?? def; } catch { return def; }
}

export function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { api, uiConfig, apiKeyHeader } = useAppState();

  const [effectiveConfig, setEffectiveConfig] = React.useState<Record<string, unknown>>({});
  const [sources, setSources] = React.useState<JsonExplorerSourceMap>({});
  const [counts, setCounts] = React.useState<Record<string, unknown>>({});
  const [activeTab, setActiveTab] = React.useState<ServerTab>("all");
  const [search, setSearch] = React.useState("");
  const [revealed, setRevealed] = React.useState<ReadonlySet<string>>(new Set());
  const [confirmReveal, setConfirmReveal] = React.useState(false);
  const [status, setStatus] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const [notificationsEnabled, setNotificationsEnabled] = React.useState<boolean>(() => getSavedBoolean(NOTIFICATION_PREF_KEY, true));
  const [defaultModel, setDefaultModel] = React.useState<string>(() => getSavedString(MODEL_PREF_KEY, String(uiConfig?.llm?.model ?? "")));

  const loadGlobalConfig = React.useCallback(async () => {
    setError(null);
    try {
      const [tree, src] = await Promise.all([api.getUiConfigTree(), api.getUiConfigSources()]);
      setEffectiveConfig((tree.config ?? {}) as Record<string, unknown>);
      setSources((src.sources ?? {}) as JsonExplorerSourceMap);
      setCounts(src.counts ?? {});
      setStatus("Loaded global config tree (secrets masked)");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load global config");
    }
  }, [api]);

  React.useEffect(() => { void loadGlobalConfig(); }, [loadGlobalConfig]);
  React.useEffect(() => {
    const saved = getSavedString(THEME_PREF_KEY, theme);
    if (saved === "dark" || saved === "light") setTheme(saved);
  }, [setTheme, theme]);

  const totalKeys = typeof counts.total === "number" ? (counts.total as number) : Object.keys(sources).length;
  const secretCount = typeof counts.secret === "number" ? (counts.secret as number) : listSecretPaths(sources).length;
  const serverTabs = React.useMemo<SettingsPanelServerTab[]>(
    () =>
      SERVER_TABS.map((server) => ({
        id: server.id,
        label: server.label,
        data: filterByServer(effectiveConfig, server.id),
        sources,
        description: "Config tree",
      })),
    [effectiveConfig, sources],
  );

  const onRevealConfirm = async () => {
    setConfirmReveal(false);
    try {
      await api.auditSettingsReveal();
      setRevealed(new Set(listSecretPaths(sources)));
      setStatus("Secrets revealed (audited). Reveal is ephemeral — reload to re-mask.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reveal failed");
    }
  };
  const onExport = () => {
    const masked = redactForExport(effectiveConfig, sources, "");
    const blob = new Blob([JSON.stringify(masked, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "chat-client-effective-config.json";
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    setStatus("Effective config exported (secrets masked)");
  };

  const onSavePref = (key: string, value: unknown) => {
    if (key === "chat.default_model") { const v = String(value ?? ""); setDefaultModel(v); try { localStorage.setItem(MODEL_PREF_KEY, v); } catch { /* ignore */ } }
    if (key === "ui.notifications") { const v = Boolean(value); setNotificationsEnabled(v); try { localStorage.setItem(NOTIFICATION_PREF_KEY, v ? "1" : "0"); } catch { /* ignore */ } }
    if (key === "ui.theme") { const v = String(value) === "dark" ? "dark" : "light"; setTheme(v); try { localStorage.setItem(THEME_PREF_KEY, v); } catch { /* ignore */ } }
    setStatus(`Saved ${key}`);
  };

  const prefGroups: SettingGroupDef[] = [
    { id: "preferences", label: "Operator preferences", settings: [
      { key: "chat.default_model", label: "Default model", type: "text", value: defaultModel, description: "Persisted locally for the operator UI." },
      { key: "ui.notifications", label: "Notifications", type: "boolean", value: notificationsEnabled, description: "Enable non-blocking status updates." },
      { key: "ui.theme", label: "Theme", type: "select", value: theme, options: ["light", "dark"], description: "Theme preference persisted across reloads." },
    ] },
  ];

  return (
    <div className="space-y-4" data-testid="settings-page">
      <SettingsPanel
        title="Settings"
        serviceName="chat-client"
        description={`Effective global configuration across all servers. API key header: ${apiKeyHeader}`}
        statusItems={[
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
        groups={prefGroups}
        onSave={onSavePref}
        onRefresh={() => void loadGlobalConfig()}
        onExport={onExport}
        secretsRevealed={revealed.size > 0}
        onRevealSecrets={revealed.size > 0 ? () => { setRevealed(new Set()); setStatus("Secrets re-masked."); } : () => setConfirmReveal(true)}
        revealSecretsLabel="Reveal secrets"
        hideSecretsLabel="Hide secrets"
        confirmRevealOpen={confirmReveal}
        onConfirmReveal={() => void onRevealConfirm()}
        onCancelReveal={() => setConfirmReveal(false)}
        footer={status ? <p role="status" className="text-sm text-emerald-700">{status}</p> : null}
      >

      {/* Health. */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Health <Badge variant="default">connected</Badge></h2>
        </CardHeader>
        <CardContent>
          <JsonBlock
            title="Service health"
            value={{ service: "chat-client", version: uiConfig?.version ?? "unknown", environment: uiConfig?.env ?? "unknown" }}
            defaultCollapsed={false}
          />
        </CardContent>
      </Card>
      </SettingsPanel>
    </div>
  );
}
