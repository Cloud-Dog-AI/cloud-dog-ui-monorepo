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

// @cloud-dog/app-git-mcp — Diff viewer page for ref-to-ref comparison and file-level change summaries.

import * as React from "react";
import { Badge, Button, Card, CardContent, CardHeader, Combobox, DataTable, JsonBlock, Label, Tabs, TabsContent, TabsList, TabsTrigger, type ComboboxOption, type DataColumn } from "@cloud-dog/ui";
import { useGitMcpState } from "../state/AppState";
import { buildWorkspaceOpenArgs, useWorkspaceSession, WorkspaceSessionCard } from "./WorkspaceSessionCard";
import { parseDiffSummary, parseUnifiedDiff, type DiffLine, type DiffSummaryRow } from "../lib/gitUi";

function lineTone(kind: DiffLine["kind"]): string {
  if (kind === "add") return "bg-emerald-50 text-emerald-950";
  if (kind === "delete") return "bg-rose-50 text-rose-950";
  if (kind === "meta") return "bg-slate-100 text-slate-900 font-medium";
  return "bg-background";
}

export function DiffViewerPage() {
  const app = useGitMcpState();
  const session = useWorkspaceSession("main");
  const [leftRef, setLeftRef] = React.useState("HEAD~1");
  const [rightRef, setRightRef] = React.useState("HEAD");
  const [renderMode, setRenderMode] = React.useState("unified");
  const [diffText, setDiffText] = React.useState("");
  const [summaryRows, setSummaryRows] = React.useState<DiffSummaryRow[]>([]);
  const [status, setStatus] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  // GM-DV-01: left/right refs are populated comboboxes (branches + tags); allowCustom keeps commit-ish
  // refs (HEAD, HEAD~1, raw hashes) usable.
  const [refOptions, setRefOptions] = React.useState<ComboboxOption[]>([]);

  React.useEffect(() => {
    if (!session.workspaceId) {
      setRefOptions([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const [branches, tags] = await Promise.all([
          app.api.listWorkspaceRefs(app.apiKey, session.workspaceId, "branch"),
          app.api.listWorkspaceRefs(app.apiKey, session.workspaceId, "tag"),
        ]);
        if (cancelled) return;
        const seen = new Set<string>();
        const merged: ComboboxOption[] = [];
        for (const row of [...branches, ...tags]) {
          if (seen.has(row.value)) continue;
          seen.add(row.value);
          merged.push({ value: row.value, label: row.label });
        }
        setRefOptions(merged);
      } catch {
        // Selectors degrade gracefully to free-text ref entry (Combobox allowCustom).
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [app.api, app.apiKey, session.workspaceId]);

  const openWorkspace = React.useCallback(async () => {
    setError(null);
    const outcome = await app.runApiTool("repo_open", buildWorkspaceOpenArgs(session));
    if (!outcome.ok) {
      setError(outcome.errorMessage || "Failed to open workspace.");
      return;
    }
    setStatus(`Opened workspace ${String((outcome.data as Record<string, unknown>).workspace_id ?? "").trim()}.`);
  }, [app, session]);

  const loadDiff = React.useCallback(async () => {
    if (!session.workspaceId) {
      setError("Open a workspace first.");
      return;
    }
    setError(null);
    const outcome = await app.runApiTool("git_diff", {
      workspace_id: session.workspaceId,
      left: leftRef.trim() || "HEAD~1",
      right: rightRef.trim() || "HEAD",
    });
    if (!outcome.ok) {
      setError(outcome.errorMessage || "Failed to generate diff.");
      return;
    }
    const nextDiff = String((outcome.data as Record<string, unknown>).diff ?? "");
    setDiffText(nextDiff);
    setSummaryRows(parseDiffSummary(nextDiff));
    setStatus(`Loaded diff ${leftRef}..${rightRef}.`);
  }, [app, leftRef, rightRef, session.workspaceId]);

  const summaryColumns: DataColumn<DiffSummaryRow>[] = [
    { id: "path", header: "Path", sortable: true, sortValue: (row) => row.path, cell: (row) => row.path },
    { id: "additions", header: "Additions", sortable: true, sortValue: (row) => row.additions, cell: (row) => row.additions },
    { id: "deletions", header: "Deletions", sortable: true, sortValue: (row) => row.deletions, cell: (row) => row.deletions },
  ];

  const diffLines = React.useMemo(() => parseUnifiedDiff(diffText), [diffText]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">Diff Viewer</h1>
        {diffText ? <Badge variant="secondary">{summaryRows.length} changed file(s)</Badge> : null}
      </header>

      <WorkspaceSessionCard
        state={session}
        onOpenWorkspace={openWorkspace}
        status={status}
        error={error}
        title="Diff Context"
        actions={
          <>
            <div className="space-y-2">
              <Label>Left ref</Label>
              <Combobox aria-label="Left ref" options={refOptions} value={leftRef} onChange={setLeftRef} allowCustom placeholder="Left ref (branch, tag, or commit)" />
            </div>
            <div className="space-y-2">
              <Label>Right ref</Label>
              <Combobox aria-label="Right ref" options={refOptions} value={rightRef} onChange={setRightRef} allowCustom placeholder="Right ref (branch, tag, or commit)" />
            </div>
            <Button variant="secondary" onClick={() => void loadDiff()} disabled={!session.workspaceId}>Compare refs</Button>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold">File summary</h2>
          </CardHeader>
          <CardContent>
            <DataTable
              tableId="git-mcp.diff-summary.columns"
              columns={summaryColumns}
              rows={summaryRows}
              getRowId={(row) => row.path}
              emptyMessage="No diff summary available yet."
              columnPickerEnabled={true}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-semibold">Rendered diff</h2>
              <Tabs value={renderMode} onValueChange={setRenderMode}>
                <TabsList>
                  <TabsTrigger value="unified">Unified</TabsTrigger>
                  <TabsTrigger value="split">Side by side</TabsTrigger>
                  <TabsTrigger value="raw">Raw</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs value={renderMode} onValueChange={setRenderMode}>
              <TabsContent value="unified">
                <div className="max-h-[620px] overflow-auto rounded-lg border border-border/70">
                  {diffLines.length ? diffLines.map((line, index) => (
                    <div key={`${line.kind}-${index}`} className={`border-b border-border/40 px-3 py-1 font-mono text-xs ${lineTone(line.kind)}`}>
                      {line.kind === "add" ? "+" : line.kind === "delete" ? "-" : " "} {line.right || line.left}
                    </div>
                  )) : <p className="p-4 text-sm text-muted-foreground">No diff output yet.</p>}
                </div>
              </TabsContent>
              <TabsContent value="split">
                <div className="max-h-[620px] overflow-auto rounded-lg border border-border/70">
                  {diffLines.length ? diffLines.map((line, index) => (
                    <div key={`${line.kind}-${index}`} className="grid grid-cols-2 border-b border-border/40 text-xs font-mono">
                      <div className={`border-r border-border/40 px-3 py-1 ${line.kind === "delete" ? lineTone("delete") : line.kind === "meta" ? lineTone("meta") : ""}`}>{line.left || " "}</div>
                      <div className={`px-3 py-1 ${line.kind === "add" ? lineTone("add") : line.kind === "meta" ? lineTone("meta") : ""}`}>{line.right || " "}</div>
                    </div>
                  )) : <p className="p-4 text-sm text-muted-foreground">No diff output yet.</p>}
                </div>
              </TabsContent>
              <TabsContent value="raw">
                <JsonBlock title="Raw diff" value={{ left: leftRef, right: rightRef, diff: diffText }} defaultCollapsed={false} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
