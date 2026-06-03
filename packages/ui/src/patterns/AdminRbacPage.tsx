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

// @cloud-dog/ui — AdminRbacPage: Standard RBAC binding management (UI-R18).

import * as React from "react";
import { cn } from "../utils/cn";
import { Badge } from "../components/layout/Badge";
import { Button } from "../components/button/Button";
import { DataTable } from "../components/table/DataTable";
import type { DataColumn } from "../components/table/DataTable";

export type RbacBinding = Readonly<{
  id: string;
  userId: string;
  groupId?: string;
  role: string;
  resource?: string;
}>;

export type RbacUser = Readonly<{ id: string; name: string }>;

export type RoleDef = Readonly<{
  name: string;
  description?: string;
  permissions?: string[];
}>;

export type AdminRbacPageProps = Readonly<{
  bindings: RbacBinding[];
  users?: RbacUser[];
  groups?: Array<Readonly<{ id: string; name: string }>>;
  roles?: string[];
  resources?: string[];
  roleDefinitions?: RoleDef[];
  onBind: (userId: string, role: string, resource?: string) => void;
  onUnbind: (bindingId: string) => void;
  title?: string;
  className?: string;
  selectable?: boolean;
  bulkActions?: Array<{ label: string; action: string }>;
  onBulkAction?: (action: string, ids: string[]) => void;
  renderUserCell?: (userId: string) => React.ReactNode;
  renderGroupCell?: (groupId: string | undefined) => React.ReactNode;
  renderResourceCell?: (resource: string | undefined) => React.ReactNode;
}>;

export function AdminRbacPage(props: AdminRbacPageProps) {
  const [userId, setUserId] = React.useState("");
  const [role, setRole] = React.useState("");
  const [resource, setResource] = React.useState("");

  const columns: DataColumn<RbacBinding>[] = [
    {
      id: "userId",
      header: "User",
      sortable: true,
      sortValue: (r) => r.userId,
      cell: (r) => (props.renderUserCell ? props.renderUserCell(r.userId) : r.userId),
    },
    {
      id: "groupId",
      header: "Group",
      sortable: true,
      sortValue: (r) => r.groupId ?? "",
      cell: (r) => (props.renderGroupCell ? props.renderGroupCell(r.groupId) : r.groupId ?? "-"),
    },
    {
      id: "role",
      header: "Role",
      sortable: true,
      sortValue: (r) => r.role,
      cell: (r) => <Badge variant="default">{r.role}</Badge>,
    },
    {
      id: "resource",
      header: "Resource",
      sortable: true,
      sortValue: (r) => r.resource ?? "*",
      cell: (r) =>
        props.renderResourceCell ? props.renderResourceCell(r.resource) : r.resource ?? "*",
    },
  ];

  const actionColumn: DataColumn<RbacBinding> = {
    id: "__actions",
    header: "Actions",
    cell: (row) => (
      <Button variant="ghost" size="sm" onClick={() => props.onUnbind(row.id)}>
        Remove
      </Button>
    ),
  };

  const handleBind = () => {
    if (!userId || !role) return;
    props.onBind(userId, role, resource || undefined);
    setUserId("");
    setRole("");
    setResource("");
  };

  return (
    <div className={cn("space-y-4", props.className)}>
      <header className="space-y-1">
        <h2 className="text-lg font-semibold">{props.title ?? "Role Assignments"}</h2>
        <p className="text-sm text-muted-foreground">
          Direct user → role assignments (separate from group-derived roles).
        </p>
      </header>

      <div className="rounded-md border bg-background p-4 space-y-3">
        <h3 className="text-sm font-medium">Add binding</h3>
        <div className="flex flex-wrap items-end gap-2">
          <label htmlFor="rbac-user" className="space-y-1 text-sm">
            <span>User</span>
            <select id="rbac-user" name="user" aria-label="User" className="block w-40 rounded border px-2 py-1 text-sm" value={userId} onChange={(e) => setUserId(e.target.value)}>
              <option value="">Select user</option>
              {(props.users ?? []).map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </label>
          <label htmlFor="rbac-role" className="space-y-1 text-sm">
            <span>Role</span>
            <select id="rbac-role" name="role" aria-label="Role" className="block w-40 rounded border px-2 py-1 text-sm" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="">Select role</option>
              {(props.roles ?? []).map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </label>
          <label htmlFor="rbac-group" className="space-y-1 text-sm">
            <span>Group</span>
            {(props.groups ?? []).length > 0 ? (
              <select id="rbac-group" name="group" aria-label="Group" className="block w-40 rounded border px-2 py-1 text-sm" value={resource} onChange={(e) => setResource(e.target.value)}>
                <option value="">No group</option>
                {(props.groups ?? []).map((g) => (
                  <option key={g.id} value={g.name}>{g.name}</option>
                ))}
              </select>
            ) : (
              <input id="rbac-group" name="group" aria-label="Group" className="block w-40 rounded border px-2 py-1 text-sm" value={resource} onChange={(e) => setResource(e.target.value)} placeholder="Group name" />
            )}
          </label>
          <Button size="sm" onClick={handleBind}>Bind</Button>
        </div>
      </div>

      <div className="rounded-md border bg-background">
        <DataTable
          columns={[...columns, actionColumn]}
          rows={props.bindings}
          emptyMessage="No role bindings."
          selectable={props.selectable}
          bulkActions={props.bulkActions}
          onBulkAction={props.onBulkAction}
        />
      </div>

      {props.roleDefinitions?.length ? (
        <div className="rounded-md border bg-background p-4">
          <h2 className="mb-2 text-sm font-medium">Role Definitions</h2>
          <div className="space-y-2">
            {props.roleDefinitions.map((rd) => (
              <div key={rd.name} className="flex items-start gap-2 text-sm">
                <Badge variant="default">{rd.name}</Badge>
                <span className="text-muted-foreground">{rd.description ?? ""}</span>
                {rd.permissions?.length ? (
                  <span className="text-xs text-muted-foreground">({rd.permissions.join(", ")})</span>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
