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

// @cloud-dog/app-file-mcp — Storage profiles page.

import * as React from "react";
import { useAuth } from "@cloud-dog/auth";
import { useNavigate } from "react-router-dom";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  DataTable,
  EntityDialog,
  Input,
  RelativeTime,
  Tooltip,
  useToast,
} from "@cloud-dog/ui";
import type {
  BulkAction,
  DataColumn,
  EntityFieldDef,
  EntityFormMode,
} from "@cloud-dog/ui";
import { canManageStorageProfiles } from "../lib/rbac";
import type { AdminProfile, BackendStatusResponse } from "../lib/types";
import { useFileMcpState } from "../state/AppState";

type ProfileFormValues = Readonly<{
  name: string;
  display_name: string;
  backend: string;
  root: string;
  // S3
  s3_endpoint: string;
  s3_bucket: string;
  s3_region: string;
  s3_access_key: string;
  s3_secret_key: string;
  // WebDAV
  webdav_base_url: string;
  webdav_username: string;
  webdav_password: string;
  // FTP
  ftp_host: string;
  ftp_port: string;
  ftp_username: string;
  ftp_password: string;
  // Google Drive
  gdrive_folder_id: string;
  gdrive_client_id: string;
  gdrive_client_secret: string;
  gdrive_user_email: string;
}>;

const EMPTY_FORM: ProfileFormValues = {
  name: "",
  display_name: "",
  backend: "local",
  root: "",
  s3_endpoint: "", s3_bucket: "", s3_region: "", s3_access_key: "", s3_secret_key: "",
  webdav_base_url: "", webdav_username: "", webdav_password: "",
  ftp_host: "", ftp_port: "21", ftp_username: "", ftp_password: "",
  gdrive_folder_id: "", gdrive_client_id: "", gdrive_client_secret: "", gdrive_user_email: "",
};

const BASE_FIELDS: EntityFieldDef[] = [
  { name: "name", label: "Profile name", type: "text", required: true },
  { name: "display_name", label: "Display name", type: "text" },
  {
    name: "backend",
    label: "Backend type",
    type: "select",
    options: ["local", "s3", "webdav", "ftp", "google-drive"],
    required: true,
  },
  { name: "root", label: "Root path", type: "text", required: true },
];

const S3_FIELDS: EntityFieldDef[] = [
  { name: "s3_endpoint", label: "S3 endpoint URL", type: "text" },
  { name: "s3_bucket", label: "S3 bucket", type: "text" },
  { name: "s3_region", label: "S3 region", type: "text" },
  { name: "s3_access_key", label: "S3 access key", type: "text" },
  { name: "s3_secret_key", label: "S3 secret key (leave blank to keep)", type: "text" },
];

const WEBDAV_FIELDS: EntityFieldDef[] = [
  { name: "webdav_base_url", label: "WebDAV base URL", type: "text" },
  { name: "webdav_username", label: "WebDAV username", type: "text" },
  { name: "webdav_password", label: "WebDAV password (leave blank to keep)", type: "text" },
];

const FTP_FIELDS: EntityFieldDef[] = [
  { name: "ftp_host", label: "FTP host", type: "text" },
  { name: "ftp_port", label: "FTP port", type: "text" },
  { name: "ftp_username", label: "FTP username", type: "text" },
  { name: "ftp_password", label: "FTP password (leave blank to keep)", type: "text" },
];

const GDRIVE_FIELDS: EntityFieldDef[] = [
  { name: "gdrive_folder_id", label: "Google Drive folder ID or URL", type: "text" },
  { name: "gdrive_client_id", label: "OAuth client ID", type: "text" },
  { name: "gdrive_client_secret", label: "OAuth client secret (leave blank to keep)", type: "text" },
  { name: "gdrive_user_email", label: "User email", type: "text" },
];

function fieldsForBackend(backend: string): EntityFieldDef[] {
  switch (backend) {
    case "s3": return [...BASE_FIELDS, ...S3_FIELDS];
    case "webdav": return [...BASE_FIELDS, ...WEBDAV_FIELDS];
    case "ftp": return [...BASE_FIELDS, ...FTP_FIELDS];
    case "google-drive":
    case "google_drive": return [...BASE_FIELDS, ...GDRIVE_FIELDS];
    default: return BASE_FIELDS;
  }
}

