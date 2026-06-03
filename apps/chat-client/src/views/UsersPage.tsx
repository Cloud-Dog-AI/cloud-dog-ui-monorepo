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

// @cloud-dog/app-chat-client — User CRUD page.

import * as React from "react";
import { useAuth } from "@cloud-dog/auth";
import { Badge, Button, Card, CardContent, CardHeader, DataTable, EntityDialog, Input, RelatedItemsPanel, RelativeTime } from "@cloud-dog/ui";
import type { BulkAction, DataColumn, EntityFieldDef } from "@cloud-dog/ui";
import { isAdminUser } from "../lib/rbac";
import type { ChatGroupRecord, ChatUserRecord } from "../lib/types";
import { useAppState } from "../state/AppState";

const userFields: EntityFieldDef[] = [
  { name: "user_id", label: "User ID", type: "text", required: true },
  { name: "display_name", label: "Display name", type: "text", required: true },
  { name: "email", label: "Email", type: "text", required: true },
  { name: "role", label: "Role", type: "select", required: true, options: ["user", "admin"] },
  { name: "status", label: "Status", type: "select", required: true, options: ["active", "disabled"] },
];

const emptyForm = {
  user_id: "",
  display_name: "",
  email: "",
  role: "user",
  status: "active",
};

export function UsersPage() {
  const auth = useAuth();
  const { api } = useAppState();
  const mayEdit = isAdminUser(auth.user);
  const [users, setUsers] = React.useState<ChatUserRecord[]>([]);
  const [groups, setGroups] = React.useState<ChatGroupRecord[]>([]);
  const [selectedUser, setSelectedUser] = React.useState<ChatUserRecord | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [form, setForm] = React.useState<Record<string, unknown>>(emptyForm);
  const [editingUserId, setEditingUserId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [query, setQuery] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);
  const refreshSeqRef = React.useRef(0);

  const refresh = React.useCallback(async () => {
    const requestSeq = refreshSeqRef.current + 1;
    refreshSeqRef.current = requestSeq;
    setError(null);
    setIsLoading(true);
    try {
      const [listedUsers, listedGroups] = await Promise.all([api.listUsers(), api.listGroups()]);
      if (refreshSeqRef.current !== requestSeq) {
        return;
      }
      const sortedUsers = [...listedUsers].sort((a, b) => {
        const aTime = Date.parse(a.updated_at || a.created_at || "") || 0;
        const bTime = Date.parse(b.updated_at || b.created_at || "") || 0;
        return bTime - aTime;
      });
      setUsers(sortedUsers);
      setGroups(listedGroups);
    } finally {
      if (refreshSeqRef.current === requestSeq) {
        setIsLoading(false);
      }
    }
  }, [api]);

  React.useEffect(() => {
    void refresh().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : "Failed to load users");
    });
  }, [refresh]);

  React.useEffect(() => {
    setPage(1);
  }, [query]);

  const resetDialog = () => {
    setEditingUserId(null);
    setForm(emptyForm);
    setDialogOpen(false);
  };

  const openCreate = () => {
    setEditingUserId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (user: ChatUserRecord) => {
    setEditingUserId(user.user_id);
    setForm({
      user_id: user.user_id,
      display_name: user.display_name,
      email: user.email,
      role: user.role,
      status: user.status,
    });
    setDialogOpen(true);
  };

  const save = async () => {
    setError(null);
    setStatus(null);
    try {
      if (editingUserId) {
        await api.updateUser(editingUserId, form);
        setStatus(`Updated user ${editingUserId}`);
      } else {
        await api.createUser(form);
        setStatus(`Created user ${String(form.user_id ?? "")}`);
      }
      resetDialog();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save user");
    }
  };

  const removeUser = async (userId: string) => {
    if (!window.confirm(`Delete user ${userId}?`)) return;
    setError(null);
    setStatus(null);
    try {
      await api.deleteUser(userId);
      if (editingUserId === userId) resetDialog();
      setStatus(`Deleted user ${userId}`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete user");
    }
  };

  const bulkDelete = async (rows: ChatUserRecord[]) => {
    if (!rows.length) return;
    if (!window.confirm(`Delete ${rows.length} selected users?`)) return;
    setError(null);
    setStatus(null);
    try {
      await Promise.all(rows.map((row) => api.deleteUser(row.user_id)));
      setStatus(`Deleted ${rows.length} users`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete selected users");
    }
  };

  const relatedGroups = selectedUser
    ? groups
        .filter((group) => group.member_user_ids.includes(selectedUser.user_id))
        .map((group) => ({ id: group.group_id, label: `${group.name} (${group.group_id})` }))
    : [];
  const groupNameById = React.useMemo(() => {
    return new Map(groups.map((group) => [group.group_id, group.name || group.group_id]));
  }, [groups]);

  const filteredUsers = React.useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return users;
    return users.filter((row) =>
      `${row.user_id} ${row.display_name} ${row.email} ${row.role} ${row.status} ${row.group_ids.join(" ")}`
        .toLowerCase()
        .includes(trimmed),
    );
  }, [query, users]);

  const columns = React.useMemo<DataColumn<ChatUserRecord>[]>(() => [
    {
      id: "username",
      header: "Username",
      sortable: true,
      sortValue: (row) => row.user_id.toLowerCase(),
      cell: (row) => <span className="font-mono text-xs">{row.user_id}</span>,
    },
    {
      id: "display_name",
      header: "Display Name",
      sortable: true,
      sortValue: (row) => row.display_name.toLowerCase(),
      cell: (row) => (
        <Button
          type="button"
          className="text-left font-medium underline-offset-4 hover:underline"
          onClick={() => setSelectedUser(row)}
        >
          {row.display_name || row.user_id}
        </Button>
      ),
    },
    {
      id: "email",
      header: "Email",
      sortable: true,
      sortValue: (row) => row.email.toLowerCase(),
      cell: (row) => row.email,
    },
    {
      id: "role",
      header: "Role",
      sortable: true,
      sortValue: (row) => row.role,
      cell: (row) => (
        <Badge role="status" variant={row.role === "admin" ? "destructive" : "secondary"}>
          {row.role}
        </Badge>
      ),
    },
    {
      id: "status",
      header: "Status",
      sortable: true,
      sortValue: (row) => row.status,
      cell: (row) => {
        const variant = row.status === "active" ? "default" : row.status === "disabled" ? "destructive" : "secondary";
        return <Badge variant={variant}>{row.status}</Badge>;
      },
    },
    {
      id: "groups",
      header: "Groups",
      sortable: true,
      sortValue: (row) => row.group_ids.join(","),
      cell: (row) => {
        if (row.group_ids.length === 0) return "none";
        return row.group_ids.map((groupId) => groupNameById.get(groupId) ?? groupId).join(", ");
      },
    },
    {
      id: "created_at",
      header: "Created",
      sortable: true,
      sortValue: (row) => row.created_at ?? "",
      cell: (row) => row.created_at ? <RelativeTime timestamp={row.created_at} /> : "-",
    },
    {
      id: "updated_at",
      header: "Updated",
      sortable: true,
      sortValue: (row) => row.updated_at,
      cell: (row) => <RelativeTime timestamp={row.updated_at} />,
    },
    {
      id: "actions",
      header: "Actions",
      cell: (row) => (
        <div className="flex gap-2">
          <Button variant="secondary" disabled={!mayEdit} onClick={() => openEdit(row)}>Edit</Button>
          <Button variant="ghost" disabled={!mayEdit} onClick={() => void removeUser(row.user_id)}>Delete</Button>
        </div>
      ),
    },
  ], [groupNameById, mayEdit, openEdit, removeUser]);

  const bulkActions = React.useMemo<BulkAction[]>(() => (mayEdit ? [{ label: "Delete Selected", action: "delete" }] : []), [mayEdit]);

  const onBulkAction = React.useCallback((action: string, selectedIds: string[]) => {
    if (action !== "delete") return;
    const selectedRows = filteredUsers.filter((row) => selectedIds.includes(row.user_id));
    void bulkDelete(selectedRows);
  }, [bulkDelete, filteredUsers]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <h1 className="text-xl font-semibold">Users</h1>
          <p className="text-sm text-muted-foreground">Manage users with the shared table and entity form components.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <Input
              aria-label="Search users"
              className="max-w-md"
              placeholder="Search users"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => void refresh()}>Refresh</Button>
              <Button disabled={!mayEdit} onClick={openCreate}>Add User</Button>
            </div>
          </div>
          <DataTable
            tableId="chat-users-v2"
            columns={columns}
            rows={filteredUsers}
            totalRows={users.length}
            emptyMessage={isLoading ? "Loading users..." : "No users configured."}
            getRowId={(row) => row.user_id}
            page={page}
            onPageChange={setPage}
            pageSize={pageSize}
            onPageSizeChange={setPageSize}
            selectable={mayEdit}
            bulkActions={bulkActions}
            onBulkAction={onBulkAction}
            columnPickerEnabled={true}
          />
          {status ? <p role="status" className="text-sm text-foreground/80">{status}</p> : null}
          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Related groups</h2>
          <p className="text-sm text-muted-foreground">Selected user's current group memberships.</p>
        </CardHeader>
        <CardContent>
          <RelatedItemsPanel
            title="Group memberships"
            items={relatedGroups}
            emptyMessage="Select a user to inspect membership."
          />
        </CardContent>
      </Card>

      <EntityDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editingUserId ? `Edit user ${editingUserId}` : "Add User"}
        fields={userFields.map((field) => (
          field.name === "user_id" && editingUserId ? { ...field, readOnly: true } : field
        ))}
        values={form}
        mode={mayEdit ? (editingUserId ? "edit" : "add") : "view"}
        onChange={(name, value) => setForm((current) => ({ ...current, [name]: value }))}
        onSubmit={() => void save()}
        onCancel={resetDialog}
      />
    </div>
  );
}
