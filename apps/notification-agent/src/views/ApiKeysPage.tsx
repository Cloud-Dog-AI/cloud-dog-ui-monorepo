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

// @cloud-dog/app-notification-agent — API key administration adopted onto shared CRUD components.
// Covers: UI-R1, UI-R2

import * as React from 'react';
import { Badge, Button, Card, CardContent, CardHeader, DataTable, EntityDialog, Input, Label, RelativeTime, Select } from '@cloud-dog/ui';
import type { BulkAction, DataColumn } from '@cloud-dog/ui';
import { useNotificationAgentState } from '../state/AppState';
import type { AdminApiKeyRecord, GroupRecord, UserRecord } from '../lib/api';

type ApiKeyFormValues = Readonly<{
  owner_user_id: string;
  key_prefix: string;
  ttl_days: string;
}>;

const emptyForm: ApiKeyFormValues = {
  owner_user_id: '',
  key_prefix: '',
  ttl_days: '7',
};

function validate(values: ApiKeyFormValues): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!values.owner_user_id.trim()) errors.owner_user_id = 'Owner user id is required.';
  if (!values.ttl_days.trim()) errors.ttl_days = 'TTL days is required.';
  else if (Number(values.ttl_days) < 1) errors.ttl_days = 'TTL days must be at least 1.';
  return errors;
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

function fallbackTimestamp(value: string | null | undefined): string {
  return value && value.trim() ? value : new Date().toISOString();
}

