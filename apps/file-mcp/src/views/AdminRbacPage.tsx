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

// @cloud-dog/app-file-mcp — Admin RBAC page.

import * as React from "react";
import { Badge, Button, DataTable, Input, Select } from "@cloud-dog/ui";
import type { DataColumn } from "@cloud-dog/ui";
import { useFileMcpState } from "../state/AppState";

type RbacUser = Readonly<{
  id: string;
  name: string;
}>;

type RbacBinding = Readonly<{
  id: string;
  userId: string;
  groupId?: string;
  role: string;
  resource?: string;
}>;

export function AdminRbacPageView() {
  const { api } = useFileMcpState();
  const [users, setUsers] = React.useState<RbacUser[]>([]);
  const [bindings, setBindings] = React.useState<RbacBinding[]>([]);
  const [userId, setUserId] = React.useState("");
  const [role, setRole] = React.useState("");
  const [resource, setResource] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pendingDeleteBinding, setPendingDeleteBinding] = React.useState<RbacBinding | null>(null);

  const load = React.useCallback(async () => {
    setError(null);
    try {
      const [userRows, groupRows] = await Promise.all([
        api.listAdminUsers(),
        api.listAdminGroups(),
      ]);
      setUsers(
        userRows.map((user) => ({
          id: user.id,
          name: user.username,
        }))
      );
      const nextBindings: RbacBinding[] = [];
      for (const group of groupRows) {
        for (const member of group.members) {
          for (const role of group.roles) {
            nextBindings.push({
              id: `${group.id}:${member}:${role}`,
              userId: member,
              groupId: group.name,
              role,
              resource: "*",
            });
          }
        }
      }
      setBindings(nextBindings);
      setStatus("RBAC data refreshed.");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load RBAC data.");
    }
  }, [api]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const roles = ["admin", "operator", "reader", "profile:default"];

  const columns = React.useMemo<DataColumn<RbacBinding>[]>(
    () => [
      { id: "user", header: "User", cell: (binding) => binding.userId },
      { id: "group", header: "Group", cell: (binding) => binding.groupId ?? "-" },
      { id: "role", header: "Role", cell: (binding) => <Badge variant="default">{binding.role}</Badge> },
      { id: "resource", header: "Resource", cell: (binding) => binding.resource ?? "*" },
      {
        id: "actions",
        header: "Actions",
        cell: (binding) => (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => setPendingDeleteBinding(binding)}
          >
            Delete
          </Button>
        ),
      },
    ],
    []
  );

  const bindRole = async () => {
    setStatus("");
    setError(null);
    const targetRole = role.trim();
    const targetUser = userId.trim();
    const targetGroup = resource.trim();

    if (!targetUser || !targetRole) {
      setError("Select a user and role before creating a binding.");
      return;
    }

    try {
      const userName = users.find((u) => u.id === targetUser)?.name ?? targetUser;
      if (targetGroup) {
        const allGroups = await api.listAdminGroups();
        const group = allGroups.find((g: Record<string, unknown>) => g.name === targetGroup || g.id === targetGroup);
        if (group) {
          const roles = Array.isArray(group.roles) ? [...group.roles] : [];
          if (!roles.includes(targetRole)) {
            roles.push(targetRole);
          }
          await api.updateAdminGroup(String(group.id), {
            description: String(group.description ?? ""),
            roles,
            is_active: group.is_active !== false,
          });
        }
        // Add user to group via user update (membership is on the user side)
        const allUsersList = await api.listAdminUsers();
        const user = allUsersList.find((u) => u.username === userName || u.id === targetUser);
        if (user) {
          const userGroups = Array.isArray(user.groups) ? [...user.groups] : [];
          if (!userGroups.includes(targetGroup)) {
            userGroups.push(targetGroup);
          }
          await api.updateAdminUser(user.id, { groups: userGroups });
        }
      }
      setBindings((prev) => [
        ...prev,
        {
          id: `${targetUser}:${targetGroup}:${targetRole}`,
          userId: userName,
          groupId: targetGroup || "-",
          role: targetRole,
          resource: "*",
        },
      ]);
      setStatus("Binding created.");
      setUserId("");
      setRole("");
      setResource("");
      await load();
    } catch (bindError) {
      setError(bindError instanceof Error ? bindError.message : "Failed to create binding.");
    }
  };

  return (
    <div className="space-y-6">
      {pendingDeleteBinding ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" role="dialog" aria-label="Confirm delete">
          <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-lg space-y-4">
            <h2 className="text-lg font-semibold">Remove binding?</h2>
            <p className="text-sm text-muted-foreground">Remove role <strong>{pendingDeleteBinding.role}</strong> from group <strong>{pendingDeleteBinding.groupId}</strong>?</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setPendingDeleteBinding(null)}>Cancel</Button>
              <Button variant="destructive" onClick={() => {
                try {
                  const baseUrl = window.location.origin;
                  const usersResp = new XMLHttpRequest();
                  usersResp.open("GET", `${baseUrl}/admin/users`, false);
                  usersResp.withCredentials = true;
                  usersResp.send();
                  const allUsers = JSON.parse(usersResp.responseText).users ?? [];
                  const user = allUsers.find((u: Record<string, unknown>) => u.username === pendingDeleteBinding.userId || u.id === pendingDeleteBinding.userId);
                  if (user && pendingDeleteBinding.groupId) {
                    const updatedGroups = ((user.groups ?? []) as string[]).filter((g: string) => g !== pendingDeleteBinding.groupId);
                    const req = new XMLHttpRequest();
                    req.open("PUT", `${baseUrl}/admin/users/${user.id}`, false);
                    req.withCredentials = true;
                    req.setRequestHeader("Content-Type", "application/json");
                    req.send(JSON.stringify({ groups: updatedGroups }));
                  }
                  void load();
                } catch {
                  setError("Failed to remove binding.");
                }
                setPendingDeleteBinding(null);
              }}>Delete</Button>
            </div>
          </div>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {status ? (
        <p role="status" className="text-sm text-foreground/80">
          {status}
        </p>
      ) : null}
      <header>
        <h1 className="text-2xl font-semibold">RBAC</h1>
      </header>

      <section className="rounded-md border bg-background p-4" aria-labelledby="rbac-add-binding-heading">
        <div className="mb-3 flex items-center gap-2">
          <h2 id="rbac-add-binding-heading" className="text-sm font-medium">
            Add Binding
          </h2>
          <Button variant="outline" size="sm" onClick={() => { /* focus the form fields */ }}>
            Add Role
          </Button>
        </div>
        <div className="grid gap-3 md:grid-cols-[minmax(10rem,1fr)_minmax(10rem,1fr)_minmax(10rem,1fr)_auto] md:items-end">
          <div className="space-y-1">
            <label htmlFor="rbac-user" className="text-sm font-medium">
              User
            </label>
            <Select
              id="rbac-user"
              value={userId}
              onChange={(event) => setUserId(event.target.value)}
              aria-label="User"
            >
              <option value="">Select user</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1">
            <label htmlFor="rbac-role" className="text-sm font-medium">
              Role
            </label>
            <Select
              id="rbac-role"
              value={role}
              onChange={(event) => setRole(event.target.value)}
              aria-label="Role"
            >
              <option value="">Select role</option>
              {roles.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1">
            <label htmlFor="rbac-resource" className="text-sm font-medium">
              Group
            </label>
            <Input
              id="rbac-resource"
              name="group"
              value={resource}
              onChange={(event) => setResource(event.target.value)}
              placeholder="*"
              aria-label="Group"
            />
          </div>
          <Button type="submit" onClick={bindRole}>
            Save
          </Button>
        </div>
      </section>

      <section className="rounded-md border bg-background p-4" aria-labelledby="rbac-bindings-heading">
        <h2 id="rbac-bindings-heading" className="mb-3 text-lg font-semibold">
          Role Bindings
        </h2>
        <DataTable
          columns={columns}
          rows={bindings}
          emptyMessage="No role bindings."
          getRowId={(binding) => binding.id}
        />
      </section>
    </div>
  );
}
