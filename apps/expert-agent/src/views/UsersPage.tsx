import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import type { EntityFieldDef, EntityFormMode, RelatedItem } from '@cloud-dog/ui';
import { Badge, Button, statusColumn } from '@cloud-dog/ui';
import { useExpertAgentState } from '../state/AppState';
import type { GroupRecord, UserRecord } from '../lib/api';
import { AppDataTable, CrudEntityDialog } from '../lib/data-table-adapter';
import { LoadingNote, PageScaffold, SummaryGrid, formatCount, renderRelativeTime } from './shared';


type UserForm = {
  username: string;
  email: string;
  password: string;
  display_name: string;
  role: string;
};

const emptyForm: UserForm = {
  username: '',
  email: '',
  password: '',
  display_name: '',
  role: 'user',
};

const fields: EntityFieldDef[] = [
  { name: 'username', label: 'Username', type: 'text', required: true },
  { name: 'email', label: 'Email', type: 'text', required: true },
  { name: 'display_name', label: 'Display name', type: 'text' },
  { name: 'role', label: 'Role', type: 'select', required: true, options: ['admin', 'owner', 'user', 'viewer'] },
  { name: 'password', label: 'Password', type: 'text' },
  { name: 'group_ids', label: 'Groups', type: 'text' },
];

function validate(form: UserForm, editingId: number | null): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!form.username.trim()) errors.username = 'Username is required.';
  if (!form.email.trim()) errors.email = 'Email is required.';
  else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email)) errors.email = 'Enter a valid email address.';
  if (editingId === null && !form.password.trim()) errors.password = 'Password is required for new users.';
  return errors;
}

function roleBadge(role: string | null | undefined): React.ReactNode {
  const r = (role ?? 'user').toLowerCase();
  return <Badge variant={r === 'admin' ? 'destructive' : 'default'}>{r}</Badge>;
}

