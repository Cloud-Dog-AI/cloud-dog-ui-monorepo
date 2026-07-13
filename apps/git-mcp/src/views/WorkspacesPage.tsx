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

// @cloud-dog/app-git-mcp — Workspaces page (NEW, W28J-1310).
//
// Surfaces Workspace as a first-class user-facing entity (W28J-1302 decision).
// There is NO "Session ID" field anywhere here — the client owns session_id
// internally (see lib/session). Open/Close are client-side selection; Reopen is
// an idempotent POST that re-derives the same deterministic workspace_id.

import * as React from "react";
import { useNavigate } from "react-router-dom";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  DataTable,
  EntityDialog,
  Input,
  RelativeTime,
  useAuditLink,
  type DataColumn,
  type EntityFieldDef,
} from "@cloud-dog/ui";
import { useGitMcpState } from "../state/AppState";
import { getSelection, setCurrentWorkspace, clearCurrentWorkspace } from "../state/selection";
import type { WorkspaceRow } from "../lib/api";
import type { ProfileRecord } from "../lib/types";

type NewWorkspaceForm = Readonly<{ profileId: string; mode: string }>;

export function WorkspacesPage() {
  const app = useGitMcpState();
  const navigate = useNavigate();
  const { linkToWorkspace } = useAuditLink();

  const [rows, setRows] = React.useState<WorkspaceRow[]>([]);
  const [profiles, setProfiles] = React.useState<ProfileRecord[]>([]);
  const [current, setCurrent] = React.useState<string | undefined>(() => getSelection().workspaceId);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [form, setForm] = React.useState<NewWorkspaceForm>({ profileId: "", mode: "persistent" });
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [status, setStatus] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);

  const refresh = React.useCallback(async () => {
    setError(null);
    try {
      const [workspaces, profileList] = await Promise.all([
        app.api.listWorkspaces(app.apiKey, "me"),
        app.api.listProfiles(app.apiKey),
      ]);
      setRows(workspaces);
      setProfiles(profileList);
      setStatus(`Loaded ${workspaces.length} workspaces.`);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load workspaces.");
    }
  }, [app.api, app.apiKey]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  React.useEffect(() => {
    setPage(1);
  }, [query]);

  const openWorkspace = (row: WorkspaceRow) => {
    setCurrentWorkspace(row.workspace_id, row.profile_id);
    setCurrent(row.workspace_id);
    setStatus(`Workspace ${row.workspace_id} is now current.`);
  };

  const closeWorkspace = (row: WorkspaceRow) => {
    clearCurrentWorkspace();
    if (current === row.workspace_id) setCurrent(undefined);
    setStatus(`Closed workspace ${row.workspace_id} (it remains available to reopen).`);
  };

  const reopenWorkspace = async (row: WorkspaceRow) => {
    setError(null);
    const outcome = await app.api.createWorkspace(app.apiKey, row.profile_id, row.mode);
    if (!outcome.ok) {
      setError(outcome.errorMessage || `Failed to reopen ${row.workspace_id}.`);
      return;
    }
    setCurrentWorkspace(row.workspace_id, row.profile_id);
    setCurrent(row.workspace_id);
    setStatus(`Reopened workspace ${row.workspace_id}.`);
    await refresh();
  };

  const submitNew = async () => {
    const nextErrors: Record<string, string> = {};
    if (!form.profileId.trim()) nextErrors.profileId = "Choose a profile.";
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }
    setErrors({});
    setError(null);
    const outcome = await app.api.createWorkspace(app.apiKey, form.profileId.trim(), form.mode);
    if (!outcome.ok) {
      setError(outcome.errorMessage || "Workspace creation failed.");
      return;
    }
    setStatus(`Created workspace for profile ${form.profileId.trim()}.`);
    setDialogOpen(false);
    setForm({ profileId: "", mode: "persistent" });
    await refresh();
  };

  const columns: DataColumn<WorkspaceRow>[] = [
    {
      id: "workspace_id",
      header: "Workspace",
      cell: (row) => (
        <span className="font-mono text-xs">
          {row.workspace_id}
          {current === row.workspace_id ? <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium">current</span> : null}
        </span>
      ),
      sortable: true,
      sortValue: (row) => row.workspace_id,
    },
    { id: "profile", header: "Profile", cell: (row) => row.profile_id, sortable: true, sortValue: (row) => row.profile_id },
    { id: "mode", header: "Mode", cell: (row) => row.mode, sortable: true, sortValue: (row) => row.mode },
    { id: "current_ref", header: "Ref", cell: (row) => row.current_ref ?? "—", sortable: true, sortValue: (row) => row.current_ref ?? "" },
    { id: "is_open", header: "Open", cell: (row) => (row.is_open ? "Yes" : "No"), sortable: true, sortValue: (row) => (row.is_open ? "1" : "0") },
    {
      id: "last_used_at",
      header: "Last used",
      cell: (row) => <RelativeTime timestamp={row.last_used_at} />,
      sortable: true,
      sortValue: (row) => row.last_used_at,
    },
    { id: "path", header: "Path", cell: (row) => <span className="font-mono text-xs break-all">{row.path}</span> },
    {
      id: "actions",
      header: "Actions",
      cell: (row) => (
        <div className="flex flex-wrap gap-1">
          <Button size="sm" onClick={() => openWorkspace(row)}>Open</Button>
          <Button size="sm" variant="secondary" onClick={() => void reopenWorkspace(row)}>Reopen</Button>
          <Button size="sm" variant="secondary" onClick={() => closeWorkspace(row)}>Close</Button>
          <Button size="sm" variant="secondary" onClick={() => navigate(linkToWorkspace(row.workspace_id))}>
            Actions › View Audit
          </Button>
        </div>
      ),
    },
  ];

  const filtered = React.useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return rows;
    return rows.filter((row) => `${row.workspace_id} ${row.profile_id} ${row.mode} ${row.current_ref ?? ""}`.toLowerCase().includes(trimmed));
  }, [rows, query]);

  const profileFields: EntityFieldDef[] = [
    { name: "profileId", label: "Profile", type: "select", required: true, options: profiles.map((p) => p.name) },
    { name: "mode", label: "Mode", type: "select", required: true, options: ["persistent", "ephemeral"] },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">Workspaces</h1>
        <Button onClick={() => { setForm({ profileId: profiles[0]?.name ?? "", mode: "persistent" }); setDialogOpen(true); }}>
          + New Workspace
        </Button>
      </header>

      <p className="text-sm text-muted-foreground">
        A <strong>Workspace</strong> is an on-disk checkout produced from a Profile. Open one to make it current; it then
        flows into Browser, Commits, Diff, Branches and the rest. You never set a session id — it is managed for you.
      </p>

      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      {status ? <p role="status" className="text-sm text-foreground/80">{status}</p> : null}

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Your workspaces</h2>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Input
              className="max-w-md"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search workspaces..."
              aria-label="Search workspaces"
            />
            <Button variant="secondary" onClick={() => void refresh()}>Refresh</Button>
          </div>
          <DataTable
            tableId="git-mcp.workspaces.columns"
            columns={columns}
            rows={filtered}
            totalRows={rows.length}
            getRowId={(row) => row.workspace_id}
            emptyMessage="No workspaces yet. Use “+ New Workspace” to open one from a profile."
            page={page}
            onPageChange={setPage}
            pageSize={pageSize}
            onPageSizeChange={setPageSize}
            columnPickerEnabled={true}
          />
          <p className="text-xs text-muted-foreground">Total records: {rows.length}</p>
        </CardContent>
      </Card>

      <EntityDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setErrors({});
        }}
        title="New Workspace"
        fields={profileFields}
        values={form}
        errors={errors}
        mode="add"
        onChange={(name, value) => setForm((current) => ({ ...current, [name]: String(value) }))}
        onSubmit={() => void submitNew()}
        onCancel={() => { setDialogOpen(false); setErrors({}); }}
      />
    </div>
  );
}
