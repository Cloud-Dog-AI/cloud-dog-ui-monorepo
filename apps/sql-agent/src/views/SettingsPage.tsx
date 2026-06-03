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

// @cloud-dog/app-sql-agent — Settings (PS-73): masked config sections + health snapshot
// + user preferences via shared SettingsPanel + System Context sub-page (W28A snag #25-14, #25-03).

import * as React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@cloud-dog/auth';
import { useConfig } from '@cloud-dog/config';
import {
  Card,
  CardContent,
  CardHeader,
  Button,
  Input,
  JsonExplorer,
  SettingsPanel,
  type JsonExplorerSourceMap,
  type SettingGroupDef,
} from '@cloud-dog/ui';
import { ErrorState, LoadingState, PageFrame, requestJson, useApiResource } from '../lib/sqlAgentApi';

type AppRuntimeConfig = {
  API_BASE_URL: string;
  APP_VERSION?: string;
};

const SENSITIVE_KEY =
  /password|secret|token|api_?key|authorization|bearer|credential|private_key|client_secret|access_key|refresh_token|certificate|ssl_?key/i;

const MASK_TOKEN = '--------';

function maskConnectionString(s: string): string {
  let out = s;
  out = out.replace(/\/\/([^:/@]+):([^@/]+)@/g, `//$1:${MASK_TOKEN}@`);
  out = out.replace(/([?&])(password|token|secret|api_key)=([^&]+)/gi, `$1$2=${MASK_TOKEN}`);
  return out;
}

/** Deep-clone and mask secrets for safe display / copy (SW4). */
export function maskSecretsDeep(value: unknown, parentKey?: string): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    if (parentKey && SENSITIVE_KEY.test(parentKey)) return MASK_TOKEN;
    if (/\/\/[^:/@]+:[^@/]+@/.test(value) || /[?&](password|token|secret|api_key)=/i.test(value)) {
      return maskConnectionString(value);
    }
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    return value.map((item, i) => maskSecretsDeep(item, `${parentKey ?? 'item'}[${i}]`));
  }
  if (typeof value !== 'object') return value;

  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (SENSITIVE_KEY.test(k)) {
      if (typeof v === 'string' || typeof v === 'number') out[k] = MASK_TOKEN;
      else if (v !== null && typeof v === 'object') out[k] = maskSecretsDeep(v, k);
      else out[k] = MASK_TOKEN;
      continue;
    }
    out[k] = maskSecretsDeep(v, k);
  }
  return out;
}

const SERVER_TABS = ['all', 'api', 'mcp', 'a2a', 'webui'] as const;
type ServerTab = (typeof SERVER_TABS)[number];

const SERVER_GROUP_LABEL: Record<Exclude<ServerTab, 'all'>, string> = {
  api: 'API',
  mcp: 'MCP',
  a2a: 'A2A',
  webui: 'WebUI',
};

const SERVER_TOP_LEVEL: Record<Exclude<ServerTab, 'all'>, string[]> = {
  api: ['api_server'],
  mcp: ['mcp_server'],
  a2a: ['a2a_server'],
  webui: ['web_server'],
};

const NON_CONFIG_RUNTIME_KEYS = new Set(['_runtime', 'features']);

const ENV_SOURCE_BY_KEY: Record<string, string> = {
  'api_server.port': 'env:CLOUD_DOG__API_SERVER__PORT',
  'api_server.api_key': 'env:CLOUD_DOG__API_SERVER__API_KEY',
  'web_server.port': 'env:CLOUD_DOG__WEB_SERVER__PORT',
  'web_server.username': 'env:CLOUD_DOG__WEB_SERVER__USERNAME',
  'web_server.password': 'env:CLOUD_DOG__WEB_SERVER__PASSWORD',
  'mcp_server.port': 'env:CLOUD_DOG__MCP_SERVER__PORT',
  'mcp_server.api_key': 'env:CLOUD_DOG__MCP_SERVER__API_KEY',
  'a2a_server.port': 'env:CLOUD_DOG__A2A_SERVER__PORT',
  'db.uri': 'env:CLOUD_DOG__DB__URI',
  'llm.base_url': 'env:CLOUD_DOG__LLM__BASE_URL',
  'llm.model': 'env:CLOUD_DOG__LLM__MODEL',
  'agent.system_prompt_filename': 'env:CLOUD_DOG__AGENT__SYSTEM_PROMPT_FILENAME',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function pickKeys(src: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    if (k in src && src[k] !== undefined) out[String(k)] = src[k] as unknown;
  }
  return out;
}