export function ApiKeysPage() {
  const { api, latestFailure, captureFailure, clearFailure } = useNotificationAgentState();
  const [keys, setKeys] = React.useState<AdminApiKeyRecord[]>([]);
  const [users, setUsers] = React.useState<UserRecord[]>([]);
  const [groups, setGroups] = React.useState<GroupRecord[]>([]);
  const [query, setQuery] = React.useState(() => new URLSearchParams(window.location.search).get('owner') ?? '');
  const [status, setStatus] = React.useState('');
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [formValues, setFormValues] = React.useState<ApiKeyFormValues>(emptyForm);
  const [formErrors, setFormErrors] = React.useState<Record<string, string>>({});
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);

  const loadKeys = React.useCallback(async (ownerUserId?: string) => {
    clearFailure();
    try {
      const [items, userList, groupList] = await Promise.all([
        api.listAdminApiKeys(ownerUserId),
        api.listUsers(),
        api.listGroups(),
      ]);
      setKeys(items);
      setUsers(userList);
      setGroups(groupList);
    } catch (error) {
      captureFailure(error);
    }
  }, [api, captureFailure, clearFailure]);

  React.useEffect(() => {
    void loadKeys();
  }, [loadKeys]);

  React.useEffect(() => {
    setPage(1);
  }, [query]);

  const filteredKeys = keys.filter((item) => {
    if (!query.trim()) return true;
    const haystack = `${item.api_key_id} ${item.owner_user_id ?? ''} ${item.key_prefix ?? ''}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  });

  const revokeKeys = async (items: AdminApiKeyRecord[]) => {
    clearFailure();
    setStatus('');
    try {
      for (const item of items) {
        await api.revokeAdminApiKey(item.api_key_id);
      }
      setStatus(`Disabled ${items.length} API key${items.length === 1 ? '' : 's'}.`);
      await loadKeys(query);
    } catch (error) {
      captureFailure(error);
    }
  };

  const columns = React.useMemo<DataColumn<AdminApiKeyRecord>[]>(() => [
    {
      id: 'api_key_id',
      header: 'Key name',
      sortable: true,
      sortValue: (item) => item.api_key_id,
      cell: (item) => <span className="font-medium">{item.api_key_id}</span>,
    },
    {
      id: 'key_prefix',
      header: 'Prefix',
      sortable: true,
      sortValue: (item) => item.key_prefix ?? '',
      cell: (item) => item.key_prefix ?? '',
    },
    {
      id: 'owner',
      header: 'Owner',
      sortable: true,
      sortValue: (item) => item.owner_user_id ?? '',
      cell: (item) => item.owner_user_id ?? '',
    },
    {
      id: 'created_at',
      header: 'Created',
      sortable: true,
      sortValue: (item) => item.created_at ?? '',
      cell: (item) => <RelativeTime timestamp={fallbackTimestamp(item.created_at)} />,
    },
    {
      id: 'expires_at',
      header: 'Expires',
      sortable: true,
      sortValue: (item) => item.expires_at ?? '',
      cell: (item) => item.expires_at ? <RelativeTime timestamp={item.expires_at} /> : 'No expiry',
    },
    {
      id: 'last_used',
      header: 'Last Used',
      sortable: true,
      sortValue: (item) => item.last_used_at ?? item.last_used ?? '',
      cell: (item) => item.last_used_at || item.last_used ? <RelativeTime timestamp={item.last_used_at ?? item.last_used ?? ''} /> : 'Never',
    },
    {
      id: 'status',
      header: 'Status',
      sortable: true,
      sortValue: (item) => item.status ?? (item.revoked ? 'revoked' : 'active'),
      cell: (item) => {
        const status = String(item.status ?? (item.revoked ? 'revoked' : 'active')).toLowerCase();
        return <Badge variant={status === 'revoked' ? 'destructive' : 'default'}>{status === 'revoked' ? 'Disabled' : 'Active'}</Badge>;
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: (item) => {
        const status = String(item.status ?? (item.revoked ? 'revoked' : 'active')).toLowerCase();
        if (status === 'revoked') return null;
        return (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => void revokeKeys([item])}>
              Disable
            </Button>
          </div>
        );
      },
    },
  ], [revokeKeys]);

  const bulkActions = React.useMemo<BulkAction[]>(() => [
    { label: 'Disable selected', action: 'revoke' },
    { label: 'Export', action: 'export' },
  ], []);

  const onBulkAction = React.useCallback((action: string, selectedIds: string[]) => {
    const items = filteredKeys.filter((item) => selectedIds.includes(item.api_key_id));
    if (action === 'revoke') {
      void revokeKeys(items);
      return;
    }
    if (action === 'export') {
      downloadJson('notification-api-keys.json', items);
    }
  }, [filteredKeys, revokeKeys]);

  const createKey = async () => {
    const errors = validate(formValues);
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    clearFailure();
    setStatus('');
    try {
      const payload: Record<string, unknown> = {
        owner_user_id: formValues.owner_user_id.trim(),
        ttl_days: Number(formValues.ttl_days),
      };
      if (formValues.key_prefix.trim()) payload.key_prefix = formValues.key_prefix.trim();
      await api.createAdminApiKey(payload);
      setStatus('Created API key.');
      setDialogOpen(false);
      setFormValues(emptyForm);
      await loadKeys(query);
    } catch (error) {
      captureFailure(error);
    }
  };


  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">API Keys</h1>
      </header>

      {latestFailure ? <p role="alert" className="text-sm text-destructive">{latestFailure}</p> : null}
      {status ? <p role="status" className="text-sm text-foreground/80">{status}</p> : null}

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Issued keys</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="flex-1">
              <Label htmlFor="api-keys-search-adopted">Search keys</Label>
              <Input
                id="api-keys-search-adopted"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by key id, owner or prefix"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => void loadKeys(query)}>Search</Button>
              <Button onClick={() => { setFormValues(emptyForm); setFormErrors({}); setDialogOpen(true); }}>Add API key</Button>
            </div>
          </div>

          <DataTable
            tableId="notification-api-keys"
            columns={columns}
            rows={filteredKeys}
            totalRows={keys.length}
            getRowId={(item) => item.api_key_id}
            page={page}
            onPageChange={setPage}
            pageSize={pageSize}
            onPageSizeChange={setPageSize}
            selectable={true}
            bulkActions={bulkActions}
            onBulkAction={onBulkAction}
            columnPickerEnabled={true}
          />
        </CardContent>
      </Card>

      <EntityDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title="Add API key"
        body={(
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void createKey();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="api-key-owner-adopted">Owner</Label>
              <Select id="api-key-owner-adopted" value={formValues.owner_user_id} onChange={(event) => setFormValues((current) => ({ ...current, owner_user_id: event.target.value }))}>
                <option value="">Select owner</option>
                {users.map((user) => <option key={`user-${user.id}`} value={String(user.id)}>{user.username} ({user.email})</option>)}
                {groups.map((group) => <option key={`group-${group.id}`} value={`group:${group.id}`}>Group: {group.name}</option>)}
              </Select>
              {formErrors.owner_user_id ? <p className="text-sm text-destructive">{formErrors.owner_user_id}</p> : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="api-key-prefix-adopted">Key prefix</Label>
              <Input id="api-key-prefix-adopted" value={formValues.key_prefix} onChange={(event) => setFormValues((current) => ({ ...current, key_prefix: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="api-key-ttl-adopted">TTL days</Label>
              <Input id="api-key-ttl-adopted" type="number" min={1} value={formValues.ttl_days} onChange={(event) => setFormValues((current) => ({ ...current, ttl_days: event.target.value }))} />
              {formErrors.ttl_days ? <p className="text-sm text-destructive">{formErrors.ttl_days}</p> : null}
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit">Save</Button>
            </div>
          </form>
        )}
      />
    </div>
  );
}
