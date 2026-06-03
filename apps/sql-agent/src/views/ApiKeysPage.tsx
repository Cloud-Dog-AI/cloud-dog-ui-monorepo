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

import * as React from 'react';
import { useConfig } from '@cloud-dog/config';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  DataTable,
  EntityDialog,
  RelatedItemsPanel,
  RelativeTime,
  type BulkAction,
  type DataColumn,
  type EntityFieldDef,
} from '@cloud-dog/ui';
import { ErrorState, LoadingState, PageFrame, requestJson, useApiResource } from '../lib/sqlAgentApi';

type AppRuntimeConfig = {
  API_BASE_URL: string;
};

type AuthStatus = {
  is_system_admin?: boolean;
};

type UserRecord = {
  id: number;
  username: string;
};

type ApiKeyRecord = {
  id: number;
  user_id: number;
  name?: string | null;
  key_prefix?: string | null;
  key_display?: string | null;
  disabled?: boolean;
  created_at?: string | null;
  last_used_at?: string | null;
  expires_at?: string | null;
  groups?: string[];
  key?: string;
};

type UsersResponse = {
  users?: UserRecord[];
};

type ApiKeysResponse = {
  api_keys?: ApiKeyRecord[];
};

const API_KEY_FIELDS: EntityFieldDef[] = [
  { name: 'name', label: 'Name', type: 'text' },
  { name: 'userId', label: 'Owner user', type: 'select', required: true, options: [] },
  { name: 'groupsCsv', label: 'Groups', type: 'text' },
];

function splitCsv(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return 'never';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}

