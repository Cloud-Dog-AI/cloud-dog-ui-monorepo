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
import { AdminRbacPage, Badge, Card, CardContent, CardHeader, DataTable, type DataColumn } from "@cloud-dog/ui";
import { DEFAULT_ROLE_PERMISSIONS, ROLE_NAMES } from "../lib/access";
import { useDbMcpState } from "../state/AppState";
import type { UserSummary } from "../lib/types";

type RoleDef = Readonly<{ name: string; description: string; permissions: string }>;
const ROLE_DEFS: RoleDef[] = [
  {
    name: "admin",
    description: "Full access across profiles, content, schema, relationships, and audit.",
    permissions: DEFAULT_ROLE_PERMISSIONS.admin.join(", "),
  },
  {
    name: "data_steward",
    description: "Manages governed profiles, data lifecycle changes, indexing, and relationship curation.",
    permissions: DEFAULT_ROLE_PERMISSIONS.data_steward.join(", "),
  },
  {
    name: "developer",
    description: "Can inspect catalog/schema, index, and create or update data but not delete or manage profiles.",
    permissions: DEFAULT_ROLE_PERMISSIONS.developer.join(", "),
  },
  {
    name: "analyst",
    description: "Read-only discovery and content search role.",
    permissions: DEFAULT_ROLE_PERMISSIONS.analyst.join(", "),
  },
  {
    name: "auditor",
    description: "Read-only access to catalog, schema, relationships, data, and audit trails.",
    permissions: DEFAULT_ROLE_PERMISSIONS.auditor.join(", "),
  },
];
const roleDefColumns: DataColumn<RoleDef>[] = [
  { id: "role", header: "Role", sortable: true, sortValue: (r) => r.name, cell: (r) => <Badge variant={r.name === "admin" ? "destructive" : "default"}>{r.name}</Badge> },
  { id: "desc", header: "Description", cell: (r) => r.description },
  { id: "perms", header: "Permissions", cell: (r) => <span className="font-mono text-xs">{r.permissions}</span> },
];

export function RbacPage() {
  const { api } = useDbMcpState();
  const [users, setUsers] = React.useState<UserSummary[]>([]);
  const [groups, setGroups] = React.useState<{ group_id: string; name: string }[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setError(null);
    try {
      const [userItems, groupItems] = await Promise.all([api.listUsers(), api.listGroups()]);
      setUsers(userItems);
      setGroups(groupItems);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load RBAC bindings.");
    }
  }, [api]);

  React.useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      <Card>
        <CardHeader><h2 className="text-lg font-semibold">Role Definitions (IW5)</h2></CardHeader>
        <CardContent>
          <DataTable tableId="role-defs" rows={[...ROLE_DEFS]} getRowId={(r) => r.name} columns={roleDefColumns} />
        </CardContent>
      </Card>
      <AdminRbacPage
        title="RBAC"
        users={users.map((item) => ({ id: item.user_id, name: item.username }))}
        groups={groups.map((item) => ({ id: item.group_id, name: item.name }))}
        roles={[...ROLE_NAMES]}
        bindings={users.flatMap((item) => {
          const memberGroups = groups.filter((g) => g.member_user_ids.includes(item.user_id));
          const groupName = memberGroups.map((g) => g.name).join(", ") || "-";
          return item.roles.map((role) => ({
            id: `${item.user_id}:${role}`,
            userId: `${item.username} (${item.user_id.slice(0, 8)})`,
            groupId: groupName,
            role,
          }));
        })}
        onBind={async (userId, role, resource) => {
          const user = users.find((item) => item.user_id === userId);
          if (!user) return;
          if (resource) {
            const group = groups.find((g) => g.name === resource || g.group_id === resource);
            if (group && !group.member_user_ids.includes(userId)) {
              await api.updateGroup(group.group_id, {
                name: group.name,
                description: group.description,
                roles: group.roles,
                member_user_ids: [...group.member_user_ids, userId],
              }).catch(() => {});
            }
          }
          await api.updateUser(userId, {
            username: user.username,
            display_name: user.display_name,
            email: user.email,
            status: user.status,
            roles: Array.from(new Set([...user.roles, role])),
          });
          await load();
        }}
        onUnbind={(bindingId) => {
          const [userId, role] = bindingId.split(":");
          const user = users.find((item) => item.user_id === userId);
          if (!user) return;
          void api.updateUser(userId, {
            username: user.username,
            display_name: user.display_name,
            email: user.email,
            status: user.status,
            roles: user.roles.filter((item) => item !== role),
          }).then(load);
        }}
      />
    </div>
  );
}