type ProfileRow = Readonly<{
  id: string;
  name: string;
  displayName: string;
  backend: string;
  root: string;
  apiKeysCount: number;
  status: string;
  reason: string;
  updatedAt: string;
  raw: AdminProfile;
}>;

type ConnectionResult = Readonly<{
  tone: "pending" | "success" | "warning" | "error";
  message: string;
}>;

function profileUpdatedAt(profile: AdminProfile): string {
  const value = profile.profile?.updated_at;
  return typeof value === "string" && value.trim()
    ? value
    : new Date().toISOString();
}

function asObj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function strOf(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v).trim();
  return s.startsWith("${") ? "" : s; // hide unresolved placeholders
}

function toFormValues(profile: AdminProfile): ProfileFormValues {
  const prof = asObj(profile.profile);
  const storage = asObj(prof.storage);
  const s3 = asObj(storage.s3);
  const webdav = asObj(storage.webdav);
  const ftp = asObj(storage.ftp);
  const gd = asObj(storage.google_drive);
  return {
    name: profile.name,
    display_name: profile.display_name || profile.name,
    backend: profile.backend,
    root: profile.roots[0] || "",
    s3_endpoint: strOf(s3.endpoint), s3_bucket: strOf(s3.bucket), s3_region: strOf(s3.region),
    s3_access_key: strOf(s3.access_key_id), s3_secret_key: "",
    webdav_base_url: strOf(webdav.base_url), webdav_username: strOf(webdav.username), webdav_password: "",
    ftp_host: strOf(ftp.host), ftp_port: strOf(ftp.port) || "21", ftp_username: strOf(ftp.username), ftp_password: "",
    gdrive_folder_id: strOf(gd.folder_id) || strOf(gd.folder_url),
    gdrive_client_id: strOf(gd.client_id), gdrive_client_secret: "", gdrive_user_email: strOf(gd.user_email),
  };
}

function statusVariant(status: string): "default" | "secondary" | "destructive" {
  const normalized = status.trim().toLowerCase();
  if (normalized === "ok" || normalized === "healthy" || normalized === "active") return "default";
  if (normalized === "error" || normalized === "failed" || normalized === "auth_failed") return "destructive";
  return "secondary";
}

function isProfileConfigured(status: string): boolean {
  const normalized = status.trim().toLowerCase();
  return normalized === "ok" || normalized === "configured" || normalized === "healthy" || normalized === "active";
}

