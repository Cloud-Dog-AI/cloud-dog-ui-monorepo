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

// @cloud-dog/app-git-mcp — Repository workspace diagnostics page.

import * as React from "react";
import { Badge, Button, Card, CardContent, CardHeader, Input, RelativeTime, Select, useAuditLink } from "@cloud-dog/ui";
import { useNavigate } from "react-router-dom";
import { useGitMcpState } from "../state/AppState";
import { getSessionId } from "../lib/session";

function scalarEntries(value: unknown): Array<{ key: string; value: string }> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item == null || ["string", "number", "boolean"].includes(typeof item))
    .map(([key, item]) => ({ key, value: String(item ?? "") }));
}

function listEntries(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item));
}

export function WorkspaceDiagnosticsPage() {
  const app = useGitMcpState();
  const navigate = useNavigate();
  const { linkToWorkspace } = useAuditLink();

  const [profile, setProfile] = React.useState(app.defaultProfile);
  // GM-WS-02: repo source is DERIVED from the active profile — read-only, not free-text.
  const repoSource = app.remoteRepoUrl;
  // GM-WS-03: session_id is internal (per-browser-session, W28J-1302 §3.5) — never a user-facing field.
  const [refType, setRefType] = React.useState("branch");
  const [refName, setRefName] = React.useState("main");
  const [filePath, setFilePath] = React.useState("README.md");
  const [latest, setLatest] = React.useState<unknown>({});
  const [executedAt, setExecutedAt] = React.useState<string>("");
  const [status, setStatus] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const openWorkspace = async () => {
    setError(null);
    const payload: Record<string, unknown> = {
      profile: profile.trim() || app.defaultProfile,
      repo_source: repoSource.trim() || app.remoteRepoUrl,
      session_id: getSessionId(),
      workspace_mode: "ephemeral",
    };
    if (refName.trim()) {
      payload.ref = { type: refType, name: refName.trim() };
    }

    const outcome = await app.runApiTool("repo_open", payload);
    setLatest(outcome.data);
    setExecutedAt(new Date().toISOString());
    if (!outcome.ok) {
      setError(outcome.errorMessage);
      return;
    }

    const result = outcome.data as Record<string, unknown>;
    const workspace = String(result.workspace_id ?? "").trim();
    if (workspace) app.setWorkspaceId(workspace);
    setStatus(`Opened workspace ${workspace}.`);
  };

  const runDiagnostic = async (toolName: string, args: Record<string, unknown>) => {
    setError(null);
    const outcome = await app.runApiTool(toolName, args);
    setLatest(outcome.data);
    setExecutedAt(new Date().toISOString());
    if (!outcome.ok) {
      setError(outcome.errorMessage);
      return;
    }
    setStatus(`Executed ${toolName}.`);
  };

  const latestSummary = scalarEntries(latest);
  const latestList = listEntries((latest as Record<string, unknown> | null)?.items ?? (latest as Record<string, unknown> | null)?.branches);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Workspace Diagnostics</h1>
      </header>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {status ? (
        <p role="status" className="text-sm text-foreground/80">
          {status}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Workspace Context</h2>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            <div>
              <label htmlFor="workspace-profile" className="text-sm font-medium">Profile</label>
              <Input id="workspace-profile" value={profile} onChange={(event) => setProfile(event.target.value)} />
            </div>
            <div>
              <label htmlFor="workspace-repo-source" className="text-sm font-medium">Repo source</label>
              <Input id="workspace-repo-source" value={repoSource} readOnly aria-readonly="true" title="Derived from the selected profile" />
              <p className="mt-1 text-xs text-muted-foreground">Derived from the selected profile.</p>
            </div>
            <div>
              <label htmlFor="workspace-ref-type" className="text-sm font-medium">Ref type</label>
              <Select id="workspace-ref-type" value={refType} onChange={(event) => setRefType(event.target.value)}>
                <option value="branch">branch</option>
                <option value="tag">tag</option>
                <option value="commit">commit</option>
              </Select>
            </div>
            <div>
              <label htmlFor="workspace-ref-name" className="text-sm font-medium">Ref name</label>
              <Input id="workspace-ref-name" value={refName} onChange={(event) => setRefName(event.target.value)} />
            </div>
            <div>
              <label htmlFor="workspace-id" className="text-sm font-medium">Current workspace ID</label>
              <Input id="workspace-id" value={app.workspaceId} onChange={(event) => app.setWorkspaceId(event.target.value)} />
            </div>
            <div>
              <label htmlFor="workspace-file-path" className="text-sm font-medium">File path</label>
              <Input id="workspace-file-path" value={filePath} onChange={(event) => setFilePath(event.target.value)} />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void openWorkspace()}>Open workspace</Button>
            <Button variant="secondary" onClick={() => void runDiagnostic("git_status", { workspace_id: app.workspaceId })} disabled={!app.workspaceId}>Git status</Button>
            <Button variant="secondary" onClick={() => void runDiagnostic("dir_list", { workspace_id: app.workspaceId, path: ".", recursive: false })} disabled={!app.workspaceId}>List root directory</Button>
            <Button variant="secondary" onClick={() => void runDiagnostic("file_read", { workspace_id: app.workspaceId, path: filePath.trim() || "README.md" })} disabled={!app.workspaceId}>Read file</Button>
            <Button variant="secondary" onClick={() => void runDiagnostic("git_branch_list", { workspace_id: app.workspaceId })} disabled={!app.workspaceId}>List branches</Button>
            <Button variant="secondary" onClick={() => void runDiagnostic("repo_close", { workspace_id: app.workspaceId })} disabled={!app.workspaceId}>Close workspace</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Latest Diagnostics Summary</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            {executedAt ? <RelativeTime timestamp={executedAt} /> : <p className="text-sm text-muted-foreground">No diagnostic has run yet.</p>}
            {latestSummary.length ? (
              <div className="grid gap-3 md:grid-cols-2">
                {latestSummary.map((item) => (
                  <div key={item.key} className="rounded-lg border border-border/70 bg-background/70 px-3 py-2">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">{item.key}</div>
                    <div className="mt-1 text-sm font-medium break-all">{item.value || "N/A"}</div>
                  </div>
                ))}
              </div>
            ) : null}
            {latestList.length ? (
              <div>
                <h3 className="text-sm font-semibold">Detected items</h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  {latestList.map((item) => <Badge key={item}>{item}</Badge>)}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {/* GM-WS-05: workspace operations are recorded in the authoritative Audit Log — link out instead of
          duplicating a second operations table on this page (mirrors GM-RC-02 / GM-MR-05 audit click-through). */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Recent Workspace Operations</h2>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Workspace operations for this session are recorded in the Audit Log. Open the Audit Log to review the
            authoritative, correlated history for the current workspace.
          </p>
          <Button
            variant="secondary"
            disabled={!app.workspaceId}
            onClick={() => navigate(linkToWorkspace(app.workspaceId))}
          >
            View workspace audit
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
