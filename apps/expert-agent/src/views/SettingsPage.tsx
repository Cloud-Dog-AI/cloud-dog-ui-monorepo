// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
// Licensed under the Apache License, Version 2.0
// PS-73 Settings Page WebUI Standard — expert-agent implementation.

import * as React from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  SettingsPanel,
  StatusBadge,
  type SettingGroupDef,
} from '@cloud-dog/ui';
import { useExpertAgentState } from '../state/AppState';
import { LoadingNote, PageScaffold, SummaryGrid, formatCount } from './shared';
import type { RuntimeHealth, StatusPayload } from '../lib/api';

const SECRET_KEYS = new Set([
  'password', 'secret', 'token', 'api_key', 'apikey', 'key_hash',
  'credentials', 'auth_token', 'jwt_secret', 'vault_token',
]);

const STORAGE_KEY = 'expert-agent:user-preferences';

type Preferences = {
  theme: 'system' | 'light' | 'dark';
  defaultExpertId: string;
  compactTables: boolean;
  sessionTimeoutMinutes: number;
};

type ConfigRowsProps = Readonly<{
  title: string;
  description: string;
  rows: Array<Readonly<{ label: string; value: React.ReactNode }>>;
}>;

function loadPreferences(): Preferences {
  if (typeof window === 'undefined') return { theme: 'system', defaultExpertId: '', compactTables: false, sessionTimeoutMinutes: 30 };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { theme: 'system', defaultExpertId: '', compactTables: false, sessionTimeoutMinutes: 30 };
    const parsed = JSON.parse(raw) as Partial<Preferences>;
    return {
      theme: parsed.theme === 'light' || parsed.theme === 'dark' ? parsed.theme : 'system',
      defaultExpertId: parsed.defaultExpertId ?? '',
      compactTables: Boolean(parsed.compactTables),
      sessionTimeoutMinutes: Number(parsed.sessionTimeoutMinutes ?? 30),
    };
  } catch {
    return { theme: 'system', defaultExpertId: '', compactTables: false, sessionTimeoutMinutes: 30 };
  }
}