export function StorageProfilesPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const { api, currentUser, selectedProfile, setSelectedProfile, refreshProfiles } = useFileMcpState();
  const toast = useToast();

  const [profiles, setProfiles] = React.useState<AdminProfile[]>([]);
  const [backendStatus, setBackendStatus] = React.useState<BackendStatusResponse | null>(null);
  const [formValues, setFormValues] = React.useState<ProfileFormValues>(EMPTY_FORM);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingName, setEditingName] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [connectionResults, setConnectionResults] = React.useState<Record<string, ConnectionResult>>({});
  const [isBusy, setIsBusy] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);
  const canManageProfiles = canManageStorageProfiles(currentUser ?? auth.user);

  const load = React.useCallback(async () => {
    setError(null);
    try {
      const profileRows = await api.listAdminProfiles();
      setProfiles(profileRows);
      if (!selectedProfile && profileRows.length) {
        setSelectedProfile(profileRows[0].name);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load storage profiles.");
      return;
    }

    void api
      .backendStatus()
      .then((backend) => {
        setBackendStatus(backend);
      })
      .catch(() => {
        setBackendStatus(null);
      });
  }, [api, selectedProfile, setSelectedProfile]);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    setPage(1);
  }, [query]);

  const rows = React.useMemo<ProfileRow[]>(() => {
    return profiles.map((profile) => {
      const state = backendStatus?.states?.[profile.backend];
      return {
        id: profile.name,
        name: profile.name,
        displayName: profile.display_name || profile.name,
        backend: profile.backend,
        root: profile.roots[0] || "",
        apiKeysCount: profile.api_keys_count,
        status: state?.status || profile.status || "not_configured",
        reason: state?.reason || profile.reason || "",
        updatedAt: profileUpdatedAt(profile),
        raw: profile,
      };
    });
  }, [backendStatus, profiles]);

  // Profiles whose name starts with "example-" are seed templates shipped with
  // the service to demonstrate each backend's config shape. They have empty
  // credentials by design and always show status=not_configured. We hide them
  // by default so the list reflects real user-configured profiles; a toggle
  // re-exposes them for users who want to use a template as a starting point.
  const [showTemplates, setShowTemplates] = React.useState(false);

  const isTemplateRow = (row: { name: string }) =>
    row.name.startsWith("example-");

  const filteredRows = React.useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    const visible = showTemplates ? rows : rows.filter((r) => !isTemplateRow(r));
    if (!trimmed) return visible;
    return visible.filter((row) =>
      `${row.name} ${row.displayName} ${row.backend} ${row.root} ${row.status} ${row.reason}`
        .toLowerCase()
        .includes(trimmed)
    );
  }, [query, rows, showTemplates]);

  const hiddenTemplateCount = React.useMemo(
    () => (showTemplates ? 0 : rows.filter(isTemplateRow).length),
    [rows, showTemplates]
  );

  const openCreate = () => {
    setEditingName(null);
    setFormValues({
      ...EMPTY_FORM,
      root: profiles[0]?.roots[0] || "",
    });
    setDialogOpen(true);
  };

  const openEdit = (row: ProfileRow) => {
    setEditingName(row.name);
    setFormValues(toFormValues(row.raw));
    setDialogOpen(true);
  };

  const deleteProfiles = React.useCallback(
    async (names: string[]) => {
      if (!names.length) return;
      setIsBusy(true);
      setError(null);
      try {
        for (const name of names) {
          await api.deleteAdminProfile(name);
        }
        setConnectionResults((current) => {
          const next = { ...current };
          for (const name of names) {
            delete next[name];
          }
          return next;
        });
        await Promise.all([load(), refreshProfiles()]);
        setStatus(
          `Deleted ${names.length} profile${names.length === 1 ? "" : "s"}.`
        );
      } catch (deleteError) {
        setError(deleteError instanceof Error ? deleteError.message : "Failed to delete profile.");
      } finally {
        setIsBusy(false);
      }
    },
    [api, load, refreshProfiles]
  );

  const onSubmit = async () => {
    const name = formValues.name.trim();
    const root = formValues.root.trim();
    if (!name || !root) {
      setError("Profile name and root path are required.");
      return;
    }

    setIsBusy(true);
    setError(null);

    // Build backend-specific profile config
    const backendConfig: Record<string, unknown> = {};
    const b = formValues.backend;
    if (b === "s3") {
      const s3: Record<string, string> = {};
      if (formValues.s3_endpoint) s3.endpoint = formValues.s3_endpoint;
      if (formValues.s3_bucket) s3.bucket = formValues.s3_bucket;
      if (formValues.s3_region) s3.region = formValues.s3_region;
      if (formValues.s3_access_key) s3.access_key_id = formValues.s3_access_key;
      if (formValues.s3_secret_key) s3.secret_access_key = formValues.s3_secret_key;
      backendConfig.s3 = s3;
    } else if (b === "webdav") {
      const wd: Record<string, string> = {};
      if (formValues.webdav_base_url) wd.base_url = formValues.webdav_base_url;
      if (formValues.webdav_username) wd.username = formValues.webdav_username;
      if (formValues.webdav_password) wd.password = formValues.webdav_password;
      backendConfig.webdav = wd;
    } else if (b === "ftp") {
      const ft: Record<string, string> = {};
      if (formValues.ftp_host) ft.host = formValues.ftp_host;
      if (formValues.ftp_port) ft.port = formValues.ftp_port;
      if (formValues.ftp_username) ft.username = formValues.ftp_username;
      if (formValues.ftp_password) ft.password = formValues.ftp_password;
      backendConfig.ftp = ft;
    } else if (b === "google-drive" || b === "google_drive") {
      const gd: Record<string, string> = {};
      if (formValues.gdrive_folder_id) gd.folder_id = formValues.gdrive_folder_id;
      if (formValues.gdrive_client_id) gd.client_id = formValues.gdrive_client_id;
      if (formValues.gdrive_client_secret) gd.client_secret = formValues.gdrive_client_secret;
      if (formValues.gdrive_user_email) gd.user_email = formValues.gdrive_user_email;
      backendConfig.google_drive = gd;
    }

    const profilePayload = {
      name,
      display_name: formValues.display_name.trim() || name,
      backend: formValues.backend,
      root,
      profile: {
        storage: { backend: formValues.backend, ...backendConfig },
        scope: { roots: [root] },
      },
    };

    try {
      if (editingName) {
        await api.updateAdminProfile(editingName, profilePayload);
        setStatus(`Updated profile ${editingName}.`);
      } else {
        await api.createAdminProfile(profilePayload);
        setStatus(`Created profile ${name}.`);
      }
      setDialogOpen(false);
      setEditingName(null);
      setFormValues(EMPTY_FORM);
      await Promise.all([load(), refreshProfiles()]);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to save profile.");
    } finally {
      setIsBusy(false);
    }
  };

  const testConnection = async (row: ProfileRow) => {
    setError(null);
    setStatus("");
    setConnectionResults((current) => ({
      ...current,
      [row.name]: {
        tone: "pending",
        message: `Connection test running for ${row.name} (${row.backend}).`,
      },
    }));
    try {
      const backend = await api.backendStatus();
      const state = backend.states?.[row.backend];
      if (state?.status === "healthy") {
        const message = `${row.name} connection test passed (${row.backend} is healthy).`;
        setConnectionResults((current) => ({
          ...current,
          [row.name]: { tone: "success", message },
        }));
        setStatus("");
        toast.push({
          title: "Connection test passed",
          description: message,
          variant: "success",
          timeoutMs: 5000,
        });
      } else {
        const description = `Connection test reported ${state?.status || "unknown"} for ${row.name}${state?.reason ? ` (${state.reason})` : ""}.`;
        setConnectionResults((current) => ({
          ...current,
          [row.name]: { tone: "warning", message: description },
        }));
        setStatus("");
        toast.push({
          title: "Connection test warning",
          description,
          variant: "warning",
          timeoutMs: 7000,
        });
      }
    } catch (testError) {
      const message = testError instanceof Error ? testError.message : "Connection test failed.";
      setError(message);
      setConnectionResults((current) => ({
        ...current,
        [row.name]: { tone: "error", message: `Connection test failed for ${row.name}: ${message}` },
      }));
      toast.push({
        title: "Connection test failed",
        description: message,
        variant: "destructive",
        timeoutMs: 7000,
      });
    }
  };

  const columns: DataColumn<ProfileRow>[] = [
    {
      id: "name",
      header: "Name",
      cell: (row) => (
        <span
          className="text-left cursor-pointer underline-offset-2 hover:underline"
          role="link"
          tabIndex={0}
          onClick={() => setSelectedProfile(row.name)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setSelectedProfile(row.name); }}
        >
          {row.name}
        </span>
      ),
      sortable: true,
      sortValue: (row) => row.name,
    },
    { id: "backend", header: "Backend", cell: (row) => row.backend, sortable: true, sortValue: (row) => row.backend },
    { id: "root", header: "Root", cell: (row) => <span className="font-mono text-xs break-all">{row.root || "-"}</span> },
    {
      id: "status",
      header: "Status",
      cell: (row) => <Badge variant={statusVariant(row.status)}>{row.status}</Badge>,
      sortable: true,
      sortValue: (row) => row.status,
    },
    { id: "reason", header: "Reason", cell: (row) => row.reason || "-" },
    { id: "keys", header: "API keys", cell: (row) => String(row.apiKeysCount), sortable: true, sortValue: (row) => row.apiKeysCount },
    {
      id: "updatedAt",
      header: "Updated",
      cell: (row) => <RelativeTime timestamp={row.updatedAt} />,
      sortable: true,
      sortValue: (row) => row.updatedAt,
    },
    {
      id: "actions",
      header: "Actions",
      cell: (row) => {
        const configured = isProfileConfigured(row.status);
        return (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1">
              <span className="sr-only">Use profile</span>
              <Tooltip content={configured ? "Set as active file browser profile" : "Profile must be configured before use"}>
                <Button
                  size="sm"
                  variant={selectedProfile === row.name ? "default" : "secondary"}
                  disabled={!configured}
                  onClick={() => {
                    setSelectedProfile(row.name);
                    navigate(`/file-browser?profile=${encodeURIComponent(row.name)}`);
                  }}
                >
                  Browse
                </Button>
              </Tooltip>
              {canManageProfiles ? (
                <>
                  <Button size="sm" variant="secondary" onClick={() => {
                    if (row.backend === "google-drive" || row.backend === "google_drive") {
                      navigate(`/google-drive-settings?profile=${encodeURIComponent(row.name)}`);
                    } else {
                      openEdit(row);
                    }
                  }}>
                    Configure
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => openEdit(row)}>
                    Edit
                  </Button>
                  <Tooltip content={configured ? "Test backend connectivity" : "Profile must be configured before testing"}>
                    <Button size="sm" variant="secondary" disabled={!configured} onClick={() => void testConnection(row)}>
                      Test connection
                    </Button>
                  </Tooltip>
                  <Button size="sm" variant="destructive" onClick={() => void deleteProfiles([row.name])}>
                    Delete
                  </Button>
                </>
              ) : null}
            </div>
            {connectionResults[row.name] ? (
              <p
                role="status"
                aria-live="polite"
                className={
                  connectionResults[row.name].tone === "success"
                    ? "text-xs text-emerald-700"
                    : connectionResults[row.name].tone === "warning" || connectionResults[row.name].tone === "pending"
                      ? "text-xs text-amber-700"
                      : "text-xs text-destructive"
                }
              >
                {connectionResults[row.name].message}
              </p>
            ) : null}
          </div>
        );
      },
    },
  ];

  const bulkActions = React.useMemo<BulkAction[]>(
    () => (canManageProfiles ? [{ label: "Delete selected", action: "delete" }] : []),
    [canManageProfiles]
  );

  const onBulkAction = React.useCallback(
    (action: string, selectedIds: string[]) => {
      if (action !== "delete") return;
      void deleteProfiles(selectedIds);
    },
    [deleteProfiles]
  );

  const mode: EntityFormMode = editingName ? "edit" : "add";

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Storage Profiles</h1>
          <p className="text-sm text-muted-foreground">
            These are backend storage definitions from <code>/admin/profiles</code>, not IDAM users/groups.
          </p>
          {!canManageProfiles ? (
            <p className="mt-1 text-sm text-muted-foreground">
              Read-only mode: profile create, edit, test, and delete actions require admin permissions.
            </p>
          ) : null}
        </div>
        {canManageProfiles ? <Button onClick={openCreate}>Add Storage Profile</Button> : null}
      </header>

      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      {status ? <p role="status" className="text-sm text-foreground/80">{status}</p> : null}

      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Configured profiles</h2>
            <Button variant="secondary" onClick={() => void load()}>
              Refresh
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Input
              className="max-w-md"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search profiles"
              aria-label="Search profiles"
            />
            <label className="flex items-center gap-2 text-sm text-muted-foreground select-none">
              <input
                type="checkbox"
                checked={showTemplates}
                onChange={(event) => setShowTemplates(event.target.checked)}
                aria-label="Show example template profiles"
              />
              Show example templates
              {hiddenTemplateCount > 0 ? (
                <span className="text-xs">({hiddenTemplateCount} hidden)</span>
              ) : null}
            </label>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <DataTable
            tableId="file-mcp-storage-profiles"
            columns={columns}
            rows={filteredRows}
            totalRows={rows.length}
            getRowId={(row) => row.id}
            emptyMessage="No storage profiles are configured."
            page={page}
            onPageChange={setPage}
            pageSize={pageSize}
            onPageSizeChange={setPageSize}
            selectable={canManageProfiles}
            bulkActions={bulkActions}
            onBulkAction={onBulkAction}
            columnPickerEnabled={true}
          />
        </CardContent>
      </Card>

      {/* Profile detail panel */}
      {(() => {
        const detailRow = rows.find((r) => r.name === selectedProfile);
        if (!detailRow) return null;
        const prof = detailRow.raw.profile ?? {};
        const storage = typeof prof === "object" && prof !== null ? (prof as Record<string, unknown>).storage : null;
        const storageObj = storage && typeof storage === "object" && !Array.isArray(storage) ? (storage as Record<string, unknown>) : {};
        const backendKey = detailRow.backend.replace("-", "_");
        const backendConfig = storageObj[backendKey] ?? {};
        const backendFields = backendConfig && typeof backendConfig === "object" && !Array.isArray(backendConfig) ? (backendConfig as Record<string, unknown>) : {};
        const healthState = backendStatus?.states?.[detailRow.backend] ?? backendStatus?.states?.[backendKey];

        const redact = (key: string, value: unknown): string => {
          if (value === null || value === undefined || String(value).trim() === "") return "(not set)";
          const secretKeys = ["secret", "password", "token", "access_key", "secret_key", "client_secret"];
          if (secretKeys.some((s) => key.toLowerCase().includes(s))) return "********";
          const raw = String(value);
          if (raw.startsWith("${")) return "(unresolved)";
          return raw;
        };

        return (
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">Profile Detail: {detailRow.name}</h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-x-8 gap-y-2 sm:grid-cols-2 text-sm">
                <div><span className="font-medium">Name:</span> {detailRow.name}</div>
                <div><span className="font-medium">Display Name:</span> {detailRow.displayName || "(none)"}</div>
                <div><span className="font-medium">Backend:</span> {detailRow.backend}</div>
                <div><span className="font-medium">Root:</span> <code className="text-xs">{detailRow.root || "(none)"}</code></div>
                <div><span className="font-medium">Status:</span> <Badge variant={statusVariant(detailRow.status)}>{detailRow.status}</Badge></div>
                <div><span className="font-medium">Reason:</span> {detailRow.reason || "-"}</div>
                <div><span className="font-medium">API Keys:</span> {detailRow.apiKeysCount}</div>
                <div><span className="font-medium">Updated:</span> <RelativeTime timestamp={detailRow.updatedAt} /></div>
                {healthState?.last_error ? (
                  <div className="sm:col-span-2"><span className="font-medium text-destructive">Last Error:</span> <code className="text-xs text-destructive">{healthState.last_error}</code></div>
                ) : null}
                {healthState?.updated_at ? (
                  <div><span className="font-medium">Last Health Check:</span> <RelativeTime timestamp={healthState.updated_at} /></div>
                ) : null}
              </div>
              {Object.keys(backendFields).length > 0 ? (
                <div>
                  <h3 className="text-sm font-semibold mb-2">{detailRow.backend} Configuration</h3>
                  <div className="rounded border bg-muted/20 p-3 text-xs font-mono space-y-1">
                    {Object.entries(backendFields).map(([key, value]) => (
                      <div key={key}><span className="text-muted-foreground">{key}:</span> {redact(key, value)}</div>
                    ))}
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        );
      })()}

      <EntityDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editingName ? "Edit Storage Profile" : "Add Storage Profile"}
        mode={mode}
        fields={fieldsForBackend(formValues.backend)}
        values={formValues as unknown as Record<string, unknown>}
        errors={error ? { name: error } : undefined}
        onChange={(name, value) => {
          setFormValues((current) => ({ ...current, [name]: String(value ?? "") }));
        }}
        submitLabel="Save"
        onSubmit={() => void onSubmit()}
        onCancel={() => setDialogOpen(false)}
      />

      {isBusy ? <p className="text-xs text-muted-foreground">Saving profile changes...</p> : null}
    </div>
  );
}
