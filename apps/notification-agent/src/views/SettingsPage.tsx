// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// @cloud-dog/app-notification-agent — Runtime settings view (PS-73).
// Covers: UI-R5

import * as React from 'react';
import { Button, Card, CardContent, CardHeader, Badge, Input, JsonExplorer, Label, RelativeTime, Select, SettingsPanel } from '@cloud-dog/ui';
import { useConfig } from '@cloud-dog/config';
import type { JsonExplorerSourceMap, SettingsPanelServerTab } from '@cloud-dog/ui';
import { useNotificationAgentState } from '../state/AppState';
import type { RuntimeHealth } from '../lib/api';
import {
  SETTINGS_INVENTORY_KEYS,
  SETTINGS_SECRET_KEYS,
  SETTINGS_SERVER_TABS,
  SETTINGS_SOURCE_MAP,
  type SettingsServerTab,
} from './settingsInventory';

// PS-73 SW4 — Secrets masking
const SECRET_PATTERNS = /password|secret|token|api_key|credential|private_key/i;

function maskSecrets(obj: unknown, depth = 0): unknown {
  if (depth > 10) return obj;
  if (typeof obj === 'string') return obj;
  if (Array.isArray(obj)) return obj.map((item) => maskSecrets(item, depth + 1));
  if (obj && typeof obj === 'object') {
    const masked: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (SECRET_PATTERNS.test(key) && typeof value === 'string' && value.length > 0) {
        masked[key] = '****';
      } else {
        masked[key] = maskSecrets(value, depth + 1);
      }
    }
    return masked;
  }
  return obj;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function pickSection(source: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  const section: Record<string, unknown> = {};
  for (const key of keys) {
    const value = source[key];
    if (value !== undefined) section[key] = value;
  }
  return section;
}

function pathParts(path: string): string[] {
  return path.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean);
}

function getPathValue(source: unknown, path: string): unknown {
  let current = source;
  for (const part of pathParts(path)) {
    if (current == null) return null;
    if (Array.isArray(current)) {
      current = current[Number(part)];
    } else if (typeof current === 'object') {
      current = (current as Record<string, unknown>)[part];
    } else {
      return null;
    }
  }
  return current ?? null;
}

