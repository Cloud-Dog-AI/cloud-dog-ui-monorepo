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

// PS-73 Settings (W28F-931 R5).
//
// Adds the explicit PS-73 panels the brief calls out:
//   - Renderer policy: live deep /health + capabilities, allowed / blocked
//   - Licence: matplotlib/vega-lite/great_tables enabled; plotly/kaleido blocked
//   - Locale + number/date format: persisted to localStorage via the
//     @cloud-dog/ui form components (no bespoke <input>).
//   - Cache mode: use_cache / refresh_if_stale / force_refresh / bypass_cache /
//     cache_only — persisted to localStorage (the operator's chosen render-cache
//     posture is sent on each subsequent render request via the existing
//     /api/render cache_mode parameter).
//
// Existing tabs (Effective Config / Sources / Dependency Health / Capabilities /
// Runtime) are preserved.

import * as React from "react";
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  Input,
  Label,
  Select,
  SettingsPanel,
  type SettingsPanelServerTab,
} from "@cloud-dog/ui";
import { useChartState } from "../state/AppState";
import { StatusLine, errMessage } from "../lib/ui";

const CACHE_MODES = [
  { value: "use_cache", label: "use_cache (default)" },
  { value: "refresh_if_stale", label: "refresh_if_stale" },
  { value: "force_refresh", label: "force_refresh" },
  { value: "bypass_cache", label: "bypass_cache" },
  { value: "cache_only", label: "cache_only" },
];

const LOCALES = [
  { value: "en-US", label: "English (US)" },
  { value: "en-GB", label: "English (UK)" },
  { value: "fr-FR", label: "Français (France)" },
  { value: "de-DE", label: "Deutsch (Deutschland)" },
  { value: "es-ES", label: "Español (España)" },
  { value: "ja-JP", label: "日本語 (日本)" },
];

const NUMBER_FORMATS = [
  { value: "decimal", label: "Decimal" },
  { value: "thousands", label: "Thousands grouped" },
  { value: "scientific", label: "Scientific" },
];

const DATE_FORMATS = [
  { value: "iso", label: "ISO 8601 (2026-06-15)" },
  { value: "long", label: "Long (June 15, 2026)" },
  { value: "short", label: "Short (06/15/26)" },
];

const PERSIST_KEY = "chart-mcp.settings.ps73";

type Persisted = {
  cacheMode: string;
  locale: string;
  numberFormat: string;
  dateFormat: string;
};

function loadPersisted(): Persisted {
  if (typeof window === "undefined") {
    return { cacheMode: "use_cache", locale: "en-US", numberFormat: "decimal", dateFormat: "iso" };
  }
  try {
    const raw = window.localStorage.getItem(PERSIST_KEY);
    if (raw) return { cacheMode: "use_cache", locale: "en-US", numberFormat: "decimal", dateFormat: "iso", ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { cacheMode: "use_cache", locale: "en-US", numberFormat: "decimal", dateFormat: "iso" };
}

function persist(value: Persisted) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(PERSIST_KEY, JSON.stringify(value)); } catch { /* ignore */ }
}

type Renderer = {
  renderer_id: string;
  enabled_by_default: boolean;
  licence: string;
  licence_class: string;
  supported_chart_types: string[];
  supported_output_formats: string[];
  requires_browser: boolean;
  requires_network: boolean;
  approved_for_offline: boolean;
};

function readRendererList(value: unknown): Renderer[] {
  if (!value || typeof value !== "object") return [];
  const renderers = (value as Record<string, unknown>).renderers as Record<string, unknown> | undefined;
  const registry = renderers && (renderers as Record<string, unknown>).registry;
  if (!Array.isArray(registry)) return [];
  return registry as Renderer[];
}

function readAllowedBlocked(value: unknown): { allowed: Record<string, unknown>; blocked: Record<string, unknown> } {
  if (!value || typeof value !== "object") return { allowed: {}, blocked: {} };
  const renderers = (value as Record<string, unknown>).renderers as Record<string, unknown> | undefined;
  return {
    allowed: (renderers && (renderers as Record<string, unknown>).allowed as Record<string, unknown>) || {},
    blocked: (renderers && (renderers as Record<string, unknown>).blocked as Record<string, unknown>) || {},
  };
}

