// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
// Licensed under the Apache License, Version 2.0.

import * as React from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";
import {
  Activity,
  BookOpen,
  Boxes,
  ClipboardList,
  FileCode2,
  FileText,
  History,
  Info,
  KeyRound,
  LayoutDashboard,
  ListChecks,
  Network,
  Play,
  Radio,
  RefreshCw,
  RotateCcw,
  Settings,
  Shield,
  Square,
  Terminal,
  Users,
  Wrench,
} from "lucide-react";
import { BaseRuntimeConfigSchema, ConfigProvider, useConfig } from "@cloud-dog/config";
import { AuthProvider, LoginPage, SessionTimeoutProvider, useAuth } from "@cloud-dog/auth";
import {
  IdamApiKeysPage,
  IdamGroupsPage,
  IdamRbacPage,
  IdamRolesPage,
  IdamUsersPage,
  setIdamTransportAuth,
} from "@cloud-dog/idam";
import {
  AboutPage,
  CopyrightFooter,
  ServiceStatusBar,
  ShellLayout,
  VersionInfo,
  operationalConsolePreset,
} from "@cloud-dog/shell";
import type { NavItemType, ServiceStatus } from "@cloud-dog/shell";
import {
  A2aConsole,
  ApiDocsPanel,
  Badge,
  Button,
  Card as UiCard,
  CardContent,
  CardHeader,
  CodeEditor,
  DataTable,
  EntityDialog,
  FileArtifactCard,
  FileBrowser,
  FileDropZone,
  HealthWidget,
  Input,
  JsonBlock,
  DiagnosticsHealthPanel,
  type DiagnosticsHealthItem,
  Label,
  MetricCard,
  Ps72McpConsole,
  Select,
  SessionsHistoryPanel,
  Spinner,
  StatusBadge,
  Textarea,
  type DataColumn,
  type FileItem,
  type FolderNode,
  type Ps72ExecuteResult,
  type Ps72HealthState,
  type Ps72McpTool,
  type SessionsHistoryRow,
} from "@cloud-dog/ui";
import { BRAND_NAME } from "@cloud-dog/tokens";
import { manifest } from "./manifest";
import {
  createCodeRunnerApi,
  type CodeRunnerApi,
  type CodeRunnerRequestOptions,
  type EgressStatusResult,
  type EgressAuditResult,
  type EgressExecuteResult,
} from "../lib/api";

const IDAM_API_BASE = "/webapi";

const AppRuntimeConfigSchema = BaseRuntimeConfigSchema.extend({
  API_BASE_URL: z.string().default(""),
  AUTH_MODE: z.enum(["cookie", "oidc"]).default("cookie"),
  APP_VERSION: z.string().optional(),
  MCP_BASE_URL: z.string().optional(),
  A2A_BASE_URL: z.string().optional(),
  SESSION_TIMEOUT_MINUTES: z.number().default(30),
  SESSION_WARNING_MINUTES: z.number().default(5),
});

type AppRuntimeConfig = z.infer<typeof AppRuntimeConfigSchema>;

type ExecutionResult = {
  status: string;
  job_id?: string;
  stdout?: string;
  stderr?: string;
  exit_code?: number;
  duration_ms?: number;
  files_out?: Record<string, string> | Array<{ path?: string; name?: string; content?: unknown }>;
  artifacts?: Array<Record<string, unknown>>;
  cached?: boolean;
  error?: string;
};

type HistoryRow = ExecutionResult & {
  id: string;
  language: string;
  startedAt: string;
  code: string;
};

type TemplateRow = {
  id: string;
  name: string;
  language: "python" | "node";
  code: string;
  description: string;
};

type ConsoleRow = {
  id: string;
  endpoint: string;
  status: string;
  detail: string;
};

type WebRuntimeConfig = AppRuntimeConfig & {
  API_BASE_URL: string;
  MCP_BASE_URL: string;
  A2A_BASE_URL: string;
};

const HISTORY_KEY = "code-runner.webui.history";

const templates: TemplateRow[] = [
  {
    id: "python-params",
    name: "Python parameters",
    language: "python",
    description: "Reads CODE_RUNNER_PARAM_NAME and prints a greeting.",
    code: "import os\nname = os.environ.get('CODE_RUNNER_PARAM_NAME', 'operator')\nprint(f'hello {name}')\n",
  },
  {
    id: "python-files",
    name: "File transform",
    language: "python",
    description: "Reads input.txt and writes summary.txt as an artifact.",
    code: "from pathlib import Path\ntext = Path('input.txt').read_text()\nPath('summary.txt').write_text(text.upper())\nprint('wrote summary.txt')\n",
  },
  {
    id: "node-json",
    name: "Node JSON",
    language: "node",
    description: "Emits structured JSON from Node.js.",
    code: "console.log(JSON.stringify({ ok: true, runtime: 'node' }))\n",
  },
];

const examples: TemplateRow[] = [
  {
    id: "fib",
    name: "Fibonacci",
    language: "python",
    description: "CPU-light deterministic execution.",
    code: "def fib(n):\n    a, b = 0, 1\n    for _ in range(n):\n        a, b = b, a + b\n    return a\nprint(fib(10))\n",
  },
  {
    id: "stderr",
    name: "Stdout and stderr",
    language: "python",
    description: "Shows split output streams.",
    code: "import sys\nprint('standard output')\nprint('standard error', file=sys.stderr)\n",
  },
  {
    id: "artifact",
    name: "Artifact extraction",
    language: "python",
    description: "Writes a named output file.",
    code: "from pathlib import Path\nPath('artifact.txt').write_text('artifact body')\nprint('artifact ready')\n",
  },
];

function browserOrigin(): string {
  return typeof window === "undefined" ? "http://localhost" : window.location.origin;
}

function normaliseBase(value: string | undefined): string {
  if (!value || value === "/" || value === "/api") return browserOrigin();
  try {
    return new URL(value, browserOrigin()).toString().replace(/\/+$/, "");
  } catch {
    return browserOrigin();
  }
}

function useRuntimeConfig(): WebRuntimeConfig {
  const cfg = useConfig<AppRuntimeConfig>();
  const apiBaseUrl = normaliseBase(cfg.API_BASE_URL);
  return {
    ...cfg,
    API_BASE_URL: apiBaseUrl,
    MCP_BASE_URL: normaliseBase(cfg.MCP_BASE_URL ?? apiBaseUrl),
    A2A_BASE_URL: normaliseBase(cfg.A2A_BASE_URL ?? apiBaseUrl),
  };
}

function readHistory(): HistoryRow[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.slice(0, 20) : [];
  } catch {
    return [];
  }
}

function writeHistory(rows: HistoryRow[]): void {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(rows.slice(0, 20)));
  } catch {
    // Local execution history is optional.
  }
}

function artifactEntries(filesOut: ExecutionResult["files_out"]): Array<[string, string]> {
  if (!filesOut) return [];
  const asText = (value: unknown) => (typeof value === "string" ? value : value == null ? "" : JSON.stringify(value));
  if (Array.isArray(filesOut)) {
    return filesOut.map((file, index) => [
      String(file?.path ?? file?.name ?? `artifact-${index}`),
      asText(file?.content ?? file),
    ]);
  }
  return Object.entries(filesOut).map(([key, value]) => [key, asText(value)]);
}

