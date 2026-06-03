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

// @cloud-dog/app-git-mcp — Commit history page for filtered log browsing and commit detail review.

import * as React from "react";
import { Badge, Button, Card, CardContent, CardHeader, DataTable, Input, JsonBlock, Label, RelativeTime, type DataColumn } from "@cloud-dog/ui";
import { useGitMcpState } from "../state/AppState";
import { buildWorkspaceOpenArgs, useWorkspaceSession, WorkspaceSessionCard } from "./WorkspaceSessionCard";
import { parseDiffSummary, parseGitLogOutput, type CommitRecord, type DiffSummaryRow } from "../lib/gitUi";

export function CommitLogPage() {
  const app = useGitMcpState();
  const session = useWorkspaceSession("main");
  const [author, setAuthor] = React.useState("");
  const [since, setSince] = React.useState("");
  const [until, setUntil] = React.useState("");
  const [filePath, setFilePath] = React.useState("");
  const [commits, setCommits] = React.useState<CommitRecord[]>([]);
  const [selectedCommit, setSelectedCommit] = React.useState<CommitRecord | null>(null);
  const [changedFiles, setChangedFiles] = React.useState<DiffSummaryRow[]>([]);
  const [status, setStatus] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);

  const openWorkspace = React.useCallback(async () => {
    setError(null);
    const outcome = await app.runApiTool("repo_open", buildWorkspaceOpenArgs(session));
    if (!outcome.ok) {
      setError(outcome.errorMessage || "Failed to open workspace.");
      return;
    }
    setStatus(`Opened workspace ${String((outcome.data as Record<string, unknown>).workspace_id ?? "").trim()}.`);
  }, [app, session]);

  const loadLog = React.useCallback(async () => {
    if (!session.workspaceId) {
      setError("Open a workspace first.");
      return;
    }
    setError(null);
    const outcome = await app.runApiTool("git_log", {
      workspace_id: session.workspaceId,
      author: author.trim() || undefined,
      since: since.trim() || undefined,
      until: until.trim() || undefined,
      path: filePath.trim() || undefined,
      max_count: pageSize * 5,
    });
    if (!outcome.ok) {
      setError(outcome.errorMessage || "Failed to load commit history.");
      return;
    }
    const nextCommits = parseGitLogOutput(String((outcome.data as Record<string, unknown>).log ?? ""));
    setCommits(nextCommits);
    setSelectedCommit(nextCommits[0] ?? null);
    setChangedFiles([]);
    setStatus(`Loaded ${nextCommits.length} commits.`);
  }, [app, author, filePath, pageSize, session.workspaceId, since, until]);

  React.useEffect(() => {
    if (!selectedCommit || !session.workspaceId) return;
    void (async () => {
      const outcome = await app.runApiTool("git_diff", {
        workspace_id: session.workspaceId,
        left: `${selectedCommit.hash}^`,
        right: selectedCommit.hash,
      });
      if (!outcome.ok) {
        setChangedFiles([]);
        return;
      }
      setChangedFiles(parseDiffSummary(String((outcome.data as Record<string, unknown>).diff ?? "")));
    })();
  }, [app, selectedCommit, session.workspaceId]);

  const columns: DataColumn<CommitRecord>[] = [
    {
      id: "hash",
      header: "Commit",
      sortable: true,
      sortValue: (row) => row.hash,
      cell: (row) => (
        <Button type="button" className="font-mono text-primary hover:underline" onClick={() => setSelectedCommit(row)}>
          {row.hash.slice(0, 12)}
        </Button>
      ),
    },
    { id: "author", header: "Author", sortable: true, sortValue: (row) => row.author, cell: (row) => row.author || "Unknown" },
    {
      id: "date",
      header: "Date",
      sortable: true,
      sortValue: (row) => row.date,
      cell: (row) => row.date ? <RelativeTime timestamp={new Date(row.date).toISOString()} /> : "N/A",
    },
    { id: "message", header: "Message", sortable: true, sortValue: (row) => row.message, cell: (row) => row.message },
    { id: "merge", header: "Type", sortable: true, sortValue: (row) => (row.merge ? "merge" : "commit"), cell: (row) => row.merge ? <Badge>Merge</Badge> : <Badge variant="secondary">Commit</Badge> },
  ];

  const changedFileColumns: DataColumn<DiffSummaryRow>[] = [
    { id: "path", header: "Path", sortable: true, sortValue: (row) => row.path, cell: (row) => row.path },
    { id: "adds", header: "Additions", sortable: true, sortValue: (row) => row.additions, cell: (row) => row.additions },
    { id: "dels", header: "Deletions", sortable: true, sortValue: (row) => row.deletions, cell: (row) => row.deletions },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">Commit Log Viewer</h1>
        {selectedCommit ? <Badge variant="secondary">{selectedCommit.hash.slice(0, 12)}</Badge> : null}
      </header>

      <WorkspaceSessionCard
        state={session}
        onOpenWorkspace={openWorkspace}
        status={status}
        error={error}
        title="Commit history context"
        actions={
          <>
            <label className="space-y-2">
              <Label htmlFor="commit-log-author">Author</Label>
              <Input id="commit-log-author" value={author} onChange={(event) => setAuthor(event.target.value)} placeholder="Filter by author" />
            </label>
            <label className="space-y-2">
              <Label htmlFor="commit-log-since">Since</Label>
              <Input id="commit-log-since" value={since} onChange={(event) => setSince(event.target.value)} placeholder="2026-04-01" />
            </label>
            <label className="space-y-2">
              <Label htmlFor="commit-log-until">Until</Label>
              <Input id="commit-log-until" value={until} onChange={(event) => setUntil(event.target.value)} placeholder="2026-04-30" />
            </label>
            <label className="space-y-2">
              <Label htmlFor="commit-log-path">Path</Label>
              <Input id="commit-log-path" value={filePath} onChange={(event) => setFilePath(event.target.value)} placeholder="src/README.md" />
            </label>
            <Button variant="secondary" onClick={() => void loadLog()} disabled={!session.workspaceId}>Load commits</Button>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold">History</h2>
          </CardHeader>
          <CardContent>
            <DataTable
              tableId="git-mcp.commit-log.columns"
              columns={columns}
              rows={commits}
              totalRows={commits.length}
              getRowId={(row) => row.hash}
              emptyMessage="No commits matched the current filters."
              page={page}
              onPageChange={setPage}
              pageSize={pageSize}
              onPageSizeChange={setPageSize}
              columnPickerEnabled={true}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold">Commit detail</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedCommit ? (
              <>
                <JsonBlock
                  title={selectedCommit.hash}
                  value={{
                    hash: selectedCommit.hash,
                    author: selectedCommit.author,
                    date: selectedCommit.date,
                    message: selectedCommit.message,
                    body: selectedCommit.body,
                  }}
                  defaultCollapsed={false}
                />
                <DataTable
                  tableId="git-mcp.commit-detail-files.columns"
                  columns={changedFileColumns}
                  rows={changedFiles}
                  getRowId={(row) => row.path}
                  emptyMessage="No changed-file summary available for the selected commit."
                  columnPickerEnabled={true}
                />
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Select a commit to inspect its details.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
