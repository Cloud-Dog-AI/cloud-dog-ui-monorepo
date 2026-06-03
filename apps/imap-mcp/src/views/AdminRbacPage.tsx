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

// @cloud-dog/app-imap-mcp — Split admin RBAC page.

import * as React from "react";
import { Link } from "react-router-dom";
import {
  AdminRbacPage as SharedAdminRbacPage,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  DataTable,
  EntityDialog,
  Input,
  StructuredView,
  type DataColumn,
  type EntityFieldDef,
  type RbacBinding,
  type RbacUser,
} from "@cloud-dog/ui";
import type { GroupRow, JsonRecord, UserRow } from "../lib/types";
import { useImapMcpState } from "../state/AppState";

function asRoles(value: JsonRecord | null): Record<string, string[]> {
  const roles = value?.roles;
  if (!roles || typeof roles !== "object" || Array.isArray(roles)) return {};
  return Object.fromEntries(
    Object.entries(roles as Record<string, unknown>).map(([name, permissions]) => [
      name,
      Array.isArray(permissions)
        ? permissions.map((permission) => String(permission)).filter(Boolean)
        : [],
    ])
  );
}

/** PS-71 IW5 — role definitions table rows. */
type RoleDefinitionRow = Readonly<{
  id: string;
  role: string;
  description: string;
  permissions: string[];
}>;

type GroupRoleBindingRow = Readonly<{
  id: string;
  groupId: string;
  groupName: string;
  role: string;
  members: string[];
}>;

type GroupRoleDraft = Readonly<{
  group: string;
  role: string;
}>;

const defaultGroupRoleDraft: GroupRoleDraft = {
  group: "",
  role: "admin",
};

const ROLE_DESCRIPTIONS: Record<string, string> = {
  admin: "Full administration of IMAP profiles, users, groups, and API keys.",
  user: "Standard access to configured mail profiles and MCP tools.",
  viewer: "Read-only access within assigned scopes.",
  writer: "Create and update resources where permitted.",
};

function roleBadgeVariant(role: string): "default" | "secondary" | "destructive" {
  const key = role.toLowerCase();
  if (key === "admin") return "destructive";
  if (key === "viewer") return "secondary";
  return "default";
}

const roleDefinitionColumns: DataColumn<RoleDefinitionRow>[] = [
  {
    id: "role",
    header: "Role",
    sortable: true,
    sortValue: (row) => row.role,
    cell: (row) => <Badge variant={roleBadgeVariant(row.role)}>{row.role}</Badge>,
  },
  {
    id: "description",
    header: "Description",
    sortable: true,
    sortValue: (row) => row.description,
    cell: (row) => row.description,
  },
  {
    id: "permissions",
    header: "Permissions",
    cell: (row) => (
      <div className="flex flex-wrap gap-1">
        {row.permissions.length ? (
          row.permissions.map((permission) => (
            <Badge key={permission} variant="secondary">
              {permission}
            </Badge>
          ))
        ) : (
          <span className="text-sm text-muted-foreground">None</span>
        )}
      </div>
    ),
  },
];

