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

// @cloud-dog/app-sql-agent — RBAC and session administration panel.

// Covers: FR-57

import * as React from 'react';
import { useConfig } from '@cloud-dog/config';
import { useAuth } from '@cloud-dog/auth';
import { Badge, Button, DataTable, type DataColumn, EntityDialog, type EntityFieldDef } from '@cloud-dog/ui';
import { useNavigate } from 'react-router-dom';
import {
  DataList,
  ErrorState,
  JsonBlock,
  LoadingState,
  PageFrame,
  PanelCard,
  requestJson,
  useApiResource,
} from '../lib/sqlAgentApi';

type RoleDefinition = {
  role: string;
  description: string;
  permissions: string;
};

const STANDARD_ROLES: RoleDefinition[] = [
  { role: 'admin', description: 'Full access: system configuration, user management, all CRUD, MCP admin', permissions: '*' },
  { role: 'owner', description: 'Group management, query creation, group-scoped operations', permissions: 'users:read, users:write, groups:read, groups:write' },
  { role: 'user', description: 'Standard operations: CRUD on own resources, query execution', permissions: 'users:read, resources:read, resources:write, sql:query:execute' },
  { role: 'viewer', description: 'Read-only access to queries and results', permissions: 'users:read, resources:read, sql:catalogue:list' },
];

const roleColumns: DataColumn<RoleDefinition>[] = [
  { id: 'role', header: 'Role', cell: (r) => <Badge variant="secondary">{r.role}</Badge>, sortable: true, sortValue: (r) => r.role },
  { id: 'description', header: 'Description', cell: (r) => r.description },
  { id: 'permissions', header: 'Permissions', cell: (r) => <span className="text-xs font-mono">{r.permissions}</span> },
];

type AppRuntimeConfig = {
  API_BASE_URL: string;
};

type AuthStatus = {
  authenticated?: boolean;
  username?: string;
  is_system_admin?: boolean;
  success?: boolean;
};

type GroupRecord = { id: number; name: string; description: string; member_count?: number; roles?: string };

const groupColumns: DataColumn<GroupRecord>[] = [
  { id: 'name', header: 'Name', cell: (r) => r.name, sortable: true, sortValue: (r) => r.name },
  { id: 'description', header: 'Description', cell: (r) => r.description },
  { id: 'roles', header: 'Roles', cell: () => <Badge variant="secondary">default</Badge> },
  { id: 'actions', header: 'Actions', cell: () => null },
];

