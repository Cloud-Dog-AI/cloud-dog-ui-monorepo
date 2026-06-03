import * as React from "react";
import { AuditPanel, Badge, Button, Card, CardContent, CardHeader, Input, JsonBlock, RelativeTime, ResourceMetrics } from "@cloud-dog/ui";
import { useGitMcpState } from "../state/AppState";
import type { AuditLogItem, UiMetric } from "../lib/types";

const LOG_TYPES = ["API", "MCP", "A2A", "WebUI", "Audit"];

function summarize(value: unknown): Array<{ key: string; value: string }> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item == null || ["string", "number", "boolean"].includes(typeof item))
    .map(([key, item]) => ({ key, value: String(item ?? "") }));
}

export function RecoveryPage() {
  const app = useGitMcpState();
  const [activeType, setActiveType] = React.useState("Audit");
  const [logs, setLogs] = React.useState<AuditLogItem[]>([]);
  const [metrics, setMetrics] = React.useState<UiMetric[]>([]);
  const [workspaceId, setWorkspaceId] = React.useState(app.workspaceId);
  const [stashMessage, setStashMessage] = React.useState("ui-recovery-stash");
  const [latest, setLatest] = React.useState<unknown>({});
  const [latestAt, setLatestAt] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [autoFollow, setAutoFollow] = React.useState(true);

  const loadAudit = React.useCallback(async (type = activeType) => {
    setError(null);
    try {
      const [items, runtime] = await Promise.all([
        app.api.listAuditEntries(app.apiKey, type),
        app.api.getUiStatus(app.apiKey),
      ]);
      setLogs(items);
      setMetrics(runtime.metrics);
      setStatus(`Loaded ${items.length} ${type} log entries.`);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load audit state.");
    }
  }, [activeType, app.api, app.apiKey]);

  React.useEffect(() => {
    void loadAudit(activeType);
  }, [activeType, loadAudit]);

  React.useEffect(() => {
    setWorkspaceId(app.workspaceId);
  }, [app.workspaceId]);

  React.useEffect(() => {
    if (!autoFollow) return undefined;
    const timer = window.setInterval(() => {
      void loadAudit(activeType);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [activeType, autoFollow, loadAudit]);

  const run = async (toolName: string, args: Record<string, unknown>) => {
    setError(null);
    const outcome = await app.runApiTool(toolName, args);
    setLatest(outcome.data);
    setLatestAt(new Date().toISOString());
    if (!outcome.ok) {
      setError(outcome.errorMessage);
      return;
    }
    setStatus(`Executed ${toolName}.`);
    await loadAudit("A2A");
  };

  const summary = summarize(latest);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">Recovery</h1>
        <Button variant="secondary" size="sm" onClick={() => void loadAudit(activeType)}>
          Refresh
        </Button>
      </header>

      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      {status ? <p role="status" className="text-sm text-foreground/80">{status}</p> : null}

      <ResourceMetrics metrics={metrics} />

      <AuditPanel
        logTypes={LOG_TYPES}
        activeType={activeType}
        onTypeChange={(type) => setActiveType(type)}
        logs={logs.map((item, index) => ({
          id: `${item.type}-${index}-${item.timestamp}`,
          timestamp: item.timestamp,
          level: item.level,
          message: item.message,
          source: item.type,
        }))}
        onRefresh={() => void loadAudit(activeType)}
        autoFollow={autoFollow}
        onAutoFollowChange={setAutoFollow}
      />

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Recovery tools</h2>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label htmlFor="recovery-workspace-id" className="text-sm font-medium">Workspace ID</label>
              <Input
                id="recovery-workspace-id"
                value={workspaceId}
                onChange={(event) => {
                  setWorkspaceId(event.target.value);
                  app.setWorkspaceId(event.target.value);
                }}
              />
            </div>
            <div>
              <label htmlFor="stash-message" className="text-sm font-medium">Stash message</label>
              <Input id="stash-message" value={stashMessage} onChange={(event) => setStashMessage(event.target.value)} />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void run("git_stash_save", { workspace_id: workspaceId, message: stashMessage })} disabled={!workspaceId}>Stash save</Button>
            <Button variant="secondary" onClick={() => void run("git_stash_list", { workspace_id: workspaceId })} disabled={!workspaceId}>Stash list</Button>
            <Button variant="secondary" onClick={() => void run("git_stash_pop", { workspace_id: workspaceId })} disabled={!workspaceId}>Stash pop</Button>
            <Button variant="secondary" onClick={() => void run("git_conflicts_list", { workspace_id: workspaceId })} disabled={!workspaceId}>List conflicts</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Latest recovery result</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            {latestAt ? <RelativeTime timestamp={latestAt} /> : <p className="text-sm text-muted-foreground">No recovery action has been executed yet.</p>}
            {summary.length ? (
              <div className="grid gap-3 md:grid-cols-2">
                {summary.map((item) => (
                  <div key={item.key} className="rounded-lg border border-border/70 bg-background/70 px-3 py-2">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">{item.key}</div>
                    <div className="mt-1 flex items-center gap-2 text-sm font-medium break-all">
                      {item.value === "true" || item.value === "false" ? <Badge>{item.value}</Badge> : item.value || "N/A"}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Technical payload</h2>
          </CardHeader>
          <CardContent>
            <JsonBlock title="Recovery result" value={latest} defaultCollapsed />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
