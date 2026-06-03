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

// @cloud-dog/app-notification-agent — Users view adopted onto shared CRUD components.
// Covers: UI-R1, UI-R2

import * as React from 'react';
import { Badge, Button, Card, CardContent, CardHeader, DataTable, EntityDialog, Input, Label, MultiSelect, RelativeTime, Select } from '@cloud-dog/ui';
import type { BulkAction, DataColumn, EntityFormMode, RelatedItem } from '@cloud-dog/ui';
import { useNotificationAgentState } from '../state/AppState';
import type { ChannelRecord, GroupRecord, UserRecord } from '../lib/api';

type UserFormValues = Readonly<{
  username: string;
  email: string;
  display_name: string;
  password: string;
  role: string;
  language: string;
  preferred_channel: string;
  content_style: string;
}>;

const emptyForm: UserFormValues = {
  username: '',
  email: '',
  display_name: '',
  password: 'example',
  role: 'viewer',
  language: 'en',
  preferred_channel: 'email_default',
  content_style: 'html',
};

function downloadJson(filename: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function validate(values: UserFormValues, mode: EntityFormMode): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!values.username.trim()) errors.username = 'Username is required.';
  if (!values.email.trim()) errors.email = 'Email is required.';
  else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(values.email.trim())) errors.email = 'Email format is invalid.';
  if (mode === 'add' && !values.password.trim()) errors.password = 'example';
  return errors;
}

