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
import { Badge, Button, Card, CardContent, CardHeader, Combobox, DataTable, DateRangePicker, JsonBlock, Label, SessionsHistoryPanel, fromISODate, toISODate, type ComboboxOption, type DataColumn } from "@cloud-dog/ui";
import type { SessionsHistoryAction, SessionsHistoryRow } from "@cloud-dog/ui";
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
  // GM-CM-03: author/path filters are populated comboboxes (allowCustom keeps free-text filtering available).
  const [authorOptions, setAuthorOptions] = React.useState<ComboboxOption[]>([]);
  const [pathOptions, setPathOptions] = React.useState<ComboboxOption[]>([]);

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

  React.useEffect(() => {
    if (!session.workspaceId) {
      setAuthorOptions([]);
      setPathOptions([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const [authors, paths] = await Promise.all([
          app.api.listWorkspaceAuthors(app.apiKey, session.workspaceId),
          app.api.listWorkspacePaths(app.apiKey, session.workspaceId),
        ]);
        if (cancelled) return;
        setAuthorOptions(authors.map((row) => ({ value: row.value, label: row.label })));
        setPathOptions(paths.map((row) => ({ value: row.value, label: row.label })));
      } catch {
        // Selectors degrade gracefully to free-text entry (Combobox allowCustom).
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [app.api, app.apiKey, session.workspaceId]);

  const commitByHash = React.useMemo(() => new Map(commits.map((commit) => [commit.hash, commit])), [commits]);

  const panelRows = React.useMemo<SessionsHistoryRow[]>(() => commits.map((commit) => ({
    id: commit.hash,
    label: commit.hash.slice(0, 12),
    title: <span className="font-mono">{commit.hash.slice(0, 12)}</span>,
    status: "Completed",
    actor: commit.author || "Unknown",
    target: session.workspaceId ?? "Workspace",
    createdAt: commit.date ? new Date(commit.date).toISOString() : undefined,
    retention: "Git history",
    summary: commit.message,
    details: [
      { label: "Hash", value: <span className="font-mono text-xs">{commit.hash}</span> },
      { label: "Author", value: commit.author || "Unknown" },
      { label: "Type", value: commit.merge ? <Badge>Merge</Badge> : <Badge variant="secondary">Commit</Badge> },
      { label: "Message", value: commit.message },
      ...(commit.body ? [{ label: "Body", value: <span className="whitespace-pre-wrap">{commit.body}</span> }] : []),
    ],
  })), [commits, session.workspaceId]);

  const rowActions = React.useCallback((row: SessionsHistoryRow): SessionsHistoryAction[] => [
    {
      id: "inspect",
      label: "Inspect",
      onClick: () => {
        const commit = commitByHash.get(row.id);
        if (commit) setSelectedCommit(commit);
      },
    },
  ], [commitByHash]);

  const changedFileColumns: DataColumn<DiffSummaryRow>[] = [
    { id: "path", header: "Path", sortable: true, sortValue: (row) => row.path, cell: (row) => row.path },
    { id: "adds", header: "Additions", sortable: true, sortValue: (row) => row.additions, cell: (row) => row.additions },
    { id: "dels", header: "Deletions", sortable: true, sortValue: (row) => row.deletions, cell: (row) => row.deletions },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">Commit History</h1>
        {selectedCommit ? <Badge variant="secondary">{selectedCommit.hash.slice(0, 12)}</Badge> : null}
      </header>

      <WorkspaceSessionCard
        state={session}
        onOpenWorkspace={openWorkspace}
        status={status}
        error={error}
        title="Commit History Context"
        actions={
          <>
            <div className="space-y-2">
              <Label>Author</Label>
              <Combobox aria-label="Author" options={authorOptions} value={author} onChange={setAuthor} allowCustom placeholder="Filter by author" />
            </div>
            <div className="space-y-2">
              <Label>Since / Until</Label>
              <DateRangePicker
                value={{ start: fromISODate(since), end: fromISODate(until) }}
                onChange={(range) => { setSince(toISODate(range.start)); setUntil(toISODate(range.end)); }}
              />
            </div>
            <div className="space-y-2">
              <Label>Path</Label>
              <Combobox aria-label="Path" options={pathOptions} value={filePath} onChange={setFilePath} allowCustom placeholder="src/README.md" />
            </div>
            <Button variant="secondary" onClick={() => void loadLog()} disabled={!session.workspaceId}>Load commits</Button>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <SessionsHistoryPanel
          title="History"
          headingLevel={2}
          variant="history"
          description="Filtered commit history for the opened workspace."
          rows={panelRows}
          emptyMessage="No commits matched the current filters."
          canonicalRoute="/history"
          legacyAliases={["/log", "/commits"]}
          actionsForRow={rowActions}
          page={page}
          onPageChange={setPage}
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          totalRows={commits.length}
          tableId="git-mcp.commit-log.columns"
        />

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
