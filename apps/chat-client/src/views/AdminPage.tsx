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

// @cloud-dog/app-chat-client — RBAC administration page.

import * as React from "react";
import { Badge, Button, Card, CardContent, CardHeader, DataTable, EntityForm, RelatedItemsPanel } from "@cloud-dog/ui";
import type { DataColumn } from "@cloud-dog/ui";
import type { EntityFieldDef } from "@cloud-dog/ui";
import { useNavigate } from "react-router-dom";
import { useAppState } from "../state/AppState";

const rbacFields: EntityFieldDef[] = [
  { name: "target_type", label: "Principal type", type: "select", required: true, options: ["group", "user"] },
  { name: "target_id", label: "Group", type: "text", required: true },
  { name: "role", label: "Role", type: "select", required: true, options: ["admin", "user"] },
  { name: "mode", label: "Change", type: "select", required: true, options: ["assign", "remove"] },
];

type RoleBindingRow = {
  id: string;
  target_type: "user" | "group";
  target_id: string;
  principal: string;
  role: string;
  members: string;
};

export function AdminPage() {
  const navigate = useNavigate();
  const { api } = useAppState();
  const [summary, setSummary] = React.useState({ users: 0, groups: 0, apiKeys: 0 });
  const [users, setUsers] = React.useState<Array<{ user_id: string; display_name: string; role: string; group_ids: string[] }>>([]);
  const [groups, setGroups] = React.useState<Array<{ group_id: string; name: string; roles: string[]; member_user_ids: string[] }>>([]);
  const [form, setForm] = React.useState<Record<string, unknown>>({ target_type: "group", target_id: "", role: "admin", mode: "assign" });
  const [status, setStatus] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    setError(null);
    const [listedUsers, listedGroups, apiKeys] = await Promise.all([
      api.listUsers(),
      api.listGroups(),
      api.listApiKeys(),
    ]);
    setUsers(listedUsers);
    setGroups(listedGroups);
    setSummary({ users: listedUsers.length, groups: listedGroups.length, apiKeys: apiKeys.length });
  }, [api]);

  React.useEffect(() => {
    void refresh().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : "Failed to load RBAC summary");
    });
  }, [refresh]);

  const save = async () => {
    const targetType = String(form.target_type ?? "user");
    const targetId = String(form.target_id ?? "").trim();
    const role = String(form.role ?? "user");
    const mode = String(form.mode ?? "assign");
    if (!targetId) {
      setError("Target ID is required");
      return;
    }
    setError(null);
    setStatus(null);
    try {
      if (targetType === "user") {
        const user = users.find((item) => item.user_id === targetId);
        if (!user) throw new Error(`Unknown user ${targetId}`);
        await api.updateUser(targetId, {
          user_id: user.user_id,
          display_name: user.display_name,
          email: (user as { email?: string }).email ?? "",
          role: mode === "assign" ? role : "user",
          status: (user as { status?: string }).status ?? "active",
          group_ids: user.group_ids,
        });
      } else {
        const group = groups.find((item) => item.group_id === targetId);
        if (!group) throw new Error(`Unknown group ${targetId}`);
        const roles = mode === "assign"
          ? Array.from(new Set([...(group.roles ?? []), role]))
          : (group.roles ?? []).filter((value) => value !== role);
        await api.updateGroup(targetId, {
          group_id: group.group_id,
          name: group.name,
          description: (group as { description?: string }).description ?? "",
          roles,
          member_user_ids: group.member_user_ids,
        });
      }
      setStatus(`${mode === "assign" ? "Assigned" : "Removed"} ${role} on ${targetType} ${targetId}`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to apply RBAC change");
    }
  };

  const resetAssignmentForm = () => {
    setForm({ target_type: "group", target_id: "", role: "admin", mode: "assign" });
    setStatus(null);
    setError(null);
  };

  const roleBindings = React.useMemo<RoleBindingRow[]>(() => {
    const userRows = users
      .filter((user) => user.role)
      .map((user) => ({
        id: `user:${user.user_id}:${user.role}`,
        target_type: "user" as const,
        target_id: user.user_id,
        principal: user.display_name ? `${user.display_name} (${user.user_id})` : user.user_id,
        role: user.role,
        members: user.group_ids.join(", ") || "none",
      }));
    const groupRows = groups.flatMap((group) =>
      (group.roles ?? []).map((role) => ({
        id: `group:${group.group_id}:${role}`,
        target_type: "group" as const,
        target_id: group.group_id,
        principal: `${group.name} (${group.group_id})`,
        role,
        members: group.member_user_ids.join(", ") || "none",
      }))
    );
    return [...userRows, ...groupRows].sort((a, b) => a.principal.localeCompare(b.principal));
  }, [groups, users]);

  const removeBinding = async (binding: RoleBindingRow) => {
    setStatus(null);
    setError(null);
    try {
      if (binding.target_type === "user") {
        const user = users.find((item) => item.user_id === binding.target_id);
        if (!user) throw new Error(`Unknown user ${binding.target_id}`);
        await api.updateUser(binding.target_id, {
          user_id: user.user_id,
          display_name: user.display_name,
          email: (user as { email?: string }).email ?? "",
          role: "user",
          status: (user as { status?: string }).status ?? "active",
          group_ids: user.group_ids,
        });
      } else {
        const group = groups.find((item) => item.group_id === binding.target_id);
        if (!group) throw new Error(`Unknown group ${binding.target_id}`);
        await api.updateGroup(binding.target_id, {
          group_id: group.group_id,
          name: group.name,
          description: (group as { description?: string }).description ?? "",
          roles: (group.roles ?? []).filter((value) => value !== binding.role),
          member_user_ids: group.member_user_ids,
        });
      }
      setStatus(`Removed ${binding.role} from ${binding.target_type} ${binding.target_id}`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove RBAC binding");
    }
  };

  const selectedTarget = String(form.target_id ?? "").trim();
  const relatedUsers = groups
    .filter((group) => group.group_id === selectedTarget)
    .flatMap((group) => group.member_user_ids.map((userId) => ({ id: userId, label: userId })));
  const relatedGroups = users
    .filter((user) => user.user_id === selectedTarget)
    .flatMap((user) => user.group_ids.map((groupId) => ({ id: groupId, label: groupId })));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <h1 className="text-xl font-semibold">RBAC administration</h1>
          <p className="text-sm text-muted-foreground">Manage user access, group membership, and issued API keys from one admin surface.</p>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <Card><CardContent className="pt-6"><p className="text-xs uppercase text-muted-foreground">Users</p><p className="text-2xl font-semibold">{summary.users}</p></CardContent></Card>
          <Card><CardContent className="pt-6"><p className="text-xs uppercase text-muted-foreground">Groups</p><p className="text-2xl font-semibold">{summary.groups}</p></CardContent></Card>
          <Card><CardContent className="pt-6"><p className="text-xs uppercase text-muted-foreground">API Keys</p><p className="text-2xl font-semibold">{summary.apiKeys}</p></CardContent></Card>
          <div className="md:col-span-3 flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => navigate("/admin/users")}>Open Users</Button>
            <Button variant="secondary" onClick={() => navigate("/admin/groups")}>Open Groups</Button>
            <Button variant="secondary" onClick={() => navigate("/admin/api-keys")}>Open API Keys</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Role Definitions (IW5)</h2>
        </CardHeader>
        <CardContent>
          <DataTable
            tableId="role-defs"
            rows={[
              { name: "admin", description: "Full access — system config, user management, all CRUD", permissions: "*" },
              { name: "user", description: "Access to conversations, sessions, and MCP invocation", permissions: "session.read, session.write, mcp.invoke" },
            ]}
            getRowId={(r: { name: string }) => r.name}
            columns={[
              { id: "role", header: "Role", sortable: true, sortValue: (r: { name: string }) => r.name, cell: (r: { name: string }) => <Badge variant={r.name === "admin" ? "destructive" : "default"}>{r.name}</Badge> },
              { id: "description", header: "Description", cell: (r: { description: string }) => r.description },
              { id: "permissions", header: "Permissions", cell: (r: { permissions: string }) => <span className="font-mono text-xs">{r.permissions}</span> },
            ] as DataColumn<{ name: string; description: string; permissions: string }>[]}
          />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Role assignment</h2>
            <p className="text-sm text-muted-foreground">Shared entity form for user/group RBAC changes.</p>
          </CardHeader>
          <CardContent>
            <div className="mb-3 flex justify-end">
              <Button variant="secondary" onClick={resetAssignmentForm}>Assign role</Button>
            </div>
            <EntityForm
              fields={rbacFields}
              values={form}
              mode="edit"
              submitLabel="Submit"
              onChange={(name, value) => setForm((current) => ({ ...current, [name]: value }))}
              onSubmit={() => void save()}
              onCancel={() => setForm({ target_type: "user", target_id: "", role: "admin", mode: "assign" })}
            />
            {status ? <p className="mt-3 text-sm text-emerald-700">{status}</p> : null}
            {error ? <p role="alert" className="mt-3 text-sm text-destructive">{error}</p> : null}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <RelatedItemsPanel
            title="User group membership"
            items={relatedGroups}
            emptyMessage="Select a user target to inspect group bindings."
          />
          <RelatedItemsPanel
            title="Group members"
            items={relatedUsers}
            emptyMessage="Select a group target to inspect membership."
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Role bindings</h2>
          <p className="text-sm text-muted-foreground">Current persisted user and group role assignments.</p>
        </CardHeader>
        <CardContent>
          <DataTable
            tableId="chat-client-rbac-bindings"
            rows={roleBindings}
            getRowId={(row) => row.id}
            columns={[
              { id: "principal", header: "Principal", sortable: true, sortValue: (row: RoleBindingRow) => row.principal, cell: (row: RoleBindingRow) => row.principal },
              { id: "type", header: "Type", sortable: true, sortValue: (row: RoleBindingRow) => row.target_type, cell: (row: RoleBindingRow) => row.target_type },
              { id: "role", header: "Role", sortable: true, sortValue: (row: RoleBindingRow) => row.role, cell: (row: RoleBindingRow) => <Badge variant={row.role === "admin" ? "destructive" : "secondary"}>{row.role}</Badge> },
              { id: "members", header: "Members", cell: (row: RoleBindingRow) => row.members },
              {
                id: "actions",
                header: "Actions",
                cell: (row: RoleBindingRow) => (
                  <Button variant="ghost" onClick={() => void removeBinding(row)}>Remove</Button>
                ),
              },
            ] as DataColumn<RoleBindingRow>[]}
            emptyMessage="No role bindings configured."
            pageSize={10}
            columnPickerEnabled={false}
          />
        </CardContent>
      </Card>
    </div>
  );
}