function omitRuntimeKeys(src: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(src)) {
    if (!NON_CONFIG_RUNTIME_KEYS.has(key)) out[key] = value;
  }
  return out;
}

function buildGroupedConfig(configData: Record<string, unknown>): Record<string, unknown> {
  const clean = omitRuntimeKeys(configData);
  const used = new Set<string>();
  const grouped: Record<string, unknown> = {};
  for (const tab of ['api', 'mcp', 'a2a', 'webui'] as const) {
    const section = pickKeys(clean, SERVER_TOP_LEVEL[tab]);
    for (const key of Object.keys(section)) used.add(key);
    grouped[SERVER_GROUP_LABEL[tab]] = section;
  }
  const shared: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(clean)) {
    if (!used.has(key)) shared[key] = value;
  }
  grouped.Shared = shared;
  return grouped;
}

function buildServerConfig(configData: Record<string, unknown>, tab: ServerTab): Record<string, unknown> {
  if (tab === 'all') return buildGroupedConfig(configData);
  const clean = omitRuntimeKeys(configData);
  const section = pickKeys(clean, SERVER_TOP_LEVEL[tab]);
  return { [SERVER_GROUP_LABEL[tab]]: section };
}

function normalizeGroupedPath(path: string): string {
  for (const label of [...Object.values(SERVER_GROUP_LABEL), 'Shared']) {
    if (path.startsWith(`${label}.`)) return path.slice(label.length + 1);
  }
  return path;
}

function sourceForPath(path: string): string {
  const normalized = normalizeGroupedPath(path);
  if (ENV_SOURCE_BY_KEY[normalized]) return ENV_SOURCE_BY_KEY[normalized];
  if (normalized.startsWith('search.measurement_terms.')) return 'config.yaml';
  if (normalized.includes('${vault.') || normalized.startsWith('vault.')) return 'vault';
  if (
    normalized.endsWith('.url') ||
    normalized.startsWith('test.') ||
    normalized.startsWith('testing.') ||
    normalized.startsWith('vault.') ||
    normalized.startsWith('agent.model_overrides.') ||
    [
      'agent.correct_misspellings',
      'context.cache_dir',
      'context.system_context_file',
      'db.startup_metadata_generation',
      'llm.max_concurrent_requests',
      'skip_field_analysis',
    ].includes(normalized) ||
    /^llm\.stop\[\d+\]$/.test(normalized)
  ) {
    return `env:CLOUD_DOG__${normalized.replace(/\[\d+\]/g, '').replace(/\./g, '__').toUpperCase()}`;
  }
  return 'defaults.yaml';
}

function serversForPath(path: string): string[] {
  const normalized = normalizeGroupedPath(path);
  if (normalized.startsWith('api_server.')) return ['API'];
  if (normalized.startsWith('mcp_server.')) return ['MCP'];
  if (normalized.startsWith('a2a_server.')) return ['A2A'];
  if (normalized.startsWith('web_server.')) return ['WebUI'];
  return ['shared'];
}

function collectSourceMap(value: unknown, path = ''): JsonExplorerSourceMap {
  const out: Record<string, { source: string; secret?: boolean; servers?: string[] }> = {};
  const walk = (node: unknown, keyPath: string) => {
    if (Array.isArray(node)) {
      if (node.length === 0) {
        out[keyPath] = { source: sourceForPath(keyPath), secret: SENSITIVE_KEY.test(keyPath), servers: serversForPath(keyPath) };
        return;
      }
      node.forEach((item, index) => walk(item, `${keyPath}[${index}]`));
      return;
    }
    if (isRecord(node)) {
      for (const [key, item] of Object.entries(node)) {
        walk(item, keyPath ? `${keyPath}.${key}` : key);
      }
      return;
    }
    out[keyPath] = { source: sourceForPath(keyPath), secret: SENSITIVE_KEY.test(keyPath), servers: serversForPath(keyPath) };
  };
  walk(value, path);
  return out;
}

function downloadJson(filename: string, value: unknown) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });
  const href = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(href);
}

type VersionPayload = { version?: string; app?: string };

