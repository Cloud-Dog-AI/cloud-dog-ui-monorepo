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

// @cloud-dog/app-imap-mcp — Split admin users page (PS-71 IW2 — DataTable + bulk delete).

import * as React from "react";
import { Link } from "react-router-dom";
import {
  Badge,
  Button,
  DataTable,
  EntityDialog,
  RelativeTime,
  type BulkAction,
  type DataColumn,
  type EntityDialogRelatedPanel,
  type EntityFieldDef,
} from "@cloud-dog/ui";
import type { GroupRow, ManagedApiKeyRow, UserRow } from "../lib/types";
import { useImapMcpState } from "../state/AppState";

type UserDraft = Readonly<{
  userId: string;
  username: string;
  email: string;
  displayName: string;
  role: string;
  // IMAP-180: group memberships are editable from inside the User dialog
  // via a multi-select picker. On submit the diff is applied through
  // addGroupMember / removeGroupMember.
  groupIds: string[];
}>;

const defaultDraft: UserDraft = {
  userId: "",
  username: "",
  email: "",
  displayName: "",
  role: "viewer",
  groupIds: [],
};

function toDraft(user: UserRow, currentMemberships: string[] = []): UserDraft {
  return {
    userId: user.userId,
    username: user.username,
    email: user.email,
    displayName: user.displayName,
    role: user.roles[0] ?? "viewer",
    groupIds: [...currentMemberships],
  };
}

function isUserActive(row: UserRow): boolean {
  return (row as UserRow & { active?: boolean }).active !== false;
}

