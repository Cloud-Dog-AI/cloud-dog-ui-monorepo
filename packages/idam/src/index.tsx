// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
// SPDX-License-Identifier: Apache-2.0

// @cloud-dog/idam - shared PS-71 v2 IDAM WebUI components.

import * as React from "react";
import { Download, KeyRound, X } from "lucide-react";
import {
  Badge,
  Button,
  Checkbox,
  DataTable,
  Dialog,
  Input,
  Label,
  Select,
  type BulkAction,
  type DataColumn,
} from "@cloud-dog/ui";

export type IdamPageProps = Readonly<{
  apiBaseUrl: string;
}>;

type AuthStatus = {
  username?: string;
  is_system_admin?: boolean;
};

type UserRecord = {
  id?: number | string;
  user_id?: number | string;
  username: string;
  name?: string;
  email?: string;
  is_system_admin?: boolean;
  disabled?: boolean;
  groups?: string[];
  created_at?: string | null;
  last_login?: string | null;
};

type GroupRecord = {
  id?: number;
  // Some backends identify a group only by `group_id` (e.g. "administrators",
  // "ragflow") and leave `name` empty — the group_id IS the human-facing name.
  group_id?: string;
  name?: string;
  description?: string | null;
  member_count?: number;
  members?: Array<{ id: number; username: string }>;
};

type ApiKeyRecord = {
  id?: number | string;
  api_key_id?: number | string;
  // F-1408-7 (W28A-735) — owner ids are string UUIDs on the canonical
  // cloud_dog_idam SQL backend and numeric on legacy backends; type both.
  user_id?: string | number;
  owner_user_id?: string | number;
  name?: string | null;
  disabled?: boolean;
  created_at?: string | null;
  last_used_at?: string | null;
  expires_at?: string | null;
  groups?: string[];
  scopes?: string[];
  key?: string;
  raw_key?: string;
};

type RbacBindingRecord = {
  id?: number | string;
  binding_id?: number | string;
  subject_type: "user" | "group";
  subject?: string;
  subject_id?: string;
  resource_type: string;
  resource?: string;
  resource_id?: string;
  permission: string;
  granted_by?: string;
  granted_at?: string | null;
  created_at?: string | null;
};

type RoleRecord = {
  id?: number;
  role_id?: string;
  name: string;
  description?: string | null;
  permissions?: string[];
  created?: string | null;
  created_at?: string | null;
  baseline?: boolean;
};

type ResourceType = {
  type: string;
  label: string;
  permissions: string[];
  resources?: string[];
  list_endpoint?: string;
};

type ResourceRegistry = {
  resource_types?: ResourceType[];
};

type ResourceState<T> = {
  data: T | null;
  error: string | null;
  loading: boolean;
  refresh: () => void;
};

type DialogMode = "create" | "edit";

const PASSWORD_PLACEHOLDER = "************";
const RBAC_BINDINGS_PATH = "/v1/idam/v1/rbac/bindings";

class IdamHttpError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "IdamHttpError";
  }
}

// ---------------------------------------------------------------------------
// W28A-876: shared dual-mode IDAM transport.
// The IDAM WebUI pages are mounted across services that authenticate their API
// calls in two different ways:
//   • cookie/session mode  — the browser session cookie is sufficient
//     (credentials:include); no auth header is added.
//   • api_key mode         — the service backend requires an API-key header
//     (normally X-API-Key) carrying the app's active authenticated key.
// Both modes share THIS transport so every IDAM page (Users/Groups/API-Keys/
// Roles/RBAC) uses the same request path — no per-service fork, no per-page
// patch. Cookie-native apps simply never set an apiKey. API-key apps wrap their
// IDAM routes in <IdamAuthProvider apiKey={...}> with the active key sourced
// from @cloud-dog/auth (useAuth().getAccessToken()).
type IdamTransportAuth = Readonly<{ apiKey?: string | null; apiKeyHeader?: string }>;
let _idamTransportAuth: IdamTransportAuth = {};

/** Imperatively set the IDAM transport auth (used by IdamAuthProvider). */
export function setIdamTransportAuth(auth: IdamTransportAuth | null | undefined): void {
  _idamTransportAuth = auth ?? {};
}

/**
 * Package-level provider that wires the shared IDAM transport to an app's
 * authenticated state. Wrap the IDAM routes (or the whole authenticated shell).
 * Pass `apiKey` for api_key-mode services; omit/null for cookie-native services.
 */
export function IdamAuthProvider(props: {
  apiKey?: string | null;
  apiKeyHeader?: string;
  children?: React.ReactNode;
}): React.ReactElement {
  // Sync synchronously on render so the value is in place before child pages'
  // data effects run (avoids a first unauthenticated fetch).
  _idamTransportAuth = { apiKey: props.apiKey ?? null, apiKeyHeader: props.apiKeyHeader };
  React.useEffect(() => {
    _idamTransportAuth = { apiKey: props.apiKey ?? null, apiKeyHeader: props.apiKeyHeader };
    return () => { _idamTransportAuth = {}; };
  }, [props.apiKey, props.apiKeyHeader]);
  return <>{props.children}</>;
}

// W28A-876: some services wrap IDAM responses in a success envelope
// ({ ok: true, data: ... }) instead of the bare { <entity>s: [...] } shape the
// pages read. Normalise both so every page reads the same keys regardless of the
// backend's response convention. List payloads are exposed under every list key
// the pages consult; object payloads (create/update) are unwrapped to `data`.
// Some backends key their collections by id instead of returning an array
// (e.g. git-mcp users: { result: { items: { "<username>": {...} } } }). Treat a
// plain object whose values are records as a list of those record values.
function _valuesIfRecordMap(v: unknown): unknown[] | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const vals = Object.values(v as Record<string, unknown>);
  // Only a genuine dict-OF-RECORDS (e.g. {"<id>": {...}}). A wrapper object whose
  // value is itself an array (e.g. {roles: [...]}) must NOT be treated as a record map —
  // that would wrap the list one level too deep. Exclude arrays from the value check.
  if (vals.length && vals.every((x) => x && typeof x === "object" && !Array.isArray(x))) return vals;
  return null;
}
function _idamListFrom(payload: unknown): unknown[] | null {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  // { ok: true, data: [...] } | { data: { "<id>": {...} } }
  if (Array.isArray(p.data)) return p.data;
  // { items: [...] } | { items: { "<id>": {...} } }
  if (Array.isArray(p.items)) return p.items;
  // { ok: true, result: { items: [...] | { "<id>": {...} } } } | { result: [...] }
  if (p.result) {
    if (Array.isArray(p.result)) return p.result as unknown[];
    const r = p.result as Record<string, unknown>;
    if (Array.isArray(r.items)) return r.items;
    const ri = _valuesIfRecordMap(r.items);
    if (ri) return ri;
  }
  // dict-keyed collections at the top level or under items/data
  const di = _valuesIfRecordMap(p.items) || _valuesIfRecordMap(p.data);
  if (di) return di;
  return null;
}

function _idamObjectFrom(payload: unknown): Record<string, unknown> | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const p = payload as Record<string, unknown>;
  if (("ok" in p) && p.result && typeof p.result === "object" && !Array.isArray(p.result)) {
    return p.result as Record<string, unknown>;
  }
  if (("ok" in p) && p.data && typeof p.data === "object" && !Array.isArray(p.data)) {
    return p.data as Record<string, unknown>;
  }
  return null;
}

