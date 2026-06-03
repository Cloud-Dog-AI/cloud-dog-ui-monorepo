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

// @cloud-dog/app-git-mcp — Stash management page for listing, saving, and restoring stash entries.

import * as React from "react";
import { useAuth } from "@cloud-dog/auth";
import { Badge, Button, Card, CardContent, CardHeader, DataTable, EntityDialog, JsonBlock, type DataColumn, type EntityFieldDef } from "@cloud-dog/ui";
import { useGitMcpState } from "../state/AppState";
import { parseStashList, type StashRecord } from "../lib/gitUi";
import { getGitRoleAccess } from "../lib/rbac";
import { buildWorkspaceOpenArgs, useWorkspaceSession, WorkspaceSessionCard } from "./WorkspaceSessionCard";

const fields: EntityFieldDef[] = [{ name: "message", label: "Stash message", type: "text", required: true }];

function stashListText(value: unknown): string {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const record = value as Record<string, unknown>;
  if (typeof record.result === "string") return record.result;
  if (typeof record.data === "string") return record.data;
  if (record.result && typeof record.result === "object" && !Array.isArray(record.result)) {
    const nested = record.result as Record<string, unknown>;
    if (typeof nested.result === "string") return nested.result;
    if (typeof nested.data === "string") return nested.data;
  }
  if (record.data && typeof record.data === "object" && !Array.isArray(record.data)) {
    const nested = record.data as Record<string, unknown>;
    if (typeof nested.result === "string") return nested.result;
    if (typeof nested.data === "string") return nested.data;
  }
  return "";
}

export function StashManagerPage() {
  const app = useGitMcpState();
  const auth = useAuth();
  const access = getGitRoleAccess(auth.user?.roles);
  const session = useWorkspaceSession("main");
  const [rows, setRows] = React.useState<StashRecord[]>([]);
  const [selected, setSelected] = React.useState<StashRecord | null>(null);
  const [status, setStatus] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [message, setMessage] = React.useState("ui-stash");

  const openWorkspace = React.useCallback(async () => {
    setError(null);
    const outcome = await app.runApiTool("repo_open", buildWorkspaceOpenArgs(session));
    if (!outcome.ok) {
      setError(outcome.errorMessage || "Failed to open workspace.");
      return;
    }
    setStatus(`Opened workspace ${String((outcome.data as Record<string, unknown>).workspace_id ?? "").trim()}.`);
  }, [app, session]);

  const refresh = React.useCallback(async (announce = true) => {
    if (!session.workspaceId) return;
    const outcome = await app.runApiTool("git_stash_list", { workspace_id: session.workspaceId });
    if (!outcome.ok) {
      setError(outcome.errorMessage || "Failed to load stashes.");
      return;
    }
    const nextRows = parseStashList(stashListText(outcome.data));
    setRows(nextRows);
    setSelected(nextRows[0] ?? null);
    if (announce) {
      setStatus(`Loaded ${nextRows.length} stash entries.`);
    }
  }, [app, session.workspaceId]);

  React.useEffect(() => {
    if (!session.workspaceId) return;
    void refresh(false);
  }, [refresh, session.workspaceId]);

  const columns: DataColumn<StashRecord>[] = [
    { id: "index", header: "Index", sortable: true, sortValue: (row) => row.index, cell: (row) => row.index },
    { id: "ref", header: "Ref", sortable: true, sortValue: (row) => row.ref, cell: (row) => <Badge variant="secondary">{row.ref}</Badge> },
    { id: "branch", header: "Branch", sortable: true, sortValue: (row) => row.branch, cell: (row) => row.branch },
    { id: "message", header: "Message", sortable: true, sortValue: (row) => row.message, cell: (row) => row.message },
    { id: "files", header: "File count", cell: () => <span className="text-sm text-muted-foreground">Not exposed by tool</span> },
    {
      id: "actions",
      header: "Actions",
      cell: (row) => (
        <div className="flex flex-wrap gap-1">
          <Button size="sm" variant="secondary" onClick={() => setSelected(row)}>Inspect</Button>
          <Button
            size="sm"
            onClick={async () => {
              const outcome = await app.runApiTool("git_stash_pop", { workspace_id: session.workspaceId });
              if (!outcome.ok) {
                setError(outcome.errorMessage || "Failed to pop latest stash.");
                return;
              }
              setStatus(`Popped ${row.ref}.`);
              await refresh(false);
            }}
            disabled={!access.canWriteRepository || row.index !== 0}
          >
            Pop latest
          </Button>
        </div>
      ),
    },
  ];

  const saveStash = async () => {
    if (!session.workspaceId) {
      setError("Open a workspace first.");
      return;
    }
    const outcome = await app.runApiTool("git_stash_save", { workspace_id: session.workspaceId, message: message.trim() });
    if (!outcome.ok) {
      setError(outcome.errorMessage || "Failed to save stash.");
      return;
    }
    setDialogOpen(false);
    setStatus(`Saved stash ${message.trim()}.`);
    await refresh(false);
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">Stash Manager</h1>
        <Badge variant="secondary">{access.primaryRole}</Badge>
      </header>

      <WorkspaceSessionCard
        state={session}
        onOpenWorkspace={openWorkspace}
        status={status}
        error={error}
        title="Stash workspace context"
        actions={
          <>
            <Button variant="secondary" onClick={() => void refresh(true)} disabled={!session.workspaceId}>Refresh stashes</Button>
            {access.canWriteRepository ? <Button onClick={() => setDialogOpen(true)} disabled={!session.workspaceId}>Save stash</Button> : null}
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold">Stash entries</h2>
          </CardHeader>
          <CardContent>
            <DataTable
              tableId="git-mcp.stash-manager.columns"
              columns={columns}
              rows={rows}
              getRowId={(row) => row.ref}
              emptyMessage="No stash entries available."
              columnPickerEnabled={true}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold">Selected stash</h2>
          </CardHeader>
          <CardContent>
            <JsonBlock title={selected?.ref ?? "Stash detail"} value={selected ?? { state: "No stash selected." }} defaultCollapsed={false} />
          </CardContent>
        </Card>
      </div>

      <EntityDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title="Save stash"
        fields={fields}
        values={{ message }}
        mode="add"
        onChange={(_name, value) => setMessage(String(value))}
        onSubmit={() => void saveStash()}
        onCancel={() => setDialogOpen(false)}
      />
    </div>
  );
}
