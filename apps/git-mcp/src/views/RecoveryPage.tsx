import * as React from "react";
import { useNavigate } from "react-router-dom";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  Combobox,
  Dialog,
  Input,
  JsonBlock,
  QuickActionBar,
  RelativeTime,
  useAuditLink,
  type ComboboxOption,
  type QuickAction,
} from "@cloud-dog/ui";
import { useGitMcpState } from "../state/AppState";
import { buildWorkspaceOpenArgs, useWorkspaceSession, WorkspaceSessionCard } from "./WorkspaceSessionCard";

// W28J-1315 Recovery redesign (GMC-R-01..R-09):
//  R-01/R-02: drop the duplicated dashboard ResourceMetrics tiles.
//  R-03: drop the inline rotating audit clone; link out to the shared Audit page instead.
//  R-04/R-06/R-07: profile + workspace selection via the shared SelectionCriteriaPanel
//        (WorkspaceSessionCard), so recovery is scoped like every other repo page.
//  R-05: page intro + per-tool help text.
//  R-08: stash-to-restore is an enumerated dropdown sourced from the backend, not free text.
//  R-09: the latest recovery result is a modal pop-up, not an always-on sub-panel.
//  R-10: the bespoke "Technical payload" debug panel was already removed.

function summarize(value: unknown): Array<{ key: string; value: string }> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item == null || ["string", "number", "boolean"].includes(typeof item))
    .map(([key, item]) => ({ key, value: String(item ?? "") }));
}

export function RecoveryPage() {
  const app = useGitMcpState();
  const navigate = useNavigate();
  const { linkToWorkspace } = useAuditLink();
  const session = useWorkspaceSession("main");
  const [stashMessage, setStashMessage] = React.useState("ui-recovery-stash");
  const [stashes, setStashes] = React.useState<ComboboxOption[]>([]);
  const [selectedStash, setSelectedStash] = React.useState("");
  const [result, setResult] = React.useState<{ tool: string; at: string; data: unknown } | null>(null);
  const [resultOpen, setResultOpen] = React.useState(false);
  const [status, setStatus] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const ws = session.workspaceId;

  const openWorkspace = React.useCallback(async () => {
    setError(null);
    const outcome = await app.runApiTool("repo_open", buildWorkspaceOpenArgs(session));
    if (!outcome.ok) {
      setError(outcome.errorMessage || "Failed to open workspace.");
      return;
    }
    setStatus(`Opened workspace ${String((outcome.data as Record<string, unknown>).workspace_id ?? "").trim()}.`);
  }, [app, session]);

  // R-08: available stashes come from the backend enumeration endpoint.
  const loadStashes = React.useCallback(async () => {
    if (!ws) {
      setStashes([]);
      return;
    }
    try {
      const rows = await app.api.listWorkspaceStashes(app.apiKey, ws);
      setStashes(rows.map((r) => ({ value: r.value, label: r.secondary ? `${r.label} — ${r.secondary}` : r.label })));
    } catch {
      setStashes([]);
    }
  }, [app.api, app.apiKey, ws]);

  React.useEffect(() => {
    void loadStashes();
  }, [loadStashes]);

  const run = React.useCallback(async (toolName: string, args: Record<string, unknown>) => {
    setError(null);
    const outcome = await app.runApiTool(toolName, args);
    setResult({ tool: toolName, at: new Date().toISOString(), data: outcome.data });
    setResultOpen(true);
    if (!outcome.ok) {
      setError(outcome.errorMessage);
      return;
    }
    setStatus(`Executed ${toolName}.`);
    await loadStashes();
  }, [app, loadStashes]);

  const actions: QuickAction[] = [
    { label: "Stash save", onClick: () => void run("git_stash_save", { workspace_id: ws, message: stashMessage.trim() }), disabled: !ws },
    { label: "Stash list", variant: "secondary", onClick: () => void run("git_stash_list", { workspace_id: ws }), disabled: !ws },
    { label: "Stash pop", variant: "secondary", onClick: () => void run("git_stash_pop", { workspace_id: ws, ...(selectedStash ? { ref: selectedStash } : {}) }), disabled: !ws },
    { label: "List conflicts", variant: "secondary", onClick: () => void run("git_conflicts_list", { workspace_id: ws }), disabled: !ws },
  ];

  const resultSummary = result ? summarize(result.data) : [];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">Recovery</h1>
        {/* R-03: link to the shared Audit page rather than cloning it inline. */}
        <Button variant="secondary" size="sm" onClick={() => navigate(ws ? linkToWorkspace(ws) : "/audit")}>
          View recovery audit log
        </Button>
      </header>

      {/* R-05: explain what the page does and how workspace/profile relate (R-06). */}
      <p className="max-w-3xl text-sm text-muted-foreground">
        Recover uncommitted work and resolve interrupted operations for a chosen profile and workspace.
        Stash changes aside, restore a previous stash, or inspect merge conflicts. Every action is scoped to
        the workspace selected below and is recorded on the{" "}
        <button type="button" className="underline underline-offset-2" onClick={() => navigate("/audit")}>Audit log</button>.
      </p>

      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      {status ? <p role="status" className="text-sm text-foreground/80">{status}</p> : null}

      {/* R-04/R-06/R-07: shared SelectionCriteriaPanel (profile + workspace + ref). */}
      <WorkspaceSessionCard
        state={session}
        onOpenWorkspace={openWorkspace}
        status={status}
        error={error}
        title="Recovery Workspace Context"
      />

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Recovery tools</h2>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Stash save sets aside uncommitted changes; stash pop restores the selected stash (or the most
            recent when none is chosen); list conflicts shows files that still need manual resolution.
          </p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <label htmlFor="stash-message" className="text-sm font-medium">Stash message</label>
              <Input id="stash-message" value={stashMessage} onChange={(event) => setStashMessage(event.target.value)} disabled={!ws} />
            </div>
            <div className="space-y-1">
              <label htmlFor="stash-select" className="text-sm font-medium">Stash to restore</label>
              <Combobox
                aria-label="Stash to restore"
                options={stashes}
                value={selectedStash}
                onChange={setSelectedStash}
                disabled={!ws}
                emptyMessage="No stashes available"
                placeholder={ws ? (stashes.length ? "Select a stash" : "No stashes available") : "Open a workspace first"}
              />
            </div>
          </div>
          <QuickActionBar actions={actions} />
        </CardContent>
      </Card>

      {/* R-09: latest recovery result as a modal pop-up. */}
      <Dialog open={resultOpen} onOpenChange={setResultOpen} label="Recovery result">
        {result ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Recovery result — {result.tool}</h2>
              <Button variant="ghost" size="sm" onClick={() => setResultOpen(false)}>Close</Button>
            </div>
            <p className="text-xs text-muted-foreground">Executed <RelativeTime timestamp={result.at} /></p>
            {resultSummary.length ? (
              <div className="grid gap-3 md:grid-cols-2">
                {resultSummary.map((item) => (
                  <div key={item.key} className="rounded-lg border border-border/70 bg-background/70 px-3 py-2">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">{item.key}</div>
                    <div className="mt-1 flex items-center gap-2 break-all text-sm font-medium">
                      {item.value === "true" || item.value === "false" ? <Badge>{item.value}</Badge> : item.value || "N/A"}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
            <JsonBlock title="Full result" value={(result.data ?? {}) as Record<string, unknown>} defaultCollapsed={resultSummary.length > 0} />
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}
