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

// @cloud-dog/app-file-mcp — Admin identity management page.

import * as React from "react";
import { Alert, Badge, Button, Card, CardContent, CardHeader, DataTable, EntityDialog, Input } from "@cloud-dog/ui";
import type { BulkAction, DataColumn, EntityFieldDef, EntityFormMode, RelatedItem } from "@cloud-dog/ui";
import { useFileMcpState } from "../state/AppState";
import type { AdminApiKey, AdminGroup, AdminUser } from "../lib/types";

export type AdminIdentitySection = "all" | "users" | "groups" | "api-keys";

type UserFormValues = Readonly<{
  username: string;
  display_name: string;
  groupsCsv: string;
  is_active: boolean;
}>;

type GroupFormValues = Readonly<{
  name: string;
  description: string;
  rolesCsv: string;
  is_active: boolean;
}>;

type ApiKeyFormValues = Readonly<{
  userId: string;
  label: string;
  scope: string;
  profileName: string;
}>;

const EMPTY_USER_FORM: UserFormValues = {
  username: "",
  display_name: "",
  groupsCsv: "",
  is_active: true,
};

const EMPTY_GROUP_FORM: GroupFormValues = {
  name: "",
  description: "",
  rolesCsv: "admin",
  is_active: true,
};

const PLATFORM_SCOPES = ["admin", "admin,profile:default", "profile:default", "read", "write", "*"];

const EMPTY_KEY_FORM: ApiKeyFormValues = {
  userId: "",
  label: "",
  scope: "admin,profile:default",
  profileName: "default",
};

