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
import { Badge, Button, DataTable, EntityDialog, RelativeTime, type BulkAction, type DataColumn, type EntityFieldDef } from "@cloud-dog/ui";
import { useDbMcpState } from "../state/AppState";
import type { GroupSummary } from "../lib/types";

type DialogMode = "add" | "edit" | "view";

type GroupFormState = Readonly<{
  name: string;
  description: string;
  roles: string[];
  members: string[];
}>;

const PLATFORM_ROLES = ["admin", "analyst", "reader", "writer", "maintainer"];

const EMPTY_FORM: GroupFormState = {
  name: "",
  description: "",
  roles: ["analyst"],
  members: [],
};


function toFormState(group: GroupSummary | null): GroupFormState {
  if (!group) return EMPTY_FORM;
  return {
    name: group.name,
    description: group.description,
    roles: group.roles,
    members: group.member_user_ids,
  };
}

export function GroupsPage() {
  const { api } = useDbMcpState();
  const [groups, setGroups] = React.useState<GroupSummary[]>([]);
  const [users, setUsers] = React.useState<{ user_id: string; username: string }[]>([]);
  const [selectedGroup, setSelectedGroup] = React.useState<GroupSummary | null>(null);
  const [dialogMode, setDialogMode] = React.useState<DialogMode>("add");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [form, setForm] = React.useState<GroupFormState>(EMPTY_FORM);
  const [page, setPage] = React.useState(1);
  const [status, setStatus] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setError(null);
    try {
      const [groupItems, userItems] = await Promise.all([api.listGroups(), api.listUsers()]);
      setGroups(groupItems);
      setUsers(userItems);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load groups.");
    }
  }, [api]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const openDialog = (mode: DialogMode, group: GroupSummary | null = null) => {
    setSelectedGroup(group);
    setDialogMode(mode);
    setForm(toFormState(group));
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setSelectedGroup(null);
    setForm(EMPTY_FORM);
  };

  const submit = async () => {
    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      roles: form.roles,
      member_user_ids: form.members,
    };
    try {
      if (dialogMode === "edit" && selectedGroup) {
        await api.updateGroup(selectedGroup.group_id, payload);
        setStatus(`Updated group ${payload.name}.`);
      } else if (dialogMode === "add") {
        await api.createGroup(payload);
        setStatus(`Created group ${payload.name}.`);
      }
      closeDialog();
      await load();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to save group.");
    }
  };

  const remove = async (group: GroupSummary) => {
    try {
      await api.deleteGroup(group.group_id);
      setStatus(`Deleted group ${group.name}.`);
      await load();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete group.");
    }
  };

  const bulkActions: BulkAction[] = [{ label: "Delete Selected", action: "delete" }];

  const columns: DataColumn<GroupSummary>[] = [
    { id: "name", header: "Name", cell: (item) => item.name, sortable: true, sortValue: (item) => item.name },
    { id: "description", header: "Description", cell: (item) => item.description || "-", sortable: true, sortValue: (item) => item.description || "-" },
    { id: "roles", header: "Roles", cell: (item) => item.roles.join(", ") || "-", sortable: true, sortValue: (item) => item.roles.join(", ") },
    { id: "members", header: "Members", cell: (item) => String(item.member_user_ids.length), sortable: true, sortValue: (item) => item.member_user_ids.length },
    { id: "status", header: "Status", cell: () => <Badge variant="default">active</Badge>, sortable: true, sortValue: () => 1 },
    { id: "created_at", header: "Created", cell: (item) => { const ts = String((item as Record<string, unknown>).created_at || ""); return ts && ts !== "undefined" ? ts : "-"; }, sortable: true, sortValue: (item) => String((item as Record<string, unknown>).created_at || "") },
    {
      id: "actions",
      header: "Actions",
      cell: (item) => (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => openDialog("view", item)}>View</Button>
          <Button size="sm" variant="secondary" onClick={() => openDialog("edit", item)}>Edit</Button>
          <Button size="sm" variant="destructive" onClick={() => void remove(item)}>Delete</Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">Groups</h1>
        <Button onClick={() => openDialog("add")}>Add Group</Button>
        <Button variant="secondary" size="sm" onClick={() => void load()}>Refresh</Button>
      </header>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      {status ? <p role="status" className="text-sm text-foreground/80">{status}</p> : null}
      <DataTable
        columns={columns}
        rows={groups}
        emptyMessage="No groups configured."
        page={page}
        pageSize={10}
        onPageChange={setPage}
        selectable
        bulkActions={bulkActions}
        onBulkAction={(action, selectedIds) => {
          if (action !== "delete") return;
          void Promise.all(groups.filter((item) => selectedIds.includes(item.group_id)).map((item) => api.deleteGroup(item.group_id))).then(load);
        }}
        columnPickerEnabled
        tableId="db-mcp-groups"
        getRowId={(item) => item.group_id}
      />
      <EntityDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={dialogMode === "add" ? "Add group" : dialogMode === "edit" ? "Edit group" : "View group"}
        fields={[
          { name: "name", label: "Name", type: "text" as const, required: true },
          { name: "description", label: "Description", type: "text" as const },
          { name: "roles", label: "Roles", type: "multiselect" as const, options: PLATFORM_ROLES },
          { name: "members", label: "Members", type: "multiselect" as const, options: users.map((u) => u.user_id) },
        ]}
        values={form as Record<string, unknown>}
        onChange={(name, value) => setForm((current) => ({ ...current, [name]: value }))}
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