export function UsersPage() {
  const navigate = useNavigate();
  const { api, latestFailure, captureFailure, clearFailure } = useExpertAgentState();
  const [users, setUsers] = React.useState<UserRecord[]>([]);
  const [groups, setGroups] = React.useState<GroupRecord[]>([]);
  const [userGroupMap, setUserGroupMap] = React.useState<Record<number, string[]>>({});
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [status, setStatus] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<UserForm>(emptyForm);
  const [editingId, setEditingId] = React.useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const refresh = React.useCallback(async () => {
    clearFailure();
    setLoading(true);
    try {
      const [userRecords, groupRecords] = await Promise.all([api.listUsers(), api.listGroups()]);
      setUsers(userRecords);
      setGroups(groupRecords);
      const memberships = await Promise.all(
        groupRecords.map(async (group) => ({ group, members: await api.listGroupMembers(group.id) }))
      );
      const nextMap: Record<number, string[]> = {};
      for (const membership of memberships) {
        for (const member of membership.members) {
          nextMap[member.id] = [...(nextMap[member.id] ?? []), membership.group.name];
        }
      }
      setUserGroupMap(nextMap);
    } catch (error) {
      captureFailure(error);
    } finally {
      setLoading(false);
    }
  }, [api, captureFailure, clearFailure]);

  React.useEffect(() => { void refresh(); }, [refresh]);

  const openCreate = React.useCallback(() => {
    setEditingId(null);
    setForm(emptyForm);
    setErrors({});
    setDialogOpen(true);
  }, []);

  const openEdit = React.useCallback((user: UserRecord) => {
    setEditingId(user.id);
    setForm({
      username: user.username,
      email: user.email,
      password: '',
      display_name: user.display_name ?? '',
      role: user.role ?? 'user',
    });
    setErrors({});
    setDialogOpen(true);
    setStatus(`Editing ${user.username}`);
  }, []);

  const closeDialog = React.useCallback(() => {
    setDialogOpen(false);
    setEditingId(null);
    setForm(emptyForm);
    setErrors({});
  }, []);

  const saveUser = React.useCallback(async () => {
    const nextErrors = validate(form, editingId);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setSaving(true);
    clearFailure();
    try {
      if (editingId === null) {
        await api.createUser(form);
        setStatus(`Created user ${form.username}.`);
      } else {
        await api.updateUser(editingId, {
          username: form.username,
          email: form.email,
          display_name: form.display_name,
          role: form.role,
          password: form.password || undefined,
        });
        setStatus(`Updated user ${form.username}.`);
      }
      closeDialog();
      await refresh();
    } catch (error) {
      captureFailure(error);
    } finally {
      setSaving(false);
    }
  }, [api, captureFailure, clearFailure, closeDialog, editingId, form, refresh]);

  const deleteUser = React.useCallback(async (user: UserRecord) => {
    clearFailure();
    try {
      await api.deleteUser(user.id);
      setStatus(`Deleted user ${user.username}.`);
      await refresh();
    } catch (error) {
      captureFailure(error);
    }
  }, [api, captureFailure, clearFailure, refresh]);

  const toggleEnabled = React.useCallback(async (user: UserRecord) => {
    const nextEnabled = user.enabled === false;
    clearFailure();
    try {
      await api.updateUser(user.id, { enabled: nextEnabled });
      setStatus(`${nextEnabled ? 'Enabled' : 'Disabled'} user ${user.username}.`);
      await refresh();
    } catch (error) {
      captureFailure(error);
    }
  }, [api, captureFailure, clearFailure, refresh]);

  const bulkDelete = React.useCallback(async (selected: UserRecord[]) => {
    if (!selected.length) return;
    clearFailure();
    try {
      await Promise.all(selected.map(async (user) => api.deleteUser(user.id)));
      setStatus(`Deleted ${selected.length} users.`);
      await refresh();
    } catch (error) {
      captureFailure(error);
    }
  }, [api, captureFailure, clearFailure, refresh]);

  const activeUser = users.find((user) => user.id === editingId) ?? null;
  const relatedGroups: RelatedItem[] = (activeUser ? (userGroupMap[activeUser.id] ?? []) : []).map((name) => ({ id: name, label: name }));
  const availableGroups: RelatedItem[] = groups.map((group) => ({ id: String(group.id), label: group.name }));
  const mode: EntityFormMode = editingId === null ? 'add' : 'edit';

  return (
    <PageScaffold title="Users" description="Create, update, and remove Expert Agent users with shared CRUD surfaces and live role management." alert={latestFailure} status={status}>
      <LoadingNote loading={loading} />
      <SummaryGrid items={[
        { label: 'Users', value: formatCount(users.length) },
        { label: 'Admins', value: formatCount(users.filter((user) => user.role === 'admin').length) },
        { label: 'Enabled', value: formatCount(users.filter((user) => user.enabled !== false).length) },
      ]} />
      <div className="flex justify-end">
        <Button type="button" onClick={openCreate}>Create User</Button>
      </div>
      <AppDataTable
        title="User inventory"
        rows={users}
        getRowId={(user) => String(user.id)}
        emptyMessage="No users reported by the backend."
        itemLabel="users"
        onRefresh={refresh}
        searchText={(user) => [
          user.username,
          user.display_name,
          user.email,
          user.role,
          ...(userGroupMap[user.id] ?? []),
        ].filter(Boolean).join(' ')}
        columns={[
          { id: 'username', header: 'Username', sortable: true, sortValue: (user) => user.username, cell: (user) => <button type="button" data-testid={`user-audit-link-${user.id}`} className="font-medium underline-offset-4 hover:underline text-left" onClick={() => navigate(`/admin/monitoring?user=${user.id}`)}>{user.username}</button> },
          { id: 'display_name', header: 'Display Name', sortable: true, sortValue: (user) => user.display_name ?? '', cell: (user) => user.display_name ?? 'N/A' },
          { id: 'email', header: 'Email', sortable: true, sortValue: (user) => user.email, cell: (user) => user.email },
          { id: 'role', header: 'Role', sortable: true, sortValue: (user) => user.role ?? 'user', cell: (user) => roleBadge(user.role) },
          statusColumn<UserRecord>({ getValue: (user) => user.enabled !== false ? 'active' : 'disabled' }),
          { id: 'groups', header: 'Groups', cell: (user) => formatCount((userGroupMap[user.id] ?? []).length) },
          { id: 'created', header: 'Created', sortable: true, sortValue: (user) => user.created_at ?? '', cell: (user) => renderRelativeTime(user.created_at) },
          { id: 'updated', header: 'Updated', sortable: true, sortValue: (user) => user.updated_at ?? '', cell: (user) => renderRelativeTime(user.updated_at) },
        ]}
        rowActions={[
          { label: 'Edit', onClick: openEdit },
          { label: 'Disable/Enable', onClick: (user) => void toggleEnabled(user) },
          { label: 'Delete', variant: 'destructive', onClick: (user) => void deleteUser(user) },
        ]}
        bulkActions={[
          { label: 'Delete Selected', variant: 'destructive', onClick: (rows) => void bulkDelete(rows) },
          { label: 'Export', onClick: () => undefined },
        ]}
      />
      <CrudEntityDialog
        open={dialogOpen}
        title={editingId === null ? 'Create User' : 'Edit User'}
        mode={mode}
        fields={fields}
        values={form}
        errors={errors}
        onChange={(name, value) => setForm((current) => ({ ...current, [name]: value as string }))}
        onSubmit={() => void saveUser()}
        onCancel={closeDialog}
        relatedPanels={[
          { title: 'Assigned groups', items: relatedGroups, emptyMessage: 'This user is not assigned to any groups yet.' },
          { title: 'Available groups', items: availableGroups, emptyMessage: 'No groups are available.' },
        ]}
        extra={saving ? <p className="text-sm text-muted-foreground">Saving user changes...</p> : null}
      />
    </PageScaffold>
  );
}
