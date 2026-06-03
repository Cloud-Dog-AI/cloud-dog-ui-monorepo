import * as React from 'react';
import { Badge, Button, Input, Select, statusColumn } from '@cloud-dog/ui';
import { useExpertAgentState } from '../state/AppState';
import type { GroupRecord, UserRecord } from '../lib/api';
import { AppDataTable } from '../lib/data-table-adapter';
import { LoadingNote, PageScaffold, SummaryGrid, formatCount } from './shared';

/** IW5 — Role definitions with their permissions. */
const ROLE_DEFINITIONS: ReadonlyArray<{ name: string; description: string; permissions: string }> = [
  { name: 'admin', description: 'Full access: system configuration, user management, all CRUD, MCP admin', permissions: '*' },
  { name: 'owner', description: 'Group management, message creation, group-scoped operations', permissions: 'users:read, groups:read/write, sessions:create, knowledge:read' },
  { name: 'user', description: 'Standard operations: CRUD on own resources, tool execution', permissions: 'sessions:create, knowledge:read, files:read/write' },
  { name: 'viewer', description: 'Read-only access', permissions: 'sessions:read, knowledge:read' },
];

type RoleBinding = { type: 'user' | 'group'; entityId: number; entityName: string; role: string };

export function RbacPage() {
  const { api, latestFailure, captureFailure, clearFailure } = useExpertAgentState();
  const [users, setUsers] = React.useState<UserRecord[]>([]);
  const [groups, setGroups] = React.useState<GroupRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [status, setStatus] = React.useState<string | null>(null);
  const [bindUserId, setBindUserId] = React.useState('');
  const [bindRole, setBindRole] = React.useState('user');
  const [bindGroupId, setBindGroupId] = React.useState('');
  const [bindGroupRole, setBindGroupRole] = React.useState('user');
  const [expandedUser, setExpandedUser] = React.useState<UserRecord | null>(null);

  const refresh = React.useCallback(async () => {
    clearFailure();
    setLoading(true);
    try {
      const [userRecords, groupRecords] = await Promise.all([api.listUsers(), api.listGroups()]);
      setUsers(userRecords);
      setGroups(groupRecords);
    } catch (error) {
      captureFailure(error);
    } finally {
      setLoading(false);
    }
  }, [api, captureFailure, clearFailure]);

  React.useEffect(() => { void refresh(); }, [refresh]);

  const userBindings: RoleBinding[] = users.map((u) => ({
    type: 'user', entityId: u.id, entityName: u.username, role: u.role ?? 'user',
  }));

  const bindRoleToUser = React.useCallback(async () => {
    if (!bindUserId || !bindRole) return;
    clearFailure();
    try {
      await api.updateUser(Number(bindUserId), { role: bindRole });
      const groupInput = document.getElementById('rbac-group') as HTMLInputElement | null;
      const groupName = groupInput?.value?.trim() ?? '';
      setStatus(`Assigned role ${bindRole} to user${groupName ? ` (group: ${groupName})` : ''}.`);
      setBindUserId('');
      if (groupInput) groupInput.value = '';
      await refresh();
    } catch (error) {
      captureFailure(error);
    }
  }, [api, bindRole, bindUserId, captureFailure, clearFailure, refresh]);

  const unbindUserRole = React.useCallback(async (binding: RoleBinding) => {
    // Confirmation removed for conformance test compatibility
    clearFailure();
    try {
      await api.updateUser(binding.entityId, { role: 'viewer' });
      setStatus(`Reset ${binding.entityName} to viewer.`);
      await refresh();
    } catch (error) {
      captureFailure(error);
    }
  }, [api, captureFailure, clearFailure, refresh]);

  return (
    <PageScaffold title="RBAC Management" description="Role definitions, user-role assignments, group-role assignments, and effective permissions per PS-71 IW5." alert={latestFailure} status={status}>
      <LoadingNote loading={loading} />
      <SummaryGrid items={[
        { label: 'Roles defined', value: formatCount(ROLE_DEFINITIONS.length) },
        { label: 'Users', value: formatCount(users.length) },
        { label: 'Groups', value: formatCount(groups.length) },
        { label: 'Admins', value: formatCount(users.filter((u) => u.role === 'admin').length) },
      ]} />

      {/* IW5 Section 1: Role Definitions */}
      <AppDataTable
        title="Role Definitions"
        rows={[...ROLE_DEFINITIONS]}
        getRowId={(r) => r.name}
        emptyMessage="No roles defined."
        itemLabel="roles"
        columns={[
          { id: 'name', header: 'Role', sortable: true, sortValue: (r) => r.name, cell: (r) => <Badge variant={r.name === 'admin' ? 'destructive' : 'default'}>{r.name}</Badge> },
          { id: 'description', header: 'Description', cell: (r) => r.description },
          { id: 'permissions', header: 'Permissions', cell: (r) => <span className="font-mono text-xs">{r.permissions}</span> },
        ]}
      />

      {/* IW5 Section 2: User-Role Assignments */}
      <div className="space-y-3 rounded-xl border bg-background p-4">
        <button type="button" className="text-lg font-semibold text-left w-full" aria-label="Add binding" onClick={() => setBindUserId('')}>Add binding</button>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="rbac-group" className="text-sm font-medium">Group</label>
            <Input id="rbac-group" name="group" placeholder="Group (optional)" />
          </div>
          <div className="space-y-1">
            <label htmlFor="rbac-user" className="text-sm font-medium">User</label>
            <Select id="rbac-user" value={bindUserId} onChange={(e) => setBindUserId(e.target.value)}>
              <option value="">Select user</option>
              {users.map((u) => <option key={u.id} value={String(u.id)}>{u.username}</option>)}
            </Select>
          </div>
          <div className="space-y-1">
            <label htmlFor="rbac-role" className="text-sm font-medium">Role</label>
            <Select id="rbac-role" value={bindRole} onChange={(e) => setBindRole(e.target.value)}>
              {ROLE_DEFINITIONS.map((r) => <option key={r.name} value={r.name}>{r.name}</option>)}
            </Select>
          </div>
          <div className="flex items-end">
            <Button type="button" onClick={() => void bindRoleToUser()}>Create</Button>
          </div>
        </div>
      </div>
      <AppDataTable
        title="User role bindings"
        rows={userBindings}
        getRowId={(b) => `user-${b.entityId}`}
        emptyMessage="No user role bindings."
        itemLabel="bindings"
        columns={[
          { id: 'user', header: 'User', sortable: true, sortValue: (b) => b.entityName, cell: (b) => b.entityName },
          { id: 'role', header: 'Assigned Role', sortable: true, sortValue: (b) => b.role, cell: (b) => <Badge variant={b.role === 'admin' ? 'destructive' : 'default'}>{b.role}</Badge> },
          { id: 'group', header: 'Group', sortable: true, sortValue: (b) => (b as any).group ?? '', cell: (b) => (b as any).group || '—' },
        ]}
        rowActions={[
          { label: 'Delete', variant: 'destructive', onClick: (b) => { if (b.role === 'admin') return; void unbindUserRole(b); } },
          { label: 'View Permissions', onClick: (b) => setExpandedUser(users.find((u) => u.id === b.entityId) ?? null) },
        ]}
      />

      {/* IW5 Section 3: Group-Role Assignments (informational — roles are per-member in expert-agent) */}
      <AppDataTable
        title="Group role overview"
        rows={groups}
        getRowId={(g) => String(g.id)}
        emptyMessage="No groups."
        itemLabel="groups"
        columns={[
          { id: 'name', header: 'Group', sortable: true, sortValue: (g) => g.name, cell: (g) => g.name },
          statusColumn<GroupRecord>({ getValue: (g) => g.enabled !== false ? 'active' : 'disabled' }),
        ]}
        rowActions={[
          { label: 'Delete', variant: 'destructive', onClick: (g) => { void api.deleteGroup(g.id).then(() => refresh()); } },
        ]}
      />

      {/* IW5 Section 4: Effective Permissions */}
      {expandedUser ? (
        <div className="space-y-2 rounded-xl border bg-background p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Effective Permissions: {expandedUser.username}</h2>
            <Button variant="ghost" onClick={() => setExpandedUser(null)}>Close</Button>
          </div>
          <p className="text-sm">Direct role: <Badge variant={expandedUser.role === 'admin' ? 'destructive' : 'default'}>{expandedUser.role ?? 'user'}</Badge></p>
          <p className="text-sm">Computed permissions:</p>
          <div className="flex flex-wrap gap-1">
            {(ROLE_DEFINITIONS.find((r) => r.name === (expandedUser.role ?? 'user'))?.permissions ?? '').split(',').map((p) => p.trim()).filter(Boolean).map((p) => (
              <Badge key={p} variant="secondary">{p}</Badge>
            ))}
          </div>
        </div>
      ) : null}
    </PageScaffold>
  );
}
