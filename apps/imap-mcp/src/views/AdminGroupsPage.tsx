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

// @cloud-dog/app-imap-mcp — Split admin groups page.

import * as React from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Badge,
  Button,
  DataTable,
  EntityDialog,
  RelativeTime,
  type DataColumn,
  type EntityDialogRelatedPanel,
  type EntityFieldDef,
} from "@cloud-dog/ui";
import type { GroupRow, UserRow } from "../lib/types";
import { useImapMcpState } from "../state/AppState";

type GroupDraft = Readonly<{
  groupId: string;
  name: string;
  description: string;
  roles: string[];
  members: string[];
}>;

const defaultDraft: GroupDraft = {
  groupId: "",
  name: "",
  description: "",
  roles: ["viewer"],
  members: [],
};

// Canonical roles served by cloud_dog_idam RBACEngine + imap-mcp defaults.yaml.
const KNOWN_ROLES = ["viewer", "reader", "writer", "admin", "audit", "read_jobs"];

function toDraft(group: GroupRow): GroupDraft {
  return {
    groupId: group.groupId,
    name: group.name,
    description: group.description,
    roles: [...group.roles],
    members: [...group.members],
  };
}

export function AdminGroupsPage() {
  const { api } = useImapMcpState();
  const [searchParams] = useSearchParams();
  const [groups, setGroups] = React.useState<GroupRow[]>([]);
  const [users, setUsers] = React.useState<UserRow[]>([]);
  const [draft, setDraft] = React.useState<GroupDraft>(defaultDraft);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [mode, setMode] = React.useState<"add" | "edit">("add");
  const [deletingGroupId, setDeletingGroupId] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [error, setError] = React.useState("");

  const loadGroups = React.useCallback(async () => {
    const [groupsResult, usersResult] = await Promise.all([api.listGroups(), api.listUsers()]);
    if (!groupsResult.ok || !groupsResult.data) {
      setError(groupsResult.errorMessage || "Failed to load groups.");
      return;
    }
    setGroups(groupsResult.data);
    setUsers(usersResult.ok && usersResult.data ? usersResult.data : []);
    setError("");
  }, [api]);

  React.useEffect(() => {
    void loadGroups();
  }, [loadGroups]);

  const userIdFilter = searchParams.get("userId")?.trim() ?? "";
  const visibleGroups = userIdFilter
    ? groups.filter((group) => group.members.includes(userIdFilter))
    : groups;

  const deleteGroup = (group: GroupRow) => {
    setDeletingGroupId(group.groupId);
    void api.deleteGroup(group.groupId).then(async (result) => {
      if (!result.ok) {
        setError(result.errorMessage || `Failed to delete ${group.groupId}.`);
        setDeletingGroupId("");
        return;
      }
      setStatus(`Deleted group ${group.groupId}.`);
      await loadGroups();
      window.setTimeout(() => setDeletingGroupId(""), 1500);
    });
  };

  const userLabel = (userId: string): string => {
    const u = users.find((row) => row.userId === userId);
    if (!u) return userId;
    return u.displayName || u.username || userId;
  };

  const columns: DataColumn<GroupRow>[] = [
    { id: "name", header: "Name", cell: (row) => row.name, sortable: true, sortValue: (row) => row.name },
    { id: "description", header: "Description", cell: (row) => row.description || "N/A" },
    {
      id: "members",
      header: "Members",
      cell: (row) => {
        if (row.members.length === 0) return <span className="text-xs text-muted-foreground">none</span>;
        return (
          <div className="flex flex-wrap gap-1">
            {row.members.slice(0, 4).map((memberId) => (
              <Link
                key={memberId}
                to={`/admin/users?userId=${encodeURIComponent(memberId)}`}
                className="text-xs text-primary underline-offset-4 hover:underline"
                title={memberId}
              >
                {userLabel(memberId)}
              </Link>
            ))}
            {row.members.length > 4 ? (
              <span className="text-xs text-muted-foreground">+{row.members.length - 4} more</span>
            ) : null}
          </div>
        );
      },
      sortable: true,
      sortValue: (row) => row.members.length,
    },
    { id: "roles", header: "Roles", cell: (row) => row.roles.join(", ") || "N/A" },
    { id: "status", header: "Status", cell: (row) => <Badge variant={row.active !== false ? 'default' : 'secondary'}>{row.active !== false ? 'Active' : 'Disabled'}</Badge>, sortable: true, sortValue: (row) => row.active !== false ? 'a' : 'z' },
    {
      id: "created",
      header: "Created",
      cell: (row) => row.createdAt ? <RelativeTime timestamp={row.createdAt} /> : "N/A",
      sortable: true,
      sortValue: (row) => row.createdAt || "",
    },
    {
      id: "actions",
      header: "Actions",
      cell: (row) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setMode("edit");
              setDraft(toDraft(row));
              setDialogOpen(true);
            }}
          >
            Edit
          </Button>
          <Link
            to={`/diagnostics-audit?target_id=${encodeURIComponent(row.groupId)}`}
            className="inline-flex h-8 items-center justify-center rounded-md px-3 text-sm font-medium hover:bg-accent"
            title={`View audit for group ${row.groupId}`}
          >
            Audit
          </Link>
          <Button
            variant="ghost"
            size="sm"
            disabled={Boolean(deletingGroupId)}
            onClick={() => deleteGroup(row)}
          >
            {deletingGroupId ? "Deleting" : "Delete"}
          </Button>
        </div>
      ),
    },
  ];

  const submit = async () => {
    if (mode === "add") {
      const result = await api.createGroup({
        group_id: draft.groupId.trim() || undefined,
        name: draft.name.trim(),
        description: draft.description.trim(),
        roles: draft.roles,
        members: draft.members,
      });
      if (!result.ok) {
        setError(result.errorMessage || "Failed to create group.");
        return;
      }
      setStatus(`Created group ${result.data?.groupId ?? draft.groupId}.`);
    } else {
      const result = await api.updateGroup(draft.groupId, {
        name: draft.name.trim(),
        description: draft.description.trim(),
        roles: draft.roles,
      });
      if (!result.ok) {
        setError(result.errorMessage || "Failed to update group.");
        return;
      }
      const nextMembers = draft.members;
      const existing = groups.find((group) => group.groupId === draft.groupId)?.members ?? [];
      for (const memberId of nextMembers.filter((memberId) => !existing.includes(memberId))) {
        await api.addGroupMember(draft.groupId, memberId);
      }
      for (const memberId of existing.filter((memberId) => !nextMembers.includes(memberId))) {
        await api.removeGroupMember(draft.groupId, memberId);
      }
      setStatus(`Updated group ${draft.groupId}.`);
    }
    setDialogOpen(false);
    await loadGroups();
  };

  return (
    <div className="space-y-4">
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      {status ? <p role="status" className="text-sm text-foreground/80">{status}</p> : null}
      {userIdFilter ? (
        <p className="text-sm text-muted-foreground">
          Showing groups related to user <span className="font-mono">{userIdFilter}</span>.{" "}
          <Link to="/admin/groups" className="font-medium text-primary underline-offset-4 hover:underline">
            View all groups
          </Link>
        </p>
      ) : null}

      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Groups</h1>
        <Button
          size="sm"
          onClick={() => {
            setMode("add");
            setDraft(defaultDraft);
            setDialogOpen(true);
          }}
        >
          Create Group
        </Button>
      </header>

      <div className="rounded-md border bg-background">
        <DataTable
          columns={columns}
          rows={visibleGroups}
          emptyMessage="No groups found."
          getRowId={(group) => group.groupId}
          columnPickerEnabled
          tableId="imap-groups"
        />
      </div>

      <EntityDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={mode === "add" ? "Create Group" : `Edit Group: ${draft.groupId}`}
        fields={[
          { name: "groupId", label: "Group ID", type: "text", required: true, readOnly: mode === "edit" },
          { name: "name", label: "Name", type: "text", required: true },
          { name: "description", label: "Description", type: "text" },
          { name: "roles", label: "Roles", type: "multiselect", options: KNOWN_ROLES },
          { name: "members", label: "Members", type: "multiselect", options: users.map((u) => u.userId) },
        ] satisfies EntityFieldDef[]}
        values={draft as Record<string, unknown>}
        onChange={(name, value) => setDraft((current) => ({ ...current, [name]: value } as GroupDraft))}
        onSubmit={() => void submit()}
        onCancel={() => setDialogOpen(false)}
        mode={mode}
        relatedPanels={
          mode === "edit"
            ? ([
                {
                  title: "Member users",
                  emptyMessage: "Group has no members.",
                  items: (() => {
                    const memberIds = (groups.find((g) => g.groupId === draft.groupId)?.members) ?? [];
                    return memberIds.map((memberId) => {
                      const u = users.find((row) => row.userId === memberId);
                      return {
                        id: memberId,
                        label: u
                          ? `${u.displayName || u.username} <${u.email || "no email"}>`
                          : memberId,
                        href: `/admin/users?userId=${encodeURIComponent(memberId)}`,
                      };
                    });
                  })(),
                },
                {
                  title: "Roles granted to members",
                  emptyMessage: "No roles configured.",
                  items: (groups.find((g) => g.groupId === draft.groupId)?.roles ?? []).map((role) => ({
                    id: role,
                    label: role,
                    href: `/admin/rbac?role=${encodeURIComponent(role)}`,
                  })),
                },
              ] satisfies EntityDialogRelatedPanel[])
            : undefined
        }
      />
    </div>
  );
}
