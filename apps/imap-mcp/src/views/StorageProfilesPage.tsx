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

// @cloud-dog/app-imap-mcp — IMAP channel CRUD using shared DataTable and EntityDialog.

import * as React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@cloud-dog/auth";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  DataTable,
  DropdownMenu,
  EntityDialog,
  JsonExplorer,
  RelativeTime,
  formatBytes,
  type DataColumn,
  type DropdownItem,
  type EntityFieldDef,
} from "@cloud-dog/ui";
import type { JsonRecord } from "../lib/types";
import { useImapMcpState } from "../state/AppState";

type ProfileListRow = Readonly<{
  enabled?: boolean;
  cacheBytes?: number | null;
  profileId: string;
  provider: string;
  description: string;
  server: string;
  port: string;
  security: string;
  authMode: string;
  allowedGroups: string[];
  mailboxPattern: string;
  lastSync: string;
  raw: JsonRecord;
}>;

type ProfileDraft = Readonly<{
  profileId: string;
  provider: "imap_generic" | "gmail" | "exchange" | "outlook365";
  description: string;
  host: string;
  port: number;
  security: "ssl" | "starttls" | "none";
  username: string;
  password: string;
  mailboxPattern: string;
  syncIntervalSeconds: number;
}>;

const defaultDraft: ProfileDraft = {
  profileId: "",
  provider: "imap_generic",
  description: "",
  host: "",
  port: 993,
  security: "ssl",
  username: "",
  password: "",
  mailboxPattern: "INBOX",
  syncIntervalSeconds: 30,
};

const PROVIDER_DEFAULTS: Record<ProfileDraft["provider"], Partial<ProfileDraft>> = {
  imap_generic: { host: "", port: 993, security: "ssl" },
  gmail: { host: "imap.gmail.com", port: 993, security: "ssl" },
  exchange: { host: "outlook.office365.com", port: 993, security: "ssl" },
  outlook365: { host: "outlook.office365.com", port: 993, security: "ssl" },
};

const fields: EntityFieldDef[] = [
  { name: "profileId", label: "Channel ID", type: "text", required: true },
  // Exchange + outlook365 intentionally excluded — not yet implemented.
  { name: "provider", label: "Provider", type: "select", required: true, options: ["imap_generic", "gmail"] },
  {
    name: "description",
    label: "Description (human-readable purpose of this channel)",
    type: "text",
    required: false,
    placeholder: "e.g. Cloud-Dog operations alerts mailbox",
  },
  { name: "host", label: "IMAP server", type: "text", required: true },
  { name: "port", label: "Port", type: "number", required: true },
  { name: "security", label: "Security", type: "select", required: true, options: ["ssl", "starttls", "none"] },
  { name: "username", label: "Username", type: "text", required: true },
  { name: "password", label: "Password", type: "text", required: true },
  {
    name: "mailboxPattern",
    label: "Mailbox pattern (glob — e.g. INBOX or INBOX/*)",
    type: "text",
    required: true,
    placeholder: "INBOX",
  },
  { name: "syncIntervalSeconds", label: "Sync interval seconds", type: "number", required: true },
];

function buildPayload(draft: ProfileDraft): JsonRecord {
  return {
    provider: draft.provider,
    description: draft.description.trim(),
    imap: {
      host: draft.host.trim(),
      port: Number(draft.port),
      security: draft.security,
      tls: { allow_self_signed: false },
      timeout_seconds: 15,
    },
    auth: { mode: "basic" },
    credentials: {
      username: draft.username.trim(),
      password: draft.password,
    },
    sync: {
      retention: {
        max_age_days: 30,
        max_total_bytes: 2147483648,
        max_messages: 50000,
      },
      folder_policy: {
        include_globs: [draft.mailboxPattern.trim()],
        exclude_globs: [],
      },
      parts_policy: {
        cache_headers: true,
        cache_bodies: true,
        max_body_bytes: 200000,
        cache_attachments: false,
        max_attachment_bytes: 25000000,
      },
    },
    sync_interval_seconds: Number(draft.syncIntervalSeconds),
    write: { enabled: false },
  };
}