export function SettingsPage() {
  const { api, apiBaseUrl, appVersion } = useChartState();
  const [config, setConfig] = React.useState<unknown>(null);
  const [sources, setSources] = React.useState<unknown>(null);
  const [capabilities, setCapabilities] = React.useState<unknown>(null);
  const [health, setHealth] = React.useState<unknown>(null);
  const [search, setSearch] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<string | null>(null);

  const [persistedState, setPersistedState] = React.useState<Persisted>(() => loadPersisted());

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cfg, src, caps, hp] = await Promise.all([
        api.config(),
        api.configSources(),
        api.capabilities(),
        api.health(),
      ]);
      setConfig(cfg);
      setSources(src);
      setCapabilities(caps);
      setHealth(hp);
    } catch (e) {
      setError(errMessage(e, "Failed to load settings."));
    } finally {
      setLoading(false);
    }
  }, [api]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const writePersisted = (next: Persisted) => {
    setPersistedState(next);
    persist(next);
    setStatus("Settings saved to browser storage.");
  };

  const runtime = { api_base_url: apiBaseUrl, app_version: appVersion, auth_mode: "cookie" };
  const renderers = readRendererList(capabilities);
  const { allowed, blocked } = readAllowedBlocked(capabilities);
  const effectiveData = React.useMemo(
    () => ({
      effective_config: config ?? {},
      sources: sources ?? {},
      dependency_health: health ?? {},
      capabilities: capabilities ?? {},
      runtime,
    }),
    [capabilities, config, health, runtime, sources],
  );
  const serverTabs = React.useMemo<SettingsPanelServerTab[]>(
    () => [
      { id: "all", label: "ALL", data: effectiveData },
      { id: "sources", label: "Sources", data: { sources: sources ?? {} } },
      { id: "api", label: "API", data: effectiveData },
      { id: "mcp", label: "MCP", data: effectiveData },
      { id: "a2a", label: "A2A", data: effectiveData },
      { id: "webui", label: "WebUI", data: effectiveData },
    ],
    [effectiveData, sources],
  );

  return (
    <div className="space-y-6">
      <SettingsPanel
        title="Settings"
        serviceName="chart-mcp"
        version={appVersion}
        description="Renderer policy, licence, locale, cache, configuration sources, dependency health, capabilities."
        serverTabs={serverTabs}
        searchTerm={search}
        onSearchTermChange={setSearch}
        loading={loading}
        error={error}
        onRefresh={() => {
          void load();
        }}
        footer={status ? <StatusLine loading={false} error={null} status={status} /> : null}
      >
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">Renderer Policy (PS-73)</h2>
              <p className="text-sm text-muted-foreground">
                Live registry of allowed and blocked rendering backends; sourced from the API capability surface.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold">Allowed</h3>
                <ul className="mt-2 space-y-1 text-sm" data-testid="settings-allowed-renderers">
                  {Object.entries(allowed).map(([name, info]) => (
                    <li key={name} className="flex items-center gap-2">
                      <Badge variant="secondary">{name}</Badge>
                      <span className="text-xs text-muted-foreground">{JSON.stringify(info)}</span>
                    </li>
                  ))}
                  {Object.keys(allowed).length === 0 ? <li className="text-xs text-muted-foreground">No allowed renderers.</li> : null}
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-semibold">Blocked</h3>
                <ul className="mt-2 space-y-1 text-sm" data-testid="settings-blocked-renderers">
                  {Object.entries(blocked).map(([name, reason]) => (
                    <li key={name} className="flex items-center gap-2">
                      <Badge variant="destructive">{name}</Badge>
                      <span className="text-xs text-muted-foreground">{String(reason)}</span>
                    </li>
                  ))}
                  {Object.keys(blocked).length === 0 ? <li className="text-xs text-muted-foreground">No blocked renderers.</li> : null}
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">Licence Status (PS-73)</h2>
              <p className="text-sm text-muted-foreground">
                Per-renderer licence + enablement, surfaced from the live capability registry. matplotlib / vega_lite /
                great_tables are permissive-licensed and enabled by policy; plotly / kaleido / browser-based renderers
                are blocked.
              </p>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm" data-testid="settings-licence-rows">
                {renderers.map((r) => (
                  <li key={r.renderer_id} className="flex flex-wrap items-center gap-2">
                    <Badge variant={r.enabled_by_default ? "secondary" : "default"}>{r.renderer_id}</Badge>
                    <span className="text-xs">{r.licence}</span>
                    <Badge variant="default">{r.licence_class}</Badge>
                    {r.requires_browser ? <Badge variant="destructive">requires browser</Badge> : null}
                    {r.requires_network ? <Badge variant="destructive">requires network</Badge> : null}
                    {r.approved_for_offline ? <Badge variant="secondary">offline-approved</Badge> : null}
                  </li>
                ))}
                {renderers.length === 0 ? <li className="text-xs text-muted-foreground">No registered renderers.</li> : null}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">Locale + Number/Date Format (PS-73)</h2>
              <p className="text-sm text-muted-foreground">
                Operator preferences persisted to browser storage; applied on subsequent renders via the locale + format
                parameters of /api/render.
              </p>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-3" data-testid="settings-locale-panel">
              <div className="space-y-1">
                <Label htmlFor="setting-locale">Locale</Label>
                <Select
                  id="setting-locale"
                  aria-label="Locale"
                  value={persistedState.locale}
                  onChange={(e) => writePersisted({ ...persistedState, locale: e.target.value })}
                >
                  {LOCALES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="setting-number-format">Number format</Label>
                <Select
                  id="setting-number-format"
                  aria-label="Number format"
                  value={persistedState.numberFormat}
                  onChange={(e) => writePersisted({ ...persistedState, numberFormat: e.target.value })}
                >
                  {NUMBER_FORMATS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="setting-date-format">Date format</Label>
                <Select
                  id="setting-date-format"
                  aria-label="Date format"
                  value={persistedState.dateFormat}
                  onChange={(e) => writePersisted({ ...persistedState, dateFormat: e.target.value })}
                >
                  {DATE_FORMATS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">Cache Mode (PS-73)</h2>
              <p className="text-sm text-muted-foreground">
                Picks the render-cache posture the WebUI sends as <code className="text-xs">cache_mode</code> on every
                subsequent /api/render request.
              </p>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2" data-testid="settings-cache-panel">
              <div className="space-y-1">
                <Label htmlFor="setting-cache-mode">Cache mode</Label>
                <Select
                  id="setting-cache-mode"
                  aria-label="Cache mode"
                  value={persistedState.cacheMode}
                  onChange={(e) => writePersisted({ ...persistedState, cacheMode: e.target.value })}
                >
                  {CACHE_MODES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="setting-cache-mode-display">Active mode</Label>
                <Input id="setting-cache-mode-display" aria-label="Active cache mode" value={persistedState.cacheMode} readOnly />
              </div>
            </CardContent>
          </Card>
      </SettingsPanel>
    </div>
  );
}
