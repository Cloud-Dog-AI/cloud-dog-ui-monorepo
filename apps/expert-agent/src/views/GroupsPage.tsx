import * as React from 'react';
import { Button, Label, Select, statusColumn, type EntityFieldDef, type EntityFormMode, type RelatedItem } from '@cloud-dog/ui';
import { useExpertAgentState } from '../state/AppState';
import type { ApiKeyRecord, GroupMemberRecord, GroupRecord, UserRecord } from '../lib/api';
import { AppDataTable, CrudEntityDialog } from '../lib/data-table-adapter';
import { LoadingNote, PageScaffold, formatCount } from './shared';


type GroupForm = {
  name: string;
  description: string;
  enabled: boolean;
};

const emptyForm: GroupForm = {
  name: '',
  description: '',
  enabled: true,
};

const fields: EntityFieldDef[] = [
  { name: 'name', label: 'Group name', type: 'text', required: true },
  { name: 'description', label: 'Description', type: 'text' },
  { name: 'enabled', label: 'Enabled', type: 'boolean' },
];

function validate(form: GroupForm): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!form.name.trim()) errors.name = 'Group name is required.';
  return errors;
}

export function GroupsPage() {
  const { api, latestFailure, captureFailure, clearFailure } = useExpertAgentState();
  const [groups, setGroups] = React.useState<GroupRecord[]>([]);
  const [users, setUsers] = React.useState<UserRecord[]>([]);
  const [members, setMembers] = React.useState<Record<number, GroupMemberRecord[]>>({});
  const [apiKeys, setApiKeys] = React.useState<ApiKeyRecord[]>([]);
  const [selectedGroupId, setSelectedGroupId] = React.useState<number | null>(null);
  const [form, setForm] = React.useState<GroupForm>(emptyForm);
  const [editingId, setEditingId] = React.useState<number | null>(null);
  const [memberUserId, setMemberUserId] = React.useState('');
  const [memberRole, setMemberRole] = React.useState<'member' | 'admin'>('member');
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [status, setStatus] = React.useState<string | null>(null);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const selectedGroupIdRef = React.useRef<number | null>(null);
  const selectedGroupNameRef = React.useRef<string | null>(null);
  const refreshRequestIdRef = React.useRef(0);

  React.useEffect(() => {
    selectedGroupIdRef.current = selectedGroupId;
  }, [selectedGroupId]);

  const selectGroup = React.useCallback((group: GroupRecord | null) => {
    selectedGroupNameRef.current = group?.name ?? null;
    setSelectedGroupId(group?.id ?? null);
  }, []);

  const refresh = React.useCallback(async () => {
    clearFailure();
    setLoading(true);
    const requestId = ++refreshRequestIdRef.current;
    try {
      const [groupRecords, userRecords, keyRecords] = await Promise.all([
        api.listGroups(),
        api.listUsers(),
        api.listApiKeys({ includeRevoked: true }),
      ]);
      setGroups(groupRecords);
      setUsers(userRecords);
      setApiKeys(keyRecords);
      const memberships = await Promise.all(
        groupRecords.map(async (group) => ({ groupId: group.id, members: await api.listGroupMembers(group.id) }))
      );
      if (requestId !== refreshRequestIdRef.current) return;
      const memberMap: Record<number, GroupMemberRecord[]> = {};
      for (const membership of memberships) memberMap[membership.groupId] = membership.members;
      setMembers(memberMap);
      const currentSelectedGroupId = selectedGroupIdRef.current;
      const selectedGroup =
        groupRecords.find((group) => group.id === currentSelectedGroupId) ??
        groupRecords.find((group) => group.name === selectedGroupNameRef.current) ??
        null;
      if (groupRecords.length === 0) {
        selectedGroupNameRef.current = null;
        setSelectedGroupId(null);
      } else if (selectedGroup) {
        selectedGroupNameRef.current = selectedGroup.name;
        if (selectedGroup.id !== currentSelectedGroupId) setSelectedGroupId(selectedGroup.id);
      } else {
        selectedGroupNameRef.current = groupRecords[0].name;
        setSelectedGroupId(groupRecords[0].id);
      }
    } catch (error) {
      if (requestId !== refreshRequestIdRef.current) return;
      captureFailure(error);
    } finally {
      if (requestId === refreshRequestIdRef.current) setLoading(false);
    }
  }, [api, captureFailure, clearFailure]);

  React.useEffect(() => { void refresh(); }, [refresh]);

  const openCreate = React.useCallback(() => {
    setEditingId(null);
    setForm(emptyForm);
    setErrors({});
    setDialogOpen(true);
  }, []);

  const openEdit = React.useCallback((group: GroupRecord) => {
    setEditingId(group.id);
    selectGroup(group);
    setForm({ name: group.name, description: group.description ?? '', enabled: group.enabled !== false });
    setErrors({});
    setDialogOpen(true);
  }, [selectGroup]);

  const closeDialog = React.useCallback(() => {
    setDialogOpen(false);
    setEditingId(null);
    setForm(emptyForm);
    setErrors({});
  }, []);

  const saveGroup = React.useCallback(async () => {
    const nextErrors = validate(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setSaving(true);
    clearFailure();
    try {
      if (editingId === null) {
        const created = await api.createGroup(form);
        selectedGroupNameRef.current = created.name;
        setSelectedGroupId(created.id);
        setStatus(`Created group ${created.name}.`);
      } else {
        await api.updateGroup(editingId, form);
        setStatus(`Updated group ${form.name}.`);
      }
      closeDialog();
      await refresh();
    } catch (error) {
      captureFailure(error);
    } finally {
      setSaving(false);
    }
  }, [api, captureFailure, clearFailure, closeDialog, editingId, form, refresh]);

  const deleteGroup = React.useCallback(async (group: GroupRecord) => {
    clearFailure();
    try {
      await api.deleteGroup(group.id);
      setStatus(`Deleted group ${group.name}.`);
      if (selectedGroupId === group.id) selectGroup(null);
      await refresh();
    } catch (error) {
      captureFailure(error);
    }
  }, [api, captureFailure, clearFailure, refresh, selectGroup, selectedGroupId]);

  const bulkDelete = React.useCallback(async (selected: GroupRecord[]) => {
    if (!selected.length) return;
    clearFailure();
    try {
      await Promise.all(selected.map(async (group) => api.deleteGroup(group.id)));
      setStatus(`Deleted ${selected.length} groups.`);
      await refresh();
    } catch (error) {
      captureFailure(error);
    }
  }, [api, captureFailure, clearFailure, refresh]);

  const selectedGroup = groups.find((group) => group.id === selectedGroupId) ?? groups.find((group) => group.id === editingId) ?? groups[0] ?? null;
  const selectedMembers = selectedGroup ? (members[selectedGroup.id] ?? []) : [];
  const groupApiKeys = selectedGroup ? apiKeys.filter((apiKey) => apiKey.group_id === selectedGroup.id && !apiKey.revoked) : [];
  const relatedMembers: RelatedItem[] = selectedMembers.map((member) => ({ id: String(member.id), label: `${member.username} (${member.role ?? 'member'})` }));
  const relatedKeys: RelatedItem[] = groupApiKeys.map((apiKey) => ({ id: String(apiKey.id), label: apiKey.name ?? `API key ${apiKey.id}` }));
  const mode: EntityFormMode = editingId === null ? 'add' : 'edit';

  const addMember = React.useCallback(async () => {
    if (!selectedGroup || !memberUserId) return;
    clearFailure();
    try {
      await api.addGroupMember(selectedGroup.id, Number(memberUserId), memberRole);
      setStatus(`Added member to ${selectedGroup.name}.`);
      setMemberUserId('');
      await refresh();
    } catch (error) {
      captureFailure(error);
    }
  }, [api, captureFailure, clearFailure, memberRole, memberUserId, refresh, selectedGroup]);

  const updateRole = React.useCallback(async (userId: number, role: 'member' | 'admin') => {
    if (!selectedGroup) return;
    clearFailure();
    try {
      await api.updateGroupMemberRole(selectedGroup.id, userId, role);
      setStatus(`Updated role for member ${userId}.`);
      await refresh();
    } catch (error) {
      captureFailure(error);
    }
  }, [api, captureFailure, clearFailure, refresh, selectedGroup]);

  const removeMember = React.useCallback(async (userId: number) => {
    if (!selectedGroup) return;
    clearFailure();
    try {
      await api.removeGroupMember(selectedGroup.id, userId);
      setStatus(`Removed member ${userId}.`);
      await refresh();
    } catch (error) {
      captureFailure(error);
    }
  }, [api, captureFailure, clearFailure, refresh, selectedGroup]);

  return (
    <PageScaffold title="Groups" description="Create groups, manage membership, and update RBAC roles with shared CRUD surfaces." alert={latestFailure} status={status}>
      <LoadingNote loading={loading} />
      <div className="flex justify-end">
        <Button type="button" onClick={openCreate}>Create Group</Button>
      </div>
      <AppDataTable
        title="Group inventory"
        rows={groups}
        getRowId={(group) => String(group.id)}
        emptyMessage="No groups reported by the backend."
        itemLabel="groups"
        onRefresh={refresh}
        searchText={(group) => [
          group.name,
          group.description ?? '',
          group.enabled !== false ? 'active' : 'disabled',
          ...(members[group.id] ?? []).map((member) => member.username),
        ].join(' ')}
        columns={[
          {
            id: 'name', header: 'Name', sortable: true, sortValue: (group) => group.name,
            cell: (group) => <span className="cursor-pointer text-left font-medium underline-offset-4 hover:underline" onClick={() => selectGroup(group)}>{group.name}</span>,
          },
          { id: 'description', header: 'Description', sortable: true, sortValue: (group) => group.description ?? '', cell: (group) => group.description ?? 'N/A' },
          { id: 'members', header: 'Members', sortable: true, sortValue: (group) => (members[group.id] ?? []).length, cell: (group) => formatCount((members[group.id] ?? []).length) },
          { id: 'roles', header: 'Roles', sortable: true, sortValue: (group) => (group as any).roles ?? '', cell: (group) => (group as any).roles || '—' },
          statusColumn<GroupRecord>({ getValue: (group) => group.enabled !== false ? 'active' : 'disabled' }),
          { id: 'created_at', header: 'Created', sortable: true, sortValue: (group) => String((group as any).created_at ?? ''), cell: (group) => (group as any).created_at ? String((group as any).created_at).slice(0, 10) : '—' },
        ]}
        rowActions={[
          { label: 'Edit', onClick: openEdit },
          { label: 'Delete', variant: 'destructive', onClick: (group) => void deleteGroup(group) },
        ]}
        bulkActions={[{ label: 'Delete Selected', variant: 'destructive', onClick: (rows) => void bulkDelete(rows) }]}
      />
      <div className="space-y-4 rounded-xl border bg-background p-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">RBAC Management</h2>
          <p className="text-sm text-muted-foreground">Assign roles and manage membership for the selected group.</p>
        </div>
        {selectedGroup ? (
          <>
            <p className="text-sm">Managing group <span className="font-medium">{selectedGroup.name}</span>.</p>
            <div className="grid gap-4 md:grid-cols-[1fr_180px_auto]">
              <label className="space-y-2">
                <Label htmlFor="group-member-user">Add Member</Label>
                <Select id="group-member-user" value={memberUserId} onChange={(event) => setMemberUserId(event.target.value)}>
                  <option value="">Select a user</option>
                  {users.map((user) => <option key={user.id} value={String(user.id)}>{user.username}</option>)}
                </Select>
              </label>
              <label className="space-y-2">
                <Label htmlFor="group-member-role">Assign role</Label>
                <Select id="group-member-role" value={memberRole} onChange={(event) => setMemberRole(event.target.value as 'member' | 'admin')}>
                  <option value="member">member</option>
                  <option value="admin">admin</option>
                </Select>
              </label>
              <div className="flex items-end">
                <Button id="group-member-add" type="button" onClick={() => void addMember()} disabled={!memberUserId}>Add Member</Button>
              </div>
            </div>
            <AppDataTable
              title="Group members"
              rows={selectedMembers}
              getRowId={(member) => String(member.id)}
              emptyMessage="No members assigned to this group."
              itemLabel="members"
              columns={[
                { id: 'username', header: 'Username', sortable: true, sortValue: (member) => member.username, cell: (member) => member.username },
                { id: 'email', header: 'Email', sortable: true, sortValue: (member) => member.email ?? '', cell: (member) => member.email ?? 'N/A' },
                { id: 'role', header: 'Role', sortable: true, sortValue: (member) => member.role ?? 'member', cell: (member) => member.role ?? 'member' },
              ]}
              rowActions={[
                { label: 'Make Admin', onClick: (member) => void updateRole(member.id, 'admin') },
                { label: 'Make Member', onClick: (member) => void updateRole(member.id, 'member') },
                { label: 'Remove Member', variant: 'destructive', onClick: (member) => void removeMember(member.id) },
              ]}
            />
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Select a group to manage members and RBAC roles.</p>
        )}
      </div>
      <CrudEntityDialog
        open={dialogOpen}
        title={editingId === null ? 'Create Group' : 'Edit Group'}
        mode={mode}
        fields={fields}
        values={form}
        errors={errors}
        onChange={(name, value) => setForm((current) => ({ ...current, [name]: value as never }))}
        onSubmit={() => void saveGroup()}
        onCancel={closeDialog}
        relatedPanels={[
          { title: 'Group members', items: relatedMembers, emptyMessage: 'No members are currently assigned.' },
          { title: 'Bound API keys', items: relatedKeys, emptyMessage: 'No active API keys are bound to this group.' },
        ]}
        extra={saving ? <p className="text-sm text-muted-foreground">Saving group changes...</p> : null}
      />
    </PageScaffold>
  );
}