export function ApiKeysPage() {
  const cfg = useConfig<AppRuntimeConfig>();
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);
  const authStatus = useApiResource<AuthStatus>(
    () => requestJson(cfg.API_BASE_URL, '/api/v1/auth/status'),
    [cfg.API_BASE_URL],
  );
  const users = useApiResource<UsersResponse>(
    () => requestJson(cfg.API_BASE_URL, '/api/v1/admin/users?include_disabled=false'),
    [cfg.API_BASE_URL],
  );
  const apiKeys = useApiResource<ApiKeysResponse>(
    () => requestJson(cfg.API_BASE_URL, '/api/v1/admin/api-keys?include_disabled=true'),
    [cfg.API_BASE_URL],
  );

  const [name, setName] = React.useState('');
  const [userId, setUserId] = React.useState('');
  const [groupsCsv, setGroupsCsv] = React.useState('default');
  const [generatedKey, setGeneratedKey] = React.useState('');
  const [status, setStatus] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);

  const userOptions = React.useMemo(
    () => (users.data?.users ?? []).map((user) => `${user.id}:${user.username}`),
    [users.data?.users],
  );
  const apiKeyFields = React.useMemo(
    () =>
      API_KEY_FIELDS.map((field) =>
        field.name === 'userId'
          ? {
              ...field,
              options: userOptions,
            }
          : field,
      ),
    [userOptions],
  );

  const rows = apiKeys.data?.api_keys ?? [];

  React.useEffect(() => {
    setPage(1);
  }, [rows.length]);

  const refreshAll = React.useCallback(() => {
    authStatus.refresh();
    users.refresh();
    apiKeys.refresh();
  }, [apiKeys, authStatus, users]);

  const createKey = React.useCallback(async () => {
    setError(null);
    setStatus(null);
    setGeneratedKey('');
    try {
      const payload = {
        user_id: Number(userId),
        name: name.trim() || undefined,
        groups: splitCsv(groupsCsv),
      };
      if (!payload.user_id) {
        throw new Error('Owner user is required.');
      }
      const response = await requestJson<{ api_key?: ApiKeyRecord }>(cfg.API_BASE_URL, '/api/v1/admin/api-keys', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const created = response.api_key;
      setGeneratedKey(created?.key ?? '');
      setStatus(`Created API key for user ${userId}.`);
      setName('');
      setUserId('');
      setGroupsCsv('default');
      setDialogOpen(false);
      apiKeys.refresh();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : String(createError));
    }
  }, [apiKeys, cfg.API_BASE_URL, groupsCsv, name, userId]);

  const revokeKey = React.useCallback(async (key: ApiKeyRecord) => {
    if (!window.confirm(`Revoke API key ${key.name || key.id}?`)) return;
    setError(null);
    try {
      await requestJson(cfg.API_BASE_URL, `/api/v1/admin/api-keys/${key.id}`, { method: 'DELETE' });
      setStatus(`Revoked API key ${key.name || key.id}.`);
      apiKeys.refresh();
    } catch (revokeError) {
      setError(revokeError instanceof Error ? revokeError.message : String(revokeError));
    }
  }, [apiKeys, cfg.API_BASE_URL]);

  const bulkActions = React.useMemo<BulkAction[]>(
    () => [
      { label: 'Export Selected', action: 'export' },
      { label: 'Revoke Selected', action: 'revoke' },
    ],
    [],
  );

  const exportKeys = React.useCallback((selectedIds: string[]) => {
    const payload = rows.filter((row) => selectedIds.includes(String(row.id)));
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'sql-agent-api-keys.json';
    link.click();
    URL.revokeObjectURL(url);
  }, [rows]);

  const revokeKeys = React.useCallback(async (selectedIds: string[]) => {
    const victims = rows.filter((row) => selectedIds.includes(String(row.id)));
    if (victims.length === 0) return;
    if (!window.confirm(`Revoke ${victims.length} selected API key(s)?`)) return;
    setError(null);
    try {
      await Promise.all(
        victims.map((key) =>
          requestJson(cfg.API_BASE_URL, `/api/v1/admin/api-keys/${key.id}`, { method: 'DELETE' }),
        ),
      );
      setStatus(`Revoked ${victims.length} API key(s).`);
      apiKeys.refresh();
    } catch (revokeError) {
      setError(revokeError instanceof Error ? revokeError.message : String(revokeError));
    }
  }, [apiKeys, cfg.API_BASE_URL, rows]);

  const columns: DataColumn<ApiKeyRecord>[] = [
    {
      id: 'name',
      header: 'Name',
      cell: (row) => row.name || `key-${row.id}`,
      sortable: true,
      sortValue: (row) => row.name || `key-${row.id}`,
    },
    {
      id: 'owner',
      header: 'Owner',
      cell: (row) => row.user_id,
    },
    {
      id: 'prefix',
      header: 'Key',
      cell: (row) => row.key_display || row.key_prefix || '—',
    },
    {
      id: 'status',
      header: 'Status',
      cell: (row) => <Badge variant={row.disabled ? 'destructive' : 'default'} className={row.disabled ? '' : 'bg-emerald-600 text-white border-emerald-700'}>{row.disabled ? 'revoked' : 'active'}</Badge>,
    },
    {
      id: 'scopes',
      header: 'Scopes',
      cell: (row) => (row.groups?.length ? row.groups.join(', ') : 'all'),
    },
    {
      id: 'created',
      header: 'Created',
      cell: (row) => (row.created_at ? <RelativeTime timestamp={row.created_at} /> : 'never'),
      sortable: true,
      sortValue: (row) => row.created_at ?? '',
    },
    {
      id: 'expires',
      header: 'Expires',
      cell: (row) => (row.expires_at ? <RelativeTime timestamp={row.expires_at} /> : 'never'),
      sortable: true,
      sortValue: (row) => row.expires_at ?? '',
    },
    {
      id: 'last_used',
      header: 'Last Used',
      cell: (row) => (row.last_used_at ? <RelativeTime timestamp={row.last_used_at} /> : 'never'),
      sortable: true,
      sortValue: (row) => row.last_used_at ?? '',
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: (row) => (
        <Button id={`api-key-revoke-${row.id}`} size="sm" variant="destructive" onClick={() => void revokeKey(row)}>
          Revoke
        </Button>
      ),
    },
  ];

  return (
    <PageFrame
      eyebrow="CFG-10"
      title="API Keys"
      description="Issue scoped API keys through the WebUI, inspect activity, and revoke keys through the same admin proxy used by the backend."
    >
      {authStatus.loading ? <LoadingState label="admin status" /> : null}
      {authStatus.error ? <ErrorState message={authStatus.error} /> : null}
      {authStatus.data?.is_system_admin === false ? (
        <Card id="panelApiKeysDenied">
          <CardHeader>
            <h2 className="text-lg font-semibold">Admin access required</h2>
          </CardHeader>
          <CardContent>
            <ErrorState message="This page is restricted to system administrators." />
          </CardContent>
        </Card>
      ) : null}

      {authStatus.data?.is_system_admin === false ? null : (
        <div className="space-y-6">
          {error ? <ErrorState message={error} /> : null}
          {status ? <p className="text-sm text-slate-600">{status}</p> : null}

          <Card id="panelApiKeysForm">
            <CardHeader>
              <h2 className="text-lg font-semibold">API key actions</h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Button id="api-key-create-btn" type="button" onClick={() => setDialogOpen(true)}>
                  Create API key
                </Button>
                <Button id="api-key-refresh-btn" type="button" variant="secondary" onClick={refreshAll}>
                  Refresh
                </Button>
              </div>
              <RelatedItemsPanel
                emptyMessage="No group scopes selected for the pending API key."
                items={splitCsv(groupsCsv).map((group) => ({ id: group, label: group }))}
                title="Pending key scopes"
              />
              {generatedKey ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                  <div className="mb-2 font-semibold">Generated API key</div>
                  <code id="generated-api-key" className="break-all text-xs">{generatedKey}</code>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card id="panelApiKeys">
            <CardHeader>
              <h2 className="text-lg font-semibold">Issued API keys</h2>
            </CardHeader>
            <CardContent>
              {apiKeys.loading ? <LoadingState label="api keys" /> : null}
              {apiKeys.error ? <ErrorState message={apiKeys.error} /> : null}
              {!apiKeys.loading && !apiKeys.error ? (
                <DataTable
                  columns={columns}
                  rows={rows}
                  emptyMessage="No API keys returned by the backend."
                  getRowId={(row) => String(row.id)}
                  page={page}
                  pageSize={pageSize}
                  onPageChange={setPage}
                  onPageSizeChange={setPageSize}
                  selectable
                  bulkActions={bulkActions}
                  onBulkAction={(action, selectedIds) => {
                    if (action === 'export') exportKeys(selectedIds);
                    if (action === 'revoke') void revokeKeys(selectedIds);
                  }}
                  columnPickerEnabled
                  tableId="sql-agent-api-keys"
                />
              ) : null}
            </CardContent>
          </Card>
        </div>
      )}
      <EntityDialog
        errors={error ? { userId: error } : undefined}
        fields={apiKeyFields}
        mode="add"
        onCancel={() => setDialogOpen(false)}
        onChange={(field, value) => {
          if (field === 'name') setName(String(value ?? ''));
          if (field === 'groupsCsv') setGroupsCsv(String(value ?? ''));
          if (field === 'userId') setUserId(String(value ?? '').split(':')[0] ?? '');
        }}
        onOpenChange={setDialogOpen}
        onSubmit={() => void createKey()}
        open={dialogOpen}
        title="Create API key"
        values={{
          name,
          userId: userOptions.find((option) => option.startsWith(`${userId}:`)) ?? '',
          groupsCsv,
        }}
      />
    </PageFrame>
  );
}