function parseCsv(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function commaSeparated(items: string[]): string {
  return items.join(", ");
}

type AdminIdentityPageProps = Readonly<{
  section?: AdminIdentitySection;
  heading?: string;
}>;

export function AdminIdentityPage(props: AdminIdentityPageProps = {}) {
  const { api } = useFileMcpState();
  const apiRef = React.useRef(api);
  apiRef.current = api;
  const section = props.section ?? "all";
  const showUsers = section === "all" || section === "users";
  const showGroups = section === "all" || section === "groups";
  const showApiKeys = section === "all" || section === "api-keys";
  const heading = props.heading ?? "Admin Identity";

  const [users, setUsers] = React.useState<AdminUser[]>([]);
  const [groups, setGroups] = React.useState<AdminGroup[]>([]);
  const [apiKeys, setApiKeys] = React.useState<AdminApiKey[]>([]);

  const [userDialogOpen, setUserDialogOpen] = React.useState(false);
  const [groupDialogOpen, setGroupDialogOpen] = React.useState(false);
  const [keyDialogOpen, setKeyDialogOpen] = React.useState(false);

  const [editingUser, setEditingUser] = React.useState<AdminUser | null>(null);
  const [editingGroup, setEditingGroup] = React.useState<AdminGroup | null>(null);

  const [userForm, setUserForm] = React.useState<UserFormValues>(EMPTY_USER_FORM);
  const [groupForm, setGroupForm] = React.useState<GroupFormValues>(EMPTY_GROUP_FORM);
  const [keyForm, setKeyForm] = React.useState<ApiKeyFormValues>(EMPTY_KEY_FORM);

  const [status, setStatus] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [createdKeySecret, setCreatedKeySecret] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [pendingDeleteGroup, setPendingDeleteGroup] = React.useState<AdminGroup | null>(null);
  const [userQuery, setUserQuery] = React.useState("");
  const [groupQuery, setGroupQuery] = React.useState("");
  const [keyQuery, setKeyQuery] = React.useState("");
  const [userPage, setUserPage] = React.useState(1);
  const [groupPage, setGroupPage] = React.useState(1);
  const [keyPage, setKeyPage] = React.useState(1);
  const [userPageSize, setUserPageSize] = React.useState(10);
  const [groupPageSize, setGroupPageSize] = React.useState(10);
  const [keyPageSize, setKeyPageSize] = React.useState(10);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const a = apiRef.current;
      const [usersResult, groupsResult, keysResult] = await Promise.all([
        showUsers ? a.listAdminUsers() : Promise.resolve([]),
        (showGroups || showUsers) ? a.listAdminGroups() : Promise.resolve([]),
        showApiKeys ? a.listAdminApiKeys(true) : Promise.resolve([]),
      ]);
      setUsers(usersResult);
      setGroups(groupsResult);
      setApiKeys(keysResult);
      setStatus("Identity data refreshed.");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load identity data.");
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showUsers, showGroups, showApiKeys]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const createOrUpdateUser = async () => {
    const username = userForm.username.trim();
    if (!editingUser && !username) {
      setError("Username is required.");
      return;
    }

    setError(null);
    try {
      if (editingUser) {
        await api.updateAdminUser(editingUser.id, {
          display_name: userForm.display_name.trim(),
          groups: parseCsv(userForm.groupsCsv),
          is_active: userForm.is_active,
        });
        setStatus(`Updated user ${editingUser.username}.`);
      } else {
        await api.createAdminUser({
          username,
          display_name: userForm.display_name.trim(),
          groups: parseCsv(userForm.groupsCsv),
          is_active: userForm.is_active,
        });
        setStatus(`Created user ${username}.`);
      }

      setUserDialogOpen(false);
      setEditingUser(null);
      setUserForm(EMPTY_USER_FORM);
      await load();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to save user.");
    }
  };

  const createOrUpdateGroup = async () => {
    const name = groupForm.name.trim();
    if (!editingGroup && !name) {
      setError("Group name is required.");
      return;
    }

    setError(null);
    try {
      if (editingGroup) {
        await api.updateAdminGroup(editingGroup.id, {
          description: groupForm.description.trim(),
          roles: parseCsv(groupForm.rolesCsv),
          is_active: groupForm.is_active,
        });
        setStatus(`Updated group ${editingGroup.name}.`);
      } else {
        await api.createAdminGroup({
          name,
          description: groupForm.description.trim(),
          roles: parseCsv(groupForm.rolesCsv),
          is_active: groupForm.is_active,
        });
        setStatus(`Created group ${name}.`);
      }

      setGroupDialogOpen(false);
      setEditingGroup(null);
      setGroupForm(EMPTY_GROUP_FORM);
      await load();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to save group.");
    }
  };

  const createApiKey = async () => {
    if (!keyForm.userId.trim() || !keyForm.label.trim()) {
      setError("User and label are required.");
      return;
    }
    const userId = keyForm.userId.split(":")[0]?.trim() || "";
    if (!userId) {
      setError("User is required.");
      return;
    }

    setError(null);
    try {
      const created = await api.createAdminApiKey({
        user_id: userId,
        label: keyForm.label.trim(),
        scopes: keyForm.scope.split(",").map((s) => s.trim()).filter(Boolean),
        profile_name: keyForm.profileName.trim(),
      });
      setCreatedKeySecret(created.secret ?? null);
      setStatus(`Created API key ${keyForm.label.trim()}.`);
      setKeyDialogOpen(false);
      setKeyForm(EMPTY_KEY_FORM);
      await load();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Failed to create API key.");
    }
  };

  const deleteUsers = async (rows: AdminUser[]) => {
    setError(null);
    try {
      for (const user of rows) {
        await api.deleteAdminUser(user.id);
      }
      setStatus(`Deleted ${rows.length} user${rows.length === 1 ? "" : "s"}.`);
      await load();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete user(s).");
    }
  };

  const deleteGroups = async (rows: AdminGroup[]) => {
    setError(null);
    try {
      for (const group of rows) {
        await api.deleteAdminGroup(group.id);
      }
      setStatus(`Deleted ${rows.length} group${rows.length === 1 ? "" : "s"}.`);
      await load();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete group(s).");
    }
  };

  const revokeKeys = async (rows: AdminApiKey[]) => {
    setError(null);
    try {
      for (const key of rows) {
        if (key.is_active) {
          await api.revokeAdminApiKey(key.id);
        }
      }
      setStatus(`Revoked ${rows.length} API key${rows.length === 1 ? "" : "s"}.`);
      await load();
    } catch (revokeError) {
      setError(revokeError instanceof Error ? revokeError.message : "Failed to revoke API key(s).");
    }
  };

  const userMode: EntityFormMode = editingUser ? "edit" : "add";
  const groupMode: EntityFormMode = editingGroup ? "edit" : "add";

  const userFields: EntityFieldDef[] = [
    {
      name: "username",
      label: "Username",
      type: "text",
      required: true,
      readOnly: Boolean(editingUser),
    },
    { name: "display_name", label: "Display name", type: "text" },
    { name: "groupsCsv", label: "Groups (CSV)", type: "text" },
    { name: "is_active", label: "Active", type: "boolean" },
  ];

  const groupFields: EntityFieldDef[] = [
    {
      name: "name",
      label: "Group name",
      type: "text",
      required: true,
      readOnly: Boolean(editingGroup),
    },
    { name: "description", label: "Description", type: "text" },
    { name: "rolesCsv", label: "Roles (CSV)", type: "text" },
    { name: "is_active", label: "Active", type: "boolean" },
  ];

  const apiKeyFields: EntityFieldDef[] = [
    {
      name: "userId",
      label: "User",
      type: "select",
      required: true,
      options: users.map((user) => `${user.id}:${user.username}`),
    },
    { name: "label", label: "Label", type: "text", required: true },
    { name: "scope", label: "Scope", type: "select", options: PLATFORM_SCOPES },
    { name: "profileName", label: "Profile", type: "select", options: ["default"] },
  ];

  const userColumns: DataColumn<AdminUser>[] = [
    { id: "id", header: "User ID", cell: (row) => row.id, sortable: true, sortValue: (row) => row.id },
    {
      id: "username",
      header: "Username",
      cell: (row) => row.username,
      sortable: true,
      sortValue: (row) => row.username,
    },
    { id: "display", header: "Display Name", cell: (row) => row.display_name || "-" },
    { id: "email", header: "Email", cell: (row) => (row as unknown as Record<string, unknown>).email as string || "-" },
    {
      id: "primary_group",
      header: "Primary group",
      cell: (row) => row.groups?.[0] ? <Badge variant="secondary">{row.groups[0]}</Badge> : "-",
    },
    { id: "groups", header: "Groups", cell: (row) => commaSeparated(row.groups) || "-" },
    { id: "status", header: "Status", cell: (row) => <Badge variant={row.is_active ? "default" : "secondary"}>{row.is_active ? "active" : "disabled"}</Badge>, sortable: true, sortValue: (row) => (row.is_active ? 1 : 0) },
    { id: "created", header: "Created", cell: (row) => row.created_at ? new Date(row.created_at).toLocaleDateString("en-GB") : "-", sortable: true, sortValue: (row) => row.created_at ?? "" },
    {
      id: "actions",
      header: "Actions",
      cell: (row) => (
        <div className="flex flex-wrap gap-1">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setEditingUser(row);
              setUserForm({
                username: row.username,
                display_name: row.display_name || "",
                groupsCsv: commaSeparated(row.groups),
                is_active: row.is_active,
              });
              setUserDialogOpen(true);
            }}
          >
            Edit
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              void api
                .updateAdminUser(row.id, { is_active: !row.is_active })
                .then(async () => {
                  setStatus(`${row.username} is now ${!row.is_active ? "active" : "inactive"}.`);
                  await load();
                })
                .catch((updateError: unknown) => {
                  setError(updateError instanceof Error ? updateError.message : "Failed to update user.");
                });
            }}
          >
            {row.is_active ? "Disable" : "Enable"}
          </Button>
          <Button size="sm" variant="destructive" onClick={() => void deleteUsers([row])}>
            Delete
          </Button>
        </div>
      ),
    },
  ];

  const groupColumns: DataColumn<AdminGroup>[] = [
    { id: "name", header: "Name", cell: (row) => row.name, sortable: true, sortValue: (row) => row.name },
    { id: "description", header: "Description", cell: (row) => row.description || "-" },
    { id: "members", header: "Members", cell: (row) => String(row.members.length), sortable: true, sortValue: (row) => row.members.length },
    { id: "roles", header: "Roles", cell: (row) => commaSeparated(row.roles) || "-" },
    { id: "status", header: "Status", cell: (row) => <Badge variant={row.is_active ? "default" : "secondary"}>{row.is_active ? "active" : "disabled"}</Badge>, sortable: true, sortValue: (row) => (row.is_active ? 1 : 0) },
    { id: "created", header: "Created", cell: (row) => row.created_at ? new Date(row.created_at).toLocaleDateString("en-GB") : "-", sortable: true, sortValue: (row) => row.created_at ?? "" },
    {
      id: "actions",
      header: "Actions",
      cell: (row) => (
        <div className="flex flex-wrap gap-1">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setEditingGroup(row);
              setGroupForm({
                name: row.name,
                description: row.description || "",
                rolesCsv: commaSeparated(row.roles),
                is_active: row.is_active,
              });
              setGroupDialogOpen(true);
            }}
          >
            Edit
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              void api
                .updateAdminGroup(row.id, { is_active: !row.is_active })
                .then(async () => {
                  setStatus(`${row.name} is now ${!row.is_active ? "active" : "inactive"}.`);
                  await load();
                })
                .catch((updateError: unknown) => {
                  setError(updateError instanceof Error ? updateError.message : "Failed to update group.");
                });
            }}
          >
            {row.is_active ? "Disable" : "Enable"}
          </Button>
          <Button size="sm" variant="destructive" onClick={() => setPendingDeleteGroup(row)}>
            Delete
          </Button>
        </div>
      ),
    },
  ];

  const keyColumns: DataColumn<AdminApiKey>[] = [
    { id: "id", header: "Key ID", cell: (row) => <span className="font-mono text-xs">{row.id.slice(0, 8)}...</span>, sortable: true, sortValue: (row) => row.id },
    { id: "label", header: "Label", cell: (row) => row.label, sortable: true, sortValue: (row) => row.label },
    { id: "owner", header: "Owner", cell: (row) => { const u = users.find((usr) => usr.id === row.user_id); return u?.username ?? row.user_id; }, sortable: true, sortValue: (row) => row.user_id },
    { id: "scopes", header: "Scopes", cell: (row) => commaSeparated(row.scopes) || "-" },
    { id: "profile", header: "Profile", cell: (row) => row.profile_name || "-" },
    { id: "masked", header: "Masked", cell: (row) => row.masked_value ? <span className="font-mono text-xs">{row.masked_value}</span> : "-" },
    { id: "expires", header: "Expires", cell: (row) => row.expires_at ? new Date(row.expires_at).toLocaleDateString("en-GB") : "-", sortable: true, sortValue: (row) => row.expires_at ?? "" },
    { id: "created", header: "Created", cell: (row) => row.created_at ? new Date(row.created_at).toLocaleDateString("en-GB") : "-", sortable: true, sortValue: (row) => row.created_at ?? "" },
    { id: "status", header: "Status", cell: (row) => <Badge variant={row.is_active ? "default" : "destructive"}>{row.is_active ? "active" : "revoked"}</Badge>, sortable: true, sortValue: (row) => (row.is_active ? 1 : 0) },
    {
      id: "actions",
      header: "Actions",
      cell: (row) => (
        <Button
          size="sm"
          variant="destructive"
          onClick={() => void revokeKeys([row])}
          disabled={!row.is_active}
        >
          Revoke
        </Button>
      ),
    },
  ];

  React.useEffect(() => setUserPage(1), [userQuery]);
  React.useEffect(() => setGroupPage(1), [groupQuery]);
  React.useEffect(() => setKeyPage(1), [keyQuery]);

  const filteredUsers = React.useMemo(() => {
    const trimmed = userQuery.trim().toLowerCase();
    if (!trimmed) return users;
    return users.filter((row) => `${row.username} ${row.display_name} ${commaSeparated(row.groups)}`.toLowerCase().includes(trimmed));
  }, [userQuery, users]);

  const filteredGroups = React.useMemo(() => {
    const trimmed = groupQuery.trim().toLowerCase();
    if (!trimmed) return groups;
    return groups.filter((row) => `${row.name} ${row.description} ${commaSeparated(row.roles)} ${commaSeparated(row.members)}`.toLowerCase().includes(trimmed));
  }, [groupQuery, groups]);

  const filteredKeys = React.useMemo(() => {
    const trimmed = keyQuery.trim().toLowerCase();
    if (!trimmed) return apiKeys;
    return apiKeys.filter((row) => `${row.label} ${row.user_id} ${row.profile_name} ${commaSeparated(row.scopes)}`.toLowerCase().includes(trimmed));
  }, [apiKeys, keyQuery]);

  const userBulkActions = React.useMemo<BulkAction[]>(() => [{ label: "Delete selected", action: "delete" }], []);
  const groupBulkActions = React.useMemo<BulkAction[]>(() => [{ label: "Delete selected", action: "delete" }], []);
  const keyBulkActions = React.useMemo<BulkAction[]>(() => [{ label: "Revoke selected", action: "revoke" }], []);

  const userRelatedGroups: RelatedItem[] = parseCsv(userForm.groupsCsv).map((groupName) => ({
    id: groupName,
    label: groupName,
  }));

  const groupRelatedMembers: RelatedItem[] = editingGroup
    ? editingGroup.members.map((member) => ({ id: member, label: member }))
    : [];

  return (
    <div className="space-y-6">
      {pendingDeleteGroup ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" role="dialog" aria-label="Confirm delete">
          <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-lg space-y-4">
            <h2 className="text-lg font-semibold">Delete group?</h2>
            <p className="text-sm text-muted-foreground">Delete group <strong>{pendingDeleteGroup.name}</strong>? This cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setPendingDeleteGroup(null)}>Cancel</Button>
              <Button variant="destructive" onClick={() => { deleteGroups([pendingDeleteGroup]); setPendingDeleteGroup(null); }}>Delete</Button>
            </div>
          </div>
        </div>
      ) : null}
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{heading}</h1>
        <Button variant="secondary" size="sm" onClick={() => void load()} disabled={loading}>
          Refresh
        </Button>
      </header>

      <p className="text-sm text-muted-foreground">
        Mutating actions require admin privileges (admin scope or matching admin UI token).
      </p>

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
      {createdKeySecret ? (
        <Alert variant="success">
          <div className="space-y-2">
            <p className="font-medium">New API key secret. Copy it now; it will not be shown again.</p>
            <code className="block overflow-x-auto rounded bg-muted/50 p-2 text-xs">{createdKeySecret}</code>
            <Button size="sm" variant="secondary" onClick={() => setCreatedKeySecret(null)}>
              Dismiss secret
            </Button>
          </div>
        </Alert>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {showUsers ? (
          <Button
            onClick={() => {
              setEditingUser(null);
              setUserForm(EMPTY_USER_FORM);
              setUserDialogOpen(true);
            }}
          >
            Add User
          </Button>
        ) : null}
        {showGroups ? (
          <Button
            onClick={() => {
              setEditingGroup(null);
              setGroupForm(EMPTY_GROUP_FORM);
              setGroupDialogOpen(true);
            }}
          >
            Add Group
          </Button>
        ) : null}
        {showApiKeys ? (
          <Button
            onClick={() => {
              setKeyForm(EMPTY_KEY_FORM);
              setKeyDialogOpen(true);
            }}
          >
            Add API Key
          </Button>
        ) : null}
      </div>

      {showUsers ? (
        <Card>
          <CardHeader className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">Users</h2>
              <Button variant="secondary" onClick={() => void load()}>Refresh</Button>
            </div>
            <Input value={userQuery} onChange={(event) => setUserQuery(event.target.value)} placeholder="Search users" aria-label="Search users" className="max-w-md" />
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <DataTable
              tableId="file-mcp-admin-users"
              columns={userColumns}
              rows={filteredUsers}
              totalRows={users.length}
              getRowId={(row) => row.id}
              emptyMessage="No admin users found. Use Create User to add your first admin account."
              page={userPage}
              onPageChange={setUserPage}
              pageSize={userPageSize}
              onPageSizeChange={setUserPageSize}
              selectable={true}
              bulkActions={userBulkActions}
              onBulkAction={(_action, selectedIds) => void deleteUsers(filteredUsers.filter((row) => selectedIds.includes(row.id)))}
              columnPickerEnabled={true}
            />
          </CardContent>
        </Card>
      ) : null}

      {showGroups ? (
        <Card>
          <CardHeader className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">Groups</h2>
              <Button variant="secondary" onClick={() => void load()}>Refresh</Button>
            </div>
            <Input value={groupQuery} onChange={(event) => setGroupQuery(event.target.value)} placeholder="Search groups" aria-label="Search groups" className="max-w-md" />
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <DataTable
              tableId="file-mcp-admin-groups"
              columns={groupColumns}
              rows={filteredGroups}
              totalRows={groups.length}
              getRowId={(row) => row.id}
              emptyMessage="No admin groups found."
              page={groupPage}
              onPageChange={setGroupPage}
              pageSize={groupPageSize}
              onPageSizeChange={setGroupPageSize}
              bulkActions={groupBulkActions}
              onBulkAction={(_action, selectedIds) => void deleteGroups(filteredGroups.filter((row) => selectedIds.includes(row.id)))}
            />
          </CardContent>
        </Card>
      ) : null}

      {showApiKeys ? (
        <Card>
          <CardHeader className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">API Keys</h2>
              <Button variant="secondary" onClick={() => void load()}>Refresh</Button>
            </div>
            <Input value={keyQuery} onChange={(event) => setKeyQuery(event.target.value)} placeholder="Search API keys" aria-label="Search API keys" className="max-w-md" />
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <DataTable
              tableId="file-mcp-admin-api-keys"
              columns={keyColumns}
              rows={filteredKeys}
              totalRows={apiKeys.length}
              getRowId={(row) => row.id}
              emptyMessage="No API keys found."
              page={keyPage}
              onPageChange={setKeyPage}
              pageSize={keyPageSize}
              onPageSizeChange={setKeyPageSize}
              selectable={true}
              bulkActions={keyBulkActions}
              onBulkAction={(_action, selectedIds) => void revokeKeys(filteredKeys.filter((row) => selectedIds.includes(row.id)))}
              columnPickerEnabled={true}
            />
          </CardContent>
        </Card>
      ) : null}

      {showUsers ? (
        <EntityDialog
          open={userDialogOpen}
          onOpenChange={(open) => {
            setUserDialogOpen(open);
            if (!open) {
              setEditingUser(null);
              setUserForm(EMPTY_USER_FORM);
            }
          }}
          title={editingUser ? `Edit user ${editingUser.username}` : "Add User"}
          mode={userMode}
          fields={userFields}
          values={userForm as unknown as Record<string, unknown>}
          onChange={(name, value) => {
            setUserForm((current) => {
              if (name === "is_active") {
                return { ...current, is_active: Boolean(value) };
              }
              return { ...current, [name]: String(value ?? "") };
            });
          }}
          onSubmit={() => void createOrUpdateUser()}
          onCancel={() => setUserDialogOpen(false)}
          relatedPanels={[
            {
              title: "Groups",
              items: userRelatedGroups,
              emptyMessage: "No groups selected.",
            },
          ]}
        />
      ) : null}

      {showGroups ? (
        <EntityDialog
          open={groupDialogOpen}
          onOpenChange={(open) => {
            setGroupDialogOpen(open);
            if (!open) {
              setEditingGroup(null);
              setGroupForm(EMPTY_GROUP_FORM);
            }
          }}
          title={editingGroup ? `Edit group ${editingGroup.name}` : "Add Group"}
          mode={groupMode}
          fields={groupFields}
          values={groupForm as unknown as Record<string, unknown>}
          onChange={(name, value) => {
            setGroupForm((current) => {
              if (name === "is_active") {
                return { ...current, is_active: Boolean(value) };
              }
              return { ...current, [name]: String(value ?? "") };
            });
          }}
          onSubmit={() => void createOrUpdateGroup()}
          onCancel={() => setGroupDialogOpen(false)}
          relatedPanels={[
            {
              title: "Members",
              items: groupRelatedMembers,
              emptyMessage: "No members linked.",
            },
          ]}
        />
      ) : null}

      {showApiKeys ? (
        <EntityDialog
          open={keyDialogOpen}
          onOpenChange={setKeyDialogOpen}
          title="Add API Key"
          mode="add"
          fields={apiKeyFields}
          values={keyForm as unknown as Record<string, unknown>}
          onChange={(name, value) => {
            setKeyForm((current) => ({
              ...current,
              [name]: String(value ?? ""),
            }));
          }}
          onSubmit={() => void createApiKey()}
          onCancel={() => setKeyDialogOpen(false)}
        />
      ) : null}

    </div>
  );
}