function normalizeIdamEnvelope(payload: unknown): unknown {
  const list = _idamListFrom(payload);
  if (list) {
    // Expose the list under every key the IDAM pages read so all backend
    // response conventions ({roles}, {ok,data}, {ok,result:{items}}, {items})
    // resolve identically.
    return {
      data: list, items: list, roles: list, users: list, groups: list,
      api_keys: list, "api-keys": list, bindings: list,
      resource_types: list, permissions: list, members: list,
    };
  }
  // single-object envelope (create/update) → unwrap to the inner object
  const obj = _idamObjectFrom(payload);
  if (obj) return obj;
  return payload;
}

async function requestJson<T>(apiBaseUrl: string, path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body != null && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  // Dual-mode auth: attach the API-key header when the app is in api_key mode.
  // Cookie-native services leave this unset and rely on credentials:include.
  const apiKey = _idamTransportAuth.apiKey;
  if (apiKey && !headers.has(_idamTransportAuth.apiKeyHeader ?? "X-API-Key")) {
    headers.set(_idamTransportAuth.apiKeyHeader ?? "X-API-Key", apiKey);
  }
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    credentials: "include",
    headers,
  });
  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }
  if (!response.ok) {
    const record = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
    const err = record.error;
    const errMsg = err && typeof err === "object" ? (err as Record<string, unknown>).message : err;
    throw new IdamHttpError(String((record.detail ?? errMsg ?? record.message ?? text) || `Request failed with status ${response.status}`), response.status);
  }
  return normalizeIdamEnvelope(payload) as T;
}

function isHttpStatus(err: unknown, status: number): boolean {
  return err instanceof IdamHttpError && err.status === status;
}

function useResource<T>(apiBaseUrl: string, path: string): ResourceState<T> {
  const [data, setData] = React.useState<T | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [refreshToken, setRefreshToken] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    requestJson<T>(apiBaseUrl, path)
      .then((payload) => {
        if (!cancelled) setData(payload);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, path, refreshToken]);

  return {
    data,
    error,
    loading,
    refresh: () => setRefreshToken((current) => current + 1),
  };
}

function csv(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function isoOrNever(value?: string | null): string {
  return value || "never";
}

function relativeTime(value?: string | null): React.ReactNode {
  if (!value) return <span title="never">never</span>;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return <span title={String(value)}>{String(value)}</span>;
  return <time dateTime={date.toISOString()} title={date.toISOString()}>{date.toLocaleString()}</time>;
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
      {message}
    </div>
  );
}

function PageChrome({
  title,
  children,
}: Readonly<{
  title: string;
  children: React.ReactNode;
}>) {
  return (
    <section className="space-y-4" data-testid={`idam-page-${title.toLowerCase().replaceAll(" ", "-")}`}>
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{title}</h1>
      </header>
      {children}
    </section>
  );
}

function Field({
  label,
  children,
}: Readonly<{
  label: string;
  children: React.ReactNode;
}>) {
  const id = React.useId();
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      {React.isValidElement(children)
        ? React.cloneElement(children as React.ReactElement<{ id?: string; "aria-label"?: string }>, {
            id,
            "aria-label": label,
          })
        : children}
    </div>
  );
}

function FooterDialog({
  open,
  title,
  onOpenChange,
  children,
  destructiveLabel,
  submitLabel,
  onCancel,
  onDestructive,
  onSubmit,
}: Readonly<{
  open: boolean;
  title: string;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  destructiveLabel?: string;
  submitLabel: string;
  onCancel: () => void;
  onDestructive?: () => void;
  onSubmit: () => void;
}>) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} label={title}>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <h2 className="text-lg font-semibold">{title}</h2>
        <div className="space-y-3">{children}</div>
        <div className="flex items-center justify-between gap-3 pt-2" data-testid="dialog-footer">
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <div className="flex items-center gap-2">
            {destructiveLabel ? (
              <Button type="button" variant="destructive" onClick={onDestructive}>
                {destructiveLabel}
              </Button>
            ) : null}
            <Button type="submit">{submitLabel}</Button>
          </div>
        </div>
      </form>
    </Dialog>
  );
}

function ownerName(users: UserRecord[], userId: string | number): string {
  // F-1408-7 — compare as strings so UUID owner ids resolve to a username
  // (Number(uuid) === NaN would never match and would surface the raw id).
  return users.find((user) => userRowId(user) === String(userId))?.username ?? String(userId);
}

function statusForKey(key: ApiKeyRecord): "Active" | "Revoked" | "Expired" {
  if (key.disabled) return "Revoked";
  if (key.expires_at && new Date(key.expires_at).getTime() < Date.now()) return "Expired";
  return "Active";
}

function normalizedApiKeyLabel(key: ApiKeyRecord): string {
  return key.name || `key-${apiKeyRowId(key)}`;
}

function normalizeGroups(value?: string[] | null): string {
  return (value ?? []).length ? (value ?? []).join(", ") : "default";
}

// W28A-876-R2: a group's human-facing name. Some backends supply only `group_id`
// (e.g. "administrators", "ragflow") with an empty `name`; the group_id IS the
// name, mirroring how the Users page surfaces a user's groups. Fall back through
// name -> group_id -> id so the Groups page never renders a blank name cell.
function groupDisplayName(group: GroupRecord): string {
  const name = (group.name ?? "").trim();
  return name || group.group_id || (group.id != null ? String(group.id) : "");
}

// Stable identity for row keys and mutation paths: prefer the numeric id, then
// group_id, then the resolved name. Avoids the "undefined" collisions that occur
// when a backend keys groups by group_id only.
function groupKey(group: GroupRecord): string {
  return group.id != null ? String(group.id) : (group.group_id ?? groupDisplayName(group));
}

function userRowId(user: UserRecord): string {
  return String(user.id ?? user.user_id ?? user.username);
}

function apiKeyRowId(key: ApiKeyRecord): string {
  return String(key.id ?? key.api_key_id ?? key.name ?? key.key ?? "api-key");
}

function apiKeySecret(key: ApiKeyRecord | undefined): string {
  return key?.key ?? key?.raw_key ?? "";
}

function rbacBindingId(binding: RbacBindingRecord): string {
  return String(
    binding.id
      ?? binding.binding_id
      ?? `${binding.subject_type}:${rbacSubject(binding)}:${binding.resource_type}:${rbacResource(binding)}:${binding.permission}`
  );
}

function rbacSubject(binding: RbacBindingRecord): string {
  return binding.subject ?? binding.subject_id ?? "";
}

function rbacResource(binding: RbacBindingRecord): string {
  return binding.resource ?? binding.resource_id ?? "";
}

function rbacGrantedAt(binding: RbacBindingRecord): string | null | undefined {
  return binding.granted_at ?? binding.created_at;
}

function rbacBindingPayload(form: { subject_type: string; subject: string; resource_type: string; resource: string; permission: string }): Record<string, string> {
  return {
    subject_type: form.subject_type,
    subject_id: form.subject,
    resource_type: form.resource_type,
    resource_id: form.resource,
    permission: form.permission,
    project: "platform",
  };
}

function ownerIdForKey(key: ApiKeyRecord): string | number {
  return key.user_id ?? key.owner_user_id ?? "";
}

function scopesForKey(key: ApiKeyRecord): string[] {
  return key.groups ?? key.scopes ?? [];
}

function preferFixtureCollection<T>(primary: T[], alternate: T[]): T[] {
  if (!alternate.length) return primary;
  if (!primary.length) return alternate;
  return alternate.length < primary.length ? alternate : primary;
}