function isSecretKey(key: string): boolean {
  const lower = key.toLowerCase();
  return SECRET_KEYS.has(lower) || lower.includes('password') || lower.includes('secret') || lower.includes('token') || lower.includes('api_key');
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function formatConfigValue(key: string, value: unknown): React.ReactNode {
  if (isSecretKey(key) && value !== undefined && value !== null && value !== '') return 'Configured, hidden';
  if (value === undefined || value === null || value === '') return 'Not configured';
  if (typeof value === 'boolean') return value ? 'Enabled' : 'Disabled';
  if (typeof value === 'number') return Number.isFinite(value) ? value.toLocaleString('en-GB') : 'Not reported';
  if (typeof value === 'string') {
    if ((key.toLowerCase().includes('url') || key.toLowerCase().includes('uri') || key.toLowerCase().includes('connection')) && value.includes('@')) {
      return value.replace(/:([^:@]+)@/, ':****@');
    }
    return value;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return 'No entries';
    if (value.every((item) => ['string', 'number', 'boolean'].includes(typeof item))) {
      return value.slice(0, 4).map(String).join(', ');
    }
    return `${value.length.toLocaleString('en-GB')} entries`;
  }
  if (typeof value === 'object') return `${Object.keys(value as Record<string, unknown>).length.toLocaleString('en-GB')} settings`;
  return String(value);
}

function rowsFrom(source: Record<string, unknown>, keys: string[]): ConfigRowsProps['rows'] {
  return keys.map((key) => ({ label: key.replace(/_/g, ' '), value: formatConfigValue(key, source[key]) }));
}

function ConfigRows(props: ConfigRowsProps) {
  return (
    <Card>
      <CardHeader>
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">{props.title}</h2>
          <p className="text-sm text-muted-foreground">{props.description}</p>
        </div>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-x-6 gap-y-3 text-sm md:grid-cols-[220px_1fr]">
          {props.rows.map((row) => (
            <React.Fragment key={row.label}>
              <dt className="font-medium capitalize text-muted-foreground">{row.label}</dt>
              <dd className="break-words">{row.value}</dd>
            </React.Fragment>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}

export function SettingsPage() {
  const { api, latestFailure, captureFailure, clearFailure } = useExpertAgentState();
  const [preferences, setPreferences] = React.useState<Preferences>(() => loadPreferences());
  const [experts, setExperts] = React.useState<Array<{ id: number; name: string }>>([]);
  const [loading, setLoading] = React.useState(true);
  const [status, setStatus] = React.useState<string | null>(null);
  const [health, setHealth] = React.useState<RuntimeHealth | null>(null);
  const [serviceStatus, setServiceStatus] = React.useState<StatusPayload | null>(null);
  const [runtimeConfig, setRuntimeConfig] = React.useState<Record<string, unknown> | null>(null);

  React.useEffect(() => {
    let active = true;
    clearFailure();
    setLoading(true);
    Promise.all([
      api.listExperts().then((records) => { if (active) setExperts(records.map((record) => ({ id: record.id, name: record.name }))); }),
      api.getHealth().then((data) => { if (active) setHealth(data); }).catch(() => {}),
      api.getStatus().then((data) => { if (active) setServiceStatus(data); }).catch(() => {}),
      api.getRuntimeConfig().then((data) => { if (active) setRuntimeConfig(data); }).catch(() => {}),
    ])
      .catch((error) => { if (active) captureFailure(error); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [api, captureFailure, clearFailure]);

  const groups: SettingGroupDef[] = [
    {
      id: 'appearance',
      label: 'Appearance',
      settings: [
        { key: 'theme', label: 'Theme', type: 'select', value: preferences.theme, options: ['system', 'light', 'dark'], description: 'Choose the SPA colour theme.' },
        { key: 'compactTables', label: 'Compact tables', type: 'boolean', value: preferences.compactTables, description: 'Reduce row density in CRUD tables.' },
      ],
    },
    {
      id: 'chat',
      label: 'Chat',
      settings: [
        { key: 'defaultExpertId', label: 'Default expert', type: 'select', value: preferences.defaultExpertId, options: ['', ...experts.map((expert) => String(expert.id))], description: 'Expert preselected on the chat workbench.' },
        { key: 'sessionTimeoutMinutes', label: 'Session timeout (minutes)', type: 'number', value: preferences.sessionTimeoutMinutes, description: 'Browser-side inactivity timeout.' },
      ],
    },
  ];

  const handleSave = React.useCallback((key: string, value: unknown) => {
    setPreferences((current) => {
      const next = { ...current, [key]: value } as Preferences;
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
    setStatus(`Saved setting ${key}.`);
  }, []);

  const app = asRecord(runtimeConfig?.app);
  const webServer = asRecord(runtimeConfig?.web_server);
  const apiServer = asRecord(runtimeConfig?.api_server);
  const mcpServer = asRecord(runtimeConfig?.mcp_server);
  const a2aServer = asRecord(runtimeConfig?.a2a_server);
  const auth = asRecord(runtimeConfig?.auth);
  const session = asRecord(runtimeConfig?.session);
  const db = asRecord(runtimeConfig?.db);
  const vector = asRecord(runtimeConfig?.vector);
  const log = asRecord(runtimeConfig?.log);
  const expert = asRecord(runtimeConfig?.expert);
  const queue = asRecord(runtimeConfig?.queue);

  return (
    <PageScaffold title="Settings" description="Structured Expert Agent runtime settings and browser preferences." alert={latestFailure} status={status}>
      <LoadingNote loading={loading} />

      <SummaryGrid items={[
        { label: 'Service', value: serviceStatus?.service ?? String(app.service_name ?? 'Expert Agent') },
        { label: 'Version', value: serviceStatus?.version ?? String(app.version ?? 'unknown') },
        { label: 'Experts available', value: formatCount(experts.length) },
      ]} />

      <ConfigRows
        title="Service info"
        description="Runtime identity and live process metrics from the API."
        rows={[
          { label: 'service', value: serviceStatus?.service ?? String(app.service_name ?? 'Expert Agent') },
          { label: 'status', value: <StatusBadge value={serviceStatus?.status ?? health?.status ?? 'not reported'} /> },
          { label: 'version', value: serviceStatus?.version ?? String(app.version ?? 'unknown') },
          { label: 'environment', value: formatConfigValue('environment', app.environment ?? log.environment) },
          { label: 'uptime seconds', value: formatConfigValue('uptime_seconds', serviceStatus?.uptime_seconds) },
          { label: 'memory mb', value: formatConfigValue('memory_mb', serviceStatus?.memory_mb) },
          { label: 'cpu percent', value: formatConfigValue('cpu_percent', serviceStatus?.cpu_percent) },
        ]}
      />

      <ConfigRows
        title="Servers"
        description="API, Web, MCP, and A2A listener configuration."
        rows={[
          ...rowsFrom(webServer, ['host', 'port', 'api_base_url', 'verify_tls']),
          ...rowsFrom(apiServer, ['host', 'port', 'api_key_header']),
          ...rowsFrom(mcpServer, ['enabled', 'host', 'port']),
          ...rowsFrom(a2aServer, ['enabled', 'host', 'port']),
        ]}
      />

      <ConfigRows
        title="Authentication"
        description="Cookie session and identity provider settings with secrets hidden."
        rows={[
          ...rowsFrom(auth, ['mode', 'provider', 'issuer', 'audience', 'session_timeout_minutes']),
          ...rowsFrom(session, ['timeout_minutes', 'refresh_enabled']),
        ]}
      />

      <ConfigRows
        title="Storage and backend"
        description="Database, vector, and cache-adjacent runtime settings without exposing credentials."
        rows={[
          ...rowsFrom(db, ['driver', 'host', 'port', 'database', 'pool_size']),
          ...rowsFrom(vector, ['backend', 'host', 'port', 'collection']),
        ]}
      />

      <ConfigRows
        title="Expert service"
        description="Expert orchestration, queue, and logging settings."
        rows={[
          ...rowsFrom(expert, ['default_provider', 'default_model', 'max_sub_expert_depth']),
          ...rowsFrom(queue, ['backend', 'depth_limit', 'max_workers']),
          ...rowsFrom(log, ['level', 'environment']),
          { label: 'available experts', value: experts.length ? experts.map((item) => item.name).join(', ') : 'No experts reported' },
        ]}
      />

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">User preferences</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          <SummaryGrid items={[
            { label: 'Theme', value: preferences.theme },
            { label: 'Default expert', value: preferences.defaultExpertId || 'none' },
            { label: 'Session timeout', value: `${preferences.sessionTimeoutMinutes} minutes` },
          ]} />
          <SettingsPanel
            groups={groups}
            onSave={handleSave}
            onExport={() => {
              const blob = new Blob([JSON.stringify(preferences, null, 2)], { type: 'application/json' });
              const href = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = href;
              link.download = 'expert-agent-settings.json';
              link.click();
              URL.revokeObjectURL(href);
            }}
            onImport={() => setStatus('Import is available via browser-local JSON restore in a follow-up shared component revision.')}
          />
        </CardContent>
      </Card>
    </PageScaffold>
  );
}
