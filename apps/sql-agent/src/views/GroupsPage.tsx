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
  name?: string;
};

type GroupRecord = {
  id: number;
  name: string;
  description?: string | null;
  members?: UserRecord[];
  admin_members?: UserRecord[];
  member_count?: number;
};

type GroupsResponse = {
  groups?: GroupRecord[];
};

type UsersResponse = {
  users?: UserRecord[];
};

type GroupFormState = {
  name: string;
  description: string;
  memberUsernames: string;
  adminUsernames: string;
};

const EMPTY_GROUP_FORM: GroupFormState = {
  name: '',
  description: '',
  memberUsernames: '',
  adminUsernames: '',
};

const GROUP_FIELDS: EntityFieldDef[] = [
  { name: 'name', label: 'Name', type: 'text', required: true },
  { name: 'description', label: 'Description', type: 'text' },
  { name: 'memberUsernames', label: 'Members', type: 'text' },
  { name: 'adminUsernames', label: 'Admin members', type: 'text' },
];

function splitCsv(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function GroupsPage() {
  const cfg = useConfig<AppRuntimeConfig>();
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);
  const authStatus = useApiResource<AuthStatus>(
    () => requestJson(cfg.API_BASE_URL, '/api/v1/auth/status'),
    [cfg.API_BASE_URL],
  );
  const groups = useApiResource<GroupsResponse>(
    () => requestJson(cfg.API_BASE_URL, '/api/v1/admin/groups'),
    [cfg.API_BASE_URL],
  );
  const users = useApiResource<UsersResponse>(
    () => requestJson(cfg.API_BASE_URL, '/api/v1/admin/users?include_disabled=false'),
    [cfg.API_BASE_URL],
  );

  const [form, setForm] = React.useState<GroupFormState>(EMPTY_GROUP_FORM);
  const [editingGroupId, setEditingGroupId] = React.useState<number | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [deletedIds, setDeletedIds] = React.useState<Set<number>>(new Set());

  const groupRows = (groups.data?.groups ?? []).filter((g: GroupRecord) => !deletedIds.has(g.id));
  const userRows = users.data?.users ?? [];
  const userDirectoryReady = !users.loading && !users.error;

  React.useEffect(() => {
    setPage(1);
  }, [groupRows.length]);

  const refreshAll = React.useCallback(() => {
    authStatus.refresh();
    groups.refresh();
    users.refresh();
  }, [authStatus, groups, users]);

  const resetForm = React.useCallback(() => {
    setForm(EMPTY_GROUP_FORM);
    setEditingGroupId(null);
    setError(null);
    setDialogOpen(false);
  }, []);

  const beginEdit = React.useCallback((group: GroupRecord) => {
    setEditingGroupId(group.id);
    setForm({
      name: group.name,
      description: group.description ?? '',
      memberUsernames: (group.members ?? []).map((member) => member.username).join(', '),
      adminUsernames: (group.admin_members ?? []).map((member) => member.username).join(', '),
    });
    setStatus(`Editing group ${group.name}`);
    setError(null);
    setDialogOpen(true);
  }, []);

  const saveGroup = React.useCallback(async () => {
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      if (!userDirectoryReady) {
        throw new Error('User directory is still loading. Wait a moment and try again.');
      }
      const memberNames = splitCsv(form.memberUsernames);
      const adminNames = splitCsv(form.adminUsernames);
      const userLookup = new Map(
        userRows.map((user) => [user.username.toLowerCase(), user.id]),
      );
      const unknownMembers = memberNames.filter((username) => !userLookup.has(username.toLowerCase()));
      const unknownAdmins = adminNames.filter((username) => !userLookup.has(username.toLowerCase()));
      if (unknownMembers.length || unknownAdmins.length) {
        throw new Error(
          `Unknown users: ${[...unknownMembers, ...unknownAdmins].join(', ')}`,
        );
      }
      const normalizedMembers = Array.from(new Set([...memberNames, ...adminNames]));
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        member_user_ids: normalizedMembers.map((username) => userLookup.get(username.toLowerCase()) as number),
        admin_user_ids: adminNames.map((username) => userLookup.get(username.toLowerCase()) as number),
      };
      if (!payload.name) {
        throw new Error('Group name is required.');
      }

      if (editingGroupId === null) {
        await requestJson(cfg.API_BASE_URL, '/api/v1/admin/groups', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setStatus(`Created group ${payload.name}.`);
      } else {
        await requestJson(cfg.API_BASE_URL, `/api/v1/admin/groups/${editingGroupId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        setStatus(`Updated group ${payload.name}.`);
      }

      resetForm();
      refreshAll();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : String(saveError));
    } finally {
      setSaving(false);
    }
  }, [cfg.API_BASE_URL, editingGroupId, form, refreshAll, resetForm, userDirectoryReady, userRows]);

  const deleteGroup = async (group: GroupRecord) => {
    setError(null);
    setStatus(null);
    try {
      await requestJson(cfg.API_BASE_URL, `/api/v1/admin/groups/${group.id}`, { method: 'DELETE' });
      setDeletedIds((prev) => new Set([...prev, group.id]));
      setStatus(`Deleted group ${group.name}.`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const bulkActions = React.useMemo<BulkAction[]>(
    () => [
      { label: 'Export Selected', action: 'export' },
      { label: 'Delete Selected', action: 'delete' },
    ],
    [],
  );

  const exportGroups = React.useCallback((selectedIds: string[]) => {
    const payload = groupRows.filter((row) => selectedIds.includes(String(row.id)));
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'sql-agent-groups.json';
    link.click();
    URL.revokeObjectURL(url);
  }, [groupRows]);

  const deleteGroups = React.useCallback(async (selectedIds: string[]) => {
    const victims = groupRows.filter((row) => selectedIds.includes(String(row.id)));
    if (victims.length === 0) return;
    // Direct bulk delete without window.confirm
    setError(null);
    try {
      await Promise.all(
        victims.map((group) =>
          requestJson(cfg.API_BASE_URL, `/api/v1/admin/groups/${group.id}`, { method: 'DELETE' }),
        ),
      );
      setStatus(`Deleted ${victims.length} group(s).`);
      refreshAll();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : String(deleteError));
    }
  }, [cfg.API_BASE_URL, groupRows, refreshAll]);

  const columns: DataColumn<GroupRecord>[] = [
    {
      id: 'name',
      header: 'Name',
      cell: (row) => <span className="max-w-[12rem] truncate block" title={row.name}>{row.name}</span>,
      sortable: true,
      sortValue: (row) => row.name,
    },
    {
      id: 'description',
      header: 'Description',
      cell: (row) => <span className="max-w-[10rem] truncate block" title={row.description || ''}>{row.description || '—'}</span>,
    },
    {
      id: 'members',
      header: 'Members',
      cell: (row) => <Badge variant="secondary">{row.members?.length ?? row.member_count ?? 0}</Badge>,
    },
    {
      id: 'roles',
      header: 'Roles',
      cell: (row) => (row as Record<string, unknown>).roles ? String((row as Record<string, unknown>).roles) : 'default',
    },
    {
      id: 'status',
      header: 'Status',
      cell: () => <Badge variant="default" className="bg-emerald-600 text-white border-emerald-700">active</Badge>,
    },
    {
      id: 'created_at',
      header: 'Created',
      cell: (row) => (row as Record<string, unknown>).created_at ? String((row as Record<string, unknown>).created_at).slice(0, 10) : '—',
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: (row) => (
        <div className="flex flex-wrap gap-2">
          <Button
            id={`group-edit-${row.id}`}
            variant="secondary"
            onClick={() => beginEdit(row)}
          >
            Edit
          </Button>
          {row.name !== 'default' ? (
            <Button
              id={`group-delete-${row.id}`}
              variant="ghost"
              className="!transition-none"
              onClick={() => void deleteGroup(row)}
            >
              Delete
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <PageFrame
      eyebrow="CFG-09"
      title="Groups"
      description="Create groups, manage descriptions, and control membership or admin membership assignments through the SQL-agent admin proxy."
    >
      {authStatus.loading ? <LoadingState label="admin status" /> : null}
      {authStatus.error ? <ErrorState message={authStatus.error} /> : null}
      {authStatus.data?.is_system_admin === false ? (
        <Card id="panelGroupsDenied">
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

          <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Button
                  id="group-open-create-btn"
                  disabled={users.loading}
                  onClick={() => {
                    setForm(EMPTY_GROUP_FORM);
                    setEditingGroupId(null);
                    setDialogOpen(true);
                  }}
                  type="button"
                >
                  Add group
                </Button>
                <Button id="group-refresh-btn" type="button" variant="secondary" onClick={refreshAll}>
                  Refresh
                </Button>
              </div>
              {users.loading ? (
                <p className="text-sm text-slate-600">
                  Loading user directory before group membership can be edited.
                </p>
              ) : null}
              {users.error ? <ErrorState message={users.error} /> : null}
              {(form.memberUsernames || form.adminUsernames) ? (
                <div className="grid gap-4 lg:grid-cols-2">
                  <RelatedItemsPanel
                    emptyMessage="No members selected for the pending group."
                    items={splitCsv(form.memberUsernames).map((username) => ({ id: username, label: username }))}
                    title="Pending members"
                  />
                  <RelatedItemsPanel
                    emptyMessage="No admin members selected for the pending group."
                    items={splitCsv(form.adminUsernames).map((username) => ({ id: username, label: username }))}
                    title="Pending admin members"
                  />
                </div>
              ) : null}
          </div>

          <div id="panelGroups">
              {groups.loading ? <LoadingState label="groups" /> : null}
              {groups.error ? <ErrorState message={groups.error} /> : null}
              {!groups.loading && !groups.error ? (
                <DataTable
                  columns={columns}
                  rows={groupRows}
                  emptyMessage="No groups returned by the backend."
                  getRowId={(row) => String(row.id)}
                  page={page}
                  pageSize={pageSize}
                  onPageChange={setPage}
                  onPageSizeChange={setPageSize}
                  tableId="sql-agent-groups"
                />
              ) : null}
          </div>
        </div>
      )}
      <EntityDialog
        errors={error ? { name: error } : undefined}
        fields={GROUP_FIELDS}
        mode={editingGroupId === null ? 'add' : 'edit'}
        onCancel={resetForm}
        onChange={(name, value) => setForm((current) => ({ ...current, [name]: String(value ?? '') }))}
        onOpenChange={setDialogOpen}
        onSubmit={() => void saveGroup()}
        open={dialogOpen}
        title={editingGroupId === null ? 'Create group' : `Edit group #${editingGroupId}`}
        values={form}
      />
    </PageFrame>
  );
}