function setPathValue(target: Record<string, unknown>, path: string, value: unknown): void {
  const parts = pathParts(path);
  let current: Record<string, unknown> = target;
  parts.forEach((part, index) => {
    const last = index === parts.length - 1;
    if (last) {
      current[part] = value;
      return;
    }
    const next = current[part];
    if (!next || typeof next !== 'object' || Array.isArray(next)) {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  });
}

function buildInventoryTree(configDump: Record<string, unknown>, tab: SettingsServerTab): Record<string, unknown> {
  const tree: Record<string, unknown> = {};
  for (const key of SETTINGS_INVENTORY_KEYS) {
    const meta = SETTINGS_SOURCE_MAP[key];
    const servers = meta?.servers ?? ['shared'];
    const include = tab === 'ALL' || servers.includes(tab) || servers.includes('shared');
    if (include) {
      setPathValue(tree, key, getPathValue(configDump, key));
    }
  }
  return tree;
}

function buildTabSourceMap(tab: SettingsServerTab): JsonExplorerSourceMap {
  if (tab === 'ALL') return SETTINGS_SOURCE_MAP;
  const scoped = Object.entries(SETTINGS_SOURCE_MAP).filter(([, meta]) => {
    const servers = meta.servers ?? ['shared'];
    return servers.includes(tab) || servers.includes('shared');
  });
  return Object.fromEntries(scoped) as JsonExplorerSourceMap;
}

function downloadJson(filename: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

type RuntimeConfig = Readonly<{
  ENV: string;
  API_BASE_URL: string;
  MCP_BASE_URL?: string;
  A2A_BASE_URL?: string;
  AUTH_MODE?: string;
  DB_BACKEND?: string;
  DB_PATH?: string;
}>;

const importMetaEnv = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
const UI_BUILD_VERSION = importMetaEnv.VITE_APP_VERSION
  ?? importMetaEnv.VITE_GIT_SHA
  ?? 'notification-webui-2026.05.28';

function displayVersion(version: string | null | undefined): string {
  const value = String(version ?? '').trim();
  if (!value || value === '0.1.0') return UI_BUILD_VERSION;
  return value;
}

function healthStatusOk(status: string | undefined): boolean {
  const s = String(status ?? '').toLowerCase();
  return s === 'ok' || s === 'healthy';
}

function splitContentStylePreference(value: string | null | undefined): { contentStyle: string; summaryMaxChars: string } {
  const text = String(value ?? '').trim();
  if (text.startsWith('summary+link')) {
    const [, rawLimit] = text.split(':', 2);
    return { contentStyle: 'summary+link', summaryMaxChars: rawLimit || '200' };
  }
  return { contentStyle: text || 'short', summaryMaxChars: '200' };
}

export function SettingsPage() {
  const cfg = useConfig<RuntimeConfig>();
  const { api, latestFailure, captureFailure, clearFailure } = useNotificationAgentState();
  const [status, setStatus] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [healthData, setHealthData] = React.useState<RuntimeHealth | null>(null);
  const [profileData, setProfileData] = React.useState<{ groups: string[]; lastLogin: string | null; language: string | null; preferredChannel: string | null; contentStyle: string | null; timezone: string | null; keywords: string[] } | null>(null);
  const [profileUserId, setProfileUserId] = React.useState<number | null>(null);
  const [activeSettingsTab, setActiveSettingsTab] = React.useState<SettingsServerTab>('ALL');
  const [settingsSearch, setSettingsSearch] = React.useState('');
  const [revealedSecrets, setRevealedSecrets] = React.useState<Set<string>>(() => new Set());
  const [settingsAudit, setSettingsAudit] = React.useState<Array<{ ts: number; text: string }>>([]);
  const [preferenceForm, setPreferenceForm] = React.useState({
    language: 'en',
    preferredChannel: '',
    contentStyle: 'short',
    summaryMaxChars: '200',
    timezone: 'UTC',
    keywords: '',
  });
  const [configDump, setConfigDump] = React.useState<Record<string, unknown>>({});

  const loadSettings = React.useCallback(async () => {
    clearFailure();
    setLoading(true);
    try {
      const dump = await api.getConfigDump();
      setConfigDump(dump);
      setStatus('Loaded runtime settings.');
    } catch (error) {
      setStatus('');
      captureFailure(error);
    } finally {
      setLoading(false);
    }
  }, [api, captureFailure, clearFailure]);

  React.useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  React.useEffect(() => {
    let active = true;
    void api
      .getHealth()
      .then((h) => {
        if (active) setHealthData(h);
      })
      .catch(() => {});
    // NOTIFWEB-096: load profile (groups + last_login) + NOTIFWEB-099: preferences
    void (async () => {
      try {
        const me = await api.getMyPreferences();
        if (!me || !active) return;
        const groups = await api.listGroups();
        const myGroups: string[] = [];
        for (const g of groups) {
          try {
            const members = await api.listGroupMembers(g.id);
            if (members.some((m) => m.user_id === me.id || m.username === me.username)) {
              myGroups.push(g.name);
            }
          } catch { /* skip */ }
        }
        if (active) {
          const stylePreference = splitContentStylePreference((me as Record<string, unknown>).content_style as string | null);
          setProfileUserId(me.id);
          setPreferenceForm({
            language: ((me as Record<string, unknown>).language as string | null) ?? 'en',
            preferredChannel: ((me as Record<string, unknown>).preferred_channel as string | null) ?? '',
            timezone: ((me as Record<string, unknown>).timezone as string | null) ?? 'UTC',
            keywords: Array.isArray((me as Record<string, unknown>).keywords)
              ? ((me as Record<string, unknown>).keywords as string[]).join(', ')
              : '',
            ...stylePreference,
          });
          setProfileData({
            groups: myGroups,
            lastLogin: (me as Record<string, unknown>).last_login_at as string | null,
            language: (me as Record<string, unknown>).language as string | null,
            preferredChannel: (me as Record<string, unknown>).preferred_channel as string | null,
            contentStyle: stylePreference.contentStyle === 'summary+link'
              ? `summary+link:${stylePreference.summaryMaxChars}`
              : stylePreference.contentStyle,
            timezone: (me as Record<string, unknown>).timezone as string | null,
            keywords: Array.isArray((me as Record<string, unknown>).keywords)
              ? ((me as Record<string, unknown>).keywords as string[])
              : [],
          });
        }
      } catch { /* best effort */ }
    })();
    return () => {
      active = false;
    };
  }, [api]);

  const runHealthCheck = async () => {
    clearFailure();
    setStatus('');
    try {
      const health = await api.getHealth();
      setHealthData(health);
      setStatus(`Health check passed (${health.status}).`);
    } catch (error) {
      captureFailure(error);
    }
  };

  const savePreferences = async () => {
    if (profileUserId == null) {
      setStatus('No profile user is available for preference update.');
      return;
    }
    clearFailure();
    setStatus('');
    try {
      const contentStyle = preferenceForm.contentStyle === 'summary+link'
        ? `summary+link:${preferenceForm.summaryMaxChars || '200'}`
        : preferenceForm.contentStyle;
      const keywords = preferenceForm.keywords
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
      await api.updateMyPreferences({
        language: preferenceForm.language,
        preferred_channel: preferenceForm.preferredChannel,
        content_style: contentStyle,
        timezone: preferenceForm.timezone,
        keywords,
      });
      setProfileData((current) => current ? {
        ...current,
        language: preferenceForm.language,
        preferredChannel: preferenceForm.preferredChannel,
        contentStyle,
        timezone: preferenceForm.timezone,
        keywords,
      } : current);
      setStatus('Saved profile preferences.');
    } catch (error) {
      captureFailure(error);
    }
  };

  const deletePreferences = async () => {
    clearFailure();
    setStatus('');
    try {
      await api.deleteMyPreferences();
      setPreferenceForm({
        language: 'en',
        preferredChannel: '',
        contentStyle: 'short',
        summaryMaxChars: '200',
        timezone: 'UTC',
        keywords: '',
      });
      setProfileData((current) => current ? {
        ...current,
        language: null,
        preferredChannel: null,
        contentStyle: null,
        timezone: null,
        keywords: [],
      } : current);
      setStatus('Deleted profile preferences.');
    } catch (error) {
      captureFailure(error);
    }
  };

  const healthOk = healthData != null && healthStatusOk(healthData.status);
  const maskedConfig = React.useMemo(() => maskSecrets(configDump) as Record<string, unknown>, [configDump]);
  const settingsSources = React.useMemo(() => buildTabSourceMap(activeSettingsTab), [activeSettingsTab]);
  const renderedKeyCount = React.useMemo(() => Object.keys(settingsSources).length, [settingsSources]);
  const settingsPanelTabs = React.useMemo<SettingsPanelServerTab[]>(
    () =>
      SETTINGS_SERVER_TABS.map((tab) => ({
        id: tab.toLowerCase(),
        label: tab,
        data: buildInventoryTree(maskedConfig, tab),
        sources: buildTabSourceMap(tab),
        description: `${tab} settings`,
      })),
    [maskedConfig],
  );
  const secretSampleKeys = React.useMemo(() => SETTINGS_SECRET_KEYS.slice(0, 5), []);
  const serverSection = React.useMemo(() => pickSection(maskedConfig, ['app', 'api_server', 'web_server', 'mcp_server', 'a2a_server']), [maskedConfig]);
  const authSection = React.useMemo(() => pickSection(maskedConfig, ['auth', 'web_server']), [maskedConfig]);
  const storageSection = React.useMemo(() => pickSection(maskedConfig, ['database', 'storage', 'db', 'channels']), [maskedConfig]);
  const loggingSection = React.useMemo(() => pickSection(maskedConfig, ['log']), [maskedConfig]);
  const serviceSpecificSection = React.useMemo(() => pickSection(maskedConfig, ['llm', 'jobs', 'rbac', 'test']), [maskedConfig]);
  const exportEffectiveConfig = React.useCallback(() => {
    downloadJson('notification-agent-effective-config-masked.json', buildInventoryTree(maskedConfig, 'ALL'));
    setSettingsAudit((current) => [{ ts: Date.now(), text: 'export masked effective config' }, ...current].slice(0, 8));
    setStatus('Downloaded masked effective config.');
  }, [maskedConfig]);
  const revealSecret = React.useCallback((key: string) => {
    setRevealedSecrets((current) => {
      const next = new Set(current);
      next.add(key);
      return next;
    });
    setSettingsAudit((current) => [{ ts: Date.now(), text: `admin reveal requested for ${key}` }, ...current].slice(0, 8));
  }, []);

  return (
    <div className="space-y-6">
      <SettingsPanel
        title="Settings"
        serviceName="notification-agent"
        version={displayVersion(String(asRecord(maskedConfig.app).version || healthData?.version || ''))}
        description="Live runtime configuration and read-only environment metadata."
        statusItems={[
          { label: "keys", value: renderedKeyCount, testId: "settings-key-count" },
          { label: healthOk ? "health ok" : "health unknown", variant: healthOk ? "default" : "destructive" },
        ]}
        serverTabs={settingsPanelTabs}
        activeServerId={activeSettingsTab.toLowerCase()}
        onActiveServerChange={(serverId) => setActiveSettingsTab(serverId.toUpperCase() as SettingsServerTab)}
        searchTerm={settingsSearch}
        onSearchTermChange={setSettingsSearch}
        revealedSecrets={revealedSecrets}
        maxDepth={12}
        error={latestFailure}
        loading={loading}
        onRefresh={() => void loadSettings()}
        onExport={exportEffectiveConfig}
        footer={status ? <p role="status" className="text-sm text-foreground/80">{status}</p> : null}
      >

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <Label htmlFor="settings-env">ENV</Label>
          <Input id="settings-env" value={cfg.ENV} readOnly />
        </div>
        <div>
          <Label htmlFor="settings-auth-mode">AUTH_MODE</Label>
          <Input id="settings-auth-mode" value={cfg.AUTH_MODE ?? 'cookie'} readOnly />
        </div>
        <div>
          <Label htmlFor="settings-api-base-url">API_BASE_URL</Label>
          <Input id="settings-api-base-url" value={cfg.API_BASE_URL} readOnly />
        </div>
        <div>
          <Label htmlFor="settings-mcp-base-url">MCP_BASE_URL</Label>
          <Input id="settings-mcp-base-url" value={cfg.MCP_BASE_URL ?? ''} readOnly />
        </div>
        <div>
          <Label htmlFor="settings-a2a-base-url">A2A_BASE_URL</Label>
          <Input id="settings-a2a-base-url" value={cfg.A2A_BASE_URL ?? ''} readOnly />
        </div>
      </div>

      <Card>
        <CardHeader><h2 className="text-lg font-semibold">Admin Reveal</h2></CardHeader>
        <CardContent className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <div className="flex flex-wrap gap-2">
            {secretSampleKeys.map((key) => (
              <Button
                key={key}
                type="button"
                size="sm"
                variant="secondary"
                data-testid="settings-secret-reveal-toggle"
                data-key-path={key}
                title={`Reveal ${key}`}
                onClick={() => revealSecret(key)}
              >
                Reveal
              </Button>
            ))}
          </div>
          <ul data-testid="settings-audit-log" className="space-y-1 text-xs text-muted-foreground">
            {settingsAudit.length > 0 ? settingsAudit.map((entry, idx) => <li key={`${entry.ts}-${idx}`}><RelativeTime timestamp={entry.ts} /> · {entry.text}</li>) : <li>No settings actions recorded.</li>}
          </ul>
        </CardContent>
      </Card>

      {/* XC-009 (d) / CX-140 — Build metadata Card (JsonExplorer table view). */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Build metadata</h2>
          <p className="text-sm text-muted-foreground">Version, build identity, and runtime environment of the running container.</p>
        </CardHeader>
        <CardContent>
          <JsonExplorer
            title=""
            testId="ps81-json-explorer-build"
            data={{
              application: String(asRecord((maskSecrets(configDump) as Record<string, unknown>).app).name || healthData?.application || 'notification-agent-mcp-server'),
              version: displayVersion(String(asRecord((maskSecrets(configDump) as Record<string, unknown>).app).version || healthData?.version || '')),
              ui_build: UI_BUILD_VERSION,
              api_version: 'v1',
              environment: cfg.ENV,
              api_base_url: cfg.API_BASE_URL,
            }}
            defaultExpanded
            maxDepth={3}
            viewMode="table"
          />
        </CardContent>
      </Card>

      {/* XC-009 (e) / CX-140 — Diagnostics Card (JsonExplorer table view). */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Diagnostics</h2>
          <p className="text-sm text-muted-foreground">Service identity, health, storage/backend and logging snapshot. Secrets are masked.</p>
        </CardHeader>
        <CardContent>
          <JsonExplorer
            title=""
            testId="ps81-json-explorer-diagnostics"
            data={{
              status: healthData?.status ?? 'loading',
              application: healthData?.application ?? 'N/A',
              version: displayVersion(healthData?.version),
              health: (healthData ?? { status: 'loading' }) as Record<string, unknown>,
              storage_backend: pickSection(maskSecrets(configDump) as Record<string, unknown>, ['database', 'storage', 'db', 'channels']),
              logging: pickSection(maskSecrets(configDump) as Record<string, unknown>, ['log']),
            }}
            defaultExpanded
            maxDepth={5}
            viewMode="table"
          />
        </CardContent>
      </Card>

      {/* XC-009 (f) / CX-140 — Runtime configuration Card (full effective config tree, JsonExplorer table view). */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Runtime configuration</h2>
          <p className="text-sm text-muted-foreground">Effective merged config tree. Secrets are masked by default.</p>
        </CardHeader>
        <CardContent>
          <JsonExplorer title="" testId="ps81-json-explorer-runtime" data={maskSecrets(configDump) as Record<string, unknown>} maxDepth={6} viewMode="table" />
        </CardContent>
      </Card>

      {/* NOTIFWEB-095: About/Version summary */}
      <Card>
        <CardHeader><h2 className="text-lg font-semibold">About</h2></CardHeader>
        <CardContent>
          <dl className="grid gap-2 sm:grid-cols-2 text-sm">
            <div><dt className="font-medium text-muted-foreground">Service</dt><dd>{String(asRecord(maskedConfig.app).name || healthData?.application || 'notification-agent-mcp-server')}</dd></div>
            <div><dt className="font-medium text-muted-foreground">Version</dt><dd data-testid="about-version">{displayVersion(String(asRecord(maskedConfig.app).version || healthData?.version || ''))}</dd></div>
            <div><dt className="font-medium text-muted-foreground">Environment</dt><dd>{cfg.ENV}</dd></div>
            <div><dt className="font-medium text-muted-foreground">Auth mode</dt><dd>{cfg.AUTH_MODE ?? 'cookie'}</dd></div>
            <div><dt className="font-medium text-muted-foreground">API URL</dt><dd className="truncate">{cfg.API_BASE_URL}</dd></div>
            <div><dt className="font-medium text-muted-foreground">MCP URL</dt><dd className="truncate">{cfg.MCP_BASE_URL ?? ''}</dd></div>
            <div><dt className="font-medium text-muted-foreground">A2A URL</dt><dd className="truncate">{cfg.A2A_BASE_URL ?? ''}</dd></div>
          </dl>
        </CardContent>
      </Card>

      {/* NOTIFWEB-096: User Profile with groups and last login */}
      {profileData ? (
        <Card>
          <CardHeader><h2 className="text-lg font-semibold">Profile</h2></CardHeader>
          <CardContent>
            <dl className="grid gap-2 sm:grid-cols-2 text-sm">
              <div><dt className="font-medium text-muted-foreground">Groups</dt><dd data-testid="profile-groups">{profileData.groups.length > 0 ? profileData.groups.join(', ') : 'None'}</dd></div>
              <div><dt className="font-medium text-muted-foreground">Last login</dt><dd data-testid="profile-last-login">{profileData.lastLogin ?? 'Not recorded'}</dd></div>
              <div><dt className="font-medium text-muted-foreground">Language</dt><dd data-testid="profile-language">{profileData.language ?? 'Not set'}</dd></div>
              <div><dt className="font-medium text-muted-foreground">Preferred channel</dt><dd data-testid="profile-channel">{profileData.preferredChannel ?? 'Not set'}</dd></div>
              <div><dt className="font-medium text-muted-foreground">Content style</dt><dd data-testid="profile-style">{profileData.contentStyle ?? 'Not set'}</dd></div>
              <div><dt className="font-medium text-muted-foreground">Timezone</dt><dd data-testid="profile-timezone">{profileData.timezone ?? 'Not set'}</dd></div>
              <div><dt className="font-medium text-muted-foreground">Keywords</dt><dd data-testid="profile-keywords">{profileData.keywords.length > 0 ? profileData.keywords.join(', ') : 'None'}</dd></div>
            </dl>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader><h2 className="text-lg font-semibold">Preferences</h2></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-6">
          <div>
            <Label htmlFor="settings-pref-language">Language</Label>
            <Select id="settings-pref-language" value={preferenceForm.language} onChange={(event) => setPreferenceForm((current) => ({ ...current, language: event.target.value }))}>
              <option value="en">English</option>
              <option value="fr">French</option>
              <option value="de">German</option>
              <option value="es">Spanish</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="settings-pref-channel">Preferred channel</Label>
            <Input id="settings-pref-channel" value={preferenceForm.preferredChannel} onChange={(event) => setPreferenceForm((current) => ({ ...current, preferredChannel: event.target.value }))} />
          </div>
          <div>
            <Label htmlFor="settings-pref-style">Content style</Label>
            <Select id="settings-pref-style" value={preferenceForm.contentStyle} onChange={(event) => setPreferenceForm((current) => ({ ...current, contentStyle: event.target.value }))}>
              <option value="short">Short</option>
              <option value="detailed">Detailed</option>
              <option value="summary+link">Summary + link</option>
              <option value="rich">Rich</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="settings-pref-summary-max">Summary max length</Label>
            <Input id="settings-pref-summary-max" type="number" min="80" max="2000" value={preferenceForm.summaryMaxChars} onChange={(event) => setPreferenceForm((current) => ({ ...current, summaryMaxChars: event.target.value }))} />
          </div>
          <div>
            <Label htmlFor="settings-pref-timezone">Timezone</Label>
            <Input id="settings-pref-timezone" value={preferenceForm.timezone} onChange={(event) => setPreferenceForm((current) => ({ ...current, timezone: event.target.value }))} />
          </div>
          <div>
            <Label htmlFor="settings-pref-keywords">Keywords</Label>
            <Input id="settings-pref-keywords" value={preferenceForm.keywords} onChange={(event) => setPreferenceForm((current) => ({ ...current, keywords: event.target.value }))} />
          </div>
          <div className="sm:col-span-6 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => void deletePreferences()} disabled={loading}>Delete preferences</Button>
            <Button onClick={() => void savePreferences()} disabled={loading}>Save preferences</Button>
          </div>
        </CardContent>
      </Card>

      {/* PS-73 SW2.2: Server — structured */}
      <Card>
        <CardHeader><h2 className="text-lg font-semibold">Server</h2></CardHeader>
        <CardContent>
          <dl className="grid gap-2 sm:grid-cols-2 text-sm">
            {Object.entries(serverSection).map(([k, v]) => (
              <div key={k}><dt className="font-medium text-muted-foreground">{k}</dt><dd>{String(v ?? 'N/A')}</dd></div>
            ))}
          </dl>
        </CardContent>
      </Card>

      {/* PS-73 SW2.3: Auth — structured */}
      <Card>
        <CardHeader><h2 className="text-lg font-semibold">Auth</h2></CardHeader>
        <CardContent>
          <dl className="grid gap-2 sm:grid-cols-2 text-sm">
            {Object.entries(authSection).map(([k, v]) => (
              <div key={k}><dt className="font-medium text-muted-foreground">{k}</dt><dd>{SECRET_PATTERNS.test(k) && typeof v === 'string' && v.length > 0 ? '****' : String(v ?? 'N/A')}</dd></div>
            ))}
          </dl>
        </CardContent>
      </Card>

      {/* PS-73 SW2.4: Storage/Backend — structured */}
      <Card>
        <CardHeader><h2 className="text-lg font-semibold">Storage / Backend</h2></CardHeader>
        <CardContent>
          <dl className="grid gap-2 sm:grid-cols-2 text-sm">
            {Object.entries(storageSection).map(([k, v]) => (
              <div key={k}><dt className="font-medium text-muted-foreground">{k}</dt><dd>{SECRET_PATTERNS.test(k) ? '****' : String(v ?? 'N/A')}</dd></div>
            ))}
          </dl>
        </CardContent>
      </Card>

      {/* PS-73 SW2.5: Logging — structured */}
      <Card>
        <CardHeader><h2 className="text-lg font-semibold">Logging</h2></CardHeader>
        <CardContent>
          <dl className="grid gap-2 sm:grid-cols-2 text-sm">
            {Object.entries(loggingSection).map(([k, v]) => (
              <div key={k}><dt className="font-medium text-muted-foreground">{k}</dt><dd>{String(v ?? 'N/A')}</dd></div>
            ))}
          </dl>
        </CardContent>
      </Card>

      {/* PS-73 SW2.6: Service-Specific — structured */}
      <Card>
        <CardHeader><h2 className="text-lg font-semibold">Service-Specific</h2></CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid gap-2 sm:grid-cols-2 text-sm">
            {Object.entries(serviceSpecificSection).map(([k, v]) => (
              <div key={k}><dt className="font-medium text-muted-foreground">{k}</dt><dd>{SECRET_PATTERNS.test(k) ? '****' : String(v ?? 'N/A')}</dd></div>
            ))}
          </dl>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => void loadSettings()} disabled={loading}>
              Reload settings
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* PS-73 SW2.7: Health */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">Health</h2>
            <Badge variant={healthOk ? 'default' : 'destructive'} className={healthOk ? 'bg-emerald-600 text-white' : ''}>
              {healthOk ? 'ok' : 'unknown'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-2 sm:grid-cols-2 text-sm">
            <div><dt className="font-medium text-muted-foreground">Status</dt><dd>{healthData?.status ?? 'loading'}</dd></div>
            <div><dt className="font-medium text-muted-foreground">Application</dt><dd>{healthData?.application ?? 'N/A'}</dd></div>
            <div><dt className="font-medium text-muted-foreground">Version</dt><dd data-testid="health-version">{displayVersion(healthData?.version)}</dd></div>
          </dl>
          <Button onClick={() => void runHealthCheck()} className="mt-2" disabled={loading}>
            Refresh
          </Button>
        </CardContent>
      </Card>
      </SettingsPanel>
    </div>
  );
}