function readDraft(profileId: string, raw: JsonRecord): ProfileDraft {
  const imap = (raw.imap ?? {}) as Record<string, unknown>;
  const credentials = (raw.credentials ?? {}) as Record<string, unknown>;
  const sync = (raw.sync ?? {}) as Record<string, unknown>;
  const folderPolicy = (sync.folder_policy ?? {}) as Record<string, unknown>;
  const includeGlobs = Array.isArray(folderPolicy.include_globs) ? folderPolicy.include_globs : [];
  const legacySecurity =
    raw.imap_ssl === true ? "ssl" : raw.imap_starttls === true ? "starttls" : "none";

  const providerValue = String(raw.provider ?? "imap_generic");
  const provider = (PROVIDER_DEFAULTS as Record<string, unknown>)[providerValue]
    ? (providerValue as ProfileDraft["provider"])
    : "imap_generic";
  return {
    profileId,
    provider,
    description: String(raw.description ?? raw.notes ?? ""),
    host: String(imap.host ?? raw.imap_host ?? ""),
    port: Number(imap.port ?? raw.imap_port ?? 993),
    security: String(imap.security ?? legacySecurity ?? "ssl") as ProfileDraft["security"],
    username: String(credentials.username ?? raw.username ?? ""),
    password: String(credentials.password ?? credentials.app_password ?? ""),
    mailboxPattern: String(includeGlobs[0] ?? raw.default_folder ?? "INBOX"),
    syncIntervalSeconds: Number(raw.sync_interval_seconds ?? 30),
  };
}

function toListRow(profileId: string, raw: JsonRecord): ProfileListRow {
  const imap = (raw.imap ?? {}) as Record<string, unknown>;
  const sync = (raw.sync ?? {}) as Record<string, unknown>;
  const folderPolicy = (sync.folder_policy ?? {}) as Record<string, unknown>;
  const includeGlobs = Array.isArray(folderPolicy.include_globs) ? folderPolicy.include_globs : [];
  const legacySecurity =
    raw.imap_ssl === true ? "ssl" : raw.imap_starttls === true ? "starttls" : "none";
  const auth = (raw.auth ?? {}) as Record<string, unknown>;
  const authMode = String(auth.mode ?? "basic");

  const allowedGroups = Array.isArray(raw.allowed_groups)
    ? raw.allowed_groups.map((g) => String(g))
    : [];

  // IMAP-323 / IMAP-326: enabled state + cache bytes (best-effort: read from raw fields)
  const enabled = raw.enabled === false ? false : true;
  const cacheBytes = typeof raw.cache_bytes_used === "number"
    ? raw.cache_bytes_used
    : typeof raw.storage_bytes === "number"
      ? raw.storage_bytes
      : null;

  return {
    profileId,
    provider: String(raw.provider ?? "imap_generic"),
    description: String(raw.description ?? raw.notes ?? ""),
    server: String(imap.host ?? raw.imap_host ?? "N/A"),
    port: String(imap.port ?? raw.imap_port ?? "N/A"),
    security: String(imap.security ?? legacySecurity ?? "N/A"),
    authMode,
    allowedGroups,
    mailboxPattern: String(includeGlobs[0] ?? raw.default_folder ?? "INBOX"),
    lastSync: String(raw.last_sync_at ?? raw.updated_at ?? ""),
    enabled,
    cacheBytes,
    raw,
  };
}

function validateDraft(draft: ProfileDraft): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!draft.profileId.trim()) errors.profileId = "Channel ID is required.";
  // For gmail channels host/port/security are fixed by Google (read from env)
  // and credentials are OAuth — only validate them on non-gmail providers.
  if (draft.provider !== "gmail") {
    if (!draft.host.trim()) errors.host = "IMAP server is required.";
    if (!Number.isFinite(draft.port) || draft.port <= 0) errors.port = "Port must be numeric.";
    if (!draft.username.trim()) errors.username = "Username is required.";
    if (!draft.password.trim()) errors.password = "Password is required.";
  }
  if (!draft.mailboxPattern.trim()) errors.mailboxPattern = "Mailbox pattern is required.";
  if (!Number.isFinite(draft.syncIntervalSeconds) || draft.syncIntervalSeconds < 1) {
    errors.syncIntervalSeconds = "Sync interval must be at least 1 second.";
  }
  return errors;
}

