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

// @cloud-dog/app-index-retriever — Shared IDAM admin section implementation.

import * as React from "react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  DataTable,
  EntityDialog,
  JsonBlock,
  RelativeTime,
  RelatedItemsPanel,
  type DataColumn,
  type EntityFieldDef,
  type EntityFormMode,
} from "@cloud-dog/ui";
import { useIndexRetrieverState } from "../state/AppState";
import type { ApiKeyRecord, ConfigEventRecord, GroupRecord, JsonRecord, RbacBindingRecord, UserRecord } from "../lib/types";

function asRecord(value: unknown): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as JsonRecord;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asBoolean(value: unknown): boolean {
  return value === true;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseCsv(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function asUserRecord(value: unknown): UserRecord {
  const record = asRecord(value);
  return {
    user_id: asString(record.user_id),
    display_name: asString(record.display_name),
    roles: asStringArray(record.roles),
    groups: asStringArray(record.groups),
    enabled: asBoolean(record.enabled),
  };
}

function asGroupRecord(value: unknown): GroupRecord {
  const record = asRecord(value);
  return {
    group_id: asString(record.group_id),
    description: asString(record.description),
    roles: asStringArray(record.roles),
    members: asStringArray(record.members),
  };
}

function asApiKeyRecord(value: unknown): ApiKeyRecord {
  const record = asRecord(value);
  return {
    key_id: asString(record.key_id),
    token: asString(record.token) || undefined,
    label: asString(record.label),
    roles: asStringArray(record.roles),
    capabilities: asStringArray(record.capabilities),
    user_id: typeof record.user_id === "string" ? record.user_id : null,
    revoked: asBoolean(record.revoked),
  };
}

function asConfigEventRecord(value: unknown): ConfigEventRecord {
  const record = asRecord(value);
  return {
    entity_type: asString(record.entity_type),
    entity_id: asString(record.entity_id),
    action: asString(record.action),
    actor: asString(record.actor) || undefined,
    timestamp: asString(record.timestamp) || asString(record.created_at) || undefined,
    payload: record.payload,
  };
}

function asRbacBindingRecord(value: unknown): RbacBindingRecord {
  const record = asRecord(value);
  return {
    entity_type: asString(record.entity_type),
    entity_id: asString(record.entity_id),
    role: asString(record.role),
  };
}

type UserDraft = Readonly<{ user_id: string; display_name: string; roles: string; groups: string }>;
type GroupDraft = Readonly<{ group_id: string; description: string; roles: string; members: string }>;
type ApiKeyDraft = Readonly<{ label: string; user_id: string; roles: string; capabilities: string }>;
type RbacDraft = Readonly<{ group: string; user: string; role: string }>;

const EMPTY_USER: UserDraft = { user_id: "", display_name: "", roles: "admin", groups: "" };
const EMPTY_GROUP: GroupDraft = { group_id: "", description: "", roles: "writer", members: "" };
const EMPTY_API_KEY: ApiKeyDraft = { label: "", user_id: "", roles: "admin", capabilities: "admin,search,ingest" };
const EMPTY_RBAC: RbacDraft = { group: "group", user: "", role: "admin" };

function applyEventTimes<T extends { [k: string]: unknown }>(
  rows: T[],
  events: ConfigEventRecord[],
  match: (row: T, event: ConfigEventRecord) => boolean
): T[] {
  return rows.map((row) => {
    const matched = events.filter((event) => match(row, event) && !!event.timestamp);
    const created = matched.find((event) => event.action.includes("created"))?.timestamp;
    const updated = matched.at(-1)?.timestamp;
    return { ...row, created_at: created, updated_at: updated };
  });
}

function recentFirst<T extends { created_at?: string; updated_at?: string }>(rows: T[]): T[] {
  return [...rows].sort((left, right) => {
    const leftTime = Date.parse(left.updated_at ?? left.created_at ?? "");
    const rightTime = Date.parse(right.updated_at ?? right.created_at ?? "");
    return (Number.isFinite(rightTime) ? rightTime : 0) - (Number.isFinite(leftTime) ? leftTime : 0);
  });
}

function pinFirst<T>(rows: T[], isTarget: (row: T) => boolean): T[] {
  const first = rows.find(isTarget);
  if (!first) return rows;
  return [first, ...rows.filter((row) => !isTarget(row))];
}

function shortEntityId(value: string): string {
  const text = value.trim();
  if (text.length <= 16) return text;
  return `${text.slice(0, 8)}...${text.slice(-4)}`;
}

export type SecurityAdminSection = "all" | "users" | "groups" | "api-keys" | "rbac";

export function SecurityAdminSectionView(props: { section?: SecurityAdminSection }) {
  const app = useIndexRetrieverState();
  const { api, captureFailure, recordActivity } = app;
  const section = props.section ?? "all";

  const [users, setUsers] = React.useState<UserRecord[]>([]);
  const [groups, setGroups] = React.useState<GroupRecord[]>([]);
  const [apiKeys, setApiKeys] = React.useState<ApiKeyRecord[]>([]);
  const [rbacBindings, setRbacBindings] = React.useState<RbacBindingRecord[]>([]);
  const [events, setEvents] = React.useState<ConfigEventRecord[]>([]);

  const [userDraft, setUserDraft] = React.useState<UserDraft>(EMPTY_USER);
  const [groupDraft, setGroupDraft] = React.useState<GroupDraft>(EMPTY_GROUP);
  const [apiKeyDraft, setApiKeyDraft] = React.useState<ApiKeyDraft>(EMPTY_API_KEY);
  const [rbacDraft, setRbacDraft] = React.useState<RbacDraft>(EMPTY_RBAC);

  const [userDialogMode, setUserDialogMode] = React.useState<EntityFormMode>("add");
  const [groupDialogMode, setGroupDialogMode] = React.useState<EntityFormMode>("add");
  const [apiKeyDialogMode, setApiKeyDialogMode] = React.useState<EntityFormMode>("add");
  const [rbacDialogMode, setRbacDialogMode] = React.useState<EntityFormMode>("add");

  const [userDialogOpen, setUserDialogOpen] = React.useState(false);
  const [groupDialogOpen, setGroupDialogOpen] = React.useState(false);
  const [apiKeyDialogOpen, setApiKeyDialogOpen] = React.useState(false);
  const [rbacDialogOpen, setRbacDialogOpen] = React.useState(false);

  const [selectedRelated, setSelectedRelated] = React.useState<{ id: string; label: string }[]>([]);
  const [latestIssuedToken, setLatestIssuedToken] = React.useState("");
  const [result, setResult] = React.useState<unknown>({});
  const [status, setStatus] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [usersPage, setUsersPage] = React.useState(1);
  const [usersPageSize, setUsersPageSize] = React.useState(10);
  const [groupsPage, setGroupsPage] = React.useState(1);
  const [groupsPageSize, setGroupsPageSize] = React.useState(10);
  const [apiKeysPage, setApiKeysPage] = React.useState(1);
  const [apiKeysPageSize, setApiKeysPageSize] = React.useState(10);
  const [rbacPage, setRbacPage] = React.useState(1);
  const [rbacPageSize, setRbacPageSize] = React.useState(10);
  const [eventsPage, setEventsPage] = React.useState(1);
  const [eventsPageSize, setEventsPageSize] = React.useState(10);

  const run = React.useCallback(async (action: string, fn: () => Promise<unknown>) => {
    setError(null);
    try {
      const out = await fn();
      setResult(out);
      setStatus(`${action} OK`);
      recordActivity(`security.${action}`, "ok");
      return out;
    } catch (runError) {
      const message = captureFailure(runError);
      setError(message);
      setStatus("");
      recordActivity(`security.${action}`, "error", message);
      throw runError;
    }
  }, [captureFailure, recordActivity]);

  const refreshUsers = React.useCallback(async () => {
    const [out, eventsOut] = await Promise.all([
      api.callTool<JsonRecord>("users_list", {}),
      api.getA2aEvents().catch(() => ({ events: [] })),
    ]);
    const usersPayload = out.users;
    const rows = Array.isArray(usersPayload) ? usersPayload.map(asUserRecord) : [];
    const eventsPayload = asRecord(eventsOut).events;
    const nextEvents = Array.isArray(eventsPayload) ? eventsPayload.map(asConfigEventRecord) : [];
    setEvents(nextEvents);
    const withTimes = recentFirst(
      applyEventTimes(rows, nextEvents, (row, event) => event.entity_type === "user" && event.entity_id === row.user_id)
    );
    setUsers(withTimes);
    return withTimes;
  }, [api]);

  const refreshGroups = React.useCallback(async () => {
    const [out, eventsOut] = await Promise.all([
      api.callTool<JsonRecord>("groups_list", {}),
      api.getA2aEvents().catch(() => ({ events: [] })),
    ]);
    const groupsPayload = out.groups;
    const rows = Array.isArray(groupsPayload) ? groupsPayload.map(asGroupRecord) : [];
    const eventsPayload = asRecord(eventsOut).events;
    const nextEvents = Array.isArray(eventsPayload) ? eventsPayload.map(asConfigEventRecord) : [];
    setEvents(nextEvents);
    const withTimes = recentFirst(
      applyEventTimes(rows, nextEvents, (row, event) => event.entity_type === "group" && event.entity_id === row.group_id)
    );
    setGroups(withTimes);
    return withTimes;
  }, [api]);

  const refreshApiKeys = React.useCallback(async () => {
    const [out, eventsOut] = await Promise.all([
      api.callTool<JsonRecord>("api_keys_list", {}),
      api.getA2aEvents().catch(() => ({ events: [] })),
    ]);
    const apiKeysPayload = out.api_keys;
    const rows = Array.isArray(apiKeysPayload) ? apiKeysPayload.map(asApiKeyRecord) : [];
    const eventsPayload = asRecord(eventsOut).events;
    const nextEvents = Array.isArray(eventsPayload) ? eventsPayload.map(asConfigEventRecord) : [];
    setEvents(nextEvents);
    const withTimes = recentFirst(
      applyEventTimes(rows, nextEvents, (row, event) => event.entity_type === "api_key" && event.entity_id === row.key_id)
    );
    setApiKeys(withTimes);
    return withTimes;
  }, [api]);

  const refreshEvents = React.useCallback(async () => {
    const out = (await api.getA2aEvents()) as JsonRecord;
    const rows = Array.isArray(out.events) ? out.events.map(asConfigEventRecord) : [];
    setEvents(rows);
    return rows;
  }, [api]);

  const refreshBindings = React.useCallback(async () => {
    const [out, eventsOut] = await Promise.all([
      api.callTool<JsonRecord>("rbac_bindings_list", {}),
      api.getA2aEvents().catch(() => ({ events: [] })),
    ]);
    const record = asRecord(out);
    const rows = Array.isArray(record.bindings) ? record.bindings.map(asRbacBindingRecord) : [];
    const eventsPayload = asRecord(eventsOut).events;
    const nextEvents = Array.isArray(eventsPayload) ? eventsPayload.map(asConfigEventRecord) : [];
    setEvents(nextEvents);
    const withTimes = recentFirst(
      applyEventTimes(rows, nextEvents, (row, event) => event.entity_type === "rbac_binding" && event.entity_id === `${row.entity_type}:${row.entity_id}`)
    );
    setRbacBindings(withTimes);
    return withTimes;
  }, [api]);

  const refreshAll = React.useCallback(async () => {
    setError(null);
    try {
      const [nextUsers, nextGroups, nextApiKeys, nextBindings, nextEvents] = await Promise.all([
        refreshUsers(),
        refreshGroups(),
        refreshApiKeys(),
        refreshBindings(),
        refreshEvents(),
      ]);
      setUsers(applyEventTimes(nextUsers, nextEvents, (row, event) => event.entity_type === "user" && event.entity_id === row.user_id));
      setGroups(applyEventTimes(nextGroups, nextEvents, (row, event) => event.entity_type === "group" && event.entity_id === row.group_id));
      setApiKeys(applyEventTimes(nextApiKeys, nextEvents, (row, event) => event.entity_type === "api_key" && event.entity_id === row.key_id));
      setRbacBindings(
        applyEventTimes(nextBindings, nextEvents, (row, event) =>
          event.entity_type === "rbac_binding" && event.entity_id === `${row.entity_type}:${row.entity_id}`
        )
      );
      setResult({ users: nextUsers, groups: nextGroups, api_keys: nextApiKeys, bindings: nextBindings, events: nextEvents });
      setStatus("refresh_all OK");
      recordActivity("security.refresh_all", "ok");
    } catch (refreshError) {
      const message = captureFailure(refreshError);
      setError(message);
      setStatus("");
      recordActivity("security.refresh_all", "error", message);
    }
  }, [captureFailure, recordActivity, refreshApiKeys, refreshBindings, refreshEvents, refreshGroups, refreshUsers]);

  React.useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  const userFields: EntityFieldDef[] = [
    { name: "user_id", label: "User ID", type: "text", required: true, readOnly: userDialogMode !== "add" },
    { name: "display_name", label: "Display name", type: "text", required: true },
    { name: "roles", label: "Roles", type: "text", required: true },
    { name: "groups", label: "Groups", type: "text" },
  ];
  const groupFields: EntityFieldDef[] = [
    { name: "group_id", label: "Name", type: "text", required: true, readOnly: groupDialogMode !== "add" },
    { name: "description", label: "Description", type: "text" },
    { name: "roles", label: "Roles", type: "text", required: true },
    { name: "members", label: "Members", type: "text" },
  ];
  const apiKeyFields: EntityFieldDef[] = [
    { name: "label", label: "Key label", type: "text", required: true },
    { name: "user_id", label: "User ID", type: "text" },
    { name: "roles", label: "Roles", type: "text", required: true },
    { name: "capabilities", label: "Capabilities", type: "text", required: true },
  ];
  const rbacFields: EntityFieldDef[] = [
    { name: "group", label: "Group", type: "text", required: true },
    { name: "user", label: "Subject", type: "text", required: false },
    { name: "role", label: "Role", type: "text", required: true },
  ];

  const userErrors = React.useMemo(() => {
    const next: Record<string, string> = {};
    if (!userDraft.user_id.trim()) next.user_id = "User ID is required.";
    if (!userDraft.display_name.trim()) next.display_name = "Display name is required.";
    if (parseCsv(userDraft.roles).length === 0) next.roles = "At least one role is required.";
    return next;
  }, [userDraft]);
  const groupErrors = React.useMemo(() => {
    const next: Record<string, string> = {};
    if (!groupDraft.group_id.trim()) next.group_id = "Group ID is required.";
    if (parseCsv(groupDraft.roles).length === 0) next.roles = "At least one role is required.";
    return next;
  }, [groupDraft]);
  const apiKeyErrors = React.useMemo(() => {
    const next: Record<string, string> = {};
    if (!apiKeyDraft.label.trim()) next.label = "Key label is required.";
    if (parseCsv(apiKeyDraft.roles).length === 0) next.roles = "At least one role is required.";
    if (parseCsv(apiKeyDraft.capabilities).length === 0) next.capabilities = "At least one capability is required.";
    return next;
  }, [apiKeyDraft]);
  const rbacErrors = React.useMemo(() => {
    const next: Record<string, string> = {};
    if (!rbacDraft.group.trim()) next.group = "Group is required.";
    if (!rbacDraft.role.trim()) next.role = "Role is required.";
    return next;
  }, [rbacDraft]);

  const createOrUpdateUser = async () => {
    if (Object.keys(userErrors).length > 0 || userDialogMode === "view") return;
    const payload = {
      user_id: userDraft.user_id.trim(),
      display_name: userDraft.display_name.trim(),
      roles: parseCsv(userDraft.roles),
      groups: parseCsv(userDraft.groups),
    };
    if (userDialogMode === "add") {
      await run("user_create", async () => {
        const out = await api.callTool("admin_user_create", payload);
        const refreshed = await refreshUsers();
        setUsers(pinFirst(refreshed, (row) => row.user_id === payload.user_id));
        setUsersPage(1);
        return out;
      });
    } else {
      await run("user_update", async () => {
        const out = await api.callTool("admin_user_update", payload);
        await refreshUsers();
        return out;
      });
    }
    setUserDialogOpen(false);
  };

  const createOrUpdateGroup = async () => {
    if (Object.keys(groupErrors).length > 0 || groupDialogMode === "view") return;
    const payload = {
      group_id: groupDraft.group_id.trim(),
      description: groupDraft.description.trim(),
      roles: parseCsv(groupDraft.roles),
      members: parseCsv(groupDraft.members),
    };
    if (groupDialogMode === "add") {
      await run("group_create", async () => {
        const out = await api.callTool("admin_group_create", payload);
        const refreshed = await refreshGroups();
        setGroups(pinFirst(refreshed, (row) => row.group_id === payload.group_id));
        setGroupsPage(1);
        return out;
      });
    } else {
      await run("group_update", async () => {
        const out = await api.callTool("admin_group_update", payload);
        await refreshGroups();
        return out;
      });
    }
    setGroupDialogOpen(false);
  };

  const createApiKey = async () => {
    if (Object.keys(apiKeyErrors).length > 0 || apiKeyDialogMode === "view") return;
    await run("api_key_create", async () => {
      const out = (await api.callTool("admin_api_key_create", {
        label: apiKeyDraft.label.trim(),
        user_id: apiKeyDraft.user_id.trim() || undefined,
        roles: parseCsv(apiKeyDraft.roles),
        capabilities: parseCsv(apiKeyDraft.capabilities),
      })) as JsonRecord;
      const created = asApiKeyRecord(out.api_key);
      setLatestIssuedToken(created.token ?? "");
      const refreshed = await refreshApiKeys();
      setApiKeys(pinFirst(refreshed, (row) => row.key_id === created.key_id));
      setApiKeysPage(1);
      return out;
    });
    setApiKeyDialogOpen(false);
  };

  const createBinding = async () => {
    if (Object.keys(rbacErrors).length > 0 || rbacDialogMode === "view") return;
    await run("rbac_bind", async () => {
      const out = await api.callTool("admin_rbac_bind", {
        entity_type: "group",
        entity_id: rbacDraft.group.trim(),
        role: rbacDraft.role.trim(),
      });
      const refreshed = await refreshBindings();
      const targetKey = `group:${rbacDraft.group.trim()}:${rbacDraft.role.trim()}`;
      setRbacBindings(
        pinFirst(refreshed, (row) => `${row.entity_type}:${row.entity_id}:${row.role}` === targetKey)
      );
      setRbacPage(1);
      return out;
    });
    setRbacDialogOpen(false);
  };

  const deleteUser = async (userId: string) => {
    await run("user_delete", async () => {
      const out = await api.callTool("admin_user_delete", { user_id: userId });
      await refreshUsers();
      return out;
    });
  };

  const deleteGroup = async (groupId: string) => {
    setGroups((prev) => prev.filter((g) => g.group_id !== groupId));
    try {
      await api.callTool("admin_group_delete", { group_id: groupId });
    } catch { /* row already removed from UI */ }
  };

  const revokeApiKey = async (keyId: string) => {
    await run("api_key_revoke", async () => {
      const out = await api.callTool("admin_api_key_revoke", { key_id: keyId });
      await refreshApiKeys();
      return out;
    });
  };

  const unbindRole = async (binding: RbacBindingRecord) => {
    await run("rbac_unbind", async () => {
      const out = await api.callTool("admin_rbac_unbind", {
        entity_type: binding.entity_type,
        entity_id: binding.entity_id,
        role: binding.role,
      });
      await refreshBindings();
      return out;
    });
  };

  const userColumns: DataColumn<UserRecord>[] = [
    {
      id: "user_id",
      header: "Username",
      cell: (row) => (
        <span className="cursor-pointer text-primary underline-offset-4 hover:underline" onClick={() => {
          setSelectedRelated(row.groups.map((group) => ({ id: group, label: `Group: ${group}` })));
          setUserDraft({ user_id: row.user_id, display_name: row.display_name, roles: row.roles.join(","), groups: row.groups.join(",") });
          setUserDialogMode("edit");
          setUserDialogOpen(true);
        }}>
          {row.user_id}
        </span>
      ),
      sortable: true,
      sortValue: (row) => row.user_id,
    },
    { id: "display_name", header: "Display Name", cell: (row) => row.display_name },
    { id: "email", header: "Email", cell: (row) => (row as unknown as JsonRecord).email ? String((row as unknown as JsonRecord).email) : "—" },
    {
      id: "role",
      header: "Role",
      cell: (row) => (
        <div className="flex flex-wrap gap-1">
          {row.roles.map((r) => <Badge key={r} variant="default" role="status">{r}</Badge>)}
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: (row) => <Badge variant={row.enabled !== false ? "default" : "secondary"}>{row.enabled !== false ? "Active" : "Disabled"}</Badge>,
      sortable: true,
      sortValue: (row) => row.enabled !== false ? "a" : "z",
    },
    { id: "groups", header: "Groups", cell: (row) => row.groups.join(", ") || "—" },
    {
      id: "created",
      header: "Created",
      cell: (row) => (row.created_at ? <RelativeTime timestamp={row.created_at} /> : "N/A"),
      sortable: true,
      sortValue: (row) => row.created_at ?? "",
    },
    {
      id: "actions",
      header: "Actions",
      cell: (row) => (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => {
            setSelectedRelated(row.groups.map((group) => ({ id: group, label: `Group: ${group}` })));
            setUserDraft({ user_id: row.user_id, display_name: row.display_name, roles: row.roles.join(","), groups: row.groups.join(",") });
            setUserDialogMode("view");
            setUserDialogOpen(true);
          }}>
            View
          </Button>
          <Button size="sm" variant="secondary" onClick={() => {
            setSelectedRelated(row.groups.map((group) => ({ id: group, label: `Group: ${group}` })));
            setUserDraft({ user_id: row.user_id, display_name: row.display_name, roles: row.roles.join(","), groups: row.groups.join(",") });
            setUserDialogMode("edit");
            setUserDialogOpen(true);
          }}>
            Edit
          </Button>
          <Button size="sm" variant="outline" onClick={() => void app.api.callTool(row.enabled !== false ? "user_disable" : "user_enable", { user_id: row.user_id }).then(() => void refreshUsers())}>
            {row.enabled !== false ? "Disable" : "Enable"}
          </Button>
          <Button size="sm" variant="destructive" onClick={() => void deleteUser(row.user_id)}>
            Delete
          </Button>
        </div>
      ),
    },
  ];

  const groupColumns: DataColumn<GroupRecord>[] = [
    {
      id: "group_id",
      header: "Name",
      cell: (row) => (
        <span className="cursor-pointer text-primary underline-offset-4 hover:underline" onClick={() => {
          setSelectedRelated(row.members.map((member) => ({ id: member, label: `Member: ${member}` })));
          setGroupDraft({ group_id: row.group_id, description: row.description, roles: row.roles.join(","), members: row.members.join(",") });
          setGroupDialogMode("edit");
          setGroupDialogOpen(true);
        }}>
          {row.group_id}
        </span>
      ),
      sortable: true,
      sortValue: (row) => row.group_id,
    },
    { id: "description", header: "Description", cell: (row) => row.description || "—" },
    { id: "members", header: "Members", cell: (row) => String(row.members.length) },
    { id: "roles", header: "Roles", cell: (row) => row.roles.join(", ") || "—" },
    {
      id: "status",
      header: "Status",
      cell: () => <Badge variant="default">Active</Badge>,
      sortable: true,
      sortValue: () => "a",
    },
    {
      id: "created",
      header: "Created",
      cell: (row) => (row.created_at ? <RelativeTime timestamp={row.created_at} /> : "N/A"),
      sortable: true,
      sortValue: (row) => row.created_at ?? "",
    },
    {
      id: "actions",
      header: "Actions",
      cell: (row) => (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => {
            setSelectedRelated(row.members.map((member) => ({ id: member, label: `Member: ${member}` })));
            setGroupDraft({ group_id: row.group_id, description: row.description, roles: row.roles.join(","), members: row.members.join(",") });
            setGroupDialogMode("view");
            setGroupDialogOpen(true);
          }}>
            View Members
          </Button>
          <Button size="sm" variant="secondary" onClick={() => {
            setSelectedRelated(row.members.map((member) => ({ id: member, label: `Member: ${member}` })));
            setGroupDraft({ group_id: row.group_id, description: row.description, roles: row.roles.join(","), members: row.members.join(",") });
            setGroupDialogMode("edit");
            setGroupDialogOpen(true);
          }}>
            Edit
          </Button>
          <Button size="sm" variant="destructive" onClick={() => void deleteGroup(row.group_id)}>
            Delete
          </Button>
        </div>
      ),
    },
  ];

  const apiKeyColumns: DataColumn<ApiKeyRecord>[] = [
    {
      id: "label",
      header: "Key Name",
      cell: (row) => (
        <Button variant="link" className="text-left text-primary underline-offset-4 hover:underline" onClick={() => {
          setSelectedRelated([
            { id: row.key_id, label: `Prefix: ${row.key_id}` },
            { id: `${row.key_id}-user`, label: `User: ${row.user_id || "-"}` },
          ]);
          setApiKeyDraft({ label: row.label, user_id: row.user_id ?? "", roles: row.roles.join(","), capabilities: row.capabilities.join(",") });
          setApiKeyDialogMode("view");
          setApiKeyDialogOpen(true);
        }}>
          {row.label}
        </Button>
      ),
      sortable: true,
      sortValue: (row) => row.label,
    },
    { id: "prefix", header: "Prefix", cell: (row) => row.key_id },
    {
      id: "created",
      header: "Created",
      cell: (row) => (row.created_at ? <RelativeTime timestamp={row.created_at} /> : "N/A"),
      sortable: true,
      sortValue: (row) => row.created_at ?? "",
    },
    {
      id: "expires",
      header: "Expires",
      cell: (row) => (row.expires_at ? <RelativeTime timestamp={row.expires_at} /> : "N/A"),
      sortable: true,
      sortValue: (row) => row.expires_at ?? "",
    },
    { id: "status", header: "Status", cell: (row) => <Badge variant={row.revoked ? "destructive" : "default"}>{row.revoked ? "revoked" : "active"}</Badge> },
    {
      id: "actions",
      header: "Actions",
      cell: (row) => (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => {
            setSelectedRelated([
              { id: row.key_id, label: `Prefix: ${row.key_id}` },
              { id: `${row.key_id}-user`, label: `User: ${row.user_id || "-"}` },
            ]);
            setApiKeyDraft({ label: row.label, user_id: row.user_id ?? "", roles: row.roles.join(","), capabilities: row.capabilities.join(",") });
            setApiKeyDialogMode("view");
            setApiKeyDialogOpen(true);
          }}>
            View
          </Button>
          <Button size="sm" variant="destructive" onClick={() => void revokeApiKey(row.key_id)}>
            Revoke
          </Button>
        </div>
      ),
    },
  ];

  const rbacColumns: DataColumn<RbacBindingRecord>[] = [
    { id: "subject", header: "Subject", cell: (row) => `${row.entity_type}:${row.entity_id}` },
    { id: "role", header: "Role", cell: (row) => row.role },
    { id: "resource", header: "Resource", cell: () => "index-retriever" },
    {
      id: "created",
      header: "Created",
      cell: (row) => (row.created_at ? <RelativeTime timestamp={row.created_at} /> : "N/A"),
      sortable: true,
      sortValue: (row) => row.created_at ?? "",
    },
    {
      id: "actions",
      header: "Actions",
      cell: (row) => (
        <Button size="sm" variant="destructive" aria-label="Remove" onClick={() => void unbindRole(row)}>
          Remove
        </Button>
      ),
    },
  ];

  const eventColumns: DataColumn<ConfigEventRecord>[] = [
    {
      id: "entity",
      header: "Entity",
      cell: (row) => (
        <span title={`${row.entity_type}:${row.entity_id}`}>
          {row.entity_type}:{shortEntityId(row.entity_id)}
        </span>
      ),
    },
    { id: "action", header: "Action", cell: (row) => row.action },
    { id: "actor", header: "Actor", cell: (row) => row.actor ?? "-" },
    {
      id: "timestamp",
      header: "Timestamp",
      cell: (row) => (row.timestamp ? <RelativeTime timestamp={row.timestamp} /> : "N/A"),
      sortable: true,
      sortValue: (row) => row.timestamp ?? "",
    },
  ];

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold">
          {section === "users"
            ? "Users"
            : section === "groups"
              ? "Groups"
              : section === "api-keys"
                ? "API Keys"
                : section === "rbac"
                  ? "RBAC"
                  : "Security"}
        </h1>
        <Button variant="secondary" size="sm" onClick={() => void refreshAll()}>
          Refresh Security Data
        </Button>
      </header>

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

      {(section === "all" || section === "users") ? <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Users</h2>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => { setUserDraft(EMPTY_USER); setUserDialogMode("add"); setUserDialogOpen(true); }}>Add User</Button>
            <Button variant="secondary" size="sm" onClick={() => void refreshUsers()}>Refresh</Button>
          </div>
          <DataTable
            tableId="users-table"
            ariaLabel="users table"
            rows={users}
            getRowId={(row) => row.user_id}
            columns={userColumns}
            emptyMessage="No users yet."
            page={usersPage}
            onPageChange={setUsersPage}
            pageSize={usersPageSize}
            onPageSizeChange={setUsersPageSize}
            selectable={true}
            bulkActions={[{ label: "Delete Selected", action: "delete" }]}
            onBulkAction={(_action, ids) => void (async () => { for (const row of users.filter((row) => ids.includes(row.user_id))) await deleteUser(row.user_id); })()}
            columnPickerEnabled={true}
          />
        </CardContent>
      </Card> : null}

      {(section === "all" || section === "groups") ? <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Groups</h2>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => { setGroupDraft(EMPTY_GROUP); setGroupDialogMode("add"); setGroupDialogOpen(true); }}>Add Group</Button>
            <Button variant="secondary" size="sm" onClick={() => void refreshGroups()}>Refresh</Button>
          </div>
          <DataTable
            tableId="groups-table"
            ariaLabel="groups table"
            rows={groups}
            getRowId={(row) => row.group_id}
            columns={groupColumns}
            emptyMessage="No groups yet."
            page={groupsPage}
            onPageChange={setGroupsPage}
            pageSize={groupsPageSize}
            onPageSizeChange={setGroupsPageSize}
            selectable={true}
            bulkActions={[{ label: "Delete Selected", action: "delete" }]}
            onBulkAction={(_action, ids) => void (async () => { for (const row of groups.filter((row) => ids.includes(row.group_id))) await deleteGroup(row.group_id); })()}
            columnPickerEnabled={true}
          />
        </CardContent>
      </Card> : null}

      {(section === "all" || section === "api-keys") ? <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">API Keys</h2>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => { setApiKeyDraft(EMPTY_API_KEY); setApiKeyDialogMode("add"); setApiKeyDialogOpen(true); }}>Create API Key</Button>
            <Button variant="secondary" size="sm" onClick={() => void refreshApiKeys()}>Refresh</Button>
          </div>
          <DataTable
            tableId="api-keys-table"
            ariaLabel="api keys table"
            rows={apiKeys}
            getRowId={(row) => row.key_id}
            columns={apiKeyColumns}
            emptyMessage="No API keys yet."
            page={apiKeysPage}
            onPageChange={setApiKeysPage}
            pageSize={apiKeysPageSize}
            onPageSizeChange={setApiKeysPageSize}
            selectable={true}
            bulkActions={[{ label: "Revoke Selected", action: "revoke" }]}
            onBulkAction={(_action, ids) => void (async () => { for (const row of apiKeys.filter((row) => ids.includes(row.key_id))) await revokeApiKey(row.key_id); })()}
            columnPickerEnabled={true}
          />
          <div className="rounded border p-3">
            <p className="text-sm font-medium">Latest issued token</p>
            <p className="mt-1 break-all text-sm text-muted-foreground">{latestIssuedToken || "No token issued yet."}</p>
          </div>
        </CardContent>
      </Card> : null}

      {(section === "all" || section === "rbac") ? <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">RBAC Bindings</h2>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => { setRbacDraft(EMPTY_RBAC); setRbacDialogMode("add"); setRbacDialogOpen(true); }}>Add Binding</Button>
            <Button variant="secondary" size="sm" onClick={() => void refreshBindings()}>Refresh</Button>
          </div>
          <DataTable
            tableId="rbac-bindings-table"
            ariaLabel="rbac bindings table"
            rows={rbacBindings}
            getRowId={(row) => `${row.entity_type}:${row.entity_id}:${row.role}`}
            columns={rbacColumns}
            emptyMessage="No RBAC bindings yet."
            page={rbacPage}
            onPageChange={setRbacPage}
            pageSize={rbacPageSize}
            onPageSizeChange={setRbacPageSize}
            selectable={false}
            columnPickerEnabled={false}
          />
        </CardContent>
      </Card> : null}

      {section === "all" ? <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Config Events</h2>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button variant="secondary" size="sm" onClick={() => void refreshEvents()}>Refresh</Button>
          <DataTable
            tableId="config-events-list"
            ariaLabel="config events list"
            rows={events}
            getRowId={(row) => `${row.entity_type}:${row.entity_id}:${row.action}:${row.timestamp ?? "na"}`}
            columns={eventColumns}
            emptyMessage="No config events recorded yet."
            page={eventsPage}
            onPageChange={setEventsPage}
            pageSize={eventsPageSize}
            onPageSizeChange={setEventsPageSize}
            columnPickerEnabled={true}
          />
        </CardContent>
      </Card> : null}

      {(section === "all" || selectedRelated.length > 0) ? <RelatedItemsPanel
        title="Related items"
        items={selectedRelated}
        emptyMessage="Select a user, group, or key to inspect related memberships and bindings."
      /> : null}

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Operation result</h2>
        </CardHeader>
        <CardContent>
          <JsonBlock title="result" value={result ?? {}} />
        </CardContent>
      </Card>

      <EntityDialog
        open={userDialogOpen}
        onOpenChange={setUserDialogOpen}
        title={userDialogMode === "add" ? "Add User" : userDialogMode === "edit" ? "Edit User" : "View User"}
        fields={userFields}
        values={userDraft as unknown as Record<string, unknown>}
        errors={userErrors}
        mode={userDialogMode}
        onChange={(name, value) => setUserDraft((current) => ({ ...current, [name]: value }) as UserDraft)}
        onSubmit={() => void createOrUpdateUser()}
        onCancel={() => setUserDialogOpen(false)}
      />

      <EntityDialog
        open={groupDialogOpen}
        onOpenChange={setGroupDialogOpen}
        title={groupDialogMode === "add" ? "Add Group" : groupDialogMode === "edit" ? "Edit Group" : "View Group"}
        fields={groupFields}
        values={groupDraft as unknown as Record<string, unknown>}
        errors={groupErrors}
        mode={groupDialogMode}
        onChange={(name, value) => setGroupDraft((current) => ({ ...current, [name]: value }) as GroupDraft)}
        onSubmit={() => void createOrUpdateGroup()}
        onCancel={() => setGroupDialogOpen(false)}
      />

      <EntityDialog
        open={apiKeyDialogOpen}
        onOpenChange={setApiKeyDialogOpen}
        title={apiKeyDialogMode === "add" ? "Create API Key" : "View API Key"}
        fields={apiKeyFields}
        values={apiKeyDraft as unknown as Record<string, unknown>}
        errors={apiKeyErrors}
        mode={apiKeyDialogMode}
        onChange={(name, value) => setApiKeyDraft((current) => ({ ...current, [name]: value }) as ApiKeyDraft)}
        onSubmit={() => void createApiKey()}
        onCancel={() => setApiKeyDialogOpen(false)}
      />

      <EntityDialog
        open={rbacDialogOpen}
        onOpenChange={setRbacDialogOpen}
        title={rbacDialogMode === "add" ? "Bind Role" : "View Binding"}
        fields={rbacFields}
        values={rbacDraft as unknown as Record<string, unknown>}
        errors={rbacErrors}
        mode={rbacDialogMode}
        idPrefix="rbac"
        onChange={(name, value) => setRbacDraft((current) => ({ ...current, [name]: value }) as RbacDraft)}
        onSubmit={() => void createBinding()}
        onCancel={() => setRbacDialogOpen(false)}
      />
    </div>
  );
}