export function AdminPage() {
  const cfg = useConfig<AppRuntimeConfig>();
  const auth = useAuth();
  const navigate = useNavigate();
  const authStatus = useApiResource<AuthStatus>(
    () => requestJson(cfg.API_BASE_URL, '/api/v1/auth/status'),
    [cfg.API_BASE_URL],
  );
  const groupsResource = useApiResource<{ groups: GroupRecord[] }>(
    () => requestJson(cfg.API_BASE_URL, '/api/v1/admin/groups'),
    [cfg.API_BASE_URL],
  );
  const groupRows = React.useMemo(() => {
    const raw = groupsResource.data;
    if (!raw) return [];
    const groups = (raw as any).result?.groups ?? (raw as any).groups ?? [];
    return groups as GroupRecord[];
  }, [groupsResource.data]);

  const [rbacDialogOpen, setRbacDialogOpen] = React.useState(false);
  const [rbacForm, setRbacForm] = React.useState<Record<string, string>>({ group: '', user: '', role: 'admin' });
  const rbacFields: EntityFieldDef[] = [
    { name: 'group', label: 'Group', type: 'text', required: true },
    { name: 'user', label: 'Subject', type: 'text' },
    { name: 'role', label: 'Role', type: 'text' },
  ];

  const saveRbacBinding = React.useCallback(async () => {
    const name = rbacForm.group?.trim();
    if (!name) return;
    await requestJson(cfg.API_BASE_URL, '/api/v1/admin/groups', {
      method: 'POST',
      body: JSON.stringify({ name, description: `RBAC binding for ${rbacForm.role || 'default'}` }),
    });
    groupsResource.refresh();
    setRbacDialogOpen(false);
    setRbacForm({ group: '', user: '', role: 'admin' });
  }, [cfg.API_BASE_URL, rbacForm, groupsResource]);

  const deleteGroupRow = React.useCallback(async (group: GroupRecord) => {
    await requestJson(cfg.API_BASE_URL, `/api/v1/admin/groups/${group.id}`, { method: 'DELETE' });
    groupsResource.refresh();
  }, [cfg.API_BASE_URL, groupsResource]);

  const groupActionColumns: DataColumn<GroupRecord>[] = React.useMemo(() => [
    ...groupColumns.slice(0, -1),
    { id: 'actions', header: 'Actions', cell: (r) => (
      r.name === 'default' ? null : <Button type="button" variant="destructive" size="sm" onClick={() => void deleteGroupRow(r)}>Delete</Button>
    )},
  ], [deleteGroupRow]);

  return (
    <PageFrame
      eyebrow="FR-57"
      title="RBAC"
      description="Review session identity, authentication state, and administrator visibility before drilling into shared Users, Groups, and API Keys management pages."
    >
      {authStatus.data && authStatus.data.is_system_admin === false ? (
        <PanelCard id="panelUserManagementDenied" title="Admin access required" subtitle="Restricted users cannot access Web UI admin diagnostics.">
          <ErrorState message="This page is restricted to system administrators." />
        </PanelCard>
      ) : null}

      {authStatus.data && authStatus.data.is_system_admin === false ? null : (
      <div className="space-y-6">
        <div className="grid gap-6 xl:grid-cols-[0.7fr_1.3fr]">
          <PanelCard id="panelUserManagement" title="Current session" subtitle="Authenticated operator identity">
            {authStatus.loading ? <LoadingState label="auth status" /> : null}
            {authStatus.error ? <ErrorState message={authStatus.error} /> : null}
            {authStatus.data ? (
              <DataList
                items={[
                  { label: 'Authenticated', value: <Badge variant="secondary">{`${authStatus.data.authenticated}`}</Badge> },
                  { label: 'Username', value: authStatus.data.username ?? 'unknown' },
                  { label: 'System admin', value: <Badge variant="secondary">{`${authStatus.data.is_system_admin}`}</Badge> },
                  { label: 'Display name', value: auth.user?.displayName ?? 'unknown' },
                ]}
              />
            ) : null}
          </PanelCard>

          <PanelCard title="Auth payload" subtitle="Raw backend session envelope">
            {authStatus.data ? <JsonBlock value={authStatus.data} /> : <LoadingState label="auth payload" />}
          </PanelCard>
        </div>

        <PanelCard title="Role Definitions" subtitle="Standard RBAC roles and their permission sets (PS-71 IW5)">
          <DataTable columns={roleColumns} rows={STANDARD_ROLES} getRowId={(r) => r.role} emptyMessage="No roles defined." tableId="sql-agent-rbac-roles" />
        </PanelCard>

        <PanelCard title="Group Role Bindings" subtitle="Groups with assigned roles and permissions">
          <Button type="button" variant="outline" size="sm" className="mb-3" onClick={() => setRbacDialogOpen(true)}>
            Add Binding
          </Button>
          <DataTable columns={groupActionColumns} rows={groupRows} getRowId={(r) => String(r.id)} emptyMessage="No group bindings." tableId="sql-agent-rbac-bindings" />
          <EntityDialog
            open={rbacDialogOpen}
            onOpenChange={setRbacDialogOpen}
            title="Add Role Binding"
            fields={rbacFields}
            values={rbacForm}
            onChange={(name, value) => setRbacForm((prev) => ({ ...prev, [name]: value }))}
            onSubmit={() => void saveRbacBinding()}
            idPrefix="rbac"
          />
        </PanelCard>

        <div className="grid gap-6 xl:grid-cols-3">
          <PanelCard id="panelUsersLink" title="Users" subtitle="Create, edit, disable, and delete operator accounts.">
            <Button id="admin-nav-users" type="button" onClick={() => navigate('/admin/users')}>
              Open Users
            </Button>
          </PanelCard>
          <PanelCard id="panelGroupsLink" title="Groups" subtitle="Manage groups and assign member or admin membership.">
            <Button id="admin-nav-groups" type="button" onClick={() => navigate('/admin/groups')}>
              Open Groups
            </Button>
          </PanelCard>
          <PanelCard id="panelApiKeysLink" title="API Keys" subtitle="Issue and revoke backend API keys via the Web proxy.">
            <Button id="admin-nav-api-keys" type="button" onClick={() => navigate('/admin/api-keys')}>
              Open API Keys
            </Button>
          </PanelCard>
        </div>
      </div>
      )}
    </PageFrame>
  );
}