export function AdminRbacPage() {
  const { api } = useImapMcpState();
  const [users, setUsers] = React.useState<UserRow[]>([]);
  const [groups, setGroups] = React.useState<GroupRow[]>([]);
  const [policyPayload, setPolicyPayload] = React.useState<JsonRecord | null>(null);
  const [policyRole, setPolicyRole] = React.useState("");
  const [policyPermissions, setPolicyPermissions] = React.useState("");
  const [groupRoleDraft, setGroupRoleDraft] = React.useState<GroupRoleDraft>(defaultGroupRoleDraft);
  const [groupRoleDialogOpen, setGroupRoleDialogOpen] = React.useState(false);
  const [status, setStatus] = React.useState("");
  const [error, setError] = React.useState("");

  const load = React.useCallback(async () => {
    const [usersResult, groupsResult, policyResult] = await Promise.all([
      api.listUsers(),
      api.listGroups(),
      api.getRbacPolicies(),
    ]);
    if (!usersResult.ok || !usersResult.data) {
      setError(usersResult.errorMessage || "Failed to load users.");
      return;
    }
    if (!groupsResult.ok || !groupsResult.data) {
      setError(groupsResult.errorMessage || "Failed to load groups.");
      return;
    }
    if (!policyResult.ok || !policyResult.data) {
      setError(policyResult.errorMessage || "Failed to load RBAC policies.");
      return;
    }
    setUsers(usersResult.data);
    setGroups(groupsResult.data);
    setPolicyPayload(policyResult.data);
    setError("");
  }, [api]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const roleMap = asRoles(policyPayload);

  const roleDefinitionRows = React.useMemo<RoleDefinitionRow[]>(() => {
    return Object.entries(roleMap)
      .map(([name, permissions]) => ({
        id: name,
        role: name,
        description: ROLE_DESCRIPTIONS[name.toLowerCase()] ?? `Role "${name}" (custom policy).`,
        permissions,
      }))
      .sort((a, b) => a.role.localeCompare(b.role));
  }, [roleMap]);

  const bindings: RbacBinding[] = users.flatMap((user) =>
    user.roles.map((role) => ({
      id: `${user.userId}:${role}`,
      userId: user.userId,
      role,
      resource: "*",
    }))
  );
  const rbacUsers: RbacUser[] = users.map((user) => ({ id: user.userId, name: user.displayName || user.username || user.userId }));
  const availableRoles = Object.keys(roleMap).sort();
  const roleOptions = availableRoles.length ? availableRoles : ["admin", "user", "viewer", "writer"];

  const groupRoleFields = React.useMemo<EntityFieldDef[]>(
    () => [
      { name: "group", label: "Group", type: "text", required: true, placeholder: "Group ID or name" },
      { name: "role", label: "Role", type: "select", required: true, options: roleOptions },
    ],
    [roleOptions]
  );

  const groupRoleRows = React.useMemo<GroupRoleBindingRow[]>(() => {
    return groups.flatMap((group) =>
      group.roles.map((role) => ({
        id: `${group.groupId}:${role}`,
        groupId: group.groupId,
        groupName: group.name || group.groupId,
        role,
        members: group.members,
      }))
    );
  }, [groups]);

  const resolveGroup = (value: string) => {
    const needle = value.trim().toLowerCase();
    return groups.find(
      (group) =>
        group.groupId.toLowerCase() === needle ||
        group.name.toLowerCase() === needle
    );
  };

  const updateGroupRoles = async (group: GroupRow, nextRoles: string[], message: string) => {
    const result = await api.updateGroup(group.groupId, {
      name: group.name,
      description: group.description,
      roles: nextRoles,
    });
    if (!result.ok) {
      setError(result.errorMessage || `Failed to update ${group.name || group.groupId}.`);
      return false;
    }
    setStatus(message);
    setError("");
    await load();
    return true;
  };

  const savePolicies = async (nextRoles: Record<string, string[]>) => {
    const result = await api.putRbacPolicies({ roles: nextRoles });
    if (!result.ok) {
      setError(result.errorMessage || "Failed to save RBAC policies.");
      return false;
    }
    setPolicyPayload(result.data ?? { roles: nextRoles });
    setStatus("Saved RBAC policies.");
    setError("");
    return true;
  };

  const bindRoleToGroup = async () => {
    const group = resolveGroup(groupRoleDraft.group);
    const role = groupRoleDraft.role.trim();
    if (!group || !role) {
      setError("Group and role are required.");
      return;
    }
    const nextRoles = Array.from(new Set([...group.roles, role])).sort();
    const updated = await updateGroupRoles(group, nextRoles, `Assigned ${role} to ${group.name || group.groupId}.`);
    if (updated) {
      setGroupRoleDialogOpen(false);
      setGroupRoleDraft(defaultGroupRoleDraft);
    }
  };

  const unbindRoleFromGroup = async (binding: GroupRoleBindingRow) => {
    const group = groups.find((item) => item.groupId === binding.groupId);
    if (!group) return;
    const nextRoles = group.roles.filter((role) => role !== binding.role);
    await updateGroupRoles(group, nextRoles, `Removed ${binding.role} from ${group.name || group.groupId}.`);
  };

  const groupRoleColumns = React.useMemo<DataColumn<GroupRoleBindingRow>[]>(
    () => [
      {
        id: "group",
        header: "Group",
        sortable: true,
        sortValue: (row) => row.groupName,
        cell: (row) => (
          <div>
            <div className="font-medium">{row.groupName}</div>
            <div className="text-xs text-muted-foreground">{row.groupId}</div>
          </div>
        ),
      },
      {
        id: "role",
        header: "Role",
        sortable: true,
        sortValue: (row) => row.role,
        cell: (row) => <Badge variant={roleBadgeVariant(row.role)}>{row.role}</Badge>,
      },
      {
        id: "members",
        header: "Members",
        cell: (row) => {
          if (row.members.length === 0) return <span className="text-xs text-muted-foreground">none</span>;
          const labelFor = (userId: string) => {
            const u = users.find((row2) => row2.userId === userId);
            return u ? (u.displayName || u.username || userId) : userId;
          };
          return (
            <div className="flex flex-wrap gap-1">
              {row.members.slice(0, 4).map((memberId) => (
                <Link
                  key={memberId}
                  to={`/admin/users?userId=${encodeURIComponent(memberId)}`}
                  className="text-xs text-primary underline-offset-4 hover:underline"
                  title={memberId}
                >
                  {labelFor(memberId)}
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
      {
        id: "actions",
        header: "Actions",
        cell: (row) => (
          <Button variant="destructive" onClick={() => void unbindRoleFromGroup(row)}>
            Delete
          </Button>
        ),
      },
    ],
    [groups, users]
  );

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">RBAC</h1>
        <p className="text-sm text-muted-foreground">
          Role-based access control. Section 1 lists role policies (permission strings per role).
          Section 2 lists group ↔ role bindings (which groups grant which roles).
          Section 3 lets you create new bindings or new role policies.
        </p>
      </header>

      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      {status ? <p role="status" className="text-sm text-foreground/80">{status}</p> : null}

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">1. Role policies</h2>
        <p className="text-sm text-muted-foreground">Roles defined in the RBAC policy and the permission strings each carries.</p>
      </section>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Role definitions</h2>
          <p className="text-sm text-muted-foreground">
            Effective permission strings per role from the RBAC policy (PS-71 IW5).
          </p>
        </CardHeader>
        <CardContent>
          <DataTable
            tableId="imap-mcp-role-definitions"
            columns={roleDefinitionColumns}
            rows={roleDefinitionRows}
            emptyMessage="No role policies loaded. Add a role below or load from the API."
            getRowId={(row) => row.id}
            columnPickerEnabled
          />
        </CardContent>
      </Card>

      <section className="space-y-2 pt-2">
        <h2 className="text-xl font-semibold">2. Group → role bindings</h2>
        <p className="text-sm text-muted-foreground">Which groups grant which roles to their members.</p>
      </section>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Group Role Bindings</h2>
              <p className="text-sm text-muted-foreground">
                Seeded and managed group-to-role assignments.
              </p>
            </div>
            <Button
              onClick={() => {
                setGroupRoleDraft(defaultGroupRoleDraft);
                setGroupRoleDialogOpen(true);
              }}
            >
              Bind Role to Group
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable
            tableId="imap-mcp-group-role-bindings"
            columns={groupRoleColumns}
            rows={groupRoleRows}
            emptyMessage="No group role bindings found."
            getRowId={(row) => row.id}
            columnPickerEnabled
            selectable
            bulkActions={[{ label: "Delete selected bindings", action: "delete" }]}
            onBulkAction={(action, selectedIds) => {
              if (action !== "delete") return;
              const selected = groupRoleRows.filter((r) => selectedIds.includes(r.id));
              if (!selected.length) return;
              if (!window.confirm(`Unbind ${selected.length} role(s) from their group(s)?`)) return;
              void (async () => {
                for (const binding of selected) {
                  await unbindRoleFromGroup(binding);
                }
              })();
            }}
          />
        </CardContent>
      </Card>

      <SharedAdminRbacPage
        title="Role Assignments"
        bindings={bindings}
        users={rbacUsers}
        roles={availableRoles}
        renderUserCell={(userId) => (
          <Link
            to={`/admin/users?userId=${encodeURIComponent(userId)}`}
            className="text-primary underline-offset-4 hover:underline"
            title={userId}
          >
            {(() => {
              const u = users.find((row) => row.userId === userId);
              return u ? (u.displayName || u.username || userId) : userId;
            })()}
          </Link>
        )}
        renderGroupCell={(groupId) => {
          if (!groupId) return <span className="text-xs text-muted-foreground">-</span>;
          const group = groups.find((g) => g.groupId === groupId);
          return (
            <Link
              to={`/admin/groups?groupId=${encodeURIComponent(groupId)}`}
              className="text-primary underline-offset-4 hover:underline"
              title={groupId}
            >
              {group ? (group.name || groupId) : groupId}
            </Link>
          );
        }}
        renderResourceCell={(resource) => {
          if (!resource) return <span className="text-xs text-muted-foreground">*</span>;
          return (
            <Link
              to={`/diagnostics-audit?target_id=${encodeURIComponent(resource)}`}
              className="text-primary underline-offset-4 hover:underline"
              title={resource}
            >
              {resource}
            </Link>
          );
        }}
        onBind={(userId, role) => {
          const user = users.find((item) => item.userId === userId);
          if (!user) return;
          void api.updateUser(user.userId, {
            username: user.username,
            email: user.email,
            display_name: user.displayName,
            role,
          }).then(async (result) => {
            if (!result.ok) {
              setError(result.errorMessage || `Failed to bind ${userId} to ${role}.`);
              return;
            }
            setStatus(`Assigned ${role} to ${userId}.`);
            await load();
          });
        }}
        onUnbind={(bindingId) => {
          const [userId] = bindingId.split(":");
          const user = users.find((item) => item.userId === userId);
          if (!user) return;
          void api.updateUser(user.userId, {
            username: user.username,
            email: user.email,
            display_name: user.displayName,
            role: "viewer",
          }).then(async (result) => {
            if (!result.ok) {
              setError(result.errorMessage || `Failed to unbind ${userId}.`);
              return;
            }
            setStatus(`Reset ${userId} to viewer.`);
            await load();
          });
        }}
      />

      <section className="space-y-2 pt-2">
        <h2 className="text-xl font-semibold">3. Edit / add a role policy</h2>
        <p className="text-sm text-muted-foreground">Add a new role to the RBAC policy or delete an existing one.</p>
      </section>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Role Policies (editor)</h2>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label htmlFor="rbac-role-name" className="text-sm font-medium">Role</label>
              <Input id="rbac-role-name" value={policyRole} onChange={(event) => setPolicyRole(event.target.value)} />
            </div>
            <div>
              <label htmlFor="rbac-role-permissions" className="text-sm font-medium">Permissions CSV</label>
              <Input
                id="rbac-role-permissions"
                value={policyPermissions}
                onChange={(event) => setPolicyPermissions(event.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={() => {
                const role = policyRole.trim();
                if (!role) {
                  setError("Role name is required.");
                  return;
                }
                const nextRoles = {
                  ...roleMap,
                  [role]: policyPermissions.split(",").map((item) => item.trim()).filter(Boolean),
                };
                void savePolicies(nextRoles);
              }}
            >
              Save Role Policy
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                const permissions = roleMap[policyRole.trim()];
                setPolicyPermissions((permissions ?? []).join(", "));
              }}
            >
              Load Role
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                const role = policyRole.trim();
                if (!role || !(role in roleMap)) {
                  setError("Select an existing role to delete.");
                  return;
                }
                const nextRoles = { ...roleMap };
                delete nextRoles[role];
                void savePolicies(nextRoles);
              }}
            >
              Delete Role
            </Button>
          </div>
        </CardContent>
      </Card>

      {policyPayload ? (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Role policy map</h2>
            <p className="text-sm text-muted-foreground">Permissions granted to each role.</p>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={[
                {
                  id: "role",
                  header: "Role",
                  cell: (row) => <span className="font-mono text-sm">{row.role}</span>,
                  sortable: true,
                  sortValue: (row) => row.role,
                },
                {
                  id: "permissions",
                  header: "Permissions",
                  cell: (row) =>
                    row.permissions.length === 0 ? (
                      <span className="text-xs text-muted-foreground">none</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {row.permissions.map((p) => (
                          <span key={p} className="font-mono text-xs rounded-md border bg-muted/40 px-1.5 py-0.5">{p}</span>
                        ))}
                      </div>
                    ),
                  sortable: true,
                  sortValue: (row) => row.permissions.join(","),
                },
                {
                  id: "count",
                  header: "#",
                  cell: (row) => String(row.permissions.length),
                  sortable: true,
                  sortValue: (row) => row.permissions.length,
                },
              ]}
              rows={Object.entries((policyPayload?.roles as Record<string, unknown> | undefined) ?? {}).map(
                ([role, permissions]) => ({
                  role,
                  permissions: Array.isArray(permissions) ? permissions.map(String) : [],
                }),
              )}
              getRowId={(row) => row.role}
              emptyMessage="No roles defined."
              tableId="imap-rbac-policy-map"
            />
          </CardContent>
        </Card>
      ) : null}

      <EntityDialog
        open={groupRoleDialogOpen}
        onOpenChange={setGroupRoleDialogOpen}
        title="Bind Role to Group"
        fields={groupRoleFields}
        values={groupRoleDraft as Record<string, unknown>}
        onChange={(name, value) => setGroupRoleDraft((current) => ({ ...current, [name]: value } as GroupRoleDraft))}
        onSubmit={() => void bindRoleToGroup()}
        onCancel={() => setGroupRoleDialogOpen(false)}
        mode="add"
        idPrefix="rbac"
      />
    </div>
  );
}