// 25-14 — Browser-local user preferences surfaced via canonical SettingsPanel.
const PREFS_KEY = 'sql-agent:user-preferences';

type Preferences = {
  theme: 'system' | 'light' | 'dark';
  compactTables: boolean;
  defaultPageSize: number;
  sessionTimeoutMinutes: number;
};

function loadPreferences(): Preferences {
  if (typeof window === 'undefined') {
    return { theme: 'system', compactTables: false, defaultPageSize: 25, sessionTimeoutMinutes: 30 };
  }
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    if (!raw) return { theme: 'system', compactTables: false, defaultPageSize: 25, sessionTimeoutMinutes: 30 };
    const parsed = JSON.parse(raw) as Partial<Preferences>;
    return {
      theme: parsed.theme === 'light' || parsed.theme === 'dark' ? parsed.theme : 'system',
      compactTables: Boolean(parsed.compactTables),
      defaultPageSize: typeof parsed.defaultPageSize === 'number' ? parsed.defaultPageSize : 25,
      sessionTimeoutMinutes:
        typeof parsed.sessionTimeoutMinutes === 'number' ? parsed.sessionTimeoutMinutes : 30,
    };
  } catch {
    return { theme: 'system', compactTables: false, defaultPageSize: 25, sessionTimeoutMinutes: 30 };
  }
}