function downloadJson(filename: string, value: unknown): void {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function ProfilesPage() {
  const { api, role } = useImapMcpState();
  const auth = useAuth();
  const [rows, setRows] = React.useState<ProfileListRow[]>([]);
  const [selectedProfile, setSelectedProfile] = React.useState<ProfileListRow | null>(null);
  const [draft, setDraft] = React.useState<ProfileDraft>(defaultDraft);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [status, setStatus] = React.useState("");
  const [error, setError] = React.useState("");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [mode, setMode] = React.useState<"add" | "edit">("add");
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);
  const [probeStatus, setProbeStatus] = React.useState("");
  const [gmailHasRefreshToken, setGmailHasRefreshToken] = React.useState<boolean | null>(null);
  const [perRowProbe, setPerRowProbe] = React.useState<Record<string, string>>({});

  const handleDraftChange = React.useCallback((name: string, value: unknown) => {
    setDraft((current) => {
      const next = { ...current, [name]: value } as ProfileDraft;
      if (name === "provider") {
        const providerKey = String(value) as ProfileDraft["provider"];
        const overrides = PROVIDER_DEFAULTS[providerKey] ?? {};
        return { ...next, ...overrides };
      }
      return next;
    });
  }, []);

  const runProbe = React.useCallback(async () => {
    setProbeStatus("Probing…");
    const result = await api.callTool<Record<string, unknown>>("mail_probe", {
      profile_id: draft.profileId.trim(),
      folder: draft.mailboxPattern.trim() || "INBOX",
    });
    if (!result.ok) {
      setProbeStatus(`Probe failed (${result.meta.status}) ${result.errorCode}: ${result.errorMessage}`);
      return;
    }
    const data = result.data as Record<string, unknown> | undefined;
    setProbeStatus(`Probe OK — status=${String(data?.status ?? "unknown")} mode=${String(data?.mode ?? "unknown")}`);
  }, [api, draft.profileId, draft.mailboxPattern]);
  const authRoles = React.useMemo(
    () => (auth.user?.roles ?? []).map((item) => item.trim().toLowerCase()).filter(Boolean),
    [auth.user?.roles],
  );
  const isAdmin = authRoles.includes("*") || authRoles.includes("admin") || role.trim().toLowerCase() === "admin";

  const load = React.useCallback(async () => {
    setError("");
    const listed = await api.listProfiles();
    if (!listed.ok) {
      setError(`List channels failed (${listed.meta.status}) ${listed.errorMessage}`);
      return;
    }

    const detailResults = await Promise.all(
      (listed.data ?? []).map(async (profileId) => ({
        profileId,
        detail: await api.getProfile(profileId),
      }))
    );
    const failedProfiles = detailResults
      .filter(({ detail }) => !detail.ok || !detail.data)
      .map(({ profileId }) => profileId);
    const loaded: ProfileListRow[] = detailResults.map(({ profileId, detail }) =>
      detail.ok && detail.data
        ? toListRow(profileId, detail.data)
        : {
            profileId,
            provider: "unknown",
            description: "",
            server: "Unavailable",
            port: "N/A",
            security: "Unknown",
            authMode: "unknown",
            allowedGroups: [],
            mailboxPattern: "N/A",
            lastSync: "",
            raw: {},
          }
    );
    loaded.sort((left, right) => left.profileId.localeCompare(right.profileId));
    setRows(loaded);
    if (failedProfiles.length > 0) {
      setError(`Loaded channel IDs, but some detail records could not be read: ${failedProfiles.join(", ")}`);
    }
  }, [api]);

  React.useEffect(() => {
    void load();
  }, [load]);

  // Probe Gmail OAuth status so gmail channels can be visually marked as
  // "configured but not authorised" when the operator hasn't completed
  // Google consent yet.
  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const r = await fetch("/admin/gmail-setup/status", { credentials: "include" });
        if (!r.ok) return;
        const body = (await r.json()) as { result?: { has_refresh_token?: boolean } };
        if (cancelled) return;
        setGmailHasRefreshToken(Boolean(body?.result?.has_refresh_token));
      } catch {
        // ignore - non-admin sessions can't see this; we render as null.
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const probeRow = React.useCallback(
    async (row: ProfileListRow) => {
      setPerRowProbe((current) => ({ ...current, [row.profileId]: "Probing…" }));
      const result = await api.callTool<Record<string, unknown>>("mail_probe", {
        profile_id: row.profileId,
        folder: row.mailboxPattern || "INBOX",
      });
      const data = result.data as Record<string, unknown> | undefined;
      setPerRowProbe((current) => ({
        ...current,
        [row.profileId]: result.ok
          ? `OK (${String(data?.status ?? "ok")}/${String(data?.mode ?? "imap")})`
          : `FAIL: ${result.errorMessage || result.errorCode || "probe failed"}`,
      }));
    },
    [api],
  );

  const openAdd = () => {
    if (!isAdmin) {
      setError("Profile creation requires admin access.");
      return;
    }
    setMode("add");
    setDraft(defaultDraft);
    setErrors({});
    setProbeStatus("");
    setDialogOpen(true);
  };

  const openEdit = async (profileId: string) => {
    if (!isAdmin) {
      setError("Profile editing requires admin access.");
      return;
    }
    const detail = await api.getProfile(profileId);
    if (!detail.ok || !detail.data) {
      setError(detail.errorMessage || `Failed to load ${profileId}.`);
      return;
    }
    setMode("edit");
    setDraft(readDraft(profileId, detail.data));
    setErrors({});
    setProbeStatus("");
    setDialogOpen(true);
  };

  const submit = async () => {
    if (!isAdmin) {
      setError("Profile updates require admin access.");
      return;
    }
    const nextErrors = validateDraft(draft);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const result = await api.upsertProfile(draft.profileId.trim(), buildPayload(draft));
    if (!result.ok) {
      setError(result.errorMessage || "Failed to save channel.");
      return;
    }

    setStatus(`Saved channel ${draft.profileId}.`);
    setDialogOpen(false);
    await load();
  };

  const remove = async (profileId: string) => {
    if (!isAdmin) {
      setError("Profile deletion requires admin access.");
      return;
    }
    window.alert(`Delete profile?\n\nprofile=${profileId}`);
    const deleted = await api.deleteProfile(profileId);
    if (!deleted.ok) {
      setError(deleted.errorMessage || `Failed to delete ${profileId}.`);
      return;
    }
    setStatus(`Deleted channel ${profileId}.`);
    await load();
  };

  // IMAP-323: toggle channel enabled/disabled flag.
  const toggleEnabled = async (row: ProfileListRow) => {
    const nextEnabled = row.enabled === false;
    const updated = await api.upsertProfile(row.profileId, { ...row.raw, enabled: nextEnabled } as JsonRecord);
    if (!updated.ok) {
      setError(updated.errorMessage || `Failed to ${nextEnabled ? "enable" : "disable"} ${row.profileId}.`);
      return;
    }
    setStatus(`${nextEnabled ? "Enabled" : "Disabled"} channel ${row.profileId}.`);
    await load();
  };

  // IMAP-328: clear local cache for a channel.
  const clearCache = async (row: ProfileListRow) => {
    if (!window.confirm(`Clear local IMAP cache for ${row.profileId}?\nThis removes search-ledger entries and downloaded attachments for this channel.`)) return;
    const result = await api.callTool<Record<string, unknown>>("mail_clear_cache", { profile_id: row.profileId });
    if (!result.ok) {
      setError(result.errorMessage || `Failed to clear cache for ${row.profileId}.`);
      return;
    }
    setStatus(`Cleared cache for ${row.profileId}.`);
    await load();
  };

  const renderAuthStatus = (row: ProfileListRow) => {
    if (row.provider === "gmail") {
      if (gmailHasRefreshToken === true) return <Badge variant="default">Authorised</Badge>;
      if (gmailHasRefreshToken === false) {
        return (
          <Link
            to="/gmail-settings"
            className="inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700 hover:bg-amber-500/20"
            title="Gmail OAuth consent not yet completed — click to authenticate"
          >
            Not authorised — fix
          </Link>
        );
      }
      return <Badge variant="secondary">Unknown</Badge>;
    }
    if (row.authMode === "oauth2") return <Badge variant="secondary">OAuth ({row.authMode})</Badge>;
    return <Badge variant="default">Basic auth</Badge>;
  };

  const columns: DataColumn<ProfileListRow>[] = [
    {
      // IMAP-321: Channel ID is a link to the detail view (opens the structured detail dialog).
      id: "profileId",
      header: "Channel ID",
      cell: (row) => (
        <button
          type="button"
          className="text-primary underline-offset-4 hover:underline font-mono text-xs"
          onClick={() => setSelectedProfile(row)}
          aria-label={`View channel ${row.profileId}`}
        >
          {row.profileId}
        </button>
      ),
      sortable: true,
      sortValue: (row) => row.profileId,
    },
    {
      // IMAP-323: enabled/disabled state visible at a glance.
      id: "enabled",
      header: "Status",
      cell: (row) => (
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${row.enabled === false ? "bg-muted text-muted-foreground" : "bg-emerald-500/10 text-emerald-700"}`}>
          {row.enabled === false ? "disabled" : "enabled"}
        </span>
      ),
      sortable: true,
      sortValue: (row) => (row.enabled === false ? "1-disabled" : "0-enabled"),
    },
    {
      id: "provider",
      header: "Provider",
      cell: (row) => <span className="font-mono text-xs">{row.provider}</span>,
      sortable: true,
      sortValue: (row) => row.provider,
    },
    {
      id: "description",
      header: "Description",
      cell: (row) =>
        row.description ? (
          <span className="text-xs" title={row.description}>{row.description}</span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
      sortable: true,
      sortValue: (row) => row.description,
    },
    { id: "server", header: "Server", cell: (row) => row.server, sortable: true, sortValue: (row) => row.server },
    { id: "port", header: "Port", cell: (row) => row.port, sortable: true, sortValue: (row) => row.port },
    { id: "security", header: "Security", cell: (row) => row.security, sortable: true, sortValue: (row) => row.security },
    {
      id: "authStatus",
      header: "Auth status",
      cell: (row) => renderAuthStatus(row),
      sortable: true,
      sortValue: (row) => row.provider + ":" + row.authMode,
    },
    {
      id: "allowedGroups",
      header: "Allowed groups",
      cell: (row) => {
        if (row.allowedGroups.length === 0) {
          return <span className="text-xs text-muted-foreground">any (no RBAC binding)</span>;
        }
        return (
          <div className="flex flex-wrap gap-1">
            {row.allowedGroups.map((g) => (
              <Link
                key={g}
                to={`/admin/groups?groupId=${encodeURIComponent(g)}`}
                className="text-xs text-primary underline-offset-4 hover:underline"
                title={`RBAC: only members of group ${g} can use this channel`}
              >
                {g}
              </Link>
            ))}
          </div>
        );
      },
      sortable: true,
      sortValue: (row) => row.allowedGroups.join(","),
    },
    {
      // IMAP-327: per-row link → Mailbox Workspace filtered for that channel.
      id: "mailbox",
      header: "Mailbox",
      cell: (row) => (
        <Link
          to={`/mailbox-workspace?profile=${encodeURIComponent(row.profileId)}`}
          className="text-primary underline-offset-4 hover:underline text-xs"
          title={`Open mailbox for ${row.profileId}`}
        >
          {row.mailboxPattern}
        </Link>
      ),
    },
    {
      id: "lastSync",
      header: "Last Sync",
      // IMAP-325: time since last refresh (RelativeTime already moment-formats; backend wiring tracked as IMAP-329).
      cell: (row) => (row.lastSync ? <RelativeTime timestamp={row.lastSync} /> : <span className="text-xs text-muted-foreground">never</span>),
      sortable: true,
      sortValue: (row) => row.lastSync,
    },
    {
      // IMAP-326: local cache size column.
      id: "cacheSize",
      header: "Cache",
      cell: (row) => (
        <span className="text-xs font-mono">
          {row.cacheBytes != null ? formatBytes(row.cacheBytes) : <span className="text-muted-foreground">—</span>}
        </span>
      ),
      sortable: true,
      sortValue: (row) => row.cacheBytes ?? -1,
    },
    {
      id: "test",
      header: "Test",
      cell: (row) => (
        <div className="flex flex-col gap-1">
          <Button size="sm" variant="secondary" onClick={() => void probeRow(row)}>Test</Button>
          {perRowProbe[row.profileId] ? (
            <span className="text-[10px] text-muted-foreground" role="status">{perRowProbe[row.profileId]}</span>
          ) : null}
        </div>
      ),
    },
    {
      // IMAP-320: collapse multiple per-row actions into a single Dropdown to fix layout.
      // IMAP-324: per-row Log link (audit) included.
      id: "actions",
      header: "Actions",
      cell: (row) => {
        const items: DropdownItem[] = [
          { id: "view", label: "View detail", onSelect: () => setSelectedProfile(row) },
          { id: "audit", label: "View audit log", onSelect: () => { window.location.assign(`/diagnostics-audit?target_id=${encodeURIComponent(row.profileId)}`); } },
          { id: "mailbox", label: "Open in Mailbox", onSelect: () => { window.location.assign(`/mailbox-workspace?profile=${encodeURIComponent(row.profileId)}`); } },
        ];
        if (isAdmin) {
          items.push({ id: "api-keys", label: "Manage API keys", onSelect: () => { window.location.assign(`/admin/api-keys?profileId=${encodeURIComponent(row.profileId)}`); } });
          items.push({ id: "edit", label: "Edit channel", onSelect: () => void openEdit(row.profileId) });
          items.push({ id: "toggle", label: row.enabled === false ? "Enable channel" : "Disable channel", onSelect: () => void toggleEnabled(row) });
          items.push({ id: "clear-cache", label: "Clear cache", onSelect: () => void clearCache(row) });
          items.push({ id: "delete", label: "Delete channel", onSelect: () => void remove(row.profileId) });
        }
        return (
          <DropdownMenu
            trigger={<Button size="sm" variant="ghost">Actions ▾</Button>}
            items={items}
          />
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Channels</h1>
          <p className="text-sm text-muted-foreground">
            Manage saved channel definitions (IMAP, Gmail, …) used by the Mailbox view and MCP/A2A tools.
          </p>
        </div>
        {isAdmin ? <Button onClick={openAdd}>Add Channel</Button> : null}
      </header>

      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      {status ? <p role="status" className="text-sm text-foreground/80">{status}</p> : null}
      {!isAdmin ? (
        <p role="status" className="text-sm text-foreground/80">
          Read-only mode. Profile creation and mutation controls are hidden for non-admin users.
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Configured Channels</h2>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            rows={rows}
            getRowId={(row) => row.profileId}
            emptyMessage="No channels are currently configured."
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            columnPickerEnabled
            tableId="imap-channels"
            selectable
            bulkActions={isAdmin ? [
              { label: "Disable selected", action: "bulk-disable" },
              { label: "Enable selected", action: "bulk-enable" },
              { label: "Clear cache on selected", action: "bulk-clear-cache" },
              { label: "Export selected", action: "bulk-export" },
            ] : [{ label: "Export selected", action: "bulk-export" }]}
            onBulkAction={(action, ids) => {
              const selected = rows.filter((r) => ids.includes(r.profileId));
              if (action === "bulk-export") {
                const blob = new Blob([JSON.stringify(selected.map(r => r.raw), null, 2)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url; a.download = `channels-export-${Date.now()}.json`; a.click();
                URL.revokeObjectURL(url);
                return;
              }
              if (!isAdmin) return;
              if (action === "bulk-disable" || action === "bulk-enable") {
                const target = action === "bulk-enable";
                if (!window.confirm(`${target ? "Enable" : "Disable"} ${selected.length} channel(s)?`)) return;
                void (async () => {
                  for (const row of selected) {
                    await api.upsertProfile(row.profileId, { ...row.raw, enabled: target } as JsonRecord);
                  }
                  setStatus(`${target ? "Enabled" : "Disabled"} ${selected.length} channel(s).`);
                  await load();
                })();
              }
              if (action === "bulk-clear-cache") {
                if (!window.confirm(`Clear local cache on ${selected.length} channel(s)?`)) return;
                void (async () => {
                  for (const row of selected) {
                    await api.callTool("mail_clear_cache", { profile_id: row.profileId });
                  }
                  setStatus(`Cleared cache on ${selected.length} channel(s).`);
                  await load();
                })();
              }
            }}
          />
        </CardContent>
      </Card>

      <EntityDialog
        open={selectedProfile !== null}
        onOpenChange={(open) => { if (!open) setSelectedProfile(null); }}
        title={selectedProfile ? `Channel detail — ${selectedProfile.profileId}` : "Channel detail"}
        body={
          selectedProfile ? (
            <div className="space-y-4 max-h-[70vh] overflow-y-auto">
              {/* IMAP-330: structured layout — identity card, IMAP config, auth, sync, RBAC sections.
                  IMAP-331: same shape used by Edit + View for consistency.
                  Raw JSON exposed at the bottom via JsonExplorer table view (CX-140). */}
              <section className="rounded-md border bg-background p-3">
                <h3 className="text-sm font-semibold mb-2">Identity</h3>
                <div className="grid gap-2 md:grid-cols-2 text-sm">
                  <div><span className="text-muted-foreground">Channel ID:</span> <span className="font-mono">{selectedProfile.profileId}</span></div>
                  <div><span className="text-muted-foreground">Provider:</span> <span className="font-mono">{selectedProfile.provider}</span></div>
                  <div><span className="text-muted-foreground">Status:</span> {selectedProfile.enabled === false ? "disabled" : "enabled"}</div>
                  <div><span className="text-muted-foreground">Mailbox pattern:</span> <span className="font-mono">{selectedProfile.mailboxPattern}</span></div>
                  <div className="md:col-span-2"><span className="text-muted-foreground">Description:</span> {selectedProfile.description ? selectedProfile.description : <span className="text-muted-foreground">—</span>}</div>
                </div>
              </section>

              <section className="rounded-md border bg-background p-3">
                <h3 className="text-sm font-semibold mb-2">IMAP connection</h3>
                <div className="grid gap-2 md:grid-cols-2 text-sm">
                  <div><span className="text-muted-foreground">Host:</span> <span className="font-mono">{selectedProfile.server}</span></div>
                  <div><span className="text-muted-foreground">Port:</span> <span className="font-mono">{selectedProfile.port}</span></div>
                  <div><span className="text-muted-foreground">Security:</span> {selectedProfile.security}</div>
                </div>
              </section>

              <section className="rounded-md border bg-background p-3">
                <h3 className="text-sm font-semibold mb-2">Auth</h3>
                <div className="grid gap-2 md:grid-cols-2 text-sm">
                  <div><span className="text-muted-foreground">Mode:</span> <span className="font-mono">{selectedProfile.authMode}</span></div>
                  <div>{renderAuthStatus(selectedProfile)}</div>
                </div>
              </section>

              <section className="rounded-md border bg-background p-3">
                <h3 className="text-sm font-semibold mb-2">Sync state</h3>
                <div className="grid gap-2 md:grid-cols-2 text-sm">
                  <div><span className="text-muted-foreground">Last sync:</span> {selectedProfile.lastSync ? <RelativeTime timestamp={selectedProfile.lastSync} /> : "never"}</div>
                  <div><span className="text-muted-foreground">Cache size:</span> <span className="font-mono">{selectedProfile.cacheBytes != null ? formatBytes(selectedProfile.cacheBytes) : "—"}</span></div>
                </div>
              </section>

              <section className="rounded-md border bg-background p-3">
                <h3 className="text-sm font-semibold mb-2">RBAC</h3>
                <div className="text-sm">
                  <span className="text-muted-foreground">Allowed groups:</span>{" "}
                  {selectedProfile.allowedGroups.length === 0
                    ? <span className="text-muted-foreground">any (no binding)</span>
                    : selectedProfile.allowedGroups.map((g) => (
                        <Link key={g} to={`/admin/groups?groupId=${encodeURIComponent(g)}`} className="text-primary underline-offset-4 hover:underline font-mono text-xs mr-2">
                          {g}
                        </Link>
                      ))}
                </div>
              </section>

              <section className="rounded-md border bg-background p-3">
                <h3 className="text-sm font-semibold mb-2">Quick actions</h3>
                <div className="flex flex-wrap gap-2">
                  <Link
                    to={`/diagnostics-audit?target_id=${encodeURIComponent(selectedProfile.profileId)}`}
                    className="inline-flex items-center rounded-md border px-3 py-1 text-sm font-medium hover:bg-muted"
                  >
                    View audit log
                  </Link>
                  <Link
                    to={`/mailbox-workspace?profile=${encodeURIComponent(selectedProfile.profileId)}`}
                    className="inline-flex items-center rounded-md border px-3 py-1 text-sm font-medium hover:bg-muted"
                  >
                    Open Mailbox
                  </Link>
                  {isAdmin ? (
                    <>
                      <Button size="sm" variant="secondary" onClick={() => { setSelectedProfile(null); void openEdit(selectedProfile.profileId); }}>Edit</Button>
                      <Button size="sm" variant="secondary" onClick={() => void clearCache(selectedProfile)}>Clear cache</Button>
                    </>
                  ) : null}
                </div>
              </section>

              {/* C-b (W28E-1863 fix-wave-b): collapse the advanced raw config behind a
                  <details> so it is not expanded on open — mirrors the mailbox
                  "Show raw message JSON (advanced)" pattern (FileBrowserPage). */}
              <details className="rounded-md border bg-background p-3">
                <summary className="cursor-pointer text-sm font-semibold">Raw configuration (advanced)</summary>
                {/* CX-140: JsonExplorer in table view, drops the `root` wrapper. */}
                <div className="mt-2">
                  <JsonExplorer data={selectedProfile.raw} viewMode="table" maxDepth={6} hideInternalSearch />
                </div>
              </details>
            </div>
          ) : null
        }
      />

      {isAdmin ? (
        <EntityDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          title={mode === "add" ? "Add Channel" : `Edit Channel: ${draft.profileId}`}
          // IMAP-043 / IMAP-048: provider-specific section.
          //   gmail        → no username/password (OAuth credentials configured at
          //                  /gmail-settings); host/port/security are fixed by Google
          //                  and read from env vars at the backend, so hide here too.
          //   imap_generic → full IMAP host/port/security/username/password.
          fields={fields
            .filter((field) => {
              if (draft.provider === "gmail") {
                return !["host", "port", "security", "username", "password"].includes(field.name);
              }
              return true;
            })
            .map((field) => (mode === "edit" && field.name === "profileId" ? { ...field, readOnly: true } : field))}
          values={draft as Record<string, unknown>}
          onChange={handleDraftChange}
          onSubmit={() => void submit()}
          onCancel={() => setDialogOpen(false)}
          mode={mode}
          errors={errors}
          submitLabel="Save Profile"
          extra={
            mode === "edit" ? (
              <div className="flex flex-wrap items-center gap-2 border-t pt-3">
                <Button type="button" size="sm" variant="secondary" onClick={() => void runProbe()}>
                  Test / Verify connection
                </Button>
                {/* IMAP-332: Gmail re-authorisation option in Edit dialog. */}
                {draft.provider === "gmail" ? (
                  <Link
                    to={`/gmail-settings?profile=${encodeURIComponent(draft.profileId)}`}
                    className="inline-flex items-center rounded-md border border-primary px-3 py-1 text-sm font-medium text-primary hover:bg-primary/10"
                  >
                    Re-authorise Gmail
                  </Link>
                ) : null}
                {probeStatus ? (
                  <span className="text-xs text-muted-foreground" role="status">{probeStatus}</span>
                ) : null}
              </div>
            ) : null
          }
        />
      ) : null}
    </div>
  );
}
