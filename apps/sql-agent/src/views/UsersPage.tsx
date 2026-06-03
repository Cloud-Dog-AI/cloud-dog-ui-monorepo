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
  authenticated?: boolean;
  username?: string;
  is_system_admin?: boolean;
};

type UserRecord = {
  id: number;
  username: string;
  name?: string;
  email?: string;
  is_system_admin?: boolean;
  disabled?: boolean;
  groups?: string[];
  created_at?: string | null;
  last_login?: string | null;
};

type UsersResponse = {
  users?: UserRecord[];
};

type UserFormState = {
  username: string;
  name: string;
  email: string;
  password: string;
  isSystemAdmin: string;
  groupsCsv: string;
};

const EMPTY_FORM: UserFormState = {
  username: '',
  name: '',
  email: '',
  password: '',
  isSystemAdmin: 'false',
  groupsCsv: 'default',
};

const USER_FIELDS: EntityFieldDef[] = [
  { name: 'username', label: 'Username', type: 'text', required: true },
  { name: 'name', label: 'Display name', type: 'text' },
  { name: 'email', label: 'Email', type: 'text' },
  { name: 'password', label: 'Password', type: 'text' },
  { name: 'isSystemAdmin', label: 'System admin', type: 'select', options: ['false', 'true'] },
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

export function UsersPage() {
  const cfg = useConfig<AppRuntimeConfig>();
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);
  const authStatus = useApiResource<AuthStatus>(
    () => requestJson(cfg.API_BASE_URL, '/api/v1/auth/status'),
    [cfg.API_BASE_URL],
  );
  const users = useApiResource<UsersResponse>(
    () => requestJson(cfg.API_BASE_URL, '/api/v1/admin/users?include_disabled=true'),
    [cfg.API_BASE_URL],
  );

  const [form, setForm] = React.useState<UserFormState>(EMPTY_FORM);
  const [editingUserId, setEditingUserId] = React.useState<number | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);

  const rows = users.data?.users ?? [];

  React.useEffect(() => {
    setPage(1);
  }, [rows.length]);

  const resetForm = React.useCallback(() => {
    setForm(EMPTY_FORM);
    setEditingUserId(null);
    setError(null);
    setDialogOpen(false);
  }, []);

  const beginEdit = React.useCallback((user: UserRecord) => {
    setEditingUserId(user.id);
    setForm({
      username: user.username,
      name: user.name ?? '',
      email: user.email ?? '',
      password: '',
      isSystemAdmin: user.is_system_admin ? 'true' : 'false',
      groupsCsv: (user.groups ?? []).join(', ') || 'default',
    });
    setStatus(`Editing ${user.username}`);
    setError(null);
    setDialogOpen(true);
  }, []);

  const refreshUsers = React.useCallback(() => {
    users.refresh();
    authStatus.refresh();
  }, [authStatus, users]);

  const saveUser = React.useCallback(async () => {
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      const payload: Record<string, unknown> = {
        username: form.username.trim(),
        name: form.name.trim() || form.username.trim(),
        email: form.email.trim() || `${form.username.trim()}@example.com`,
        is_system_admin: form.isSystemAdmin === 'true',
        groups: splitCsv(form.groupsCsv),
      };
      if (form.password.trim()) {
        payload.password = form.password;
      }

      if (editingUserId === null) {
        if (!form.password.trim()) {
          throw new Error('Password is required for new users.');
        }
        await requestJson(cfg.API_BASE_URL, '/api/v1/admin/users', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setStatus(`Created user ${form.username.trim()}.`);
      } else {
        await requestJson(cfg.API_BASE_URL, `/api/v1/admin/users/${editingUserId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        setStatus(`Updated user ${form.username.trim()}.`);
      }

      resetForm();
      refreshUsers();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : String(saveError));
    } finally {
      setSaving(false);
    }
  }, [cfg.API_BASE_URL, editingUserId, form, refreshUsers, resetForm]);

  const deleteUser = React.useCallback(async (user: UserRecord) => {
    if (!window.confirm(`Delete user ${user.username}?`)) return;
    setError(null);
    try {
      await requestJson(cfg.API_BASE_URL, `/api/v1/admin/users/${user.id}`, { method: 'DELETE' });
      setStatus(`Deleted user ${user.username}.`);
      if (editingUserId === user.id) resetForm();
      refreshUsers();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : String(deleteError));
    }
  }, [cfg.API_BASE_URL, editingUserId, refreshUsers, resetForm]);

  const toggleUser = React.useCallback(async (user: UserRecord) => {
    setError(null);
    try {
      const action = user.disabled ? 'enable' : 'disable';
      await requestJson(cfg.API_BASE_URL, `/api/v1/admin/users/${user.id}/${action}`, { method: 'POST' });
      setStatus(`${action === 'enable' ? 'Enabled' : 'Disabled'} user ${user.username}.`);
      refreshUsers();
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : String(toggleError));
    }
  }, [cfg.API_BASE_URL, refreshUsers]);

  const bulkActions = React.useMemo<BulkAction[]>(
    () => [
      { label: 'Export Selected', action: 'export' },
      { label: 'Delete Selected', action: 'delete' },
    ],
    [],
  );

  const exportUsers = React.useCallback((selectedIds: string[]) => {
    const payload = rows.filter((row) => selectedIds.includes(String(row.id)));
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'sql-agent-users.json';
    link.click();
    URL.revokeObjectURL(url);
  }, [rows]);

  const deleteUsers = React.useCallback(async (selectedIds: string[]) => {
    const victims = rows.filter((row) => selectedIds.includes(String(row.id)));
    if (victims.length === 0) return;
    if (!window.confirm(`Delete ${victims.length} selected user(s)?`)) return;
    setError(null);
    try {
      await Promise.all(
        victims.map((user) =>
          requestJson(cfg.API_BASE_URL, `/api/v1/admin/users/${user.id}`, { method: 'DELETE' }),
        ),
      );
      setStatus(`Deleted ${victims.length} user(s).`);
      refreshUsers();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : String(deleteError));
    }
  }, [cfg.API_BASE_URL, refreshUsers, rows]);

  const columns: DataColumn<UserRecord>[] = [
    {
      id: 'username',
      header: 'Username',
      cell: (row) => row.username,
      sortable: true,
      sortValue: (row) => row.username,
    },
    {
      id: 'name',
      header: 'Display Name',
      cell: (row) => row.name ?? '—',
      sortable: true,
      sortValue: (row) => row.name ?? '',
    },
    {
      id: 'email',
      header: 'Email',
      cell: (row) => row.email ?? '—',
      sortable: true,
      sortValue: (row) => row.email ?? '',
    },
    {
      id: 'role',
      header: 'Role',
      cell: (row) => <Badge variant="secondary">{row.is_system_admin ? 'admin' : 'user'}</Badge>,
    },
    {
      id: 'status',
      header: 'Status',
      cell: (row) => <Badge variant={row.disabled ? 'destructive' : 'default'} className={row.disabled ? '' : 'bg-emerald-600 text-white border-emerald-700'}>{row.disabled ? 'disabled' : 'active'}</Badge>,
      sortable: true,
      sortValue: (row) => row.disabled ? 'disabled' : 'active',
    },
    {
      id: 'groups',
      header: 'Groups',
      cell: (row) => (row.groups?.length ? row.groups.join(', ') : '—'),
    },
    {
      id: 'created_at',
      header: 'Created',
      cell: (row) => row.created_at ? <RelativeTime timestamp={row.created_at} /> : '—',
      sortable: true,
      sortValue: (row) => row.created_at ?? '',
    },
    {
      id: 'last_login',
      header: 'Last Login',
      cell: (row) => row.last_login ? <RelativeTime timestamp={row.last_login} /> : 'never',
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: (row) => (
        <div className="flex flex-wrap gap-2">
          <Button id={`user-edit-${row.id}`} size="sm" variant="secondary" onClick={() => beginEdit(row)}>
            Edit
          </Button>
          <Button id={`user-toggle-${row.id}`} size="sm" variant="secondary" onClick={() => void toggleUser(row)}>
            {row.disabled ? 'Enable' : 'Disable'}
          </Button>
          <Button id={`user-delete-${row.id}`} size="sm" variant="destructive" onClick={() => void deleteUser(row)}>
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <PageFrame
      eyebrow="CFG-08"
      title="Users"
      description="Create, update, enable, disable, reset passwords, and remove SQL-agent operator accounts through the authenticated admin proxy."
    >
      {authStatus.loading ? <LoadingState label="admin status" /> : null}
      {authStatus.error ? <ErrorState message={authStatus.error} /> : null}
      {authStatus.data?.is_system_admin === false ? (
        <Card id="panelUsersDenied">
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

          <Card id="panelUsersForm">
            <CardHeader>
              <h2 className="text-lg font-semibold">User actions</h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Button
                  id="user-open-create-btn"
                  onClick={() => {
                    setForm(EMPTY_FORM);
                    setEditingUserId(null);
                    setDialogOpen(true);
                  }}
                  type="button"
                >
                  Add user
                </Button>
                <Button id="user-refresh-btn" type="button" variant="secondary" onClick={refreshUsers}>
                  Refresh
                </Button>
              </div>
              <RelatedItemsPanel
                emptyMessage="No groups set for the pending user."
                items={splitCsv(form.groupsCsv).map((group) => ({ id: group, label: group }))}
                title="Pending group assignments"
              />
            </CardContent>
          </Card>

          <Card id="panelUsers">
            <CardHeader>
              <h2 className="text-lg font-semibold">User inventory</h2>
            </CardHeader>
            <CardContent>
              {users.loading ? <LoadingState label="users" /> : null}
              {users.error ? <ErrorState message={users.error} /> : null}
              {!users.loading && !users.error ? (
                <DataTable
                  columns={columns}
                  rows={rows}
                  emptyMessage="No users returned by the backend."
                  getRowId={(row) => String(row.id)}
                  page={page}
                  pageSize={pageSize}
                  onPageChange={setPage}
                  onPageSizeChange={setPageSize}
                  selectable
                  bulkActions={bulkActions}
                  onBulkAction={(action, selectedIds) => {
                    if (action === 'export') exportUsers(selectedIds);
                    if (action === 'delete') void deleteUsers(selectedIds);
                  }}
                  columnPickerEnabled
                  tableId="sql-agent-users"
                />
              ) : null}
            </CardContent>
          </Card>
        </div>
      )}
      <EntityDialog
        errors={error ? { username: error } : undefined}
        fields={USER_FIELDS.map((field) =>
          field.name === 'username' && editingUserId !== null ? { ...field, readOnly: true } : field,
        )}
        mode={editingUserId === null ? 'add' : 'edit'}
        onCancel={resetForm}
        onChange={(name, value) => setForm((current) => ({ ...current, [name]: value }))}
        onOpenChange={setDialogOpen}
        onSubmit={() => void saveUser()}
        open={dialogOpen}
        title={editingUserId === null ? 'Create user' : `Edit user #${editingUserId}`}
        values={form}
      />
    </PageFrame>
  );
}