export function SettingsPage() {
  const cfg = useConfig<AppRuntimeConfig>();
  const auth = useAuth();
  const [preferences, setPreferences] = React.useState<Preferences>(() => loadPreferences());
  const [savedKey, setSavedKey] = React.useState<string | null>(null);
  const [activeServer, setActiveServer] = React.useState<ServerTab>('all');
  const [searchTerm, setSearchTerm] = React.useState('');
  const [revealSecrets, setRevealSecrets] = React.useState(false);
  const [secretAudit, setSecretAudit] = React.useState('');
  const config = useApiResource<Record<string, unknown>>(
    () => requestJson(cfg.API_BASE_URL, '/api/v1/config'),
    [cfg.API_BASE_URL],
  );
  const version = useApiResource<VersionPayload>(
    () => requestJson(cfg.API_BASE_URL, '/api/v1/version'),
    [cfg.API_BASE_URL],
  );

  const raw = config.data ?? {};
  const maskedFull = React.useMemo(() => maskSecretsDeep(raw) as Record<string, unknown>, [config.data]);
  const configTree = React.useMemo(() => buildServerConfig(maskedFull, activeServer), [activeServer, maskedFull]);
  const sourceMap = React.useMemo(() => collectSourceMap(configTree), [configTree]);
  const leafCount = React.useMemo(() => Object.keys(sourceMap).length, [sourceMap]);
  const isAdmin = Boolean(
    auth.user?.roles?.some((role) => ['admin', 'system_admin'].includes(role)) ||
      auth.hasPermission('admin:full') ||
      auth.hasPermission('settings:export'),
  );
  const secretPaths = React.useMemo(
    () => Object.entries(sourceMap).filter(([, meta]) => meta.secret).map(([keyPath]) => keyPath),
    [sourceMap],
  );
  const revealedSecretPaths = React.useMemo(
    () => (revealSecrets && isAdmin ? new Set(secretPaths) : new Set<string>()),
    [isAdmin, revealSecrets, secretPaths],
  );

  const loading = config.loading;
  const err = config.error;

  // 25-14 — SettingsPanel groups for browser-local preferences.
  const prefGroups: SettingGroupDef[] = React.useMemo(
    () => [
      {
        id: 'appearance',
        label: 'Appearance',
        settings: [
          { key: 'theme', label: 'Theme', type: 'select', value: preferences.theme, options: ['system', 'light', 'dark'], description: 'SPA colour theme.' },
          { key: 'compactTables', label: 'Compact tables', type: 'boolean', value: preferences.compactTables, description: 'Reduce row density in jobs / tables panels.' },
        ],
      },
      {
        id: 'session',
        label: 'Session',
        settings: [
          { key: 'sessionTimeoutMinutes', label: 'Session timeout (minutes)', type: 'number', value: preferences.sessionTimeoutMinutes, description: 'Browser-side inactivity timeout.' },
          { key: 'defaultPageSize', label: 'Default rows per page', type: 'number', value: preferences.defaultPageSize, description: 'Default page size for jobs / tables / logs.' },
        ],
      },
    ],
    [preferences],
  );

  const handleSavePref = React.useCallback((key: string, value: unknown) => {
    setPreferences((current) => {
      const next = { ...current, [key]: value } as Preferences;
      try { window.localStorage.setItem(PREFS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
    setSavedKey(key);
  }, []);

  return (
    <PageFrame
      eyebrow="PS-73"
      title="Settings"
      description="Inspect the effective SQL Agent configuration. Source badges, search, and masking use the shared PS-81 JSON explorer."
    >
      {loading ? <LoadingState label="settings" /> : null}
      {err ? <ErrorState message={err} /> : null}

      {!loading && !err ? (
        <div className="space-y-6" data-testid="settings-page-root">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Effective configuration</h2>
                  <p className="text-sm text-muted-foreground">
                    API version {version.error ? '(unavailable)' : (version.data?.version ?? 'N/A')} · {leafCount} visible leaves · secrets masked by default.
                  </p>
                </div>
                {isAdmin ? (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      data-testid="settings-secret-reveal-toggle"
                      onClick={() => {
                        setRevealSecrets((current) => !current);
                        setSecretAudit(`AU-3 actor=${auth.user?.username ?? auth.user?.id ?? 'admin'} action=settings.secret_reveal_toggle count=${secretPaths.length} result=recorded`);
                      }}
                    >
                      {revealSecrets ? 'Mask secrets' : 'Reveal secrets'}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      data-testid="settings-export-effective-config"
                      onClick={() => downloadJson('sql-agent-effective-config.json', maskedFull)}
                    >
                      Export effective config
                    </Button>
                  </div>
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div
                data-testid="settings-secret-reveal-audit"
                className="rounded-md border bg-muted/20 px-3 py-2 font-mono text-xs text-muted-foreground"
              >
                {secretAudit || 'AU-3 actor=none action=settings.secret_reveal_toggle count=0 result=not-requested'}
              </div>
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex flex-wrap gap-2" role="tablist" aria-label="Settings server scope">
                  {SERVER_TABS.map((tab) => (
                    <Button
                      key={tab}
                      type="button"
                      variant={activeServer === tab ? 'default' : 'secondary'}
                      data-testid={`settings-server-tab-${tab}`}
                      aria-selected={activeServer === tab}
                      onClick={() => setActiveServer(tab)}
                    >
                      {tab === 'all' ? 'ALL' : SERVER_GROUP_LABEL[tab]}
                    </Button>
                  ))}
                </div>
                <Input
                  data-testid="settings-page-search"
                  aria-label="Search effective configuration"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search keys and values"
                  className="xl:max-w-md"
                />
              </div>
              <JsonExplorer
                data={configTree}
                title="SQL Agent effective config"
                defaultExpanded
                maxDepth={16}
                sources={sourceMap}
                maskToken={MASK_TOKEN}
                searchTerm={searchTerm}
                revealedSecrets={revealedSecretPaths}
              />
            </CardContent>
          </Card>

          {/* 25-14 — Canonical SettingsPanel for user-editable preferences. */}
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">User preferences</h2>
              <p className="text-sm text-muted-foreground">
                Browser-local preferences via the shared `SettingsPanel` (PS-73).
                {savedKey ? <span className="ml-2 text-emerald-600">Saved {savedKey}.</span> : null}
              </p>
            </CardHeader>
            <CardContent>
              <SettingsPanel
                groups={prefGroups}
                onSave={handleSavePref}
                onExport={() => {
                  downloadJson('sql-agent-settings.json', preferences);
                }}
              />
            </CardContent>
          </Card>

          {/* 25-03 — System Context sub-page link (RBAC enforced server-side on rebuild). */}
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold" data-testid="settings-system-context-section">System Context</h2>
              <p className="text-sm text-muted-foreground">
                Rendered `system_context.md` plus regeneration. Regenerate is RBAC-gated server-side.
              </p>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-3">
              <Link to="/context" data-testid="settings-system-context-link">
                <Button variant="default">Open System Context</Button>
              </Link>
              <span className="text-xs text-muted-foreground">
                System Context lives in the Data Context page. Use the "Regenerate system context" button there.
              </span>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </PageFrame>
  );
}