function apiRequest<T>(api: CodeRunnerApi, path: string, options?: CodeRunnerRequestOptions): Promise<T> {
  return api.request<T>(path, options);
}

function navIcon(Icon: React.ElementType) {
  return <Icon aria-hidden="true" className="h-4 w-4" />;
}

function Page(props: { title: string; actions?: React.ReactNode; children: React.ReactNode }) {
  const id = `${props.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-heading`;
  return (
    <section className="min-w-0 space-y-4 overflow-x-hidden" aria-labelledby={id}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 id={id} className="text-2xl font-semibold tracking-tight">{props.title}</h1>
        {props.actions ? <div className="flex flex-wrap items-center gap-2">{props.actions}</div> : null}
      </div>
      {props.children}
    </section>
  );
}

function Card(props: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <UiCard className={`min-w-0 ${props.className ?? ""}`}>
      {props.title ? (
        <CardHeader>
          <h2 className="text-base font-semibold">{props.title}</h2>
        </CardHeader>
      ) : null}
      <CardContent className="min-w-0 space-y-3 overflow-hidden">{props.children}</CardContent>
    </UiCard>
  );
}

function EmptyState(props: { title: string; detail: string }) {
  return (
    <div className="rounded-md border border-dashed bg-muted/20 p-6 text-center text-sm text-muted-foreground">
      <p className="font-medium text-foreground">{props.title}</p>
      <p>{props.detail}</p>
    </div>
  );
}

function StatusPill(props: { value: string }) {
  return <StatusBadge value={props.value || "unknown"} />;
}

