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
  EntityDialog,
  RelativeTime,
  type DataColumn,
  type EntityFieldDef,
} from "@cloud-dog/ui";
import type { JsonRecord } from "../lib/types";
import { useImapMcpState } from "../state/AppState";

type ProfileListRow = Readonly<{
  profileId: string;
  provider: string;
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
  host: string;
  port: number;
  security: "ssl" | "starttls" | "none";
  username: string;
  password: string;
  mailboxPattern: string;
  syncIntervalSeconds: number;
}>;

type LegacyProfileDraft = Readonly<{
  profileId: string;
  host: string;
  maxAgeDays: string;
  includeGlobs: string;
  notes: string;
}>;

const defaultDraft: ProfileDraft = {
  profileId: "",
  provider: "imap_generic",
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

const defaultLegacyDraft: LegacyProfileDraft = {
  profileId: "",
  host: "smtp.example.com",
  maxAgeDays: "30",
  includeGlobs: "INBOX",
  notes: "",
};

const fields: EntityFieldDef[] = [
  { name: "profileId", label: "Channel ID", type: "text", required: true },
  // Exchange + outlook365 intentionally excluded — not yet implemented.
  { name: "provider", label: "Provider", type: "select", required: true, options: ["imap_generic", "gmail"] },
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

  return {
    profileId,
    provider: String(raw.provider ?? "imap_generic"),
    server: String(imap.host ?? raw.imap_host ?? "N/A"),
    port: String(imap.port ?? raw.imap_port ?? "N/A"),
    security: String(imap.security ?? legacySecurity ?? "N/A"),
    authMode,
    allowedGroups,
    mailboxPattern: String(includeGlobs[0] ?? raw.default_folder ?? "INBOX"),
    lastSync: String(raw.last_sync_at ?? raw.updated_at ?? ""),
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
    if (!draft.password.trim()) errors.password = "example";
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
  const [legacyDraft, setLegacyDraft] = React.useState<LegacyProfileDraft>(defaultLegacyDraft);
  const [profilePayload, setProfilePayload] = React.useState("{}");
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

  const buildLegacyPayload = React.useCallback(
    (draftValue: LegacyProfileDraft): JsonRecord => ({
      provider: "imap_generic",
      notes: draftValue.notes.trim(),
      imap: {
        host: draftValue.host.trim(),
        port: 993,
        security: "ssl",
        tls: { allow_self_signed: false },
        timeout_seconds: 15,
      },
      auth: { mode: "basic" },
      credentials: {
        username: `${draftValue.profileId.trim() || "profile"}@example.com`,
        password: "example",
      },
      sync: {
        retention: {
          max_age_days: Number(draftValue.maxAgeDays || "30"),
          max_total_bytes: 2147483648,
          max_messages: 50000,
        },
        folder_policy: {
          include_globs: draftValue.includeGlobs.split(",").map((item) => item.trim()).filter(Boolean),
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
      sync_interval_seconds: 30,
      write: { enabled: false },
    }),
    []
  );

  const syncLegacyFormToJson = React.useCallback(
    (draftValue: LegacyProfileDraft) => {
      setProfilePayload(JSON.stringify(buildLegacyPayload(draftValue), null, 2));
    },
    [buildLegacyPayload]
  );

  React.useEffect(() => {
    syncLegacyFormToJson(legacyDraft);
  }, [legacyDraft, syncLegacyFormToJson]);

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
    const imap = (detail.data.imap ?? {}) as Record<string, unknown>;
    const sync = (detail.data.sync ?? {}) as Record<string, unknown>;
    const folderPolicy = (sync.folder_policy ?? {}) as Record<string, unknown>;
    const includeGlobs = Array.isArray(folderPolicy.include_globs) ? folderPolicy.include_globs : [];
    const retention = (sync.retention ?? {}) as Record<string, unknown>;
    const notesValue = String(detail.data.notes ?? detail.data.description ?? "");
    const nextLegacyDraft = {
      profileId,
      host: String(imap.host ?? ""),
      maxAgeDays: String(retention.max_age_days ?? 30),
      includeGlobs: includeGlobs.join(",") || "INBOX",
      notes: notesValue,
    } satisfies LegacyProfileDraft;
    setLegacyDraft(nextLegacyDraft);
    syncLegacyFormToJson(nextLegacyDraft);
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
      id: "profileId",
      header: "Channel ID",
      cell: (row) => row.profileId,
      sortable: true,
      sortValue: (row) => row.profileId,
    },
    {
      id: "provider",
      header: "Provider",
      cell: (row) => <span className="font-mono text-xs">{row.provider}</span>,
      sortable: true,
      sortValue: (row) => row.provider,
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
    { id: "mailbox", header: "Mailbox", cell: (row) => row.mailboxPattern },
    {
      id: "lastSync",
      header: "Last Sync",
      cell: (row) => (row.lastSync ? <RelativeTime timestamp={row.lastSync} /> : "N/A"),
      sortable: true,
      sortValue: (row) => row.lastSync,
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
      id: "actions",
      header: "Actions",
      cell: (row) => (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => setSelectedProfile(row)}>View</Button>
          <Link
            to={`/diagnostics-audit?target_id=${encodeURIComponent(row.profileId)}`}
            className="inline-flex items-center rounded-md border px-3 py-1 text-sm font-medium hover:bg-muted"
            title={`View audit for channel ${row.profileId}`}
          >
            Audit
          </Link>
          {isAdmin ? (
            <>
              <Link
                to={`/admin/api-keys?profileId=${encodeURIComponent(row.profileId)}`}
                className="inline-flex items-center rounded-md border px-3 py-1 text-sm font-medium hover:bg-muted"
              >
                API Keys
              </Link>
              <Button size="sm" variant="secondary" onClick={() => void openEdit(row.profileId)}>Edit</Button>
              <Button size="sm" variant="destructive" onClick={() => void remove(row.profileId)}>Delete</Button>
            </>
          ) : null}
        </div>
      ),
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
          />
        </CardContent>
      </Card>

      <EntityDialog
        open={selectedProfile !== null}
        onOpenChange={(open) => { if (!open) setSelectedProfile(null); }}
        title={selectedProfile ? `Channel detail — ${selectedProfile.profileId}` : "Channel detail"}
        body={
          selectedProfile ? (
            <div className="space-y-3 max-h-[70vh] overflow-y-auto">
              <div className="grid gap-2 md:grid-cols-2 text-sm">
                <div><span className="text-muted-foreground">Channel:</span> <span className="font-mono">{selectedProfile.profileId}</span></div>
                <div><span className="text-muted-foreground">Provider:</span> <span className="font-mono">{selectedProfile.provider}</span></div>
                <div><span className="text-muted-foreground">Server:</span> <span className="font-mono">{selectedProfile.server}:{selectedProfile.port}</span></div>
                <div><span className="text-muted-foreground">Security:</span> {selectedProfile.security}</div>
                <div><span className="text-muted-foreground">Auth:</span> {selectedProfile.authMode}</div>
                <div><span className="text-muted-foreground">Mailbox:</span> <span className="font-mono">{selectedProfile.mailboxPattern}</span></div>
              </div>
              <div className="rounded-md border bg-muted/30 p-3 text-xs">
                <pre className="overflow-x-auto whitespace-pre-wrap font-mono">{JSON.stringify(selectedProfile.raw, null, 2)}</pre>
              </div>
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
