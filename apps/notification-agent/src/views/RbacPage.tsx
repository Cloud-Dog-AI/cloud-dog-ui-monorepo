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

// @cloud-dog/app-notification-agent — RBAC view for role definitions and user-role assignments.
// Covers: PS-71 IW5

import * as React from 'react';
import { Badge, Button, Card, CardContent, CardHeader, DataTable, EntityDialog, Input, Label, MultiSelect } from '@cloud-dog/ui';
import type { BulkAction, DataColumn, EntityFormMode } from '@cloud-dog/ui';
import { useNotificationAgentState } from '../state/AppState';
import type { ChannelRecord, RbacRoleRecord, UserRecord } from '../lib/api';

const FUNCTION_OPTIONS = [
  'notification:send:execute',
  'notification:item:read',
  'notification:item:delete',
  'notification:list:read',
  'notification:config:read',
  'notification:config:write',
  'notify:admin:*',
  '*',
];

type RoleFormValues = Readonly<{
  name: string;
  description: string;
  group: string;
  user: string;
}>;

const emptyRole: RoleFormValues = {
  name: '',
  description: '',
  group: '',
  user: '',
};

export function RbacPage() {
  const { api, latestFailure, captureFailure, clearFailure } = useNotificationAgentState();
  const [roles, setRoles] = React.useState<RbacRoleRecord[]>([]);
  const [users, setUsers] = React.useState<UserRecord[]>([]);
  const [channels, setChannels] = React.useState<ChannelRecord[]>([]);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [dialogMode, setDialogMode] = React.useState<EntityFormMode>('add');
  const [activeRole, setActiveRole] = React.useState<RbacRoleRecord | null>(null);
  const [formValues, setFormValues] = React.useState<RoleFormValues>(emptyRole);
  const [selectedFunctions, setSelectedFunctions] = React.useState<string[]>([]);
  const [selectedChannels, setSelectedChannels] = React.useState<string[]>([]);
  const [status, setStatus] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);

  const loadData = React.useCallback(async () => {
    clearFailure();
    try {
      const [roleList, userList, channelList] = await Promise.all([
        api.listRbacRoles(),
        api.listUsers(),
        api.listChannels(),
      ]);
      setRoles(roleList);
      setUsers(userList);
      setChannels(channelList);
    } catch (error) {
      captureFailure(error);
    }
  }, [api, captureFailure, clearFailure]);

  React.useEffect(() => {
    void loadData();
  }, [loadData]);

  const openDialog = (mode: EntityFormMode, role?: RbacRoleRecord) => {
    setDialogMode(mode);
    setActiveRole(role ?? null);
    setFormValues(role ? { name: role.name, description: role.description ?? '', group: '', user: '' } : emptyRole);
    setSelectedFunctions(role?.functions ?? role?.permissions?.filter((permission) => !permission.startsWith('channel:')) ?? []);
    setSelectedChannels((role?.channels ?? []).map((permission) => permission.replace(/:(read|write|admin)$/, '')));
    setDialogOpen(true);
  };

  const saveRole = async () => {
    const permissions = [
      ...selectedFunctions,
      ...selectedChannels.map((channelId) => `channel:${channelId}:read`),
    ];
    clearFailure();
    setStatus('');
    try {
      const roleName = formValues.group.trim() || formValues.name;
      if (dialogMode === 'add') {
        await api.createRbacRole({
          name: roleName,
          description: formValues.description || `Binding for group ${formValues.group.trim()} user ${formValues.user.trim()}`.trim(),
          permissions,
        });
      } else if (activeRole) {
        await api.updateRbacRole(activeRole.name, {
          description: formValues.description,
          permissions,
        });
      }
      setStatus(dialogMode === 'add' ? `Created role ${roleName}.` : `Updated role ${activeRole?.name ?? ''}.`);
      await loadData();
    } catch (error) {
      captureFailure(error);
    } finally {
      setDialogOpen(false);
    }
  };

  const deleteRoles = async (items: RbacRoleRecord[]) => {
    clearFailure();
    setStatus('');
    try {
      for (const item of items) {
        await api.deleteRbacRole(item.name);
      }
      setStatus(`Revoked ${items.length} role${items.length === 1 ? '' : 's'}.`);
      await loadData();
    } catch (error) {
      captureFailure(error);
    }
  };

  const roleColumns: DataColumn<RbacRoleRecord>[] = [
    {
      id: 'role',
      header: 'Role',
      cell: (row) => <Badge variant={row.name === 'admin' ? 'default' : 'secondary'}>{row.name}</Badge>,
      sortable: true,
      sortValue: (row) => row.name,
    },
    { id: 'description', header: 'Description', cell: (row) => row.description ?? '' },
    {
      id: 'permissions',
      header: 'Permissions',
      cell: (row) => String(row.permissions?.length ?? 0),
      sortable: true,
      sortValue: (row) => row.permissions?.length ?? 0,
    },
    {
      id: 'channels',
      header: 'Channels',
      cell: (row) => String(row.channels?.length ?? 0),
      sortable: true,
      sortValue: (row) => row.channels?.length ?? 0,
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: (row) => (
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => openDialog('view', row)}>View</Button>
          <Button variant="secondary" onClick={() => openDialog('edit', row)}>Edit</Button>
          {row.name !== 'admin' ? <Button variant="secondary" onClick={() => void deleteRoles([row])}>Delete</Button> : null}
        </div>
      ),
    },
  ];

  const userRoleColumns: DataColumn<UserRecord>[] = [
    { id: 'username', header: 'Username', cell: (row) => row.username, sortable: true, sortValue: (row) => row.username },
    { id: 'role', header: 'Role', cell: (row) => <Badge variant={row.role === 'admin' ? 'default' : 'secondary'}>{row.role ?? 'viewer'}</Badge>, sortable: true, sortValue: (row) => row.role ?? '' },
    { id: 'email', header: 'Email', cell: (row) => row.email },
  ];

  const bulkActions = React.useMemo<BulkAction[]>(() => [
    { label: 'Revoke selected', action: 'revoke' },
  ], []);

  const onBulkAction = React.useCallback((action: string, selectedIds: string[]) => {
    if (action === 'revoke') {
      void deleteRoles(roles.filter((role) => selectedIds.includes(role.name)));
    }
  }, [roles]);

  const channelOptions = channels.map((channel) => ({ value: String(channel.id), label: `${channel.name} (${channel.type})` }));
  const functionOptions = FUNCTION_OPTIONS.map((permission) => ({ value: permission, label: permission }));

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">RBAC</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => void loadData()}>Refresh</Button>
          <Button onClick={() => openDialog('add')}>Add role</Button>
        </div>
      </header>

      {latestFailure ? <p role="alert" className="text-sm text-destructive">{latestFailure}</p> : null}
      {status ? <p role="status" className="text-sm text-foreground/80">{status}</p> : null}

      <Card>
        <CardHeader><h2 className="text-lg font-semibold">Role definitions</h2></CardHeader>
        <CardContent>
          <DataTable
            columns={roleColumns}
            rows={roles}
            emptyMessage="No roles defined."
            getRowId={(row) => row.name}
            tableId="notify-rbac-roles"
            page={page}
            onPageChange={setPage}
            pageSize={pageSize}
            onPageSizeChange={setPageSize}
            columnPickerEnabled
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><h2 className="text-lg font-semibold">User-role assignments</h2></CardHeader>
        <CardContent>
          <DataTable columns={userRoleColumns} rows={users} emptyMessage="No users found." getRowId={(row) => String(row.id)} tableId="notify-rbac-users" columnPickerEnabled />
        </CardContent>
      </Card>

      <EntityDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={dialogMode === 'add' ? 'Add role' : `${dialogMode === 'edit' ? 'Edit' : 'View'} role ${activeRole?.name ?? ''}`}
        body={(
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void saveRole();
            }}
          >
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="rbac-group">Group</Label>
                <Input id="rbac-group" name="group" value={formValues.group} onChange={(event) => setFormValues((current) => ({ ...current, group: event.target.value }))} disabled={dialogMode === 'view'} placeholder="Group name (optional)" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rbac-user">User</Label>
                <Input id="rbac-user" name="user" value={formValues.user} onChange={(event) => setFormValues((current) => ({ ...current, user: event.target.value }))} disabled={dialogMode === 'view'} placeholder="User (optional)" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rbac-role-name">Role</Label>
                <Input id="rbac-role-name" name="role" value={formValues.name} onChange={(event) => setFormValues((current) => ({ ...current, name: event.target.value }))} disabled={dialogMode !== 'add'} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rbac-role-description">Description</Label>
                <Input id="rbac-role-description" value={formValues.description} onChange={(event) => setFormValues((current) => ({ ...current, description: event.target.value }))} disabled={dialogMode === 'view'} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Access functions</Label>
              <MultiSelect options={functionOptions} values={selectedFunctions} onChange={setSelectedFunctions} disabled={dialogMode === 'view'} placeholder="Select functions" />
            </div>
            <div className="space-y-2">
              <Label>Channels</Label>
              <MultiSelect options={channelOptions} values={selectedChannels} onChange={setSelectedChannels} disabled={dialogMode === 'view'} placeholder="Select channels" emptyMessage="No channels available" />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setDialogOpen(false)}>Cancel</Button>
              {dialogMode !== 'view' ? <Button type="submit">Save changes</Button> : null}
            </div>
          </form>
        )}
      />
    </div>
  );
}