function useAsync<T>(load: () => Promise<T>, fallback: T, deps: React.DependencyList) {
  const [data, setData] = React.useState<T>(fallback);
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [tick, setTick] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    load()
      .then((next) => {
        if (!cancelled) setData(next);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Request failed.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  return { data, error, loading, reload: () => setTick((value) => value + 1) };
}

function HistoryTable(props: { rows: HistoryRow[] }) {
  const columns: DataColumn<HistoryRow>[] = [
    { id: "execution", header: "Execution", cell: (row) => row.job_id || row.id, sortable: true, sortValue: (row) => row.job_id || row.id },
    { id: "language", header: "Language", cell: (row) => row.language, sortable: true, sortValue: (row) => row.language },
    { id: "status", header: "Status", cell: (row) => <StatusPill value={row.status} />, sortable: true, sortValue: (row) => row.status },
    { id: "cache", header: "Cache", cell: (row) => (row.cached ? "hit" : "miss"), sortable: true, sortValue: (row) => (row.cached ? "hit" : "miss") },
    { id: "startedAt", header: "Started", cell: (row) => row.startedAt, sortable: true, sortValue: (row) => row.startedAt },
  ];
  return (
    <DataTable
      columns={columns}
      rows={props.rows}
      emptyMessage="No runs yet."
      getRowId={(row) => row.id}
      tableId="code-runner-history"
      selectable
    />
  );
}

function ConsoleTable(props: { rows: ConsoleRow[] }) {
  const columns: DataColumn<ConsoleRow>[] = [
    { id: "endpoint", header: "Endpoint", cell: (row) => row.endpoint, sortable: true, sortValue: (row) => row.endpoint },
    { id: "status", header: "Status", cell: (row) => <StatusPill value={row.status} />, sortable: true, sortValue: (row) => row.status },
    { id: "detail", header: "Detail", cell: (row) => <code className="break-all text-xs">{row.detail}</code> },
  ];
  return (
    <DataTable
      columns={columns}
      rows={props.rows}
      emptyMessage="No calls yet."
      getRowId={(row) => row.id}
      tableId="code-runner-console-calls"
    />
  );
}

function DashboardPage(props: { api: CodeRunnerApi; services: ServiceStatus[] }) {
  const health = useAsync(
    async () => ({
      ping: await apiRequest<Record<string, unknown>>(props.api, "/webapi/v1/ping"),
      mcp: await apiRequest<Record<string, unknown>>(props.api, "/webmcp/health"),
      a2a: await apiRequest<Record<string, unknown>>(props.api, "/weba2a/health"),
    }),
    { ping: {}, mcp: {}, a2a: {} },
    [props.api],
  );
  const history = readHistory();

  return (
    <Page
      title="Dashboard"
      actions={<Button variant="secondary" size="sm" onClick={health.reload}><RefreshCw aria-hidden="true" className="h-4 w-4" />Refresh</Button>}
    >
      <div className="grid gap-4 md:grid-cols-3">
        {props.services.map((service) => (
          <HealthWidget key={service.name} name={service.name} status={service.status} detail={service.url} url={service.url} />
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="API Status" value={String(health.data.ping.status ?? (health.error ? "CHECK" : "OK"))} />
        <MetricCard label="MCP Status" value={String(health.data.mcp.status ?? "UNKNOWN")} />
        <MetricCard label="A2A Status" value={String(health.data.a2a.status ?? "UNKNOWN")} />
        <MetricCard label="Local Runs" value={history.length} />
      </div>
      {health.loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <Spinner className="h-4 w-4" /> Loading service status...
        </div>
      ) : null}
      {health.error ? <p role="alert" className="text-sm text-destructive">{health.error}</p> : null}
      <Card title="Recent Execution History">
        {history.length ? <HistoryTable rows={history.slice(0, 5)} /> : <EmptyState title="No local execution history" detail="Run code from Executions to populate stdout, stderr, artifacts and cache status." />}
      </Card>
      <CopyrightFooter />
    </Page>
  );
}

function ExecutionsPage(props: { api: CodeRunnerApi }) {
  const abortRef = React.useRef<AbortController | null>(null);
  const [language, setLanguage] = React.useState<"python" | "node">("python");
  const [code, setCode] = React.useState(templates[0].code);
  const [params, setParams] = React.useState("NAME=operator");
  const [files, setFiles] = React.useState("input.txt=hello from file");
  const [extractPaths, setExtractPaths] = React.useState("summary.txt,artifact.txt");
  const [timeoutSeconds, setTimeoutSeconds] = React.useState(30);
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<ExecutionResult | null>(null);
  const [history, setHistory] = React.useState<HistoryRow[]>(() => readHistory());

  const run = React.useCallback(async () => {
    abortRef.current?.abort();
    const abort = new AbortController();
    abortRef.current = abort;
    setBusy(true);
    setResult({ status: "running" });
    const payload = {
      language,
      code,
      timeout_seconds: timeoutSeconds,
      params: Object.fromEntries(
        params
          .split(/\n|,/)
          .map((item) => item.trim())
          .filter(Boolean)
          .map((item) => {
            const [key, ...rest] = item.split("=");
            return [key.trim(), rest.join("=").trim()];
          }),
      ),
      files_in: files
        .split(/\n/)
        .map((item) => item.trim())
        .filter(Boolean)
        .map((item) => {
          const [path, ...rest] = item.split("=");
          return { path: path.trim(), content: rest.join("=") };
        }),
      extract_paths: extractPaths.split(",").map((item) => item.trim()).filter(Boolean),
    };
    try {
      const body = await apiRequest<ExecutionResult>(props.api, "/webapi/execute", {
        method: "POST",
        body: payload,
        signal: abort.signal,
      });
      const next: ExecutionResult = { ...body, status: body.status || "ok" };
      setResult(next);
      const row: HistoryRow = {
        ...next,
        id: next.job_id || `${Date.now()}`,
        language,
        startedAt: new Date().toISOString(),
        code,
      };
      const updated = [row, ...history].slice(0, 20);
      setHistory(updated);
      writeHistory(updated);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setResult({ status: "cancelled", stderr: "Execution cancelled in the browser before completion." });
      } else {
        setResult({ status: "failed", stderr: err instanceof Error ? err.message : "Execution failed." });
      }
    } finally {
      setBusy(false);
    }
  }, [code, extractPaths, files, history, language, params, props.api, timeoutSeconds]);

  const artifacts = artifactEntries(result?.files_out);
  const addInputFiles = React.useCallback(async (droppedFiles: File[]) => {
    const entries = await Promise.all(
      droppedFiles.map(async (file) => `${file.name}=${await file.text()}`),
    );
    setFiles((current) => [current.trim(), ...entries].filter(Boolean).join("\n"));
  }, []);
  const artifactFolders = React.useMemo<FolderNode[]>(
    () => [{ name: "Artifacts", path: "/artifacts", children: [] }],
    [],
  );
  const artifactBrowserFiles = React.useMemo<FileItem[]>(
    () => artifacts.map(([name, content]) => ({
      name,
      path: `/artifacts/${name}`,
      size: `${content.length} chars`,
      kind: "artifact",
      status: result?.status ?? "idle",
      testId: `code-runner-artifact-${name.replace(/[^a-zA-Z0-9_-]/g, "-")}`,
    })),
    [artifacts, result?.status],
  );

  return (
    <Page
      title="Executions"
      actions={
        <>
          <Button disabled={busy} onClick={() => { void run(); }}><Play aria-hidden="true" className="h-4 w-4" />Run</Button>
          <Button variant="secondary" disabled={!busy} onClick={() => abortRef.current?.abort()}><Square aria-hidden="true" className="h-4 w-4" />Cancel</Button>
          <Button variant="secondary" disabled={!result || busy} onClick={() => { void run(); }}><RotateCcw aria-hidden="true" className="h-4 w-4" />Retry</Button>
        </>
      }
    >
      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <Card title="Editor and Inputs">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="execution-language">Language</Label>
              <Select id="execution-language" value={language} onChange={(event) => setLanguage(event.target.value as "python" | "node")}>
                <option value="python">Python</option>
                <option value="node">Node.js</option>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="execution-timeout">Timeout Seconds</Label>
              <Input id="execution-timeout" type="number" min={1} max={300} value={timeoutSeconds} onChange={(event) => setTimeoutSeconds(Number(event.target.value))} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Code</Label>
            <CodeEditor
              value={code}
              onChange={setCode}
              language={language === "python" ? "python" : "text"}
              ariaLabel="Code editor"
              height={320}
              className="min-w-0 max-w-full"
            />
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="execution-params">Params</Label>
              <Textarea id="execution-params" value={params} onChange={(event) => setParams(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="execution-files">Files</Label>
              <Textarea id="execution-files" value={files} onChange={(event) => setFiles(event.target.value)} />
              <FileDropZone
                label="Upload execution input file"
                description="Dropped text files are added to the files input list for the next run."
                onDrop={(droppedFiles) => void addInputFiles(droppedFiles)}
                testId="code-runner-input-file-drop-zone"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="execution-extract">Extract Paths</Label>
              <Textarea id="execution-extract" value={extractPaths} onChange={(event) => setExtractPaths(event.target.value)} />
            </div>
          </div>
        </Card>
        <Card title="Status, Output and Artifacts">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <StatusPill value={busy ? "running" : result?.status ?? "idle"} />
            <span>Cache: {result?.cached ? "hit" : result ? "miss or not cacheable" : "not run"}</span>
            <span>Exit: {result?.exit_code ?? "-"}</span>
            <span>Duration: {result?.duration_ms ?? "-"} ms</span>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold">stdout</h3>
            <pre className="min-h-20 overflow-auto rounded-md border bg-muted/30 p-3 text-xs" data-testid="stdout">{result?.stdout ?? ""}</pre>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold">stderr</h3>
            <pre className="min-h-20 overflow-auto rounded-md border bg-muted/30 p-3 text-xs text-destructive" data-testid="stderr">{result?.stderr ?? result?.error ?? ""}</pre>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold">artifacts</h3>
            <FileBrowser
              folders={artifactFolders}
              files={artifactBrowserFiles}
              currentPath="/artifacts"
              rootLabel="run"
              filesLabel="Execution artifacts"
              emptyMessage="No artifacts"
              readOnly
              onNavigate={() => undefined}
              testId="code-runner-artifact-file-browser"
            />
            {artifacts.length ? (
              <div className="space-y-2">
                {artifacts.map(([name, content]) => (
                  <FileArtifactCard
                    key={name}
                    title={name}
                    path={name}
                    kind="download"
                    statusLabel="Extracted"
                    description="Extracted from the sandbox working directory."
                    preview={{ kind: "text", content }}
                  />
                ))}
              </div>
            ) : result?.artifacts?.length ? (
              <JsonBlock title="Artifacts" value={result.artifacts} defaultCollapsed={false} />
            ) : (
              <EmptyState title="No artifacts" detail="Add extract paths to capture files from the sandbox working directory." />
            )}
          </div>
        </Card>
      </div>
      <Card title="History">
        {history.length ? <HistoryTable rows={history} /> : <EmptyState title="No runs yet" detail="Completed runs appear here with status, cache indicator and output summary." />}
      </Card>
    </Page>
  );
}

function SessionsPage(props: { api: CodeRunnerApi }) {
  const data = useAsync(async () => apiRequest<{ sessions?: unknown[] }>(props.api, "/webapi/sessions"), { sessions: [] }, [props.api]);
  const sessions = Array.isArray(data.data.sessions) ? data.data.sessions : [];
  const rawById = React.useMemo(() => new Map(sessions.map((entry, index) => {
    const obj = (entry && typeof entry === "object" ? entry : {}) as Record<string, unknown>;
    const id = String(obj.session_id ?? obj.id ?? obj.name ?? index);
    return [id, entry] as const;
  })), [sessions]);
  const rows = React.useMemo<SessionsHistoryRow[]>(() => sessions.map((entry, index) => {
    const obj = (entry && typeof entry === "object" ? entry : {}) as Record<string, unknown>;
    const id = String(obj.session_id ?? obj.id ?? obj.name ?? index);
    const status = obj.status ?? obj.state ?? "active";
    const created = obj.created_at ?? obj.started_at ?? obj.createdAt;
    const updated = obj.updated_at ?? obj.last_accessed_at ?? obj.last_activity_at ?? obj.updatedAt;
    const expires = obj.expires_at ?? obj.expiresAt;
    const owner = obj.owner_user_id ?? obj.user_id ?? obj.actor ?? obj.tenant_id;
    const profile = obj.profile_id ?? obj.profile ?? obj.sandbox_id;
    return {
      id,
      label: id,
      title: <span className="font-mono">{id}</span>,
      status: String(status),
      actor: owner === undefined ? undefined : String(owner),
      target: profile === undefined ? undefined : String(profile),
      createdAt: typeof created === "string" || typeof created === "number" ? created : undefined,
      lastActivityAt: typeof updated === "string" || typeof updated === "number" ? updated : undefined,
      expiresAt: typeof expires === "string" || typeof expires === "number" ? expires : undefined,
      retention: expires === undefined ? undefined : "Expires by policy",
      summary: "Interactive code-runner session",
    };
  }), [sessions]);
  return (
    <SessionsHistoryPanel
      title="Sessions"
      description="Interactive code-runner sessions group related executions and preserve ownership boundaries."
      rows={rows}
      loading={data.loading}
      error={data.error || undefined}
      emptyMessage="No active sessions."
      canonicalRoute="/sessions"
      onRefresh={data.reload}
      tableId="code-runner-sessions"
      renderDetail={(row) => <JsonBlock value={rawById.get(row.id) ?? row} defaultCollapsed={false} />}
    />
  );
}

type ProfileRow = { id: string; name: string; model: string; raw: Record<string, unknown> };

function toProfileRows(profiles: unknown[]): ProfileRow[] {
  return profiles.map((entry, index) => {
    const obj = (entry && typeof entry === "object" ? entry : {}) as Record<string, unknown>;
    const id = String(obj.id ?? obj.name ?? index);
    return {
      id,
      name: String(obj.name ?? id),
      model: String(obj.model ?? obj.model_name ?? "—"),
      raw: obj,
    };
  });
}

function ProfilesPage(props: { api: CodeRunnerApi }) {
  const data = useAsync(async () => apiRequest<{ profiles?: unknown[] }>(props.api, "/webapi/generation-profiles"), { profiles: [] }, [props.api]);
  const [selected, setSelected] = React.useState<ProfileRow | null>(null);
  const rows = toProfileRows(data.data.profiles ?? []);
  const columns: DataColumn<ProfileRow>[] = [
    { id: "name", header: "Name", cell: (row) => row.name, sortable: true, sortValue: (row) => row.name },
    { id: "model", header: "Model", cell: (row) => row.model, sortable: true, sortValue: (row) => row.model },
    { id: "view", header: "", cell: (row) => <Button variant="secondary" size="sm" onClick={() => setSelected(row)}>View</Button> },
  ];
  return (
    <Page title="Profiles" actions={<Button variant="secondary" size="sm" onClick={data.reload}><RefreshCw aria-hidden="true" className="h-4 w-4" />Refresh</Button>}>
      <Card title="Generation Profiles">
        {data.error ? <p className="text-sm text-destructive">{data.error}</p> : null}
        {rows.length ? (
          <DataTable
            columns={columns}
            rows={rows}
            emptyMessage="No generation profiles."
            getRowId={(row) => row.id}
            tableId="code-runner-profiles"
          />
        ) : (
          <EmptyState title="No generation profiles" detail="Profiles hold model, temperature and system-prompt presets for generation workflows." />
        )}
      </Card>
      <EntityDialog
        open={selected !== null}
        onOpenChange={(open) => { if (!open) setSelected(null); }}
        title={selected ? `Profile · ${selected.name}` : "Profile"}
        body={selected ? <JsonBlock value={selected.raw} defaultCollapsed={false} /> : null}
      />
    </Page>
  );
}

function TemplateCard(props: { item: TemplateRow }) {
  return (
    <Card title={props.item.name}>
      <p className="text-sm text-muted-foreground">{props.item.description}</p>
      <Badge variant="secondary">{props.item.language}</Badge>
      <CodeEditor value={props.item.code} language={props.item.language === "python" ? "python" : "text"} readOnly height={220} className="min-w-0 max-w-full" />
    </Card>
  );
}

// W28E-1852: distinct-domain member of the Prompts/Templates/message-assets family
// (PS-WEBUI-STYLE-COMPONENTS §10). Consumes the shared DataTable list + EntityDialog
// view + CodeEditor body + StatusBadge contract at the service-approved route /templates.
function TemplatesPage() {
  const [viewing, setViewing] = React.useState<TemplateRow | null>(null);
  const columns: DataColumn<TemplateRow>[] = [
    {
      id: "name",
      header: "Name",
      sortable: true,
      sortValue: (r) => r.name,
      cell: (r) => (
        <button
          type="button"
          className="text-left font-medium text-primary hover:underline"
          data-testid={`template-name-${r.id}`}
          onClick={() => setViewing(r)}
        >
          {r.name}
        </button>
      ),
    },
    { id: "language", header: "Language", sortable: true, sortValue: (r) => r.language, cell: (r) => r.language },
    { id: "description", header: "Description", cell: (r) => r.description },
    { id: "status", header: "Status", cell: () => <StatusBadge value="Enabled" tone="ok" /> },
    {
      id: "__actions",
      header: "Actions",
      cell: (r) => (
        <Button variant="ghost" size="sm" data-testid={`template-view-${r.id}`} onClick={() => setViewing(r)}>
          View
        </Button>
      ),
    },
  ];
  return (
    <Page title="Templates">
      <div className="rounded-md border bg-background">
        <DataTable
          columns={columns}
          rows={templates}
          getRowId={(r) => r.id}
          ariaLabel="Code templates"
          emptyMessage="No templates found."
        />
      </div>
      {viewing ? (
        <EntityDialog
          open={!!viewing}
          onOpenChange={(open) => {
            if (!open) setViewing(null);
          }}
          title={`View Template — ${viewing.name}`}
          body={
            <div className="space-y-3" data-testid="template-view-body">
              <p className="text-sm text-muted-foreground">{viewing.description}</p>
              <Badge variant="secondary">{viewing.language}</Badge>
              <CodeEditor
                value={viewing.code}
                language={viewing.language === "python" ? "python" : "text"}
                readOnly
                ariaLabel="Template body"
                height={220}
              />
            </div>
          }
        />
      ) : null}
    </Page>
  );
}

function ExamplesPage() {
  return <Page title="Examples"><div className="grid gap-4 lg:grid-cols-3">{examples.map((item) => <TemplateCard key={item.id} item={item} />)}</div></Page>;
}

function SandboxesPage(props: { api: CodeRunnerApi }) {
  const data = useAsync(async () => apiRequest<Record<string, unknown>>(props.api, "/webapi/cache/stats"), {}, [props.api]);
  return (
    <Page title="Sandboxes">
      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Provider" value="local_docker" />
        <MetricCard label="Python Image" value="sandbox-python" />
        <MetricCard label="Node Image" value="sandbox-node" />
        <MetricCard label="Cache" value={data.error ? "CHECK" : String(data.data.enabled ?? "enabled")} />
      </div>
      <Card title="Sandbox Controls">
        <p className="text-sm text-muted-foreground">Each execution runs in a fresh isolated container and is destroyed on completion.</p>
        {data.error ? <p role="alert" className="text-sm text-destructive">{data.error}</p> : <JsonBlock value={data.data} defaultCollapsed />}
      </Card>
    </Page>
  );
}

function AuditPage(props: { api: CodeRunnerApi }) {
  const auth = useAuth();
  const data = useAsync(async () => apiRequest<Record<string, unknown>>(props.api, "/webapi/audit/events"), {}, [props.api]);
  // PS-WEBUI-STYLE-COMPONENTS §10 / W28E-1851 (STD-F16): diagnostics / health /
  // resource-metrics panel above the audit events.
  const [health, setHealth] = React.useState<DiagnosticsHealthItem[]>([{ name: "Jobs", status: "unknown" }]);
  const refreshHealth = React.useCallback(async () => {
    try {
      const res = await apiRequest<Record<string, unknown>>(props.api, "/webapi/v1/jobs/health");
      const raw = String((res as Record<string, unknown>)?.status ?? "").toLowerCase();
      const status: DiagnosticsHealthItem["status"] = raw.includes("degrad") || raw.includes("warn")
        ? "warning"
        : raw.includes("fail") || raw.includes("error") || raw.includes("down")
          ? "error"
          : "ok";
      setHealth([{ name: "Jobs", status }]);
    } catch {
      setHealth([{ name: "Jobs", status: "error", detail: "Health probe failed" }]);
    }
  }, [props.api]);
  React.useEffect(() => { void refreshHealth(); }, [refreshHealth]);
  return (
    <Page title="Audit Log" actions={<Button variant="secondary" size="sm" onClick={() => { data.reload(); void refreshHealth(); }}><RefreshCw aria-hidden="true" className="h-4 w-4" />Refresh</Button>}>
      <DiagnosticsHealthPanel
        title="System diagnostics"
        description="Live resource metrics and service health for the code-runner service."
        metricsUrl="/webapi/v1/metrics"
        metricsIntervalMs={30000}
        getAccessToken={() => auth.getAccessToken?.() ?? null}
        fallbackMetrics={[
          { label: "Uptime", value: "N/A", tone: "neutral" },
          { label: "Memory", value: "N/A", tone: "neutral" },
          { label: "CPU", value: "N/A", tone: "neutral" },
          { label: "Disk", value: "N/A", tone: "neutral" },
          { label: "Connections", value: "N/A", tone: "neutral" },
        ]}
        health={health}
        error={data.error ?? null}
        onRefresh={() => { data.reload(); void refreshHealth(); }}
      />
      <Card title="Audit Events">
        {data.error ? <p role="alert" className="text-sm text-destructive">{data.error}</p> : <JsonBlock value={data.data} defaultCollapsed={false} />}
      </Card>
    </Page>
  );
}

function JobsPage(props: { api: CodeRunnerApi }) {
  const [jobId, setJobId] = React.useState("");
  const [rows, setRows] = React.useState<ConsoleRow[]>([]);
  const record = (row: Omit<ConsoleRow, "id">) => setRows((current) => [{ ...row, id: `${Date.now()}-${row.endpoint}` }, ...current].slice(0, 10));
  const call = async (action: "status" | "cancel") => {
    const value = jobId.trim();
    if (!value) return;
    try {
      const body = action === "status"
        ? await apiRequest<Record<string, unknown>>(props.api, `/webapi/jobs/${encodeURIComponent(value)}`)
        : await apiRequest<Record<string, unknown>>(props.api, `/webapi/jobs/${encodeURIComponent(value)}/cancel`, { method: "POST", body: {} });
      record({ endpoint: action, status: "ok", detail: JSON.stringify(body) });
    } catch (err) {
      record({ endpoint: action, status: "failed", detail: err instanceof Error ? err.message : "Request failed" });
    }
  };
  return (
    <Page title="Jobs">
      <Card title="Job Lookup and Control">
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-64 flex-1 space-y-2">
            <Label htmlFor="job-id">Job ID</Label>
            <Input id="job-id" value={jobId} onChange={(event) => setJobId(event.target.value)} placeholder="job id" />
          </div>
          <Button variant="secondary" onClick={() => { void call("status"); }}>Status</Button>
          <Button variant="secondary" onClick={() => { void call("cancel"); }}>Cancel</Button>
        </div>
        <ConsoleTable rows={rows} />
      </Card>
    </Page>
  );
}

function SettingsPage(props: { cfg: WebRuntimeConfig; api: CodeRunnerApi }) {
  const data = useAsync(async () => apiRequest<Record<string, unknown>>(props.api, "/webapi/config"), {}, [props.api]);
  return (
    <Page title="Settings" actions={<Button variant="secondary" size="sm" onClick={data.reload}><RefreshCw aria-hidden="true" className="h-4 w-4" />Refresh</Button>}>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Runtime Config"><JsonBlock value={props.cfg} defaultCollapsed={false} /></Card>
        <Card title="HTTPS Safety">
          <StatusPill value={props.cfg.API_BASE_URL.startsWith("https://") || window.location.protocol === "http:" ? "pass" : "fail"} />
          <p className="text-sm text-muted-foreground">HTTPS pages must use same-origin or HTTPS browser endpoints.</p>
        </Card>
      </div>
      <Card title="Effective Service Config">
        {data.error ? <p role="alert" className="text-sm text-destructive">{data.error}</p> : <JsonBlock value={data.data} defaultCollapsed={false} />}
      </Card>
    </Page>
  );
}

function ApiDocsPage(props: { cfg: WebRuntimeConfig }) {
  return (
    <Page title="API Docs">
      <ApiDocsPanel
        openapiUrl={`${props.cfg.API_BASE_URL}/webapi-openapi.json`}
        links={[
          { label: "MCP Console", href: "/developer/mcp-console" },
          { label: "A2A Console", href: "/developer/a2a-console" },
        ]}
        readmeTitle="Code Runner WebUI"
        readmeContent="Browser operators use cookie sessions through the WebUI. API keys remain machine credentials for API, MCP and A2A automation."
      />
    </Page>
  );
}

function McpConsolePage(props: { cfg: WebRuntimeConfig; api: CodeRunnerApi }) {
  const auth = useAuth();
  const [tools, setTools] = React.useState<Ps72McpTool[]>([]);
  const [health, setHealth] = React.useState<Ps72HealthState>("unknown");
  const [error, setError] = React.useState("");
  const endpointUrl = `${props.cfg.API_BASE_URL}/webmcp/tools`;

  React.useEffect(() => {
    let cancelled = false;
    void apiRequest<{ tools?: Array<{ name: string; description?: string; inputSchema?: unknown; input_schema?: unknown; bound?: boolean }>; data?: unknown }>(props.api, "/webmcp/tools")
      .then((body) => {
        const raw = Array.isArray(body.tools)
          ? body.tools
          : body.data && typeof body.data === "object" && Array.isArray((body.data as { items?: unknown[] }).items)
            ? ((body.data as { items: Array<{ name: string; description?: string; inputSchema?: unknown; input_schema?: unknown; bound?: boolean }> }).items)
            : [];
        if (!cancelled) {
          setTools(raw.map((tool) => ({ name: tool.name, description: tool.description, inputSchema: tool.inputSchema ?? tool.input_schema, bound: tool.bound })));
          setHealth(raw.length > 0 ? "healthy" : "degraded");
          setError("");
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setHealth("unhealthy");
          setError(err instanceof Error ? err.message : "Failed to load MCP tools.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [props.api]);

  const onExecute = React.useCallback(
    async (toolName: string, args: unknown): Promise<Ps72ExecuteResult> => {
      try {
        const body = await apiRequest<Record<string, unknown>>(props.api, `/webmcp/tools/${encodeURIComponent(toolName)}`, { method: "POST", body: args });
        const data = body.data && typeof body.data === "object" ? (body.data as Record<string, unknown>) : body;
        const proof = data.proof && typeof data.proof === "object" ? (data.proof as Record<string, unknown>) : null;
        const jobId =
          (typeof body.job_id === "string" ? body.job_id : null) ??
          (typeof data.job_id === "string" ? data.job_id : null) ??
          (proof && typeof proof.job_id === "string" ? proof.job_id : null);
        return { body, correlationId: null, requestId: null, httpStatus: 200, denied: false, jobId };
      } catch (err) {
        return {
          body: { error: err instanceof Error ? err.message : "MCP request failed" },
          correlationId: null,
          requestId: null,
          httpStatus: 500,
          denied: true,
        };
      }
    },
    [props.api],
  );

  return (
    <Page title="MCP Console">
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      <Ps72McpConsole
        endpointUrl={endpointUrl}
        tools={tools}
        health={health}
        hasBoundKey={auth.isAuthenticated}
        boundLabel={auth.isAuthenticated ? "session • cookie" : "not signed in"}
        docsHref="/developer/api-docs"
        jobsHref="/system/jobs"
        onExecute={onExecute}
      />
    </Page>
  );
}

function A2aConsolePage(props: { cfg: WebRuntimeConfig; api: CodeRunnerApi }) {
  const [agentCard, setAgentCard] = React.useState<Record<string, unknown> | null>(null);
  const [error, setError] = React.useState("");
  const endpointUrl = `${props.cfg.API_BASE_URL}/weba2a`;

  React.useEffect(() => {
    let cancelled = false;
    void apiRequest<Record<string, unknown>>(props.api, "/weba2a/.well-known/agent.json")
      .then((body) => {
        if (!cancelled) {
          setAgentCard(body);
          setError("");
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load A2A agent card.");
      });
    return () => {
      cancelled = true;
    };
  }, [props.api]);

  const skills = Array.isArray(agentCard?.skills)
    ? (agentCard.skills as unknown[]).map((skill) => (typeof skill === "string" ? skill : typeof skill === "object" && skill ? String((skill as Record<string, unknown>).id ?? (skill as Record<string, unknown>).name ?? "") : "")).filter(Boolean)
    : ["root", "health"];

  const onSend = React.useCallback(
    async (topic: string, payload: unknown) => {
      const normalized = topic.trim().toLowerCase();
      const path = normalized === "root"
        ? "/weba2a/.well-known/agent.json"
        : normalized === "health" || normalized === "status"
          ? "/weba2a/health"
          : "/weba2a/tasks";
      return apiRequest(props.api, path, normalized === "root" || normalized === "health" || normalized === "status" ? {} : { method: "POST", body: { action: topic, payload } });
    },
    [props.api],
  );

  return (
    <Page title="A2A Console">
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <Card title="Agent Card">
          {agentCard ? <JsonBlock value={agentCard} defaultCollapsed={false} /> : <EmptyState title="No agent card loaded" detail="The authenticated A2A agent-card probe has not returned yet." />}
        </Card>
        <A2aConsole endpointUrl={endpointUrl} topics={skills} initialTopic={skills[0]} onSend={onSend} />
      </div>
    </Page>
  );
}

// W28I-1240: allowlisted programme-service egress page.
type EgressAllowRow = { id: string; methods: string; paths: string; rate: number };
type EgressTraceRowView = { id: string; service_id: string; method: string; path: string; allowed: string; reason: string; status: number };

function EgressPage(props: { api: CodeRunnerApi }) {
  const status = useAsync<EgressStatusResult>(() => props.api.egressStatus(), {}, [props.api]);
  const audit = useAsync<EgressAuditResult>(() => props.api.egressAudit(50), { count: 0, trace: [] }, [props.api]);
  const [serviceId, setServiceId] = React.useState("");
  const [method, setMethod] = React.useState("GET");
  const [path, setPath] = React.useState("/api/v1/health");
  const [body, setBody] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<EgressExecuteResult | null>(null);
  const [error, setError] = React.useState("");

  const services = status.data.effective_allowlist?.services ?? {};
  const serviceIds = Object.keys(services);

  React.useEffect(() => {
    if (!serviceId && serviceIds.length) setServiceId(serviceIds[0]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceIds.join(",")]);

  const run = React.useCallback(async () => {
    setBusy(true);
    setError("");
    setResult(null);
    try {
      let parsedBody: unknown;
      if (body.trim()) {
        try {
          parsedBody = JSON.parse(body);
        } catch {
          parsedBody = body;
        }
      }
      const res = await props.api.egressExecute({
        profile: status.data.profile ?? "",
        operations: [{ service_id: serviceId, method, path, body: parsedBody, op: method === "GET" ? "read" : "write" }],
      });
      setResult(res);
      audit.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Egress request failed (code:egress:execute required).");
    } finally {
      setBusy(false);
    }
  }, [props.api, serviceId, method, path, body, status.data.profile, audit]);

  const allowlistRows: EgressAllowRow[] = serviceIds.map((id) => ({
    id,
    methods: (services[id]?.methods ?? []).join(", "),
    paths: (services[id]?.path_patterns ?? []).join(", "),
    rate: services[id]?.rate_limit_per_minute ?? 0,
  }));
  const allowlistColumns: DataColumn<EgressAllowRow>[] = [
    { id: "service", header: "Service", cell: (row) => <code className="text-xs">{row.id}</code>, sortable: true, sortValue: (row) => row.id },
    { id: "methods", header: "Methods", cell: (row) => row.methods || "—" },
    { id: "paths", header: "Path patterns", cell: (row) => <code className="break-all text-xs">{row.paths || "—"}</code> },
    { id: "rate", header: "Rate/min", cell: (row) => row.rate || "—" },
  ];

  const traceRows: EgressTraceRowView[] = (audit.data.trace ?? []).map((row, index) => ({
    id: `${index}`,
    service_id: row.service_id ?? "",
    method: row.method ?? "",
    path: row.path ?? "",
    allowed: row.allowed ? "allowed" : "denied",
    reason: row.reason ?? "",
    status: row.status_code ?? 0,
  }));
  const traceColumns: DataColumn<EgressTraceRowView>[] = [
    { id: "service", header: "Service", cell: (row) => <code className="text-xs">{row.service_id}</code>, sortable: true, sortValue: (row) => row.service_id },
    { id: "method", header: "Method", cell: (row) => row.method },
    { id: "path", header: "Path", cell: (row) => <code className="break-all text-xs">{row.path}</code> },
    { id: "result", header: "Result", cell: (row) => <StatusPill value={row.allowed} />, sortable: true, sortValue: (row) => row.allowed },
    { id: "reason", header: "Reason", cell: (row) => row.reason || "—" },
    { id: "status", header: "HTTP", cell: (row) => row.status || "—" },
  ];

  return (
    <Page
      title="Service Egress"
      actions={<Button variant="secondary" size="sm" onClick={() => { status.reload(); audit.reload(); }}><RefreshCw aria-hidden="true" className="h-4 w-4" />Refresh</Button>}
    >
      <div className="grid gap-4 md:grid-cols-4">
        <div data-testid="egress-status-enabled"><MetricCard label="Egress Enabled" value={status.data.enabled ? "YES" : "NO"} /></div>
        <div data-testid="egress-status-can"><MetricCard label="You Can Egress" value={status.data.can_egress ? "YES" : "NO"} /></div>
        <MetricCard label="Profile" value={status.data.profile || "—"} />
        <MetricCard label="Preflight" value={status.data.preflight_reason || "ok"} />
      </div>
      {status.loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status"><Spinner className="h-4 w-4" /> Loading egress status...</div>
      ) : null}
      {status.error ? <p role="alert" className="text-sm text-destructive">{status.error}</p> : null}

      <Card title="Effective allowlist (service ∩ profile ∩ your role)">
        {allowlistRows.length ? (
          <div data-testid="egress-allowlist-table">
            <DataTable columns={allowlistColumns} rows={allowlistRows} emptyMessage="No services available to you." getRowId={(row) => row.id} tableId="egress-allowlist" />
          </div>
        ) : (
          <EmptyState title="No egress services" detail={status.data.can_egress ? "No confirmed programme services are in your effective allowlist." : "Your role does not permit service egress (code:egress:execute)."} />
        )}
      </Card>

      <Card title="Run allowlisted egress">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="egress-service">Service</Label>
            <Select id="egress-service" data-testid="egress-service-select" value={serviceId} onChange={(event) => setServiceId(event.target.value)}>
              {serviceIds.length ? serviceIds.map((id) => <option key={id} value={id}>{id}</option>) : <option value="">(none available)</option>}
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="egress-method">Method</Label>
            <Select id="egress-method" data-testid="egress-method-select" value={method} onChange={(event) => setMethod(event.target.value)}>
              {["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => <option key={m} value={m}>{m}</option>)}
            </Select>
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label htmlFor="egress-path">Path (service-relative — never a URL)</Label>
            <Input id="egress-path" data-testid="egress-path-input" value={path} onChange={(event) => setPath(event.target.value)} placeholder="/api/v1/health" />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label htmlFor="egress-body">Body (JSON, optional)</Label>
            <Textarea id="egress-body" data-testid="egress-body-textarea" value={body} onChange={(event) => setBody(event.target.value)} placeholder='{"jsonrpc":"2.0","id":1,"method":"tools/list"}' />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button data-testid="egress-run-button" onClick={run} disabled={busy || !serviceId}>{busy ? <Spinner className="h-4 w-4" /> : <Play aria-hidden="true" className="h-4 w-4" />}Run egress</Button>
        </div>
        {error ? <p role="alert" data-testid="egress-error" className="text-sm text-destructive">{error}</p> : null}
      </Card>

      {result ? (
        <Card title="Result">
          <div data-testid="egress-result" className="space-y-2">
            {(result.results ?? []).map((row, index) => (
              <div key={index} className="flex flex-wrap items-center gap-2">
                <StatusPill value={row.allowed ? "allowed" : "denied"} />
                <code className="text-xs">{row.service_id} {row.method} {row.path}</code>
                {row.reason ? <Badge variant="secondary" data-testid="egress-result-reason">{row.reason}</Badge> : null}
                <Badge variant="secondary">HTTP {row.status_code ?? 0}</Badge>
              </div>
            ))}
            <JsonBlock title="Raw result" value={result} defaultCollapsed={false} />
          </div>
        </Card>
      ) : null}

      <Card title="Outbound call trace / audit">
        {audit.error ? (
          <EmptyState title="Trace not available" detail="Reading the egress trace requires code:egress:audit." />
        ) : traceRows.length ? (
          <div data-testid="egress-trace-table">
            <DataTable columns={traceColumns} rows={traceRows} emptyMessage="No outbound calls yet." getRowId={(row) => row.id} tableId="egress-trace" />
          </div>
        ) : (
          <EmptyState title="No outbound calls yet" detail="Run an allowlisted egress operation to populate the trace." />
        )}
      </Card>
      <CopyrightFooter />
    </Page>
  );
}

// W28E-1838 §6: bespoke IdamPage (raw-JSON dump) removed; IDAM uses shared @cloud-dog/idam components.

function ShellApp() {
  const cfg = useRuntimeConfig();
  const auth = useAuth();
  setIdamTransportAuth({ apiKey: auth.getAccessToken?.() ?? null });
  const navigate = useNavigate();
  const location = useLocation();
  const authRef = React.useRef(auth);
  React.useEffect(() => {
    authRef.current = auth;
  }, [auth]);
  const api = React.useMemo(
    () =>
      createCodeRunnerApi({
        baseUrl: cfg.API_BASE_URL,
        mcpBaseUrl: cfg.MCP_BASE_URL,
        getAccessToken: () => authRef.current.getAccessToken(),
        onAuthError: () => {
          void authRef.current.logout();
        },
      }),
    [cfg.API_BASE_URL, cfg.MCP_BASE_URL],
  );
  const [services, setServices] = React.useState<ServiceStatus[]>([
    { name: "API", url: `${cfg.API_BASE_URL}/webapi/v1/ping`, status: "unknown" },
    { name: "MCP", url: `${cfg.API_BASE_URL}/webmcp/health`, status: "unknown" },
    { name: "A2A", url: `${cfg.API_BASE_URL}/weba2a/health`, status: "unknown" },
  ]);

  React.useEffect(() => {
    document.title = `${BRAND_NAME} : ${manifest.appName}`;
  }, []);

  React.useEffect(() => {
    if (!auth.isAuthenticated) return;
    let cancelled = false;
    const probe = async () => {
      const targets = [
        { name: "API", url: `${cfg.API_BASE_URL}/webapi/v1/ping`, path: "/webapi/v1/ping" },
        { name: "MCP", url: `${cfg.API_BASE_URL}/webmcp/health`, path: "/webmcp/health" },
        { name: "A2A", url: `${cfg.API_BASE_URL}/weba2a/health`, path: "/weba2a/health" },
      ];
      const next = await Promise.all(targets.map(async (target): Promise<ServiceStatus> => {
        try {
          await apiRequest<Record<string, unknown>>(api, target.path);
          return { name: target.name, url: target.url, status: "ok" };
        } catch {
          return { name: target.name, url: target.url, status: "error" };
        }
      }));
      if (!cancelled) setServices(next);
    };
    void probe();
    const timer = window.setInterval(() => {
      void probe();
    }, 15000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [api, auth.isAuthenticated, cfg.API_BASE_URL]);

  if (auth.isLoading) {
    return (
      <div className="grid min-h-screen place-items-center bg-muted/10" role="status" aria-live="polite">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner className="h-5 w-5" /> Loading session...
        </div>
      </div>
    );
  }

  if (!auth.isAuthenticated) {
    return <LoginPage appName={manifest.appName} mode="cookie" error={auth.error} />;
  }

  if (location.pathname === "/login" || location.pathname === "/auth/login") {
    return <Navigate to="/" replace />;
  }

  const navItems: NavItemType[] = [
    {
      label: "Code Runner",
      path: "/",
      icon: navIcon(Terminal),
      children: [
        { label: "Dashboard", path: "/", icon: navIcon(LayoutDashboard) },
        { label: "Executions", path: "/executions", icon: navIcon(Play) },
        { label: "Sessions", path: "/sessions", icon: navIcon(History) },
        { label: "Profiles", path: "/profiles", icon: navIcon(FileCode2) },
        { label: "Templates", path: "/templates", icon: navIcon(FileText) },
        { label: "Examples", path: "/examples", icon: navIcon(BookOpen) },
        { label: "Sandboxes", path: "/sandboxes", icon: navIcon(Boxes) },
        { label: "Service Egress", path: "/egress", icon: navIcon(Network) },
        { label: "Audit Log", path: "/audit-log", icon: navIcon(ClipboardList) },
      ],
    },
    {
      label: "Admin",
      path: "/admin/users",
      icon: navIcon(Users),
      children: [
        { label: "Users", path: "/admin/users", icon: navIcon(Users) },
        { label: "Groups", path: "/admin/groups", icon: navIcon(Users) },
        { label: "API Keys", path: "/admin/api-keys", icon: navIcon(KeyRound) },
        { label: "Roles", path: "/admin/roles", icon: navIcon(Shield) },
        { label: "RBAC", path: "/admin/rbac", icon: navIcon(Shield) },
      ],
    },
    {
      label: "Developer",
      path: "/developer/api-docs",
      icon: navIcon(Wrench),
      children: [
        { label: "API Docs", path: "/developer/api-docs", icon: navIcon(FileText) },
        { label: "MCP Console", path: "/developer/mcp-console", icon: navIcon(Terminal) },
        { label: "A2A Console", path: "/developer/a2a-console", icon: navIcon(Radio) },
      ],
    },
    {
      label: "System",
      path: "/system/jobs",
      icon: navIcon(Activity),
      children: [
        { label: "Jobs", path: "/system/jobs", icon: navIcon(ListChecks) },
        { label: "Settings", path: "/system/settings", icon: navIcon(Settings) },
        { label: "About", path: "/system/about", icon: navIcon(Info) },
      ],
    },
  ];

  return (
    <ShellLayout
      appName={manifest.appName}
      navItems={navItems}
      preset={operationalConsolePreset}
      userMenu={{
        displayName: auth.user?.displayName ?? auth.user?.username ?? "operator",
        email: auth.user?.email,
        onSettings: () => navigate("/system/settings"),
        onAbout: () => navigate("/system/about"),
        onLogout: () => {
          void auth.logout().then(() => navigate("/login"));
        },
      }}
    >
      <ServiceStatusBar services={services} />
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <VersionInfo version={cfg.APP_VERSION ?? "0.1.0"} />
        <span>Runtime: {cfg.ENV}</span>
        <span>Auth: cookie session</span>
      </div>
      <Routes>
        {/* PS-WEBUI-URL-CANONICAL v1.0: each page has ONE canonical path. The
            server issues a 308 to the canonical path on direct nav / refresh;
            the legacy aliases are ALSO mounted here (defense in depth) so an
            in-app client-side transition still renders the same component. */}
        {/* --- Domain pages (already canonical) --- */}
        <Route path="/" element={<DashboardPage api={api} services={services} />} />
        <Route path="/executions" element={<ExecutionsPage api={api} />} />
        <Route path="/sessions" element={<SessionsPage api={api} />} />
        <Route path="/profiles" element={<ProfilesPage api={api} />} />
        <Route path="/generation-profiles" element={<Navigate to="/profiles" replace />} />
        <Route path="/templates" element={<TemplatesPage />} />
        <Route path="/examples" element={<ExamplesPage />} />
        <Route path="/sandboxes" element={<SandboxesPage api={api} />} />
        <Route path="/egress" element={<EgressPage api={api} />} />
        <Route path="/service-egress" element={<Navigate to="/egress" replace />} />
        {/* canonical /audit-log; /audit + /logs kept as back-compat aliases. */}
        <Route path="/audit-log" element={<AuditPage api={api} />} />
        <Route path="/audit" element={<Navigate to="/audit-log" replace />} />
        <Route path="/diagnostics-audit" element={<Navigate to="/audit-log" replace />} />
        <Route path="/observability" element={<Navigate to="/audit-log" replace />} />
        <Route path="/logs" element={<Navigate to="/audit-log" replace />} />
        {/* W28E-1838 §6: canonical /admin/* IDAM pages use the shared @cloud-dog/idam components (no bespoke). */}
        <Route path="/admin/users" element={<IdamUsersPage apiBaseUrl={IDAM_API_BASE} />} />
        <Route path="/admin/groups" element={<IdamGroupsPage apiBaseUrl={IDAM_API_BASE} />} />
        <Route path="/admin/api-keys" element={<IdamApiKeysPage apiBaseUrl={IDAM_API_BASE} />} />
        <Route path="/admin/roles" element={<IdamRolesPage apiBaseUrl={IDAM_API_BASE} />} />
        <Route path="/admin/rbac" element={<IdamRbacPage apiBaseUrl={IDAM_API_BASE} />} />
        <Route path="/admin" element={<Navigate to="/admin/users" replace />} />
        <Route path="/idam/users" element={<Navigate to="/admin/users" replace />} />
        <Route path="/idam/groups" element={<Navigate to="/admin/groups" replace />} />
        <Route path="/idam/api-keys" element={<Navigate to="/admin/api-keys" replace />} />
        <Route path="/idam/roles" element={<Navigate to="/admin/roles" replace />} />
        <Route path="/idam/rbac" element={<Navigate to="/admin/rbac" replace />} />
        <Route path="/idam/:section" element={<Navigate to="/admin/users" replace />} />
        {/* --- Developer (canonical /developer/*, legacy API-doc aliases redirect) --- */}
        <Route path="/developer/api-docs" element={<ApiDocsPage cfg={cfg} />} />
        <Route path="/developer/mcp-console" element={<McpConsolePage cfg={cfg} api={api} />} />
        <Route path="/developer/a2a-console" element={<A2aConsolePage cfg={cfg} api={api} />} />
        <Route path="/api-docs" element={<Navigate to="/developer/api-docs" replace />} />
        <Route path="/docs" element={<Navigate to="/developer/api-docs" replace />} />
        <Route path="/openapi" element={<Navigate to="/developer/api-docs" replace />} />
        <Route path="/mcp-console" element={<Navigate to="/developer/mcp-console" replace />} />
        <Route path="/mcp" element={<Navigate to="/developer/mcp-console" replace />} />
        <Route path="/a2a-console" element={<Navigate to="/developer/a2a-console" replace />} />
        <Route path="/a2a" element={<Navigate to="/developer/a2a-console" replace />} />
        {/* --- System (canonical /system/*, legacy aliases render same) --- */}
        <Route path="/system/jobs" element={<JobsPage api={api} />} />
        <Route path="/system/settings" element={<SettingsPage cfg={cfg} api={api} />} />
        <Route
          path="/system/about"
          element={
            <AboutPage
              productName={manifest.appName}
              description="Code Runner executes sandboxed Python and Node workflows across WebUI, API, MCP and A2A surfaces."
              version={cfg.APP_VERSION ?? "0.1.0"}
            />
          }
        />
        <Route path="/jobs" element={<Navigate to="/system/jobs" replace />} />
        <Route path="/settings" element={<Navigate to="/system/settings" replace />} />
        <Route path="/about" element={<Navigate to="/system/about" replace />} />
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <CopyrightFooter />
    </ShellLayout>
  );
}

function AppWithProviders() {
  const cfg = useRuntimeConfig();
  return (
    <AuthProvider
      config={{
        mode: "cookie",
        apiBaseUrl: cfg.API_BASE_URL,
        cookie: { loginPath: "/auth/login", mePath: "/auth/me", logoutPath: "/auth/logout" },
        idleTimeoutMs: (cfg.SESSION_TIMEOUT_MINUTES ?? 30) * 60 * 1000,
      }}
    >
      <SessionTimeoutProvider
        timeoutMinutes={cfg.SESSION_TIMEOUT_MINUTES ?? 30}
        warningMinutes={cfg.SESSION_WARNING_MINUTES ?? 5}
      >
        <ShellApp />
      </SessionTimeoutProvider>
    </AuthProvider>
  );
}

export function App() {
  return (
    <ConfigProvider schema={AppRuntimeConfigSchema}>
      <AppWithProviders />
    </ConfigProvider>
  );
}
