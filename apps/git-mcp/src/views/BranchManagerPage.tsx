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

// @cloud-dog/app-git-mcp — Branch management page for listing, creating, switching, and deleting branches.

import * as React from "react";
import { useAuth } from "@cloud-dog/auth";
import { Badge, Button, Card, CardContent, CardHeader, DataTable, EntityDialog, type DataColumn, type EntityFieldDef } from "@cloud-dog/ui";
import { useGitMcpState } from "../state/AppState";
import { buildWorkspaceOpenArgs, useWorkspaceSession, WorkspaceSessionCard } from "./WorkspaceSessionCard";
import { getGitRoleAccess } from "../lib/rbac";

type BranchRow = Readonly<{
  name: string;
  isCurrent: boolean;
  protectedBranch: boolean;
}>;

const fields: EntityFieldDef[] = [
  { name: "name", label: "Branch name", type: "text", required: true },
  { name: "fromRef", label: "From ref", type: "text", required: true },
];

export function BranchManagerPage() {
  const app = useGitMcpState();
  const auth = useAuth();
  const session = useWorkspaceSession("main");
  const access = getGitRoleAccess(auth.user?.roles);
  const [branches, setBranches] = React.useState<BranchRow[]>([]);
  const [status, setStatus] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [form, setForm] = React.useState({ name: "", fromRef: "HEAD" });

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
    setError(null);
    const outcome = await app.runApiTool("git_branch_list", { workspace_id: session.workspaceId });
    if (!outcome.ok) {
      setError(outcome.errorMessage || "Failed to load branches.");
      return;
    }
    const names = Array.isArray((outcome.data as Record<string, unknown>).branches) ? ((outcome.data as Record<string, unknown>).branches as string[]) : [];
    setBranches(
      names.map((name) => ({
        name,
        isCurrent: name === session.refName,
        protectedBranch: name === "main" || name === "master",
      })),
    );
    if (announce) {
      setStatus(`Loaded ${names.length} branches.`);
    }
  }, [app, session.refName, session.workspaceId]);

  React.useEffect(() => {
    if (!session.workspaceId) return;
    void refresh(false);
  }, [refresh, session.workspaceId]);

  const columns: DataColumn<BranchRow>[] = [
    { id: "name", header: "Branch", sortable: true, sortValue: (row) => row.name, cell: (row) => row.name },
    { id: "current", header: "Current", sortable: true, sortValue: (row) => (row.isCurrent ? 1 : 0), cell: (row) => row.isCurrent ? <Badge>Current</Badge> : <Badge variant="secondary">Available</Badge> },
    { id: "protected", header: "Protected", sortable: true, sortValue: (row) => (row.protectedBranch ? 1 : 0), cell: (row) => row.protectedBranch ? <Badge variant="destructive">Protected</Badge> : <span className="text-sm text-muted-foreground">No</span> },
    { id: "last", header: "Last commit", cell: () => <span className="text-sm text-muted-foreground">Current workspace ref</span> },
    {
      id: "actions",
      header: "Actions",
      cell: (row) => (
        <div className="flex flex-wrap gap-1">
          <Button
            size="sm"
            variant="secondary"
            onClick={async () => {
              const outcome = await app.runApiTool("git_checkout", {
                workspace_id: session.workspaceId,
                ref: row.name,
              });
              if (!outcome.ok) {
                setError(outcome.errorMessage || `Failed to switch to ${row.name}.`);
                return;
              }
              session.setRefName(row.name);
              setStatus(`Checked out ${row.name}.`);
              await refresh(false);
            }}
            disabled={!access.canManageBranches}
          >
            Switch
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={async () => {
              const outcome = await app.runApiTool("git_branch_delete", {
                workspace_id: session.workspaceId,
                name: row.name,
                force: !row.protectedBranch,
              });
              if (!outcome.ok) {
                setError(outcome.errorMessage || `Failed to delete ${row.name}.`);
                return;
              }
              setStatus(`Deleted branch ${row.name}.`);
              await refresh(false);
            }}
            disabled={!access.canManageBranches || row.isCurrent || row.protectedBranch}
          >
            Delete
          </Button>
        </div>
      ),
    },
  ];

  const submitCreate = async () => {
    if (!session.workspaceId) {
      setError("Open a workspace first.");
      return;
    }
    const outcome = await app.runApiTool("git_branch_create", {
      workspace_id: session.workspaceId,
      name: form.name.trim(),
      from_ref: form.fromRef.trim() || "HEAD",
    });
    if (!outcome.ok) {
      setError(outcome.errorMessage || `Failed to create ${form.name}.`);
      return;
    }
    setDialogOpen(false);
    setStatus(`Created branch ${form.name.trim()}.`);
    setForm({ name: "", fromRef: "HEAD" });
    await refresh(false);
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">Branch Manager</h1>
        <Badge variant="secondary">{access.primaryRole}</Badge>
      </header>

      <WorkspaceSessionCard
        state={session}
        onOpenWorkspace={openWorkspace}
        status={status}
        error={error}
        title="Branch workspace context"
        actions={
          <>
            <Button variant="secondary" onClick={() => void refresh(true)} disabled={!session.workspaceId}>Refresh branches</Button>
            {access.canManageBranches ? <Button onClick={() => setDialogOpen(true)} disabled={!session.workspaceId}>Create branch</Button> : null}
          </>
        }
      />

      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold">Branches</h2>
        </CardHeader>
        <CardContent>
          <DataTable
            tableId="git-mcp.branch-manager.columns"
            columns={columns}
            rows={branches}
            getRowId={(row) => row.name}
            emptyMessage="No branches available."
            columnPickerEnabled={true}
          />
        </CardContent>
      </Card>

      <EntityDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title="Create branch"
        fields={fields}
        values={form}
        mode="add"
        onChange={(name, value) => setForm((current) => ({ ...current, [name]: String(value) }))}
        onSubmit={() => void submitCreate()}
        onCancel={() => setDialogOpen(false)}
      />
    </div>
  );
}