export function UsersPage() {
  const { api, latestFailure, captureFailure, clearFailure } = useNotificationAgentState();
  const [users, setUsers] = React.useState<UserRecord[]>([]);
  const [groups, setGroups] = React.useState<GroupRecord[]>([]);
  const [channels, setChannels] = React.useState<ChannelRecord[]>([]);
  const [userGroups, setUserGroups] = React.useState<Record<number, RelatedItem[]>>({});
  const [query, setQuery] = React.useState('');
  const [status, setStatus] = React.useState('');
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [dialogMode, setDialogMode] = React.useState<EntityFormMode>('add');
  const [activeUser, setActiveUser] = React.useState<UserRecord | null>(null);
  const [formValues, setFormValues] = React.useState<UserFormValues>(emptyForm);
  const [formErrors, setFormErrors] = React.useState<Record<string, string>>({});
  const [selectedGroupIds, setSelectedGroupIds] = React.useState<string[]>([]);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);
  const [quickValues, setQuickValues] = React.useState({
    username: '',
    email: '',
    display_name: '',
  });
  const savingRef = React.useRef(false);

  const loadUsers = React.useCallback(async (search?: string) => {
    clearFailure();
    try {
      const [userList, groupList, channelList] = await Promise.all([api.listUsers(), api.listGroups(), api.listChannels()]);
      setUsers(userList);
      setGroups(groupList);
      setChannels(channelList);
      setUserGroups({});
    } catch (error) {
      captureFailure(error);
    }
  }, [api, captureFailure, clearFailure]);

  React.useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  React.useEffect(() => {
    setPage(1);
  }, [query]);

  const filteredUsers = users.filter((user) => {
    if (!query.trim()) return true;
    const haystack = `${user.username} ${user.email} ${user.display_name ?? ''} ${user.role ?? ''}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  });

  const openDialog = (mode: EntityFormMode, user?: UserRecord) => {
    setDialogMode(mode);
    setActiveUser(user ?? null);
    setFormErrors({});
    setSelectedGroupIds(user ? (userGroups[user.id] ?? []).map((group) => group.id) : []);
    if (!user) {
      setFormValues(emptyForm);
    } else {
      setFormValues({
        username: user.username,
        email: user.email,
        display_name: user.display_name ?? '',
        password: '',
        role: user.role ?? 'viewer',
        language: user.language ?? 'en',
        preferred_channel: user.preferred_channel ?? 'email_default',
        content_style: user.content_style ?? 'html',
      });
    }
    setDialogOpen(true);
  };

  const saveUser = async () => {
    if (savingRef.current) return;
    const errors = validate(formValues, dialogMode);
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    savingRef.current = true;
    clearFailure();
    setStatus('');
    try {
      let statusMsg = '';
      if (dialogMode === 'add') {
        const createPayload = {
          ...formValues,
          display_name: formValues.display_name.trim() || formValues.username.trim(),
          preferred_channel: formValues.preferred_channel || channels[0]?.name || 'email_default',
        };
        const result = await api.createUser(createPayload);
        const created = result as unknown as Record<string, unknown>;
        const createdUserId = Number(created.id ?? created.user_id ?? 0);
        for (const groupId of selectedGroupIds) {
          if (createdUserId > 0) {
            await api.addGroupMember(Number(groupId), { user_id: createdUserId, role: 'member' });
          }
        }
        setUsers((prev) => [{
          id: createdUserId,
          username: formValues.username,
          email: formValues.email,
          display_name: String(createPayload.display_name),
          role: formValues.role ?? 'viewer',
          language: formValues.language,
          preferred_channel: String(createPayload.preferred_channel),
          content_style: formValues.content_style,
        } as UserRecord, ...prev.filter((user) => user.id !== createdUserId)]);
        setPage(1);
        statusMsg = `Created user ${formValues.username}.`;
        setFormValues(emptyForm);
      } else if (activeUser) {
        const updatePayload = {
          email: formValues.email,
          display_name: formValues.display_name.trim() || formValues.username.trim(),
          role: formValues.role,
          language: formValues.language,
          preferred_channel: formValues.preferred_channel,
          content_style: formValues.content_style,
        };
        await api.updateUser(activeUser.id, updatePayload);
        const currentGroupIds = new Set((userGroups[activeUser.id] ?? []).map((group) => group.id));
        const nextGroupIds = new Set(selectedGroupIds);
        for (const groupId of selectedGroupIds) {
          if (!currentGroupIds.has(groupId)) {
            await api.addGroupMember(Number(groupId), { user_id: activeUser.id, role: 'member' });
          }
        }
        for (const groupId of currentGroupIds) {
          if (!nextGroupIds.has(groupId)) {
            await api.removeGroupMember(Number(groupId), activeUser.id);
          }
        }
        setUsers((prev) => prev.map((user) => (user.id === activeUser.id
          ? {
              ...user,
              email: formValues.email,
              display_name: formValues.display_name.trim() || formValues.username.trim(),
              role: formValues.role,
              language: formValues.language,
              preferred_channel: formValues.preferred_channel,
              content_style: formValues.content_style,
            }
          : user)));
        statusMsg = `Updated user ${activeUser.username}.`;
      }
      setStatus(statusMsg);
      setDialogOpen(false);
    } catch (error) {
      captureFailure(error);
    } finally {
      savingRef.current = false;
    }
  };

  const deleteUsers = async (items: UserRecord[]) => {
    clearFailure();
    setStatus('');
    try {
      for (const item of items) {
        await api.deleteUser(item.id);
      }
      const deletedIds = new Set(items.map((item) => item.id));
      setUsers((prev) => prev.filter((user) => !deletedIds.has(user.id)));
      setUserGroups((prev) =>
        Object.fromEntries(Object.entries(prev).filter(([userId]) => !deletedIds.has(Number(userId)))),
      );
      setStatus(items.length === 1 ? `Deleted user ${items[0].username}.` : `Deleted ${items.length} users.`);
      if (activeUser && items.some((item) => item.id === activeUser.id)) {
        setDialogOpen(false);
        setActiveUser(null);
      }
      void loadUsers(query);
    } catch (error) {
      captureFailure(error);
    }
  };

  const createQuickUser = async (event: React.FormEvent) => {
    event.preventDefault();
    clearFailure();
    setStatus('');
    const username = quickValues.username.trim();
    const email = quickValues.email.trim();
    if (!username || !email) {
      captureFailure(new Error('Username and email are required.'));
      return;
    }
    try {
      const payload = {
        ...emptyForm,
        username,
        email,
        display_name: quickValues.display_name.trim() || username,
        preferred_channel: channels[0]?.name || emptyForm.preferred_channel,
      };
      const result = await api.createUser(payload);
      const created = result as unknown as Record<string, unknown>;
      const createdUserId = Number(created.id ?? created.user_id ?? 0);
      setUsers((prev) => [{
        id: createdUserId,
        username,
        email,
        display_name: payload.display_name,
        role: payload.role,
        language: payload.language,
        preferred_channel: payload.preferred_channel,
        content_style: payload.content_style,
      } as UserRecord, ...prev.filter((user) => user.id !== createdUserId)]);
      setQuickValues({ username: '', email: '', display_name: '' });
      setPage(1);
      setStatus(`Created user ${username}.`);
    } catch (error) {
      captureFailure(error);
    }
  };

  const columns = React.useMemo<DataColumn<UserRecord>[]>(() => [
    {
      id: 'username',
      header: 'Username',
      sortable: true,
      sortValue: (user) => user.username,
      cell: (user) => (
        <span className="cursor-pointer font-medium underline-offset-4 hover:underline" onClick={() => openDialog('view', user)}>
          {user.username}
        </span>
      ),
    },
    {
      id: 'display_name',
      header: 'Display Name',
      sortable: true,
      sortValue: (user) => user.display_name || user.username,
      cell: (user) => user.display_name || user.username,
    },
    {
      id: 'email',
      header: 'Email',
      sortable: true,
      sortValue: (user) => user.email,
      cell: (user) => user.email,
    },
    {
      id: 'role',
      header: 'Role',
      sortable: true,
      sortValue: (user) => user.role ?? 'viewer',
      cell: (user) => <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>{user.role ?? 'viewer'}</Badge>,
    },
    {
      id: 'groups',
      header: 'Groups',
      sortable: true,
      sortValue: (user) => userGroups[user.id]?.length ?? 0,
      cell: (user) => (userGroups[user.id] ?? []).map((group) => group.label).join(', ') || 'None',
    },
    {
      id: 'status',
      header: 'Status',
      sortable: true,
      sortValue: (user) => (user as any).status ?? 'active',
      cell: (user) => <Badge variant={((user as any).status ?? 'active') === 'active' ? 'default' : 'secondary'}>{(user as any).status ?? 'active'}</Badge>,
    },
    {
      id: 'language',
      header: 'Language',
      sortable: true,
      sortValue: (user) => user.language ?? 'en',
      cell: (user) => user.language ?? 'en',
    },
    {
      id: 'created_at',
      header: 'Created',
      sortable: true,
      sortValue: (user) => String((user as any).created_at ?? ''),
      cell: (user) => (user as any).created_at ? String((user as any).created_at).slice(0, 10) : '—',
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: (user) => (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" aria-label={`View user ${user.username}`} onClick={() => openDialog('view', user)}>View</Button>
          <Button type="button" variant="secondary" aria-label={`Edit user ${user.username}`} onClick={() => openDialog('edit', user)}>Edit</Button>
          <Button type="button" variant="secondary" onClick={() => { window.location.href = `/messages?sender=${encodeURIComponent(user.username)}`; }}>Messages</Button>
          <Button type="button" variant="secondary" aria-label={`Delete user ${user.username}`} onClick={() => void deleteUsers([user])}>Delete</Button>
        </div>
      ),
    },
  ], [deleteUsers, userGroups]);

  const bulkActions = React.useMemo<BulkAction[]>(() => [
    { label: 'Delete selected', action: 'delete' },
    { label: 'Export', action: 'export' },
  ], []);

  const onBulkAction = React.useCallback((action: string, selectedIds: string[]) => {
    const items = filteredUsers.filter((user) => selectedIds.includes(String(user.id)));
    if (action === 'delete') {
      void deleteUsers(items);
      return;
    }
    if (action === 'export') {
      downloadJson('notification-users.json', items);
    }
  }, [deleteUsers, filteredUsers]);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Users</h1>
      </header>

      {latestFailure ? <p role="alert" className="text-sm text-destructive">{latestFailure}</p> : null}
      {status ? <p role="status" className="text-sm text-foreground/80">{status}</p> : null}

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Create user</h2>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]" onSubmit={createQuickUser}>
            <div className="space-y-2">
              <Label htmlFor="users-quick-username">Username</Label>
              <Input
                id="users-quick-username"
                value={quickValues.username}
                onChange={(event) => setQuickValues((current) => ({ ...current, username: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="users-quick-email">Email</Label>
              <Input
                id="users-quick-email"
                value={quickValues.email}
                onChange={(event) => setQuickValues((current) => ({ ...current, email: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="users-quick-display-name">Display name</Label>
              <Input
                id="users-quick-display-name"
                value={quickValues.display_name}
                onChange={(event) => setQuickValues((current) => ({ ...current, display_name: event.target.value }))}
              />
            </div>
            <Button type="submit" className="self-end">Create user</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">User directory</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="flex-1">
              <Label htmlFor="users-search-adopted">Search or filter</Label>
              <Input
                id="users-search-adopted"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by username, email or role"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setPage(1)}>Search</Button>
              <Button onClick={() => openDialog('add')}>Add user</Button>
            </div>
          </div>

          <DataTable
            tableId="notification-users"
            columns={columns}
            rows={filteredUsers}
            getRowId={(user) => String(user.id)}
            getRowName={(user) => `${user.username} ${user.display_name ?? ''} ${user.email}`}
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
        title={
          dialogMode === 'add'
            ? 'Create user'
            : dialogMode === 'edit'
              ? `Edit user ${activeUser?.username ?? ''}`
              : `View user ${activeUser?.username ?? ''}`
        }
        body={(
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void saveUser();
            }}
          >
            {latestFailure ? <p role="alert" className="text-sm text-destructive">{latestFailure}</p> : null}
            {status ? <p role="status" className="text-sm text-foreground/80">{status}</p> : null}
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="users-dialog-username">Username</Label>
                <Input id="users-dialog-username" value={formValues.username} onChange={(event) => setFormValues((current) => ({ ...current, username: event.target.value, display_name: current.display_name || event.target.value }))} disabled={dialogMode !== 'add'} />
                {formErrors.username ? <p className="text-sm text-destructive">{formErrors.username}</p> : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="users-dialog-email">Email</Label>
                <Input id="users-dialog-email" value={formValues.email} onChange={(event) => setFormValues((current) => ({ ...current, email: event.target.value }))} disabled={dialogMode === 'view'} />
                {formErrors.email ? <p className="text-sm text-destructive">{formErrors.email}</p> : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="users-dialog-display-name">Display name</Label>
                <Input
                  id="users-dialog-display-name"
                  value={formValues.display_name || formValues.username}
                  onChange={(event) => setFormValues((current) => ({ ...current, display_name: event.target.value }))}
                  disabled={dialogMode === 'view'}
                />
              </div>
              {dialogMode === 'add' ? (
                <div className="space-y-2">
                  <Label htmlFor="users-dialog-password">Password</Label>
                  <Input id="users-dialog-password" type="password" value={formValues.password} onChange={(event) => setFormValues((current) => ({ ...current, password: event.target.value }))} />
                  {formErrors.password ? <p className="text-sm text-destructive">{formErrors.password}</p> : null}
                </div>
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="users-dialog-role">Role</Label>
                <Select id="users-dialog-role" value={formValues.role} onChange={(event) => setFormValues((current) => ({ ...current, role: event.target.value }))} disabled={dialogMode === 'view'}>
                  <option value="viewer">Viewer</option>
                  <option value="user">User</option>
                  <option value="editor">Editor</option>
                  <option value="admin">Admin</option>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="users-dialog-language">Language</Label>
                <Select id="users-dialog-language" value={formValues.language} onChange={(event) => setFormValues((current) => ({ ...current, language: event.target.value }))} disabled={dialogMode === 'view'}>
                  <option value="en">English</option>
                  <option value="fr">French</option>
                  <option value="de">German</option>
                  <option value="es">Spanish</option>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="users-dialog-preferred-channel">Preferred channel</Label>
                <Select id="users-dialog-preferred-channel" value={formValues.preferred_channel} onChange={(event) => setFormValues((current) => ({ ...current, preferred_channel: event.target.value }))} disabled={dialogMode === 'view'}>
                  <option value="email_default">email_default</option>
                  {channels.map((channel) => <option key={channel.id} value={channel.name}>{channel.name}</option>)}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="users-dialog-content-style">Content style</Label>
                <Select id="users-dialog-content-style" value={formValues.content_style} onChange={(event) => setFormValues((current) => ({ ...current, content_style: event.target.value }))} disabled={dialogMode === 'view'}>
                  <option value="html">HTML</option>
                  <option value="plain">Plain</option>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Groups</Label>
              <MultiSelect
                options={groups.map((group) => ({ value: String(group.id), label: group.name }))}
                values={selectedGroupIds}
                onChange={setSelectedGroupIds}
                disabled={dialogMode === 'view'}
                placeholder="Select groups"
                emptyMessage="No groups available"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setDialogOpen(false)}>Cancel</Button>
              {dialogMode !== 'view' ? <Button type="submit">Save changes</Button> : null}
            </div>
          </form>
        )}
        relatedPanels={activeUser ? [{
          title: 'Related groups',
          items: userGroups[activeUser.id] ?? [],
          emptyMessage: 'No group memberships.',
        }] : undefined}
      />

    </div>
  );
}
