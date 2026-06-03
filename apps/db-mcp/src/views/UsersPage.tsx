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

import * as React from "react";
import { Badge, Button, DataTable, EntityDialog, RelativeTime, statusColumn, type BulkAction, type DataColumn, type EntityFieldDef } from "@cloud-dog/ui";
import { useDbMcpState } from "../state/AppState";
import type { GroupSummary, UserSummary } from "../lib/types";

type DialogMode = "add" | "edit" | "view";

type UserFormState = Readonly<{
  username: string;
  display_name: string;
  email: string;
  status: string;
  rolesCsv: string;
}>;

const USER_FIELDS: EntityFieldDef[] = [
  { name: "username", label: "Username", type: "text", required: true },
  { name: "display_name", label: "Display name", type: "text" },
  { name: "email", label: "Email", type: "text" },
  { name: "status", label: "Status", type: "text" },
  { name: "rolesCsv", label: "Roles", type: "multiselect", options: ["admin", "analyst", "reader", "writer", "maintainer"] },
];

const EMPTY_FORM: UserFormState = {
  username: "",
  display_name: "",
  email: "",
  status: "active",
  rolesCsv: "analyst",
};

function parseCsv(value: string): string[] {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function toFormState(user: UserSummary | null): UserFormState {
  if (!user) return EMPTY_FORM;
  return {
    username: user.username,
    display_name: user.display_name,
    email: user.email,
    status: user.status,
    rolesCsv: user.roles.join(", "),
  };
}

export function UsersPage() {
  const { api } = useDbMcpState();
  const [users, setUsers] = React.useState<UserSummary[]>([]);
  const [groups, setGroups] = React.useState<GroupSummary[]>([]);
  const [selectedUser, setSelectedUser] = React.useState<UserSummary | null>(null);
  const [dialogMode, setDialogMode] = React.useState<DialogMode>("add");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [form, setForm] = React.useState<UserFormState>(EMPTY_FORM);
  const [page, setPage] = React.useState(1);
  const [status, setStatus] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setError(null);
    try {
      const [userItems, groupItems] = await Promise.all([api.listUsers(), api.listGroups().catch(() => [] as GroupSummary[])]);
      setUsers(userItems);
      setGroups(groupItems);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load users.");
    }
  }, [api]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const openDialog = (mode: DialogMode, user: UserSummary | null = null) => {
    setSelectedUser(user);
    setDialogMode(mode);
    setForm(toFormState(user));
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setSelectedUser(null);
    setForm(EMPTY_FORM);
  };

  const submit = async () => {
    const payload = {
      username: form.username.trim(),
      display_name: form.display_name.trim(),
      email: form.email.trim(),
      status: form.status.trim() || "active",
      roles: parseCsv(form.rolesCsv),
    };
    try {
      if (dialogMode === "edit" && selectedUser) {
        await api.updateUser(selectedUser.user_id, payload);
        setStatus(`Updated user ${payload.username}.`);
      } else if (dialogMode === "add") {
        await api.createUser(payload);
        setStatus(`Created user ${payload.username}.`);
      }
      closeDialog();
      await load();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to save user.");
    }
  };

  const remove = async (user: UserSummary) => {
    try {
      await api.deleteUser(user.user_id);
      setStatus(`Deleted user ${user.username}.`);
      await load();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete user.");
    }
  };

  const bulkActions: BulkAction[] = [{ label: "Delete Selected", action: "delete" }];

  const columns: DataColumn<UserSummary>[] = [
    { id: "username", header: "Username", cell: (item) => item.username, sortable: true, sortValue: (item) => item.username },
    { id: "display_name", header: "Display Name", cell: (item) => item.display_name || "-", sortable: true, sortValue: (item) => item.display_name || "-" },
    { id: "email", header: "Email", cell: (item) => item.email || "-", sortable: true, sortValue: (item) => item.email || "-" },
    statusColumn<UserSummary>({ getValue: (item) => item.status }),
    { id: "roles", header: "Role", cell: (item) => item.roles.length > 0 ? (<div className="flex flex-wrap gap-1">{item.roles.map((r) => (<Badge key={r} variant={r === "admin" ? "default" : "secondary"}>{r}</Badge>))}</div>) : "-", sortable: true, sortValue: (item) => item.roles.join(", ") },
    { id: "groups", header: "Groups", cell: (item) => { const memberGroups = groups.filter((g) => g.member_user_ids.includes(item.user_id)); return memberGroups.map((g) => g.name).join(", ") || "-"; }, sortable: true, sortValue: (item) => groups.filter((g) => g.member_user_ids.includes(item.user_id)).map((g) => g.name).join(", ") },
    { id: "created_at", header: "Created", cell: (item) => { const ts = String((item as Record<string, unknown>).created_at || ""); return ts && ts !== "undefined" ? ts : "-"; }, sortable: true, sortValue: (item) => String((item as Record<string, unknown>).created_at || "") },
    {
      id: "actions",
      header: "Actions",
      cell: (item) => (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => openDialog("view", item)}>View</Button>
          <Button size="sm" variant="secondary" onClick={() => openDialog("edit", item)}>Edit</Button>
          <Button size="sm" variant="secondary" onClick={() => { void api.updateUser(item.user_id, { username: item.username, display_name: item.display_name, email: item.email, status: item.status === "active" ? "disabled" : "active", roles: item.roles }).then(load); }}>{item.status === "active" ? "Disable" : "Enable"}</Button>
          <Button size="sm" variant="destructive" onClick={() => void remove(item)}>Delete</Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">Users</h1>
        <Button onClick={() => openDialog("add")}>Add User</Button>
        <Button variant="secondary" size="sm" onClick={() => void load()}>Refresh</Button>
      </header>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      {status ? <p role="status" className="text-sm text-foreground/80">{status}</p> : null}
      <DataTable
        columns={columns}
        rows={users}
        emptyMessage="No users configured. Use Create User to add your first admin account."
        page={page}
        pageSize={10}
        onPageChange={setPage}
        selectable
        bulkActions={bulkActions}
        onBulkAction={(action, selectedIds) => {
          if (action !== "delete") return;
          void Promise.all(users.filter((item) => selectedIds.includes(item.user_id)).map((item) => api.deleteUser(item.user_id))).then(load);
        }}
        columnPickerEnabled
        tableId="db-mcp-users"
        getRowId={(item) => item.user_id}
      />
      <EntityDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={dialogMode === "add" ? "Add user" : dialogMode === "edit" ? "Edit user" : "View user"}
        fields={USER_FIELDS}
        values={form as Record<string, unknown>}
        onChange={(name, value) => setForm((current) => ({ ...current, [name]: String(value ?? "") }))}
        onSubmit={() => {
          if (dialogMode !== "view") {
            void submit();
            return;
          }
          closeDialog();
        }}
        onCancel={closeDialog}
        mode={dialogMode}
      />
    </div>
  );
}
