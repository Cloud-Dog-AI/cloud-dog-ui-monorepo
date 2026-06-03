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

// @cloud-dog/app-notification-agent — Groups view adopted onto shared CRUD components.
// Covers: UI-R1, UI-R2

import * as React from 'react';
import { Badge, Button, Card, CardContent, CardHeader, DataTable, EntityDialog, Input, Label, MultiSelect, Select } from '@cloud-dog/ui';
import type { BulkAction, DataColumn, EntityFormMode, RelatedItem } from '@cloud-dog/ui';
import { useNotificationAgentState } from '../state/AppState';
import type { GroupMemberRecord, GroupRecord, UserRecord } from '../lib/api';

type GroupFormValues = Readonly<{
  name: string;
  description: string;
  enabled: boolean;
}>;

const emptyForm: GroupFormValues = {
  name: '',
  description: '',
  enabled: true,
};

function validate(values: GroupFormValues): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!values.name.trim()) errors.name = 'Group name is required.';
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

export function GroupsPage() {
  const { api, latestFailure, captureFailure, clearFailure } = useNotificationAgentState();
  const [groups, setGroups] = React.useState<GroupRecord[]>([]);
  const [users, setUsers] = React.useState<UserRecord[]>([]);
  const [membersByGroup, setMembersByGroup] = React.useState<Record<number, GroupMemberRecord[]>>({});
  const [loading, setLoading] = React.useState(true);
  const [query, setQuery] = React.useState('');
  const [status, setStatus] = React.useState('');
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [dialogMode, setDialogMode] = React.useState<EntityFormMode>('add');
  const [activeGroup, setActiveGroup] = React.useState<GroupRecord | null>(null);
  const [formValues, setFormValues] = React.useState<GroupFormValues>(emptyForm);
  const [formErrors, setFormErrors] = React.useState<Record<string, string>>({});
  const [selectedUserIds, setSelectedUserIds] = React.useState<string[]>([]);
  const [quickValues, setQuickValues] = React.useState<GroupFormValues>(emptyForm);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(25);

  const loadGroups = React.useCallback(async () => {
    setLoading(true);
    clearFailure();
    try {
      const [groupList, userList] = await Promise.all([
        api.listGroups(),
        api.listUsers(),
      ]);
      setGroups(groupList);
      setUsers(userList);
      setLoading(false);
    } catch (error) {
      captureFailure(error);
      setLoading(false);
    }
  }, [api, captureFailure, clearFailure]);

  React.useEffect(() => {
    void loadGroups();
  }, [loadGroups]);

  React.useEffect(() => {
    setPage(1);
  }, [query]);

  const deleteGroups = React.useCallback(async (items: GroupRecord[]) => {
    clearFailure();
    setStatus('');
    try {
      for (const item of items) {
        await api.deleteGroup(item.id);
      }
      const deletedIds = new Set(items.map((item) => item.id));
      setGroups((current) => current.filter((group) => !deletedIds.has(group.id)));
      setMembersByGroup((current) =>
        Object.fromEntries(Object.entries(current).filter(([groupId]) => !deletedIds.has(Number(groupId)))),
      );
      setStatus(items.length === 1 ? `Deleted group ${items[0].name}.` : `Deleted ${items.length} groups.`);
      if (activeGroup && items.some((item) => item.id === activeGroup.id)) {
        setDialogOpen(false);
        setActiveGroup(null);
      }
      await loadGroups();
    } catch (error) {
      captureFailure(error);
    }
  }, [api, activeGroup, clearFailure, captureFailure, loadGroups]);

  const filteredGroups = groups.filter((group) => {
    if (!query.trim()) return true;
    const haystack = `${group.name} ${group.description ?? ''}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  });

  const columns = React.useMemo<DataColumn<GroupRecord>[]>(() => [
    {
      id: 'name',
      header: 'Name',
      sortable: true,
      sortValue: (group) => group.name,
      cell: (group) => (
        <span className="cursor-pointer font-medium underline-offset-4 hover:underline" onClick={() => openDialog('view', group)}>
          {group.name}
        </span>
      ),
    },
    {
      id: 'description',
      header: 'Description',
      sortable: true,
      sortValue: (group) => group.description ?? '',
      cell: (group) => group.description ?? '',
    },
    {
      id: 'members',
      header: 'Members',
      sortable: true,
      sortValue: (group) => membersByGroup[group.id]?.length ?? 0,
      cell: (group) => String(membersByGroup[group.id]?.length ?? 0),
    },
    {
      id: 'roles',
      header: 'Roles',
      sortable: true,
      sortValue: (group) => (group as any).roles ?? '',
      cell: (group) => (group as any).roles || '—',
    },
    {
      id: 'status',
      header: 'Status',
      sortable: true,
      sortValue: (group) => (group.enabled === false ? 0 : 1),
      cell: (group) => <Badge variant={group.enabled === false ? 'secondary' : 'default'}>{group.enabled === false ? 'Disabled' : 'Active'}</Badge>,
    },
    {
      id: 'created_at',
      header: 'Created',
      sortable: true,
      sortValue: (group) => String((group as any).created_at ?? ''),
      cell: (group) => (group as any).created_at ? String((group as any).created_at).slice(0, 10) : '—',
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: (group) => (
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" aria-label={`View group ${group.name}`} onClick={() => openDialog('view', group)}>View</Button>
          <Button variant="secondary" aria-label={`Edit group ${group.name}`} onClick={() => openDialog('edit', group)}>Edit</Button>
          <Button variant="secondary" onClick={() => { window.location.href = `/admin/rbac?group=${encodeURIComponent(group.name)}`; }}>RBAC</Button>
          <Button variant="secondary" onClick={() => { window.location.href = `/admin/api-keys?owner=group:${group.id}`; }}>API keys</Button>
          <Button variant="secondary" onClick={() => { window.location.href = `/monitoring?query=group:${encodeURIComponent(group.name)}`; }}>Logs</Button>
          <Button variant="secondary" aria-label={`Delete group ${group.name}`} onClick={() => void deleteGroups([group])}>Delete</Button>
        </div>
      ),
    },
  ], [deleteGroups, membersByGroup]);

  const bulkActions = React.useMemo<BulkAction[]>(() => [
    { label: 'Delete selected', action: 'delete' },
    { label: 'Export', action: 'export' },
  ], []);

  const onBulkAction = React.useCallback((action: string, selectedIds: string[]) => {
    const items = filteredGroups.filter((group) => selectedIds.includes(String(group.id)));
    if (action === 'delete') {
      void deleteGroups(items);
      return;
    }
    if (action === 'export') {
      downloadJson('notification-groups.json', items);
    }
  }, [deleteGroups, filteredGroups]);

  const openDialog = (mode: EntityFormMode, group?: GroupRecord) => {
    setDialogMode(mode);
    setActiveGroup(group ?? null);
    setFormErrors({});
    setSelectedUserIds(group ? (membersByGroup[group.id] ?? []).map((member) => String(member.user_id)) : []);
    if (!group) {
      setFormValues(emptyForm);
    } else {
      setFormValues({
        name: group.name,
        description: group.description ?? '',
        enabled: group.enabled !== false,
      });
    }
    setDialogOpen(true);
    if (group) {
      void api.listGroupMembers(group.id)
        .then((members) => setMembersByGroup((current) => ({ ...current, [group.id]: members })))
        .catch(captureFailure);
    }
  };

  const saveGroup = async () => {
    const errors = validate(formValues);
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    clearFailure();
    setStatus('');
    let statusMsg = '';
    try {
      if (dialogMode === 'add') {
        const created = await api.createGroup({
          name: formValues.name.trim(),
          description: formValues.description.trim() || undefined,
          enabled: formValues.enabled,
        });
        const createdGroup: GroupRecord = {
          id: Number((created as Record<string, unknown>).group_id ?? (created as Record<string, unknown>).id ?? 0),
          name: String((created as Record<string, unknown>).name ?? formValues.name.trim()),
          description: String((created as Record<string, unknown>).description ?? (formValues.description.trim() || '')),
          enabled: Boolean((created as Record<string, unknown>).enabled ?? formValues.enabled),
        };
        setGroups((current) => [createdGroup, ...current.filter((group) => group.id !== createdGroup.id)]);
        setMembersByGroup((current) => ({ ...current, [createdGroup.id]: [] }));
        for (const userId of selectedUserIds) {
          await api.addGroupMember(createdGroup.id, { user_id: Number(userId), role: 'member' });
        }
        const createdMembers: GroupMemberRecord[] = selectedUserIds.map((userId) => {
          const user = users.find((item) => String(item.id) === userId);
          return {
            user_id: Number(userId),
            username: user?.username,
            email: user?.email,
            display_name: user?.display_name,
            role: 'member',
          };
        });
        setMembersByGroup((current) => ({ ...current, [createdGroup.id]: createdMembers }));
        setPage(1);
        setLoading(false);
        setFormValues(emptyForm);
        statusMsg = `Created group ${formValues.name.trim()}.`;
      } else if (activeGroup) {
        await api.updateGroup(activeGroup.id, {
          description: formValues.description.trim() || undefined,
          enabled: formValues.enabled,
        });
        const currentUserIds = new Set((membersByGroup[activeGroup.id] ?? []).map((member) => String(member.user_id)));
        const nextUserIds = new Set(selectedUserIds);
        for (const userId of selectedUserIds) {
          if (!currentUserIds.has(userId)) {
            await api.addGroupMember(activeGroup.id, { user_id: Number(userId), role: 'member' });
          }
        }
        for (const userId of currentUserIds) {
          if (!nextUserIds.has(userId)) {
            await api.removeGroupMember(activeGroup.id, Number(userId));
          }
        }
        const updatedMembers: GroupMemberRecord[] = selectedUserIds.map((userId) => {
          const user = users.find((item) => String(item.id) === userId);
          return {
            user_id: Number(userId),
            username: user?.username,
            email: user?.email,
            display_name: user?.display_name,
            role: 'member',
          };
        });
        setMembersByGroup((current) => ({ ...current, [activeGroup.id]: updatedMembers }));
        statusMsg = `Updated group ${activeGroup.name}.`;
      }
      await loadGroups();
      setStatus(statusMsg);
      setDialogOpen(false);
    } catch (error) {
      captureFailure(error);
    }
  };

  const createQuickGroup = async (event: React.FormEvent) => {
    event.preventDefault();
    const errors = validate(quickValues);
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    clearFailure();
    setStatus('');
    try {
      const created = await api.createGroup({
        name: quickValues.name.trim(),
        description: quickValues.description.trim() || undefined,
        enabled: quickValues.enabled,
      });
      const createdGroup: GroupRecord = {
        id: Number((created as Record<string, unknown>).group_id ?? (created as Record<string, unknown>).id ?? 0),
        name: String((created as Record<string, unknown>).name ?? quickValues.name.trim()),
        description: String((created as Record<string, unknown>).description ?? (quickValues.description.trim() || '')),
        enabled: Boolean((created as Record<string, unknown>).enabled ?? quickValues.enabled),
      };
      if (createdGroup.id > 0) {
        setGroups((current) => [createdGroup, ...current.filter((group) => group.id !== createdGroup.id)]);
        setMembersByGroup((current) => ({ ...current, [createdGroup.id]: [] }));
      }
      setQuickValues(emptyForm);
      setPage(1);
      setLoading(false);
      setStatus(`Created group ${createdGroup.name}.`);
      await loadGroups();
    } catch (error) {
      captureFailure(error);
    }
  };

  // deleteGroups moved above columns useMemo to avoid TDZ

  const relatedMembers: RelatedItem[] = (activeGroup ? membersByGroup[activeGroup.id] ?? [] : []).map((member) => ({
    id: String(member.user_id),
    label: member.username ?? member.display_name ?? member.email ?? `User ${member.user_id}`,
    href: `/users/${member.user_id}/view`,
  }));

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Groups</h1>
      </header>

      {latestFailure ? <p role="alert" className="text-sm text-destructive">{latestFailure}</p> : null}
      {status ? <p role="status" className="text-sm text-foreground/80">{status}</p> : null}

      {!dialogOpen ? (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Create group</h2>
          </CardHeader>
          <CardContent>
            <form className="grid gap-3 md:grid-cols-[1fr_1fr_10rem_auto]" onSubmit={createQuickGroup}>
              <div className="space-y-2">
                <Label htmlFor="groups-quick-name">Name</Label>
                <Input
                  id="groups-quick-name"
                  value={quickValues.name}
                  onChange={(event) => setQuickValues((current) => ({ ...current, name: event.target.value }))}
                />
                {formErrors.name ? <p className="text-sm text-destructive">{formErrors.name}</p> : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="groups-quick-description">Description</Label>
                <Input
                  id="groups-quick-description"
                  value={quickValues.description}
                  onChange={(event) => setQuickValues((current) => ({ ...current, description: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="groups-quick-enabled">Enabled</Label>
                <Select
                  id="groups-quick-enabled"
                  value={String(quickValues.enabled)}
                  onChange={(event) => setQuickValues((current) => ({ ...current, enabled: event.target.value === 'true' }))}
                >
                  <option value="true">Enabled</option>
                  <option value="false">Disabled</option>
                </Select>
              </div>
              <Button type="submit" className="self-end">Create group</Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Group directory</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="flex-1">
              <Label htmlFor="groups-search-adopted">Search groups</Label>
              <Input
                id="groups-search-adopted"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by group name or description"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => void loadGroups()}>Refresh</Button>
              <Button onClick={() => openDialog('add')}>Add group</Button>
            </div>
          </div>

          <DataTable
            tableId="notification-groups"
            columns={columns}
            rows={filteredGroups}
            getRowId={(group) => String(group.id)}
            getRowName={(group) => `${group.name} ${group.description ?? ''} group`}
            page={page}
            onPageChange={setPage}
            pageSize={pageSize}
            onPageSizeChange={setPageSize}
            selectable={true}
            bulkActions={bulkActions}
            onBulkAction={onBulkAction}
            columnPickerEnabled={true}
            emptyMessage={loading ? 'Loading groups...' : 'No results.'}
          />
        </CardContent>
      </Card>

      <EntityDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={
          dialogMode === 'add'
            ? 'Create group'
            : dialogMode === 'edit'
              ? `Edit group ${activeGroup?.name ?? ''}`
              : `View group ${activeGroup?.name ?? ''}`
        }
        body={(
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void saveGroup();
            }}
          >
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="groups-dialog-name">Name</Label>
                <Input id="groups-dialog-name" value={formValues.name} onChange={(event) => setFormValues((current) => ({ ...current, name: event.target.value }))} disabled={dialogMode !== 'add'} />
                {formErrors.name ? <p className="text-sm text-destructive">{formErrors.name}</p> : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="groups-dialog-enabled">Enabled</Label>
                <Select id="groups-dialog-enabled" value={String(formValues.enabled)} onChange={(event) => setFormValues((current) => ({ ...current, enabled: event.target.value === 'true' }))} disabled={dialogMode === 'view'}>
                  <option value="true">Enabled</option>
                  <option value="false">Disabled</option>
                </Select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="groups-dialog-description">Description</Label>
                <Input id="groups-dialog-description" value={formValues.description} onChange={(event) => setFormValues((current) => ({ ...current, description: event.target.value }))} disabled={dialogMode === 'view'} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Members</Label>
              <MultiSelect
                options={users.map((user) => ({ value: String(user.id), label: `${user.username} (${user.email})` }))}
                values={selectedUserIds}
                onChange={setSelectedUserIds}
                disabled={dialogMode === 'view'}
                placeholder="Select users"
                emptyMessage="No users available"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {activeGroup ? <Button type="button" variant="secondary" onClick={() => { window.location.href = `/admin/rbac?group=${encodeURIComponent(activeGroup.name)}`; }}>RBAC</Button> : null}
              {activeGroup ? <Button type="button" variant="secondary" onClick={() => { window.location.href = `/admin/api-keys?owner=group:${activeGroup.id}`; }}>API keys</Button> : null}
              {activeGroup ? <Button type="button" variant="secondary" onClick={() => { window.location.href = `/monitoring?query=group:${encodeURIComponent(activeGroup.name)}`; }}>Logs</Button> : null}
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setDialogOpen(false)}>Cancel</Button>
              {dialogMode !== 'view' ? <Button type="submit">Save changes</Button> : null}
            </div>
          </form>
        )}
        relatedPanels={activeGroup ? [{
          title: 'Related members',
          items: relatedMembers,
          emptyMessage: 'No members assigned.',
        }] : undefined}
      />

    </div>
  );
}