export function AdminUsersPage() {
  const { api } = useImapMcpState();
  const [users, setUsers] = React.useState<UserRow[]>([]);
  const [groups, setGroups] = React.useState<GroupRow[]>([]);
  const [apiKeys, setApiKeys] = React.useState<ManagedApiKeyRow[]>([]);
  const [groupMembers, setGroupMembers] = React.useState<Record<string, number>>({});
  const [draft, setDraft] = React.useState<UserDraft>(defaultDraft);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [mode, setMode] = React.useState<"add" | "edit">("add");
  const [status, setStatus] = React.useState("");
  const [error, setError] = React.useState("");
  const [page, setPage] = React.useState(1);

  const loadUsers = React.useCallback(async () => {
    const [usersResult, groupsResult, apiKeysResult] = await Promise.all([
      api.listUsers(),
      api.listGroups(),
      api.listApiKeys(),
    ]);
    if (!usersResult.ok || !usersResult.data) {
      setError(usersResult.errorMessage || "Failed to load users.");
      return;
    }
    if (!groupsResult.ok || !groupsResult.data) {
      setError(groupsResult.errorMessage || "Failed to load groups.");
      return;
    }

    const memberships = groupsResult.data.reduce<Record<string, number>>((counts, group) => {
      for (const memberId of group.members) {
        counts[memberId] = (counts[memberId] ?? 0) + 1;
      }
      return counts;
    }, {});

    setUsers(usersResult.data);
    setGroups(groupsResult.data);
    setApiKeys(apiKeysResult.ok && apiKeysResult.data ? apiKeysResult.data : []);
    setGroupMembers(memberships);
    setError("");
  }, [api]);

  React.useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const bulkActions = React.useMemo<BulkAction[]>(() => [{ label: "Delete Selected", action: "delete" }], []);

  const columns: DataColumn<UserRow>[] = React.useMemo(
    () => [
      { id: "username", header: "Username", cell: (row) => row.username, sortable: true, sortValue: (row) => row.username },
      { id: "displayName", header: "Display Name", cell: (row) => row.displayName || "N/A" },
      { id: "email", header: "Email", cell: (row) => row.email || "N/A" },
      {
        id: "roles",
        header: "Role",
        cell: (row) => <Badge variant="default">{row.roles[0] ?? "viewer"}</Badge>,
        sortable: true,
        sortValue: (row) => row.roles[0] ?? "viewer",
      },
      {
        id: "status",
        header: "Status",
        cell: (row) => (
          <Badge variant={isUserActive(row) ? "default" : "secondary"}>{isUserActive(row) ? "Active" : "Disabled"}</Badge>
        ),
        sortable: true,
        sortValue: (row) => (isUserActive(row) ? "a" : "z"),
      },
      {
        id: "groups",
        header: "Groups",
        cell: (row) => (
          <Link
            to={`/admin/groups?userId=${encodeURIComponent(row.userId)}`}
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            {groupMembers[row.userId] ?? 0} group(s)
          </Link>
        ),
        sortable: true,
        sortValue: (row) => groupMembers[row.userId] ?? 0,
      },
      {
        id: "created",
        header: "Created",
        cell: (row) => row.createdAt ? <RelativeTime timestamp={row.createdAt} /> : "N/A",
        sortable: true,
        sortValue: (row) => row.createdAt || "",
      },
      {
        id: "__actions",
        header: "Actions",
        cell: (row) => (
          <div className="flex flex-wrap gap-1">
            <Button variant="ghost" size="sm" onClick={() => {
              setMode("edit");
              const memberships = groups
                .filter((g) => g.members.includes(row.userId))
                .map((g) => g.groupId);
              setDraft(toDraft(row, memberships));
              setDialogOpen(true);
            }}
            >
              Edit
            </Button>
            <Link
              to={`/diagnostics-audit?actor_id=${encodeURIComponent(row.userId)}`}
              className="inline-flex h-8 items-center justify-center rounded-md px-3 text-sm font-medium hover:bg-accent"
              title={`View audit for ${row.userId}`}
            >
              Audit
            </Link>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (!window.confirm(`Delete user ${row.userId}?`)) return;
                void api.deleteUser(row.userId).then(async (result) => {
                  if (!result.ok) {
                    setError(result.errorMessage || `Failed to delete ${row.userId}.`);
                    return;
                  }
                  setStatus(`Deleted user ${row.userId}.`);
                  await loadUsers();
                });
              }}
            >
              Delete
            </Button>
          </div>
        ),
      },
    ],
    [api, groupMembers, loadUsers],
  );

  const onBulkAction = React.useCallback(
    (action: string, selectedIds: string[]) => {
      if (action !== "delete") return;
      const selected = users.filter((u) => selectedIds.includes(u.userId));
      if (!selected.length) return;
      if (!window.confirm(`Delete ${selected.length} selected user(s)?`)) return;
      void Promise.all(selected.map((u) => api.deleteUser(u.userId))).then(async (results) => {
        const failed = results.find((r) => !r.ok);
        if (failed) {
          setError(failed.errorMessage || "Bulk delete failed.");
          return;
        }
        setStatus(`Deleted ${selected.length} user(s).`);
        await loadUsers();
      });
    },
    [api, loadUsers, users],
  );

  const submit = async () => {
    if (mode === "add") {
      const result = await api.createUser({
        user_id: draft.userId.trim() || undefined,
        username: draft.username.trim(),
        email: draft.email.trim(),
        display_name: draft.displayName.trim(),
        role: draft.role.trim() || "viewer",
      });
      if (!result.ok) {
        setError(result.errorMessage || "Failed to create user.");
        return;
      }
      setStatus(`Created user ${result.data?.userId ?? draft.userId}.`);
    } else {
      const result = await api.updateUser(draft.userId, {
        username: draft.username.trim(),
        email: draft.email.trim(),
        display_name: draft.displayName.trim(),
        role: draft.role.trim() || "viewer",
      });
      if (!result.ok) {
        setError(result.errorMessage || "Failed to update user.");
        return;
      }
      // IMAP-180: apply group-membership diff via add/removeGroupMember.
      const previous = groups
        .filter((g) => g.members.includes(draft.userId))
        .map((g) => g.groupId);
      const next = draft.groupIds;
      const added = next.filter((g) => !previous.includes(g));
      const removed = previous.filter((g) => !next.includes(g));
      for (const groupId of added) {
        await api.addGroupMember(groupId, draft.userId);
      }
      for (const groupId of removed) {
        await api.removeGroupMember(groupId, draft.userId);
      }
      setStatus(`Updated user ${draft.userId}.`);
    }
    setDialogOpen(false);
    await loadUsers();
  };

  return (
    <div className="space-y-4">
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      {status ? <p role="status" className="text-sm text-foreground/80">{status}</p> : null}

      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Users</h1>
        <Button
          size="sm"
          onClick={() => {
            setMode("add");
            setDraft(defaultDraft);
            setDialogOpen(true);
          }}
        >
          Create User
        </Button>
      </header>

      <div className="rounded-md border bg-background">
        <DataTable
          tableId="imap-mcp-admin-users"
          columns={columns}
          rows={users}
          emptyMessage="No users found."
          getRowId={(row) => row.userId}
          page={page}
          onPageChange={setPage}
          pageSize={25}
          selectable
          bulkActions={bulkActions}
          onBulkAction={onBulkAction}
          columnPickerEnabled
        />
      </div>

      <EntityDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={mode === "add" ? "Create User" : `Edit User: ${draft.userId}`}
        fields={[
          { name: "userId", label: "User ID", type: "text", required: true, readOnly: mode === "edit" },
          { name: "username", label: "Username", type: "text", required: true },
          { name: "email", label: "Email", type: "text" },
          { name: "displayName", label: "Display Name", type: "text" },
          { name: "role", label: "Role", type: "select", required: true, options: ["viewer", "writer", "admin"] },
          // IMAP-180: in-dialog group memberships editor (visible only on edit).
          ...(mode === "edit"
            ? ([
                {
                  name: "groupIds",
                  label: "Group memberships",
                  type: "multiselect",
                  options: groups.map((g) => g.groupId),
                },
              ] satisfies EntityFieldDef[])
            : []),
        ]}
        values={draft as Record<string, unknown>}
        onChange={(name, value) => setDraft((current) => ({ ...current, [name]: value } as UserDraft))}
        onSubmit={() => void submit()}
        onCancel={() => setDialogOpen(false)}
        mode={mode}
        relatedPanels={
          mode === "edit"
            ? ([
                {
                  title: "Group memberships",
                  emptyMessage: "Not a member of any groups.",
                  items: groups
                    .filter((g) => g.members.includes(draft.userId))
                    .map((g) => ({
                      id: g.groupId,
                      label: `${g.name} (${g.roles.join(", ") || "no roles"})`,
                      href: `/admin/groups?groupId=${encodeURIComponent(g.groupId)}`,
                    })),
                },
                {
                  title: "API keys",
                  emptyMessage: "No API keys issued to this user.",
                  items: apiKeys
                    .filter((k) => k.ownerUserId === draft.userId)
                    .map((k) => ({
                      id: k.apiKeyId,
                      label: `${k.description || k.apiKeyId} — ${k.status} [${k.scopes.join(",") || "no scopes"}]`,
                      href: `/admin/api-keys?apiKeyId=${encodeURIComponent(k.apiKeyId)}`,
                    })),
                },
              ] satisfies EntityDialogRelatedPanel[])
            : undefined
        }
      />
    </div>
  );
}
