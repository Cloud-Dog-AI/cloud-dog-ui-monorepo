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
import { Button, Card, CardContent, CardHeader, Badge, Input, Label, Select, SettingsPanel } from '@cloud-dog/ui';
import { useConfig } from '@cloud-dog/config';
import type { SettingGroupDef } from '@cloud-dog/ui';
import { useNotificationAgentState } from '../state/AppState';
import type { RuntimeHealth } from '../lib/api';

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

type RuntimeConfig = Readonly<{
  ENV: string;
  API_BASE_URL: string;
  MCP_BASE_URL?: string;
  A2A_BASE_URL?: string;
  AUTH_MODE?: string;
  DB_BACKEND?: string;
  DB_PATH?: string;
}>;

const SETTINGS_KEYS = ['app.title', 'app.default_language', 'web_server.session_max_age'] as const;
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
  return { contentStyle: text || 'html', summaryMaxChars: '200' };
}

export function SettingsPage() {
  const cfg = useConfig<RuntimeConfig>();
  const { api, latestFailure, captureFailure, clearFailure } = useNotificationAgentState();
  const [status, setStatus] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [healthData, setHealthData] = React.useState<RuntimeHealth | null>(null);
  const [profileData, setProfileData] = React.useState<{ groups: string[]; lastLogin: string | null; language: string | null; preferredChannel: string | null; contentStyle: string | null } | null>(null);
  const [profileUserId, setProfileUserId] = React.useState<number | null>(null);
  const [preferenceForm, setPreferenceForm] = React.useState({
    language: 'en',
    preferredChannel: '',
    contentStyle: 'html',
    summaryMaxChars: '200',
  });
  const [configDump, setConfigDump] = React.useState<Record<string, unknown>>({});
  const [form, setForm] = React.useState<Record<string, unknown>>({
    'runtime.env': '',
    'runtime.auth_mode': 'cookie',
    'runtime.api_base_url': '',
    'runtime.mcp_base_url': '',
    'runtime.a2a_base_url': '',
    'app.title': '',
    'app.default_language': 'en',
    'web_server.session_max_age': 3600,
  });

  const loadSettings = React.useCallback(async () => {
    clearFailure();
    setLoading(true);
    try {
      const values = await api.queryConfig([...SETTINGS_KEYS]);
      const dump = await api.getConfigDump();
      setConfigDump(dump);
      setForm({
        'runtime.env': cfg.ENV,
        'runtime.auth_mode': cfg.AUTH_MODE ?? 'cookie',
        'runtime.api_base_url': cfg.API_BASE_URL,
        'runtime.mcp_base_url': cfg.MCP_BASE_URL ?? '',
        'runtime.a2a_base_url': cfg.A2A_BASE_URL ?? '',
        'app.title': String(values['app.title'] ?? ''),
        'app.default_language': String(values['app.default_language'] ?? 'en'),
        'web_server.session_max_age': Number(values['web_server.session_max_age'] ?? 3600),
      });
      setStatus('Loaded runtime settings.');
    } catch (error) {
      setStatus('');
      captureFailure(error);
    } finally {
      setLoading(false);
    }
  }, [api, captureFailure, cfg.A2A_BASE_URL, cfg.API_BASE_URL, cfg.AUTH_MODE, cfg.ENV, cfg.MCP_BASE_URL, clearFailure]);

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
        const users = await api.listUsers();
        const me = users.find((u) => u.role === 'admin') ?? users[0];
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
          });
        }
      } catch { /* best effort */ }
    })();
    return () => {
      active = false;
    };
  }, [api]);

  const groups: SettingGroupDef[] = [
    {
      id: 'app',
      label: 'Application',
      settings: [
        {
          key: 'app.title',
          label: 'Application title',
          type: 'text',
          value: form['app.title'],
          description: 'Displayed in the shell and login experience.',
        },
        {
          key: 'app.default_language',
          label: 'Default language',
          type: 'select',
          value: form['app.default_language'],
          options: ['en', 'fr', 'de', 'es'],
          description: 'Default language for new templates and messages.',
        },
        {
          key: 'web_server.session_max_age',
          label: 'Session max age',
          type: 'number',
          value: form['web_server.session_max_age'],
          description: 'Cookie session lifetime in seconds.',
        },
      ],
    },
  ];

  const saveSetting = async (key: string, value: unknown) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const persistSettings = async () => {
    clearFailure();
    setStatus('');
    try {
      await api.updateConfig({
        updates: {
          'app.title': form['app.title'],
          'app.default_language': form['app.default_language'],
          'web_server.session_max_age': Number(form['web_server.session_max_age'] ?? 3600),
        },
        persist: true,
      });
      await loadSettings();
      setStatus('Saved runtime settings.');
    } catch (error) {
      captureFailure(error);
    }
  };

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
      await api.updateUser(profileUserId, {
        language: preferenceForm.language,
        preferred_channel: preferenceForm.preferredChannel,
        content_style: contentStyle,
      });
      setProfileData((current) => current ? {
        ...current,
        language: preferenceForm.language,
        preferredChannel: preferenceForm.preferredChannel,
        contentStyle,
      } : current);
      setStatus('Saved profile preferences.');
    } catch (error) {
      captureFailure(error);
    }
  };

  const healthOk = healthData != null && healthStatusOk(healthData.status);
  const maskedConfig = React.useMemo(() => maskSecrets(configDump) as Record<string, unknown>, [configDump]);
  const serverSection = React.useMemo(() => pickSection(maskedConfig, ['app', 'api_server', 'web_server', 'mcp_server', 'a2a_server']), [maskedConfig]);
  const authSection = React.useMemo(() => pickSection(maskedConfig, ['auth', 'web_server']), [maskedConfig]);
  const storageSection = React.useMemo(() => pickSection(maskedConfig, ['database', 'storage', 'db', 'channels']), [maskedConfig]);
  const loggingSection = React.useMemo(() => pickSection(maskedConfig, ['log']), [maskedConfig]);
  const serviceSpecificSection = React.useMemo(() => pickSection(maskedConfig, ['llm', 'jobs', 'rbac', 'test']), [maskedConfig]);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">Shared settings panel for live runtime configuration and read-only environment metadata.</p>
      </header>

      {latestFailure ? <p role="alert" className="text-sm text-destructive">{latestFailure}</p> : null}
      {status ? <p role="status" className="text-sm text-foreground/80">{status}</p> : null}

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
            </dl>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader><h2 className="text-lg font-semibold">Preferences</h2></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-4">
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
              <option value="html">HTML</option>
              <option value="plain">Plain</option>
              <option value="summary+link">Summary + link</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="settings-pref-summary-max">Summary max length</Label>
            <Input id="settings-pref-summary-max" type="number" min="80" max="2000" value={preferenceForm.summaryMaxChars} onChange={(event) => setPreferenceForm((current) => ({ ...current, summaryMaxChars: event.target.value }))} />
          </div>
          <div className="sm:col-span-4 flex justify-end">
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
          <SettingsPanel
            groups={groups}
            onSave={saveSetting}
            onExport={() => setStatus('Export is not yet wired for notification-agent.')}
            onImport={() => setStatus('Import is not yet wired for notification-agent.')}
          />
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => void loadSettings()} disabled={loading}>
              Reload settings
            </Button>
            <Button onClick={() => void persistSettings()} disabled={loading}>
              Save settings
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
    </div>
  );
}
