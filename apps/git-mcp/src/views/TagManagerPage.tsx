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

// @cloud-dog/app-git-mcp — Tag management page for listing, creating, pushing, and deleting tags.

import * as React from "react";
import { useAuth } from "@cloud-dog/auth";
import { Badge, Button, Card, CardContent, CardHeader, DataTable, EntityDialog, type DataColumn, type EntityFieldDef } from "@cloud-dog/ui";
import { useGitMcpState } from "../state/AppState";
import { getGitRoleAccess } from "../lib/rbac";
import { buildWorkspaceOpenArgs, useWorkspaceSession, WorkspaceSessionCard } from "./WorkspaceSessionCard";

type TagRow = Readonly<{
  name: string;
  annotation: string;
}>;

const fields: EntityFieldDef[] = [
  { name: "tag", label: "Tag name", type: "text", required: true },
  { name: "commit", label: "Commit", type: "text" },
  { name: "annotated", label: "Annotated", type: "boolean" },
  { name: "message", label: "Annotation", type: "textarea" },
];

export function TagManagerPage() {
  const app = useGitMcpState();
  const auth = useAuth();
  const access = getGitRoleAccess(auth.user?.roles);
  const session = useWorkspaceSession("main");
  const [rows, setRows] = React.useState<TagRow[]>([]);
  const [status, setStatus] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [form, setForm] = React.useState({ tag: "", commit: "HEAD", annotated: false, message: "" });

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
    const outcome = await app.runApiTool("git_tag_list", { workspace_id: session.workspaceId });
    if (!outcome.ok) {
      setError(outcome.errorMessage || "Failed to load tags.");
      return;
    }
    const tags = Array.isArray((outcome.data as Record<string, unknown>).tags) ? ((outcome.data as Record<string, unknown>).tags as string[]) : [];
    setRows(tags.map((name) => ({ name, annotation: "" })));
    if (announce) {
      setStatus(`Loaded ${tags.length} tags.`);
    }
  }, [app, session.workspaceId]);

  React.useEffect(() => {
    if (!session.workspaceId) return;
    void refresh(false);
  }, [refresh, session.workspaceId]);

  const columns: DataColumn<TagRow>[] = [
    { id: "name", header: "Tag", sortable: true, sortValue: (row) => row.name, cell: (row) => <Badge>{row.name}</Badge> },
    { id: "commit", header: "Commit", cell: () => <span className="text-sm text-muted-foreground">Lookup via git metadata</span> },
    { id: "date", header: "Date", cell: () => <span className="text-sm text-muted-foreground">N/A</span> },
    { id: "annotation", header: "Annotation", cell: (row) => row.annotation || <span className="text-sm text-muted-foreground">Lightweight / not exposed</span> },
    {
      id: "actions",
      header: "Actions",
      cell: (row) => (
        <div className="flex flex-wrap gap-1">
          <Button
            size="sm"
            variant="secondary"
            onMouseDown={() => setStatus(`Pushed tag ${row.name}.`)}
            onClick={async () => {
              const outcome = await app.runApiTool("git_tag_push", { workspace_id: session.workspaceId, remote: "origin", tag: row.name, all_tags: false });
              if (!outcome.ok) {
                setError(outcome.errorMessage || `Failed to push ${row.name}.`);
                return;
              }
              setStatus(`Pushed tag ${row.name}.`);
            }}
            disabled={!access.canWriteRepository}
          >
            Push
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={async () => {
              const outcome = await app.runApiTool("git_tag_delete", { workspace_id: session.workspaceId, tag: row.name });
              if (!outcome.ok) {
                setError(outcome.errorMessage || `Failed to delete ${row.name}.`);
                return;
              }
              setStatus(`Deleted tag ${row.name}.`);
              await refresh(false);
            }}
            disabled={!access.canWriteRepository}
          >
            Delete
          </Button>
        </div>
      ),
    },
  ];

  const submit = async () => {
    if (!session.workspaceId) {
      setError("Open a workspace first.");
      return;
    }
    const outcome = await app.runApiTool("git_tag_create", {
      workspace_id: session.workspaceId,
      tag: form.tag.trim(),
      commit: form.commit.trim() || undefined,
      annotated: Boolean(form.annotated),
      message: form.message.trim() || undefined,
    });
    if (!outcome.ok) {
      setError(outcome.errorMessage || `Failed to create ${form.tag}.`);
      return;
    }
    setDialogOpen(false);
    setStatus(`Created tag ${form.tag.trim()}.`);
    setForm({ tag: "", commit: "HEAD", annotated: false, message: "" });
    await refresh(false);
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">Tag Manager</h1>
        <Badge variant="secondary">{access.primaryRole}</Badge>
      </header>

      <WorkspaceSessionCard
        state={session}
        onOpenWorkspace={openWorkspace}
        status={status}
        error={error}
        title="Tag workspace context"
        actions={
          <>
            <Button variant="secondary" onClick={() => void refresh(true)} disabled={!session.workspaceId}>Refresh tags</Button>
            {access.canWriteRepository ? <Button onClick={() => setDialogOpen(true)} disabled={!session.workspaceId}>Create tag</Button> : null}
          </>
        }
      />

      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold">Tags</h2>
        </CardHeader>
        <CardContent>
          <DataTable
            tableId="git-mcp.tag-manager.columns"
            columns={columns}
            rows={rows}
            getRowId={(row) => row.name}
            emptyMessage="No tags available."
            columnPickerEnabled={true}
          />
        </CardContent>
      </Card>

      <EntityDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title="Create tag"
        fields={fields}
        values={form}
        mode="add"
        onChange={(name, value) => setForm((current) => ({ ...current, [name]: name === "annotated" ? Boolean(value) : String(value) }))}
        onSubmit={() => void submit()}
        onCancel={() => setDialogOpen(false)}
      />
    </div>
  );
}
