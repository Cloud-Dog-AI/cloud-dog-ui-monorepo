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

// @cloud-dog/app-git-mcp — Merge and conflict-resolution page for merge, rebase, and manual conflict handling.

import * as React from "react";
import { useAuth } from "@cloud-dog/auth";
import { Badge, Button, Card, CardContent, CardHeader, DataTable, Input, JsonBlock, Label, Switch, Textarea, type DataColumn } from "@cloud-dog/ui";
import { useGitMcpState } from "../state/AppState";
import { parseConflictMarkers } from "../lib/gitUi";
import { getGitRoleAccess } from "../lib/rbac";
import { buildWorkspaceOpenArgs, useWorkspaceSession, WorkspaceSessionCard } from "./WorkspaceSessionCard";

type ConflictRow = Readonly<{ path: string }>;

export function MergePage() {
  const app = useGitMcpState();
  const auth = useAuth();
  const access = getGitRoleAccess(auth.user?.roles);
  const session = useWorkspaceSession("main");
  const [mergeRef, setMergeRef] = React.useState("");
  const [rebaseOnto, setRebaseOnto] = React.useState("main");
  const [ffOnly, setFfOnly] = React.useState(false);
  const [conflicts, setConflicts] = React.useState<ConflictRow[]>([]);
  const [selectedConflict, setSelectedConflict] = React.useState("");
  const [conflictContent, setConflictContent] = React.useState("");
  const [manualContent, setManualContent] = React.useState("");
  const [latest, setLatest] = React.useState<unknown>({});
  const [status, setStatus] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const openWorkspace = React.useCallback(async () => {
    setError(null);
    const outcome = await app.runApiTool("repo_open", buildWorkspaceOpenArgs(session));
    if (!outcome.ok) {
      setError(outcome.errorMessage || "Failed to open workspace.");
      return;
    }
    setStatus(`Opened workspace ${String((outcome.data as Record<string, unknown>).workspace_id ?? "").trim()}.`);
  }, [app, session]);

  const refreshConflicts = React.useCallback(async () => {
    if (!session.workspaceId) return;
    const outcome = await app.runApiTool("git_conflicts_list", { workspace_id: session.workspaceId });
    setLatest(outcome.data);
    if (!outcome.ok) {
      setError(outcome.errorMessage || "Failed to list conflicts.");
      return;
    }
    const rows = Array.isArray((outcome.data as Record<string, unknown>).conflicts)
      ? ((outcome.data as Record<string, unknown>).conflicts as string[]).map((path) => ({ path }))
      : [];
    setConflicts(rows);
    if (rows[0]) setSelectedConflict((current) => current || rows[0].path);
    setStatus(`Loaded ${rows.length} conflict file(s).`);
  }, [app, session.workspaceId]);

  React.useEffect(() => {
    if (!selectedConflict || !session.workspaceId) return;
    void (async () => {
      const outcome = await app.runApiTool("file_read", { workspace_id: session.workspaceId, path: selectedConflict });
      if (!outcome.ok) return;
      const content = String((outcome.data as Record<string, unknown>).content ?? "");
      setConflictContent(content);
      setManualContent(content);
    })();
  }, [app, selectedConflict, session.workspaceId]);

  const runTool = async (toolName: string, args: Record<string, unknown>, successMessage: string) => {
    setError(null);
    const outcome = await app.runApiTool(toolName, args);
    setLatest(outcome.data);
    if (!outcome.ok) {
      setError(outcome.errorMessage || `${toolName} failed.`);
      return;
    }
    setStatus(successMessage);
    await refreshConflicts();
    setStatus(successMessage);
  };

  const conflictColumns: DataColumn<ConflictRow>[] = [
    { id: "path", header: "Conflict file", sortable: true, sortValue: (row) => row.path, cell: (row) => row.path },
    {
      id: "actions",
      header: "Actions",
      cell: (row) => (
        <div className="flex flex-wrap gap-1">
          <Button size="sm" variant="secondary" onClick={() => setSelectedConflict(row.path)}>Inspect</Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => void runTool("git_conflict_resolve", { workspace_id: session.workspaceId, mode: "ours", paths: [row.path] }, `Resolved ${row.path} with ours.`)}
            disabled={!access.canManageMerges}
          >
            Ours
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => void runTool("git_conflict_resolve", { workspace_id: session.workspaceId, mode: "theirs", paths: [row.path] }, `Resolved ${row.path} with theirs.`)}
            disabled={!access.canManageMerges}
          >
            Theirs
          </Button>
        </div>
      ),
    },
  ];

  const sections = React.useMemo(() => parseConflictMarkers(conflictContent), [conflictContent]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">Merge & Conflict Resolution</h1>
        <Badge variant="secondary">{access.primaryRole}</Badge>
      </header>

      <WorkspaceSessionCard
        state={session}
        onOpenWorkspace={openWorkspace}
        status={status}
        error={error}
        title="Merge workspace context"
        actions={
          <>
            <label className="space-y-2">
              <Label htmlFor="merge-ref">Merge ref</Label>
              <Input id="merge-ref" value={mergeRef} onChange={(event) => setMergeRef(event.target.value)} placeholder="feature/my-branch" />
            </label>
            <label className="space-y-2">
              <Label htmlFor="rebase-onto">Rebase onto</Label>
              <Input id="rebase-onto" value={rebaseOnto} onChange={(event) => setRebaseOnto(event.target.value)} />
            </label>
            <div className="flex items-center gap-2 pt-7">
              <Switch checked={ffOnly} onCheckedChange={setFfOnly} aria-label="Fast-forward only" />
              <span className="text-sm">Fast-forward only</span>
            </div>
            <Button variant="secondary" onClick={() => void runTool("git_merge", { workspace_id: session.workspaceId, ref: mergeRef.trim(), ff_only: ffOnly }, `Merge requested for ${mergeRef.trim()}.`)} disabled={!session.workspaceId || !mergeRef.trim() || !access.canManageMerges}>
              Start merge
            </Button>
            <Button variant="secondary" onClick={() => void runTool("git_rebase", { workspace_id: session.workspaceId, onto: rebaseOnto.trim() }, `Rebase requested onto ${rebaseOnto.trim()}.`)} disabled={!session.workspaceId || !rebaseOnto.trim() || !access.canManageMerges}>
              Start rebase
            </Button>
            <Button variant="secondary" onClick={() => void runTool("git_merge_abort", { workspace_id: session.workspaceId }, "Merge aborted.")} disabled={!session.workspaceId || !access.canManageMerges}>
              Abort merge
            </Button>
            <Button variant="secondary" onClick={() => void runTool("git_merge_continue", { workspace_id: session.workspaceId }, "Merge continued.")} disabled={!session.workspaceId || !access.canManageMerges}>
              Continue merge
            </Button>
            <Button variant="secondary" onClick={() => void runTool("git_rebase_abort", { workspace_id: session.workspaceId }, "Rebase aborted.")} disabled={!session.workspaceId || !access.canManageMerges}>
              Abort rebase
            </Button>
            <Button variant="secondary" onClick={() => void runTool("git_rebase_continue", { workspace_id: session.workspaceId }, "Rebase continued.")} disabled={!session.workspaceId || !access.canManageMerges}>
              Continue rebase
            </Button>
            <Button variant="secondary" onClick={() => void refreshConflicts()} disabled={!session.workspaceId}>
              Refresh conflicts
            </Button>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold">Conflict files</h2>
          </CardHeader>
          <CardContent>
            <DataTable
              tableId="git-mcp.merge-conflicts.columns"
              columns={conflictColumns}
              rows={conflicts}
              getRowId={(row) => row.path}
              emptyMessage="No conflicts detected."
              columnPickerEnabled={true}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-semibold">Conflict view</h2>
              {selectedConflict ? <Badge variant="secondary">{selectedConflict}</Badge> : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selectedConflict ? (
              <p className="text-sm text-muted-foreground">Select a conflict file to inspect the three-way view.</p>
            ) : (
              <>
                <div className="grid gap-4 xl:grid-cols-3">
                  <div className="rounded-lg border border-border/70 p-3">
                    <h3 className="text-lg font-semibold">Ours</h3>
                    <pre className="mt-2 max-h-[240px] overflow-auto whitespace-pre-wrap font-mono text-xs">{sections.ours || "No ours block detected."}</pre>
                  </div>
                  <div className="rounded-lg border border-border/70 p-3">
                    <h3 className="text-lg font-semibold">Theirs</h3>
                    <pre className="mt-2 max-h-[240px] overflow-auto whitespace-pre-wrap font-mono text-xs">{sections.theirs || "No theirs block detected."}</pre>
                  </div>
                  <div className="rounded-lg border border-border/70 p-3">
                    <h3 className="text-lg font-semibold">Result</h3>
                    <pre className="mt-2 max-h-[240px] overflow-auto whitespace-pre-wrap font-mono text-xs">{sections.result || "No result content loaded."}</pre>
                  </div>
                </div>
                <div className="space-y-3">
                  <Label htmlFor="merge-manual-editor">Manual resolution</Label>
                  <Textarea id="merge-manual-editor" rows={14} value={manualContent} onChange={(event) => setManualContent(event.target.value)} disabled={!access.canManageMerges} />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={() => void runTool("git_conflict_resolve_manual", { workspace_id: session.workspaceId, path: selectedConflict, content: manualContent }, `Resolved ${selectedConflict} manually.`)}
                      disabled={!session.workspaceId || !selectedConflict || !access.canManageMerges}
                    >
                      Apply manual resolution
                    </Button>
                    <Button variant="secondary" onClick={() => setManualContent(conflictContent)} disabled={!selectedConflict}>
                      Reset editor
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold">Latest tool payload</h2>
        </CardHeader>
        <CardContent>
          <JsonBlock title="Merge tooling" value={latest} defaultCollapsed={false} />
        </CardContent>
      </Card>
    </div>
  );
}
