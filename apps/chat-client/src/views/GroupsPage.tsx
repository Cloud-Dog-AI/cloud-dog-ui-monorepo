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

// @cloud-dog/app-chat-client — Group CRUD page.

import * as React from "react";
import { useAuth } from "@cloud-dog/auth";
import { Badge, Button, Card, CardContent, CardHeader, DataTable, EntityDialog, Input, RelatedItemsPanel, RelativeTime } from "@cloud-dog/ui";
import type { BulkAction, DataColumn, EntityFieldDef } from "@cloud-dog/ui";
import { isAdminUser } from "../lib/rbac";
import type { ChatGroupRecord, ChatUserRecord } from "../lib/types";
import { useAppState } from "../state/AppState";

const groupFields: EntityFieldDef[] = [
  { name: "group_id", label: "Group ID", type: "text", required: false },
  { name: "name", label: "Name", type: "text", required: true },
  { name: "description", label: "Description", type: "text", required: false },
  { name: "roles", label: "Roles (comma-separated)", type: "text", required: true },
  { name: "member_user_ids", label: "Members (comma-separated user IDs)", type: "text", required: false },
];

const emptyForm = {
  group_id: "",
  name: "",
  description: "",
  roles: "user",
  member_user_ids: "",
};

function toPayload(form: Record<string, unknown>) {
  return {
    group_id: String(form.group_id ?? "").trim(),
    name: String(form.name ?? "").trim(),
    description: String(form.description ?? "").trim(),
    roles: String(form.roles ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
    member_user_ids: String(form.member_user_ids ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  };
}

export function GroupsPage() {
  const auth = useAuth();
  const { api } = useAppState();
  const mayEdit = isAdminUser(auth.user);
  const [groups, setGroups] = React.useState<ChatGroupRecord[]>([]);
  const [users, setUsers] = React.useState<ChatUserRecord[]>([]);
  const [selectedGroup, setSelectedGroup] = React.useState<ChatGroupRecord | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [form, setForm] = React.useState<Record<string, unknown>>(emptyForm);
  const [editingGroupId, setEditingGroupId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);

  const refresh = React.useCallback(async () => {
    setError(null);
    const [listedGroups, listedUsers] = await Promise.all([api.listGroups(), api.listUsers()]);
    setGroups(listedGroups);
    setUsers(listedUsers);
  }, [api]);

  React.useEffect(() => {
    void refresh().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : "Failed to load groups");
    });
  }, [refresh]);

  React.useEffect(() => {
    setPage(1);
  }, [query]);

  const resetDialog = () => {
    setEditingGroupId(null);
    setForm(emptyForm);
    setDialogOpen(false);
  };

  const openCreate = () => {
    setEditingGroupId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (group: ChatGroupRecord) => {
    setEditingGroupId(group.group_id);
    setForm({
      group_id: group.group_id,
      name: group.name,
      description: group.description,
      roles: group.roles.join(", "),
      member_user_ids: group.member_user_ids.join(", "),
    });
    setDialogOpen(true);
  };

  const save = async () => {
    setError(null);
    setStatus(null);
    try {
      const payload = toPayload(form);
      if (editingGroupId) {
        await api.updateGroup(editingGroupId, payload);
        setStatus(`Updated group ${editingGroupId}`);
      } else {
        await api.createGroup(payload);
        setStatus(`Created group ${payload.group_id || payload.name}`);
      }
      resetDialog();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save group");
    }
  };

  const removeGroup = async (groupId: string) => {
    setError(null);
    setStatus(null);
    try {
      await api.deleteGroup(groupId);
      setStatus(`Deleted group ${groupId}`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete group");
    }
  };

  const bulkDelete = async (rows: ChatGroupRecord[]) => {
    if (!rows.length) return;
    if (!window.confirm(`Delete ${rows.length} selected groups?`)) return;
    setError(null);
    setStatus(null);
    try {
      await Promise.all(rows.map((row) => api.deleteGroup(row.group_id)));
      setStatus(`Deleted ${rows.length} groups`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete selected groups");
    }
  };

  const relatedUsers = selectedGroup
    ? users
        .filter((user) => selectedGroup.member_user_ids.includes(user.user_id))
        .map((user) => ({ id: user.user_id, label: `${user.display_name || user.user_id} (${user.user_id})` }))
    : [];

  const filteredGroups = React.useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return groups;
    return groups.filter((row) =>
      `${row.group_id} ${row.name} ${row.description} ${row.roles.join(" ")} ${row.member_user_ids.join(" ")}`
        .toLowerCase()
        .includes(trimmed),
    );
  }, [groups, query]);

  const columns = React.useMemo<DataColumn<ChatGroupRecord>[]>(() => [
    {
      id: "name",
      header: "Name",
      sortable: true,
      sortValue: (row) => row.name.toLowerCase(),
      cell: (row) => <span className="font-medium">{row.name}</span>,
    },
    {
      id: "group_id",
      header: "Group ID",
      sortable: true,
      sortValue: (row) => row.group_id,
      cell: (row) => <span className="font-mono text-xs">{row.group_id}</span>,
    },
    {
      id: "description",
      header: "Description",
      sortable: true,
      sortValue: (row) => row.description ?? "",
      cell: (row) => row.description || "-",
    },
    {
      id: "roles",
      header: "Roles",
      sortable: true,
      sortValue: (row) => row.roles.join(","),
      cell: (row) => row.roles.join(", ") || "none",
    },
    {
      id: "members",
      header: "Members",
      sortable: true,
      sortValue: (row) => row.member_user_ids.length,
      cell: (row) => String(row.member_user_ids.length),
    },
    {
      id: "status",
      header: "Status",
      sortable: true,
      sortValue: () => 1,
      cell: () => <Badge variant="default">active</Badge>,
    },
    {
      id: "created_at",
      header: "Created",
      sortable: true,
      sortValue: (row) => row.created_at || row.updated_at || "",
      cell: (row) => row.created_at ? <RelativeTime timestamp={row.created_at} /> : "-",
    },
    {
      id: "actions",
      header: "Actions",
      cell: (row) => (
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => setSelectedGroup(row)}>Details</Button>
          <Button variant="secondary" disabled={!mayEdit} onClick={() => openEdit(row)}>Edit</Button>
          <Button variant="ghost" disabled={!mayEdit} onClick={() => void removeGroup(row.group_id)}>Delete</Button>
        </div>
      ),
    },
  ], [mayEdit, openEdit, removeGroup]);

  const bulkActions = React.useMemo<BulkAction[]>(() => (mayEdit ? [{ label: "Delete Selected", action: "delete" }] : []), [mayEdit]);

  const onBulkAction = React.useCallback((action: string, selectedIds: string[]) => {
    if (action !== "delete") return;
    const selectedRows = filteredGroups.filter((row) => selectedIds.includes(row.group_id));
    void bulkDelete(selectedRows);
  }, [bulkDelete, filteredGroups]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <h1 className="text-xl font-semibold">Groups</h1>
          <p className="text-sm text-muted-foreground">Manage groups, memberships, and roles with shared tables and forms.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <Input
              aria-label="Search groups"
              className="max-w-md"
              placeholder="Search groups"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => void refresh()}>Refresh</Button>
              <Button disabled={!mayEdit} onClick={openCreate}>Add Group</Button>
            </div>
          </div>
          <DataTable
            tableId="chat-groups"
            columns={columns}
            rows={filteredGroups}
            totalRows={groups.length}
            emptyMessage="No groups configured."
            getRowId={(row) => row.group_id}
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
          <h2 className="text-lg font-semibold">Group members</h2>
          <p className="text-sm text-muted-foreground">Selected group's current members.</p>
        </CardHeader>
        <CardContent>
          <RelatedItemsPanel
            title="Members"
            items={relatedUsers}
            emptyMessage="Select a group to inspect membership."
          />
        </CardContent>
      </Card>

      <EntityDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editingGroupId ? `Edit group ${editingGroupId}` : "Add Group"}
        fields={groupFields.map((field) => (
          field.name === "group_id" && editingGroupId ? { ...field, readOnly: true } : field
        ))}
        values={form}
        mode={mayEdit ? (editingGroupId ? "edit" : "add") : "view"}
        onChange={(name, value) => setForm((current) => ({ ...current, [name]: value }))}
        onSubmit={() => void save()}
        onCancel={resetDialog}
      />
    </div>
  );
}