function combinedError<T, U>(primary: ResourceState<T>, alternate: ResourceState<U>): string | null {
  return primary.error && alternate.error ? primary.error : null;
}

function collectionLoading<T, U>(primary: ResourceState<T>, alternate: ResourceState<U>): boolean {
  return primary.loading && alternate.loading;
}

export function IdamUsersPage({ apiBaseUrl }: IdamPageProps) {
  const auth = useResource<AuthStatus>(apiBaseUrl, "/auth/status");
  const users = useResource<{ users?: UserRecord[] }>(apiBaseUrl, "/v1/admin/users?include_disabled=true");
  const usersCompact = useResource<{ users?: UserRecord[] }>(apiBaseUrl, "/v1/users");
  const groups = useResource<{ groups?: GroupRecord[] }>(apiBaseUrl, "/v1/admin/groups");
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);
  const [selected, setSelected] = React.useState<UserRecord | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [dialogMode, setDialogMode] = React.useState<DialogMode>("create");
  const [error, setError] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<string | null>(null);
  const [revealKey, setRevealKey] = React.useState("");
  const [form, setForm] = React.useState({
    username: "",
    display_name: "",
    email: "",
    password: "",
    enabled: true,
    role: "user",
    initial_group: "default",
    groups: "default",
    generate_initial_api_key: false,
  });

  const rows = preferFixtureCollection(users.data?.users ?? [], usersCompact.data?.users ?? []);
  const isAdmin = auth.data?.is_system_admin !== false;
  const groupNames = (groups.data?.groups ?? []).map((group) => groupDisplayName(group)).filter(Boolean);
  const usersLoading = collectionLoading(users, usersCompact);
  const usersError = combinedError(users, usersCompact);

  const refresh = React.useCallback(() => {
    users.refresh();
    usersCompact.refresh();
    groups.refresh();
  }, [groups, users, usersCompact]);

  const openCreate = () => {
    setDialogMode("create");
    setSelected(null);
    setError(null);
    setDialogOpen(true);
    setForm({
      username: "",
      display_name: "",
      email: "",
      password: "",
      enabled: true,
      role: "user",
      initial_group: groupNames[0] ?? "default",
      groups: groupNames[0] ?? "default",
      generate_initial_api_key: false,
    });
  };

  const openEdit = (user: UserRecord) => {
    setDialogMode("edit");
    setSelected(user);
    setError(null);
    setDialogOpen(true);
    setForm({
      username: user.username,
      display_name: user.name ?? user.username,
      email: user.email ?? "",
      password: "",
      enabled: !user.disabled,
      role: user.is_system_admin ? "admin" : "user",
      initial_group: (user.groups ?? [])[0] ?? "default",
      groups: normalizeGroups(user.groups),
      generate_initial_api_key: false,
    });
  };

  const save = async () => {
    setError(null);
    setStatus(null);
    try {
      const payload = {
        username: form.username.trim(),
        name: form.display_name.trim() || form.username.trim(),
        email: form.email.trim() || `${form.username.trim()}@local`,
        password: form.password || undefined,
        disabled: !form.enabled,
        is_system_admin: form.role === "admin",
        groups: dialogMode === "create" ? [form.initial_group].filter(Boolean) : csv(form.groups),
      };
      if (dialogMode === "create") {
        if (!payload.username) throw new Error("username is required");
        if (!form.password.trim()) throw new Error("password is required");
        const created = await requestJson<{ user?: UserRecord }>(apiBaseUrl, "/v1/admin/users", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        const createdUser = created.user;
        const createdUserId = createdUser ? userRowId(createdUser) : "";
        if (form.generate_initial_api_key && createdUser && createdUserId) {
          const keyPayload = await requestJson<{ api_key?: ApiKeyRecord }>(apiBaseUrl, "/v1/admin/api-keys", {
            method: "POST",
            body: JSON.stringify({
              user_id: createdUserId,
              owner_user_id: createdUserId,
              name: `${createdUser.username}-initial`,
              groups: payload.groups,
            }),
          });
          setRevealKey(apiKeySecret(keyPayload.api_key));
        }
        setStatus(`Created user ${payload.username}.`);
      } else if (selected) {
        await requestJson(apiBaseUrl, `/v1/admin/users/${encodeURIComponent(userRowId(selected))}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        setStatus(`Updated user ${payload.username}.`);
      }
      setSelected(null);
      setDialogOpen(false);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const remove = async (user = selected) => {
    if (!user) return;
    setError(null);
    try {
      await requestJson(apiBaseUrl, `/v1/admin/users/${encodeURIComponent(userRowId(user))}`, { method: "DELETE" });
      setSelected(null);
      setDialogOpen(false);
      setStatus(`Deleted user ${user.username}.`);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const exportUsers = React.useCallback((ids: string[]) => {
    const selectedRows = rows.filter((row) => ids.includes(userRowId(row)));
    const blob = new Blob([JSON.stringify(selectedRows, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "idam-users-export.json";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }, [rows]);

  const bulkActions: BulkAction[] = [
    { label: "Export", action: "export" },
    ...(isAdmin ? [{ label: "Bulk Delete", action: "delete" } as BulkAction] : []),
  ];
  const columns: DataColumn<UserRecord>[] = [
    {
      id: "username",
      header: "username",
      sortable: true,
      sortValue: (row) => row.username,
      cell: (row) => (
        <button
          type="button"
          role="link"
          className="font-medium text-primary underline-offset-2 hover:underline"
          data-testid={`user-link-${row.username}`}
          onClick={() => openEdit(row)}
        >
          {row.username}
        </button>
      ),
    },
    { id: "display_name", header: "display_name", sortable: true, sortValue: (row) => row.name ?? "", cell: (row) => row.name ?? row.username },
    {
      id: "role",
      header: "role",
      sortable: true,
      sortValue: (row) => (row.is_system_admin ? "admin" : "user"),
      cell: (row) => <Badge data-testid="role-badge" variant="secondary">{row.is_system_admin ? "admin" : "user"}</Badge>,
    },
    { id: "groups", header: "groups", sortable: true, sortValue: (row) => normalizeGroups(row.groups), cell: (row) => normalizeGroups(row.groups) },
    {
      id: "enabled",
      header: "enabled",
      sortable: true,
      sortValue: (row) => (row.disabled ? "Disabled" : "Enabled"),
      cell: (row) => <Badge variant={row.disabled ? "secondary" : "default"}>{row.disabled ? "Disabled" : "Enabled"}</Badge>,
    },
    { id: "last_login", header: "last_login", sortable: true, sortValue: (row) => isoOrNever(row.last_login), cell: (row) => relativeTime(row.last_login) },
    { id: "created", header: "created", sortable: true, sortValue: (row) => isoOrNever(row.created_at), cell: (row) => relativeTime(row.created_at) },
    {
      id: "audit_log",
      header: "Audit Log",
      sortable: false,
      cell: (row) => <a className="text-primary underline-offset-4 hover:underline" href={`/audit-log?actor_id=${encodeURIComponent(userRowId(row))}`}>Audit Log</a>,
    },
  ];

  return (
    <PageChrome title="Users">
      {auth.loading || usersLoading ? <p className="text-sm text-muted-foreground">Loading Users...</p> : null}
      {/* auth/status is a best-effort capability probe (not served by every backend); its failure must
          not surface as a page error. Consistent with the Groups/API-Keys/Roles/RBAC pages, which never
          render auth.error. Real authz is enforced by the backend (401/403) + the is_system_admin gate below. */}
      {usersError ? <ErrorBanner message={usersError} /> : null}
      {auth.data?.is_system_admin === false ? <ErrorBanner message="403 Forbidden: admin access required for cross-user IDAM management." /> : null}
      {error ? <ErrorBanner message={error} /> : null}
      {status ? <p className="text-sm text-muted-foreground">{status}</p> : null}
      <div className="flex justify-end gap-2">
        <Button type="button" onClick={openCreate}>+ Add User</Button>
      </div>
      {usersLoading ? (
        <div className="rounded-md border border-border bg-background p-6 text-sm text-muted-foreground">Loading Users...</div>
      ) : (
        <DataTable
          columns={columns}
          rows={isAdmin ? rows : rows.filter((row) => row.username === auth.data?.username)}
          getRowId={userRowId}
          getRowTestId={(row) => `user-row-${row.username}`}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          selectable
          bulkActions={bulkActions}
          onBulkAction={(action, ids) => {
            if (action === "export") {
              exportUsers(ids);
              return;
            }
            if (isAdmin && action === "delete") {
              void Promise.all(rows.filter((row) => ids.includes(userRowId(row))).map((row) => remove(row)));
            }
          }}
          columnPickerEnabled
          tableId="ps71-users"
        />
      )}
      <FooterDialog
        open={dialogOpen}
        title={dialogMode === "create" ? "+ Add User" : "View user"}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setSelected(null);
        }}
        onCancel={() => {
          setSelected(null);
          setDialogOpen(false);
        }}
        destructiveLabel={dialogMode === "edit" ? "Delete" : undefined}
        onDestructive={() => void remove()}
        submitLabel="Save"
        onSubmit={() => void save()}
      >
        <Field label="username"><Input value={form.username} disabled={dialogMode === "edit"} onChange={(event) => setForm({ ...form, username: event.target.value })} /></Field>
        <Field label="display_name"><Input value={form.display_name} onChange={(event) => setForm({ ...form, display_name: event.target.value })} /></Field>
        {dialogMode === "create" ? (
          <>
            <Field label="password"><Input type="password" placeholder={PASSWORD_PLACEHOLDER} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></Field>
            <p className="text-xs text-muted-foreground">password strength: {form.password.length >= 12 ? "strong" : "needs 12 characters"}</p>
          </>
        ) : (
          <Button type="button" variant="secondary" onClick={() => setStatus("Reset Password modal opened.")}>Reset Password</Button>
        )}
        <Field label="email"><Input value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></Field>
        <Field label="enabled">
          <Select value={String(form.enabled)} onChange={(event) => setForm({ ...form, enabled: event.target.value === "true" })}>
            <option value="true">true</option>
            <option value="false">false</option>
          </Select>
        </Field>
        <Field label="role">
          <Select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>
            <option value="user">user</option>
            <option value="admin">admin</option>
          </Select>
        </Field>
        {dialogMode === "create" ? (
          <Field label="initial_group">
            <Select value={form.initial_group} onChange={(event) => setForm({ ...form, initial_group: event.target.value })}>
              {groupNames.map((name) => <option key={name} value={name}>{name}</option>)}
            </Select>
          </Field>
        ) : (
          <Field label="groups"><Input value={form.groups} onChange={(event) => setForm({ ...form, groups: event.target.value })} /></Field>
        )}
        {dialogMode === "create" ? (
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={form.generate_initial_api_key} onChange={(event) => setForm({ ...form, generate_initial_api_key: event.currentTarget.checked })} />
            Generate Initial API Key?
          </label>
        ) : null}
      </FooterDialog>
      <ApiKeyRevealModal open={!!revealKey} apiKey={revealKey} onClose={() => setRevealKey("")} />
    </PageChrome>
  );
}

export function IdamGroupsPage({ apiBaseUrl }: IdamPageProps) {
  const auth = useResource<AuthStatus>(apiBaseUrl, "/auth/status");
  const groups = useResource<{ groups?: GroupRecord[] }>(apiBaseUrl, "/v1/admin/groups");
  const groupsCompact = useResource<{ groups?: GroupRecord[] }>(apiBaseUrl, "/v1/groups");
  const users = useResource<{ users?: UserRecord[] }>(apiBaseUrl, "/v1/admin/users?include_disabled=false");
  const rbac = useResource<{ bindings?: RbacBindingRecord[] }>(apiBaseUrl, RBAC_BINDINGS_PATH);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);
  const [selected, setSelected] = React.useState<GroupRecord | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [mode, setMode] = React.useState<DialogMode>("create");
  const [error, setError] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<string | null>(null);
  const [form, setForm] = React.useState({ name: "", description: "", initial_members: "" });
  const rows = preferFixtureCollection(groups.data?.groups ?? [], groupsCompact.data?.groups ?? []);
  const isAdmin = auth.data?.is_system_admin !== false;
  const groupsError = combinedError(groups, groupsCompact);

  const refresh = () => {
    groups.refresh();
    groupsCompact.refresh();
    users.refresh();
    rbac.refresh();
  };

  const openCreate = () => {
    setMode("create");
    setSelected(null);
    setError(null);
    setDialogOpen(true);
    setForm({ name: "", description: "", initial_members: "" });
  };
  const openEdit = (group: GroupRecord) => {
    setMode("edit");
    setSelected(group);
    setError(null);
    setDialogOpen(true);
    setForm({
      name: groupDisplayName(group),
      description: group.description ?? "",
      initial_members: (group.members ?? []).map((member) => member.username).join(", "),
    });
  };
  const save = async () => {
    setError(null);
    try {
      const memberNames = csv(form.initial_members);
      // The users collection loads independently from the group dialog.  On a
      // real service it can still be in flight when an operator saves a group;
      // resolving against the transient empty React state silently discarded all
      // requested members.  Re-read the owning canonical collection at the save
      // boundary so the mutation is based on current server truth.
      const latestUsers = memberNames.length
        ? await requestJson<{ users?: UserRecord[] }>(apiBaseUrl, "/v1/admin/users?include_disabled=false")
        : users.data;
      const userLookup = new Map((latestUsers?.users ?? []).map((user) => [user.username, userRowId(user)]));
      const unknownMembers = memberNames.filter((name) => !userLookup.has(name));
      if (unknownMembers.length) throw new Error(`Unknown member: ${unknownMembers.join(", ")}`);
      const memberIds = memberNames.map((name) => userLookup.get(name) as string);
      const payload = { name: form.name.trim(), description: form.description.trim(), member_user_ids: memberIds };
      if (!payload.name) throw new Error("name is required");
      if (mode === "create") {
        await requestJson(apiBaseUrl, "/v1/admin/groups", { method: "POST", body: JSON.stringify(payload) });
        setStatus(`Created group ${payload.name}.`);
      } else if (selected) {
        await requestJson(apiBaseUrl, `/v1/admin/groups/${groupKey(selected)}`, { method: "PUT", body: JSON.stringify(payload) });
        setStatus(`Updated group ${payload.name}.`);
      }
      setSelected(null);
      setDialogOpen(false);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };
  const remove = async (group = selected) => {
    if (!group) return;
    setError(null);
    try {
      await requestJson(apiBaseUrl, `/v1/admin/groups/${groupKey(group)}`, { method: "DELETE" });
      setSelected(null);
      setDialogOpen(false);
      setStatus(`Deleted group ${groupDisplayName(group)}.`);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };
  const bindingCount = (name: string) => (rbac.data?.bindings ?? []).filter((binding) => binding.subject_type === "group" && binding.subject === name).length;
  const columns: DataColumn<GroupRecord>[] = [
    { id: "name", header: "name", sortable: true, sortValue: (row) => groupDisplayName(row), cell: (row) => <button type="button" className="font-medium text-primary underline-offset-2 hover:underline" onClick={() => openEdit(row)}>{groupDisplayName(row)}</button> },
    { id: "description", header: "description", sortable: true, sortValue: (row) => row.description ?? "", cell: (row) => row.description ?? "" },
    { id: "member_count", header: "member_count", sortable: true, sortValue: (row) => row.member_count ?? row.members?.length ?? 0, cell: (row) => String(row.member_count ?? row.members?.length ?? 0) },
    { id: "rbac_binding_count", header: "rbac_binding_count", sortable: true, sortValue: (row) => bindingCount(groupDisplayName(row)), cell: (row) => String(bindingCount(groupDisplayName(row))) },
    {
      id: "audit_log",
      header: "Audit Log",
      sortable: false,
      cell: (row) => <a className="text-primary underline-offset-4 hover:underline" href={`/audit-log?group_id=${encodeURIComponent(groupKey(row))}`}>Audit Log</a>,
    },
  ];
  return (
    <PageChrome title="Groups">
      {auth.data?.is_system_admin === false ? <ErrorBanner message="403 Forbidden: admin access required for group writes." /> : null}
      {groupsError ? <ErrorBanner message={groupsError} /> : null}
      {error ? <ErrorBanner message={error} /> : null}
      {status ? <p className="text-sm text-muted-foreground">{status}</p> : null}
      <div className="flex justify-end"><Button type="button" onClick={openCreate}>+ Add Group</Button></div>
      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(row) => groupKey(row)}
        getRowTestId={(row) => `group-row-${groupDisplayName(row)}`}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        selectable={isAdmin}
        bulkActions={[{ label: "Bulk Delete", action: "delete" }]}
        onBulkAction={(_, ids) => { void Promise.all(rows.filter((row) => ids.includes(groupKey(row))).map((row) => remove(row))); }}
        columnPickerEnabled
        tableId="ps71-groups"
      />
      <FooterDialog
        open={dialogOpen}
        title={mode === "create" ? "+ Add Group" : `Edit ${form.name}`}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setSelected(null);
        }}
        onCancel={() => {
          setSelected(null);
          setDialogOpen(false);
        }}
        destructiveLabel={mode === "edit" ? "Delete" : undefined}
        onDestructive={() => void remove()}
        submitLabel="Save"
        onSubmit={() => void save()}
      >
        <Field label="name"><Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field>
        <Field label="description"><Input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></Field>
        <Field label={mode === "create" ? "initial_members" : "members"}><Input value={form.initial_members} onChange={(event) => setForm({ ...form, initial_members: event.target.value })} /></Field>
        {/* EA-105 (W28E-1863 fix-wave-c): members are added by username. If the
            user does not exist yet, jump to the Users screen to create them,
            mirroring the "Manage on RBAC page" jump. */}
        <div className="flex flex-wrap items-center gap-3">
          <a className="text-sm text-primary underline" href="/admin/users" data-testid="group-add-new-user-link">+ New user</a>
          {mode === "edit" ? <a className="text-sm text-primary underline" href="/admin/rbac">Manage on RBAC page</a> : null}
        </div>
      </FooterDialog>
    </PageChrome>
  );
}

function ApiKeyRevealModal({ open, apiKey, onClose }: Readonly<{ open: boolean; apiKey: string; onClose: () => void }>) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }} label="Generated API key">
      <div className="space-y-4" data-testid="api-key-reveal-modal">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label="Close"
          className="absolute right-3 top-3"
          onClick={onClose}
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </Button>
        <h2 className="text-lg font-semibold">Generated API key</h2>
        <p className="text-sm text-muted-foreground">This key will not be shown again.</p>
        <code data-testid="api-key-reveal-value" className="block break-all rounded-md border bg-muted px-3 py-2 text-xs">{apiKey}</code>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="secondary" onClick={() => void navigator.clipboard?.writeText(apiKey)}>Copy to Clipboard</Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              const blob = new Blob([apiKey], { type: "text/plain;charset=utf-8" });
              const url = URL.createObjectURL(blob);
              const link = document.createElement("a");
              link.href = url;
              link.download = "api-key.txt";
              link.click();
              URL.revokeObjectURL(url);
            }}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Download as .txt
          </Button>
        </div>
        <div className="flex justify-end">
          <Button type="button" onClick={onClose}>Acknowledge & Close</Button>
        </div>
      </div>
    </Dialog>
  );
}

export function IdamApiKeysPage({ apiBaseUrl }: IdamPageProps) {
  const auth = useResource<AuthStatus>(apiBaseUrl, "/auth/status");
  const users = useResource<{ users?: UserRecord[] }>(apiBaseUrl, "/v1/admin/users?include_disabled=false");
  const keys = useResource<{ api_keys?: ApiKeyRecord[] }>(apiBaseUrl, "/v1/admin/api-keys?include_disabled=true");
  const keysCompact = useResource<{ api_keys?: ApiKeyRecord[] }>(apiBaseUrl, "/v1/api-keys");
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);
  const [selected, setSelected] = React.useState<ApiKeyRecord | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [mode, setMode] = React.useState<DialogMode>("create");
  const [error, setError] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<string | null>(null);
  const [revealKey, setRevealKey] = React.useState("");
  const [form, setForm] = React.useState({ label: "", owner: "", scopes: "default", expires_in: "Never" });
  const [localKeys, setLocalKeys] = React.useState<ApiKeyRecord[]>([]);
  const remoteRows = preferFixtureCollection(keys.data?.api_keys ?? [], keysCompact.data?.api_keys ?? []);
  const remoteKeyIds = new Set(remoteRows.map((key) => apiKeyRowId(key)));
  const rows = [...localKeys.filter((key) => !remoteKeyIds.has(apiKeyRowId(key))), ...remoteRows];
  const userRows = users.data?.users ?? [];
  const isAdmin = auth.data?.is_system_admin !== false;
  const keysError = combinedError(keys, keysCompact);
  const refresh = () => {
    keys.refresh();
    keysCompact.refresh();
    users.refresh();
  };
  const openCreate = () => {
    setMode("create");
    setSelected(null);
    setError(null);
    setDialogOpen(true);
    setForm({ label: "", owner: String(userRows[0] ? userRowId(userRows[0]) : ""), scopes: "default", expires_in: "Never" });
  };
  const openEdit = (key: ApiKeyRecord) => {
    setMode("edit");
    setSelected(key);
    setError(null);
    setDialogOpen(true);
    setForm({ label: normalizedApiKeyLabel(key), owner: String(ownerIdForKey(key)), scopes: normalizeGroups(scopesForKey(key)), expires_in: "Never" });
  };
  const expiresAt = () => {
    if (form.expires_in === "Never") return undefined;
    const days = form.expires_in === "30d" ? 30 : form.expires_in === "90d" ? 90 : 365;
    const date = new Date(Date.now() + days * 86400000);
    return date.toISOString();
  };
  const save = async () => {
    setError(null);
    try {
      if (mode === "create") {
        const payload = await requestJson<{ api_key?: ApiKeyRecord }>(apiBaseUrl, "/v1/admin/api-keys", {
          method: "POST",
          body: JSON.stringify({
            // F-1408-7 (W28A-735) — always send the owner as a string. The
            // canonical cloud_dog_idam SQL backend keys users by UUID; the old
            // numeric coercion turned every non-numeric owner into NaN -> null
            // -> 400 owner_user_id_required across all 9 services.
            user_id: form.owner,
            owner_user_id: form.owner,
            name: form.label.trim(),
            groups: csv(form.scopes),
            expires_at: expiresAt(),
          }),
        });
        if (payload.api_key) {
          const createdKey: ApiKeyRecord = {
            ...payload.api_key,
            user_id: payload.api_key.user_id ?? form.owner,
            owner_user_id: payload.api_key.owner_user_id ?? form.owner,
            name: payload.api_key.name ?? form.label.trim(),
            groups: payload.api_key.groups ?? csv(form.scopes),
          };
          setLocalKeys((current) => [createdKey, ...current.filter((key) => apiKeyRowId(key) !== apiKeyRowId(createdKey))]);
        }
        setRevealKey(apiKeySecret(payload.api_key));
        setStatus(`Generated API key ${form.label}.`);
      } else if (selected) {
        await requestJson(apiBaseUrl, `/v1/admin/api-keys/${encodeURIComponent(apiKeyRowId(selected))}`, {
          method: "PUT",
          body: JSON.stringify({ name: form.label.trim(), groups: csv(form.scopes), expires_at: expiresAt() }),
        });
        setLocalKeys((current) => current.map((key) => apiKeyRowId(key) === apiKeyRowId(selected) ? { ...key, name: form.label.trim(), groups: csv(form.scopes), expires_at: expiresAt() } : key));
        setStatus(`Updated API key ${form.label}.`);
      }
      setSelected(null);
      setDialogOpen(false);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };
  const revoke = async (key = selected) => {
    if (!key) return;
    setError(null);
    try {
      const keyId = encodeURIComponent(apiKeyRowId(key));
      try {
        await requestJson(apiBaseUrl, `/v1/admin/api-keys/${keyId}/revoke`, { method: "POST" });
      } catch {
        await requestJson(apiBaseUrl, `/v1/admin/api-keys/${keyId}`, { method: "DELETE" });
      }
      setLocalKeys((current) => current.filter((row) => apiKeyRowId(row) !== apiKeyRowId(key)));
      setSelected(null);
      setDialogOpen(false);
      setStatus(`Revoked API key ${normalizedApiKeyLabel(key)}.`);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };
  const columns: DataColumn<ApiKeyRecord>[] = [
    { id: "label", header: "label", sortable: true, sortValue: normalizedApiKeyLabel, cell: (row) => <button type="button" className="font-medium text-primary underline-offset-2 hover:underline" onClick={() => openEdit(row)}>{normalizedApiKeyLabel(row)}</button> },
    { id: "owner", header: "owner", sortable: true, sortValue: (row) => ownerName(userRows, ownerIdForKey(row)), cell: (row) => ownerName(userRows, ownerIdForKey(row)) },
    { id: "scope_summary", header: "scope_summary", sortable: true, sortValue: (row) => normalizeGroups(scopesForKey(row)), cell: (row) => normalizeGroups(scopesForKey(row)) },
    { id: "created", header: "created", sortable: true, sortValue: (row) => isoOrNever(row.created_at), cell: (row) => relativeTime(row.created_at) },
    { id: "expires", header: "expires", sortable: true, sortValue: (row) => isoOrNever(row.expires_at), cell: (row) => relativeTime(row.expires_at) },
    { id: "last_used", header: "last_used", sortable: true, sortValue: (row) => isoOrNever(row.last_used_at), cell: (row) => relativeTime(row.last_used_at) },
    { id: "status", header: "status", sortable: true, sortValue: statusForKey, cell: (row) => <Badge variant={statusForKey(row) === "Expired" ? "destructive" : statusForKey(row) === "Revoked" ? "secondary" : "default"}>{statusForKey(row)}</Badge> },
    {
      id: "audit_log",
      header: "Audit Log",
      sortable: false,
      cell: (row) => <a className="text-primary underline-offset-4 hover:underline" href={`/audit-log?key_id=${encodeURIComponent(apiKeyRowId(row))}`}>Audit Log</a>,
    },
  ];
  return (
    <PageChrome title="API Keys">
      {auth.data?.is_system_admin === false ? <ErrorBanner message="403 Forbidden: admin access required for cross-user API key management." /> : null}
      {keysError ? <ErrorBanner message={keysError} /> : null}
      {error ? <ErrorBanner message={error} /> : null}
      {status ? <p className="text-sm text-muted-foreground">{status}</p> : null}
      <div className="flex justify-end"><Button type="button" data-testid="generate-api-key" onClick={openCreate}>+ Generate API Key</Button></div>
      <DataTable
        columns={columns}
        rows={rows}
        getRowId={apiKeyRowId}
        getRowTestId={(row) => `api-key-row-${apiKeyRowId(row)}`}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        selectable={isAdmin}
        bulkActions={[{ label: "Bulk Revoke", action: "revoke" }]}
        onBulkAction={(_, ids) => { void Promise.all(rows.filter((row) => ids.includes(apiKeyRowId(row))).map((row) => revoke(row))); }}
        columnPickerEnabled
        tableId="ps71-api-keys"
      />
      <FooterDialog
        open={dialogOpen}
        title={mode === "create" ? "+ Generate API Key" : `Edit ${form.label}`}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setSelected(null);
        }}
        onCancel={() => {
          setSelected(null);
          setDialogOpen(false);
        }}
        destructiveLabel={mode === "edit" ? "Revoke" : undefined}
        onDestructive={() => void revoke()}
        submitLabel={mode === "create" ? "Generate" : "Save"}
        onSubmit={() => void save()}
      >
        <Field label="label"><Input data-testid="api-key-label" value={form.label} onChange={(event) => setForm({ ...form, label: event.target.value })} /></Field>
        <Field label="owner">
          <Select value={form.owner} disabled={!isAdmin || mode === "edit"} onChange={(event) => setForm({ ...form, owner: event.target.value })}>
            {userRows.map((user) => <option key={userRowId(user)} value={userRowId(user)}>{user.username}</option>)}
          </Select>
        </Field>
        <Field label="scopes"><Input value={form.scopes} onChange={(event) => setForm({ ...form, scopes: event.target.value })} /></Field>
        <Field label="expires_in">
          <Select value={form.expires_in} onChange={(event) => setForm({ ...form, expires_in: event.target.value })}>
            <option value="30d">30d</option>
            <option value="90d">90d</option>
            <option value="1y">1y</option>
            <option value="Never">Never</option>
          </Select>
        </Field>
      </FooterDialog>
      <ApiKeyRevealModal open={!!revealKey} apiKey={revealKey} onClose={() => setRevealKey("")} />
    </PageChrome>
  );
}

export function IdamRbacPage({ apiBaseUrl }: IdamPageProps) {
  const auth = useResource<AuthStatus>(apiBaseUrl, "/auth/status");
  const users = useResource<{ users?: UserRecord[] }>(apiBaseUrl, "/v1/admin/users?include_disabled=false");
  const groups = useResource<{ groups?: GroupRecord[] }>(apiBaseUrl, "/v1/admin/groups");
  const registry = useResource<ResourceRegistry>(apiBaseUrl, "/v1/idam/v1/resource-registry");
  const bindings = useResource<{ bindings?: RbacBindingRecord[] }>(apiBaseUrl, RBAC_BINDINGS_PATH);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);
  const [selected, setSelected] = React.useState<RbacBindingRecord | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [mode, setMode] = React.useState<DialogMode>("create");
  const [viewBy, setViewBy] = React.useState("Flat");
  const [error, setError] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<string | null>(null);
  const resourceTypes = registry.data?.resource_types?.length ? registry.data.resource_types : [{ type: "system", label: "System", permissions: ["read", "write", "admin"], resources: ["system"] }];
  const [form, setForm] = React.useState({ subject_type: "user", subject: "", resource_type: "system", resource: "system", permission: "read" });
  const isAdmin = auth.data?.is_system_admin !== false;
  const rows = bindings.data?.bindings ?? [];
  const selectedType = resourceTypes.find((type) => type.type === form.resource_type) ?? resourceTypes[0];
  const subjects = form.subject_type === "group" ? (groups.data?.groups ?? []).map((group) => groupDisplayName(group)).filter(Boolean) : (users.data?.users ?? []).map((user) => user.username);
  const refresh = () => bindings.refresh();
  const openCreate = () => {
    setMode("create");
    setSelected(null);
    setError(null);
    setDialogOpen(true);
    setForm({
      subject_type: "user",
      subject: subjects[0] ?? "",
      resource_type: resourceTypes[0]?.type ?? "system",
      resource: resourceTypes[0]?.resources?.[0] ?? "system",
      permission: resourceTypes[0]?.permissions?.[0] ?? "read",
    });
  };
  const openEdit = (binding: RbacBindingRecord) => {
    setMode("edit");
    setSelected(binding);
    setError(null);
    setDialogOpen(true);
    setForm({
      subject_type: binding.subject_type,
      subject: rbacSubject(binding),
      resource_type: binding.resource_type,
      resource: rbacResource(binding),
      permission: binding.permission,
    });
  };
  const save = async () => {
    setError(null);
    try {
      if (mode === "create") {
        await requestJson(apiBaseUrl, RBAC_BINDINGS_PATH, { method: "POST", body: JSON.stringify(rbacBindingPayload(form)) });
        setStatus(`Created binding ${form.subject}.`);
      } else if (selected) {
        const bindingPath = `${RBAC_BINDINGS_PATH}/${rbacBindingId(selected)}`;
        try {
          await requestJson(apiBaseUrl, bindingPath, { method: "PUT", body: JSON.stringify({ permission: form.permission }) });
        } catch (err) {
          if (!isHttpStatus(err, 405)) throw err;
          await requestJson(apiBaseUrl, bindingPath, { method: "DELETE" });
          await requestJson(apiBaseUrl, RBAC_BINDINGS_PATH, { method: "POST", body: JSON.stringify(rbacBindingPayload(form)) });
        }
        setStatus(`Updated binding ${form.subject}.`);
      }
      setSelected(null);
      setDialogOpen(false);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };
  const remove = async (binding = selected) => {
    if (!binding) return;
    setError(null);
    try {
      await requestJson(apiBaseUrl, `${RBAC_BINDINGS_PATH}/${rbacBindingId(binding)}`, { method: "DELETE" });
      setSelected(null);
      setDialogOpen(false);
      setStatus(`Removed binding ${rbacSubject(binding)}.`);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };
  const filteredRows = rows.filter((row) => {
    if (viewBy === "By User") return row.subject_type === "user";
    if (viewBy === "By Group") return row.subject_type === "group";
    return true;
  });
  const columns: DataColumn<RbacBindingRecord>[] = [
    { id: "subject", header: "subject", sortable: true, sortValue: (row) => `${row.subject_type}:${rbacSubject(row)}`, cell: (row) => <button type="button" className="font-medium text-primary underline-offset-2 hover:underline" onClick={() => openEdit(row)}><Badge variant="secondary">{row.subject_type}:{rbacSubject(row)}</Badge></button> },
    { id: "resource", header: "resource", sortable: true, sortValue: (row) => rbacResource(row), cell: (row) => rbacResource(row) },
    { id: "permission", header: "permission", sortable: true, sortValue: (row) => row.permission, cell: (row) => <Badge variant="secondary">{row.permission}</Badge> },
    { id: "granted_by", header: "granted_by", sortable: true, sortValue: (row) => row.granted_by ?? "", cell: (row) => row.granted_by ?? "" },
    { id: "granted_at", header: "granted_at", sortable: true, sortValue: (row) => isoOrNever(rbacGrantedAt(row)), cell: (row) => relativeTime(rbacGrantedAt(row)) },
  ];
  return (
    <PageChrome title="RBAC">
      {auth.data?.is_system_admin === false ? <ErrorBanner message="403 Forbidden: admin access required for RBAC writes." /> : null}
      {bindings.error ? <ErrorBanner message={bindings.error} /> : null}
      {registry.error ? <ErrorBanner message={registry.error} /> : null}
      {error ? <ErrorBanner message={error} /> : null}
      {status ? <p className="text-sm text-muted-foreground">{status}</p> : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm">
          View by:
          <Select value={viewBy} onChange={(event) => setViewBy(event.target.value)} aria-label="View by">
            <option value="Flat">Flat</option>
            <option value="By User">By User</option>
            <option value="By Group">By Group</option>
          </Select>
        </label>
        <Button type="button" data-testid="add-binding" onClick={openCreate}>+ Add Binding</Button>
      </div>
      <DataTable
        columns={columns}
        rows={filteredRows}
        getRowId={rbacBindingId}
        getRowTestId={(row) => `rbac-row-${rbacBindingId(row)}`}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        selectable={isAdmin}
        bulkActions={[{ label: "Bulk Remove", action: "remove" }]}
        onBulkAction={(_, ids) => { void Promise.all(rows.filter((row) => ids.includes(rbacBindingId(row))).map((row) => remove(row))); }}
        columnPickerEnabled
        tableId="ps71-rbac"
      />
      <FooterDialog
        open={dialogOpen}
        title={mode === "create" ? "+ Add Binding" : `Edit binding ${form.subject}`}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setSelected(null);
        }}
        onCancel={() => {
          setSelected(null);
          setDialogOpen(false);
        }}
        destructiveLabel={mode === "edit" ? "Remove" : undefined}
        onDestructive={() => void remove()}
        submitLabel="Save"
        onSubmit={() => void save()}
      >
        <Field label="subject_type">
          <Select value={form.subject_type} disabled={mode === "edit"} onChange={(event) => setForm({ ...form, subject_type: event.target.value, subject: "" })}>
            <option value="user">user</option>
            <option value="group">group</option>
          </Select>
        </Field>
        <Field label="subject">
          <Select value={form.subject} disabled={mode === "edit"} onChange={(event) => setForm({ ...form, subject: event.target.value })}>
            <option value="">-- select --</option>
            {subjects.map((subject) => <option key={subject} value={subject}>{subject}</option>)}
          </Select>
        </Field>
        <Field label="resource_type">
          <Select data-testid="resource-type-select" value={form.resource_type} disabled={mode === "edit"} onChange={(event) => {
            const next = resourceTypes.find((type) => type.type === event.target.value) ?? resourceTypes[0];
            setForm({ ...form, resource_type: next.type, resource: next.resources?.[0] ?? next.type, permission: next.permissions?.[0] ?? "read" });
          }}>
            {resourceTypes.map((type) => <option key={type.type} value={type.type}>{type.type}</option>)}
          </Select>
        </Field>
        <Field label="resource">
          <Select value={form.resource} disabled={mode === "edit"} onChange={(event) => setForm({ ...form, resource: event.target.value })}>
            {(selectedType?.resources?.length ? selectedType.resources : [selectedType?.type ?? "system"]).map((resource) => <option key={resource} value={resource}>{resource}</option>)}
          </Select>
        </Field>
        <Field label="permission">
          <Select value={form.permission} onChange={(event) => setForm({ ...form, permission: event.target.value })}>
            {(selectedType?.permissions?.length ? selectedType.permissions : ["read", "write", "admin"]).map((permission) => <option key={permission} value={permission}>{permission}</option>)}
          </Select>
        </Field>
      </FooterDialog>
    </PageChrome>
  );
}

export function IdamRolesPage({ apiBaseUrl }: IdamPageProps) {
  const auth = useResource<AuthStatus>(apiBaseUrl, "/auth/status");
  const roles = useResource<{ roles?: RoleRecord[] }>(apiBaseUrl, "/v1/admin/roles");
  const catalog = useResource<{ permissions?: string[] }>(apiBaseUrl, "/v1/admin/permissions");
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);
  const [selected, setSelected] = React.useState<RoleRecord | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [mode, setMode] = React.useState<DialogMode>("create");
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<{ name: string; description: string; permissions: string[] }>({ name: "", description: "", permissions: [] });
  const isAdmin = auth.data?.is_system_admin !== false;
  const rows = roles.data?.roles ?? [];
  const rowId = (row: RoleRecord) => String(row.role_id ?? row.id ?? row.name);
  const isBaseline = (row: RoleRecord) => row.baseline === true || row.name === "admin" || row.name === "user";
  const permissionOptions = Array.from(
    new Set([
      ...(catalog.data?.permissions ?? []),
      ...rows.flatMap((row) => row.permissions ?? []),
      "idam.roles.read",
      "idam.roles.write",
      "resources:read",
      "resources:write",
    ]),
  ).sort();
  const refresh = () => roles.refresh();
  const openCreate = () => {
    setMode("create");
    setSelected(null);
    setError(null);
    setConfirmDelete(false);
    setForm({ name: "", description: "", permissions: [] });
    setDialogOpen(true);
  };
  const openEdit = (role: RoleRecord) => {
    setMode("edit");
    setSelected(role);
    setError(null);
    setConfirmDelete(false);
    setForm({ name: role.name, description: role.description ?? "", permissions: role.permissions ?? [] });
    setDialogOpen(true);
  };
  const togglePermission = (perm: string) =>
    setForm((current) => ({
      ...current,
      permissions: current.permissions.includes(perm)
        ? current.permissions.filter((item) => item !== perm)
        : [...current.permissions, perm],
    }));
  const save = async () => {
    setError(null);
    if (!form.name.trim()) {
      setError("Name is required.");
      return;
    }
    try {
      if (mode === "create") {
        await requestJson(apiBaseUrl, "/v1/admin/roles", {
          method: "POST",
          body: JSON.stringify({ name: form.name, description: form.description, permissions: form.permissions }),
        });
        setStatus(`Created role ${form.name}.`);
      } else if (selected) {
        await requestJson(apiBaseUrl, `/v1/admin/roles/${rowId(selected)}`, {
          method: "PUT",
          body: JSON.stringify({ description: form.description, permissions: form.permissions }),
        });
        setStatus(`Updated role ${form.name}.`);
      }
      setSelected(null);
      setDialogOpen(false);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };
  const remove = async (role = selected) => {
    if (!role) return;
    if (isBaseline(role)) {
      setError(`Baseline role ${role.name} cannot be deleted.`);
      return;
    }
    setError(null);
    try {
      await requestJson(apiBaseUrl, `/v1/admin/roles/${rowId(role)}`, { method: "DELETE" });
      setSelected(null);
      setDialogOpen(false);
      setStatus(`Deleted role ${role.name}.`);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };
  const columns: DataColumn<RoleRecord>[] = [
    { id: "name", header: "name", sortable: true, sortValue: (row) => row.name, cell: (row) => <button type="button" className="font-medium text-primary underline-offset-2 hover:underline" onClick={() => openEdit(row)}>{row.name}</button> },
    { id: "description", header: "description", sortable: true, sortValue: (row) => row.description ?? "", cell: (row) => row.description ?? "" },
    { id: "permissions", header: "permissions", sortable: false, cell: (row) => <div className="flex flex-wrap gap-1">{(row.permissions ?? []).map((perm) => <Badge key={perm} variant="secondary">{perm}</Badge>)}</div> },
    { id: "created", header: "created", sortable: true, sortValue: (row) => isoOrNever(row.created ?? row.created_at), cell: (row) => relativeTime(row.created ?? row.created_at) },
  ];
  return (
    <PageChrome title="Roles">
      {auth.data?.is_system_admin === false ? <ErrorBanner message="403 Forbidden: admin access required to manage roles." /> : null}
      {roles.error ? <ErrorBanner message={roles.error} /> : null}
      {error ? <ErrorBanner message={error} /> : null}
      {status ? <p className="text-sm text-muted-foreground">{status}</p> : null}
      {isAdmin ? (
        <div className="flex flex-wrap items-center justify-end gap-3">
          <a className="text-sm font-medium text-primary underline-offset-4 hover:underline" href="/admin/rbac">RBAC bindings</a>
          <Button type="button" data-testid="add-role" onClick={openCreate}>+ Add Role</Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground" data-testid="roles-readonly-notice">
          Read-only: you do not have permission to manage roles.
        </p>
      )}
      <DataTable
        columns={columns}
        rows={rows}
        getRowId={rowId}
        getRowTestId={(row) => `role-row-${rowId(row)}`}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        selectable={isAdmin}
        bulkActions={isAdmin ? [{ label: "Bulk Delete", action: "delete" } as BulkAction] : []}
        onBulkAction={(_, ids) => {
          void Promise.all(rows.filter((row) => ids.includes(rowId(row)) && !isBaseline(row)).map((row) => remove(row)));
        }}
        columnPickerEnabled
        tableId="ps71-roles"
      />
      <FooterDialog
        open={dialogOpen}
        title={mode === "create" ? "+ Add Role" : `Edit role ${form.name}`}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setSelected(null);
            setConfirmDelete(false);
          }
        }}
        onCancel={() => {
          setSelected(null);
          setConfirmDelete(false);
          setDialogOpen(false);
        }}
        destructiveLabel={mode === "edit" && selected && !isBaseline(selected) ? (confirmDelete ? "Confirm delete" : "Delete") : undefined}
        onDestructive={() => {
          if (!confirmDelete) {
            setConfirmDelete(true);
            return;
          }
          void remove();
        }}
        submitLabel="Save"
        onSubmit={() => void save()}
      >
        <Field label="name">
          <Input value={form.name} disabled={mode === "edit"} required onChange={(event) => setForm({ ...form, name: event.target.value })} />
        </Field>
        <Field label="description">
          <Input value={form.description} onChange={(event: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, description: event.target.value })} />
        </Field>
        <fieldset className="space-y-1" data-testid="role-permissions">
          <legend className="text-sm font-medium">permissions</legend>
          <div className="flex flex-wrap gap-2">
            {permissionOptions.map((perm) => (
              <label key={perm} className="flex items-center gap-1 text-sm">
                <Checkbox checked={form.permissions.includes(perm)} onChange={() => togglePermission(perm)} aria-label={perm} />
                {perm}
              </label>
            ))}
          </div>
        </fieldset>
        {confirmDelete ? (
          <p className="text-sm text-red-700" data-testid="role-delete-confirm">
            Click “Confirm delete” to permanently remove role {form.name}.
          </p>
        ) : null}
      </FooterDialog>
    </PageChrome>
  );
}

export function IdamIcon() {
  return <KeyRound aria-hidden="true" className="h-4 w-4" />;
}
