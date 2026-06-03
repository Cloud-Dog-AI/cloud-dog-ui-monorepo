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

// @cloud-dog/app-index-retriever — Observability page with NIST AU-3 audit log DataTable.
// Covers: W28A-641 R1-R6, W28A-648, PS-40 L3

import * as React from "react";
import {
  AuditPanel,
  Button,
  Card,
  CardContent,
  CardHeader,
  DataTable,
  HealthWidget,
  RelativeTime,
  ResourceMetrics,
  SearchPanel,
} from "@cloud-dog/ui";
import type { DataColumn, LogEntry, SearchFilterValues } from "@cloud-dog/ui";
import { useIndexRetrieverState } from "../state/AppState";
import type { AuditLogEntry } from "../lib/types";

const LOG_SOURCES = ["audit", "api", "web", "mcp", "a2a"] as const;
type LogSource = (typeof LOG_SOURCES)[number];

function flattenAuditValue(value: unknown): string[] {
  if (value == null) return [];
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return [String(value)];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => flattenAuditValue(item));
  }
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, nested]) => [key, ...flattenAuditValue(nested)]);
  }
  return [];
}

function collectAuditKeys(value: unknown, prefix = ""): string[] {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return [];
  }
  return Object.entries(value as Record<string, unknown>).flatMap(([key, nested]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return [path, ...collectAuditKeys(nested, path)];
  });
}

function summariseAuditDetails(details: Record<string, unknown> | undefined): string {
  if (!details) return "";
  const keys = Array.from(new Set(collectAuditKeys(details)));
  const preferred = keys.filter((item) =>
    item.includes("job")
    || item.includes("profile")
    || item.includes("collection")
    || item.includes("source")
    || item.includes("doc")
    || item.includes("record")
    || item.includes("progress")
  );
  return (preferred.length > 0 ? preferred : keys).slice(0, 8).join(" | ");
}

export function ObservabilityPage() {
  const app = useIndexRetrieverState();
  const [entries, setEntries] = React.useState<AuditLogEntry[]>([]);
  const [backendHealth, setBackendHealth] = React.useState<Record<string, unknown>>({});
  const [embeddingHealth, setEmbeddingHealth] = React.useState<Record<string, unknown>>({});
  const [queueStatus, setQueueStatus] = React.useState<Record<string, unknown>>({});
  const [jobs, setJobs] = React.useState<Record<string, unknown>[]>([]);
  const [logSource, setLogSource] = React.useState<LogSource>("audit");
  const [error, setError] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  const [severityFilter, setSeverityFilter] = React.useState("");
  const [actorFilter, setActorFilter] = React.useState("");
  const [autoFollow, setAutoFollow] = React.useState(true);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(25);

  const refresh = React.useCallback(async () => {
    setError(null);
    try {
      const [response, backend, embedding, queue, jobList] = await Promise.all([
        app.api.getAuditLog({ limit: pageSize, log_source: logSource }),
        app.api.callTool<Record<string, unknown>>("backend_health_check", {}),
        app.api.callTool<Record<string, unknown>>("embedding_health_check", {}),
        app.api.callTool<Record<string, unknown>>("queue_status", {}),
        app.api.callTool<Record<string, unknown>>("job_list", {}),
      ]);
      setEntries(response?.entries ?? []);
      setBackendHealth(backend ?? {});
      setEmbeddingHealth(embedding ?? {});
      setQueueStatus(queue ?? {});
      setJobs(Array.isArray(jobList?.jobs) ? (jobList.jobs as Record<string, unknown>[]) : []);
      app.recordActivity("observability.refresh", "ok", String(response?.count ?? 0));
    } catch (refreshError) {
      const message = app.captureFailure(refreshError);
      setError(message);
    }
  }, [app, logSource, pageSize]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  React.useEffect(() => {
    setPage(1);
  }, [actorFilter, logSource, pageSize, query, severityFilter]);

  const filteredEntries = entries.filter((entry) => {
    if (severityFilter && `${entry.severity ?? entry.level ?? ""}`.toLowerCase() !== severityFilter.toLowerCase()) return false;
    if (actorFilter.trim() && !`${entry.actor?.id ?? ""}`.toLowerCase().includes(actorFilter.trim().toLowerCase())) return false;
    if (!query.trim()) return true;
    const haystack = `${entry.event_type ?? ""} ${entry.action ?? ""} ${entry.outcome ?? ""} ${entry.actor?.id ?? ""} ${entry.target?.id ?? ""} ${entry.severity ?? ""} ${entry.message ?? ""} ${entry.logger ?? ""} ${flattenAuditValue(entry.details).join(" ")}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  });

  const streamEntries = React.useMemo<LogEntry[]>(
    () =>
      entries.map((entry, index) => ({
        id: `${entry.timestamp ?? ""}-${entry.correlation_id ?? ""}-${index}`,
        timestamp: entry.timestamp ?? "",
        level: entry.severity ?? entry.level ?? "info",
        message: entry.message ?? entry.action ?? entry.event_type ?? "log entry",
        source: entry.service ?? logSource,
      })),
    [entries, logSource]
  );

  const handleSearch = React.useCallback((nextQuery: string, filters: SearchFilterValues) => {
    setQuery(nextQuery);
    setSeverityFilter(typeof filters.severity === "string" ? filters.severity : "");
    setActorFilter(typeof filters.actor === "string" ? filters.actor : "");
  }, []);

  const columns = React.useMemo<DataColumn<AuditLogEntry>[]>(
    () => [
      {
        id: "timestamp",
        header: "When",
        sortable: true,
        sortValue: (e) => e.timestamp ?? "",
        cell: (e) => e.timestamp ? <RelativeTime timestamp={e.timestamp} /> : <span>—</span>,
      },
      {
        id: "who",
        header: "Who",
        sortable: true,
        sortValue: (e) => e.actor?.id ?? "",
        cell: (e) => <span title={`${e.actor?.type ?? ""}:${e.actor?.id ?? ""}`}>{e.actor?.id ?? "anonymous"}</span>,
      },
      {
        id: "from",
        header: "From",
        sortable: true,
        sortValue: (e) => e.source_address ?? e.actor?.ip ?? e.source_host ?? "",
        cell: (e) => e.source_address ?? e.actor?.ip ?? e.source_host ?? "",
      },
      {
        id: "destination",
        header: "Destination",
        sortable: true,
        sortValue: (e) => e.destination_address ?? "",
        cell: (e) => e.destination_address ?? "",
      },
      {
        id: "component",
        header: "Component",
        sortable: true,
        sortValue: (e) => e.component ?? e.source_application ?? "",
        cell: (e) => e.component ?? e.source_application ?? "",
      },
      {
        id: "eventType",
        header: "Event Type",
        sortable: true,
        sortValue: (e) => e.event_type ?? e.level ?? "",
        cell: (e) => e.event_type ?? e.level ?? "",
      },
      {
        id: "action",
        header: "Action",
        sortable: true,
        sortValue: (e) => e.action ?? "",
        cell: (e) => e.action ?? e.message ?? "",
      },
      {
        id: "target",
        header: "Target",
        sortable: true,
        sortValue: (e) => e.target?.id ?? "",
        cell: (e) => (
          <span className="max-w-[200px] truncate inline-block" title={`${e.target?.type ?? ""}:${e.target?.id ?? ""}`}>
            {e.target?.id ?? ""}
          </span>
        ),
      },
      {
        id: "details",
        header: "Details",
        sortable: false,
        cell: (e) => {
          const summary = summariseAuditDetails(e.details);
          if (!summary) return "";
          return (
            <span className="inline-block max-w-[320px] truncate text-xs text-muted-foreground" title={summary}>
              {summary}
            </span>
          );
        },
      },
      {
        id: "outcome",
        header: "Outcome",
        sortable: true,
        sortValue: (e) => e.outcome ?? "",
        cell: (e) => e.outcome ?? "",
      },
      {
        id: "severity",
        header: "Severity",
        sortable: true,
        sortValue: (e) => e.severity ?? e.level ?? "",
        cell: (e) => e.severity ?? e.level ?? "",
      },
      {
        id: "duration",
        header: "Duration",
        sortable: true,
        sortValue: (e) => e.duration_ms ?? 0,
        cell: (e) => e.duration_ms == null ? "" : `${e.duration_ms} ms`,
      },
      {
        id: "traceId",
        header: "Trace ID",
        sortable: false,
        cell: (e) => (
          <span className="font-mono text-xs text-muted-foreground">
            {(e.trace_id ?? e.correlation_id ?? "").substring(0, 8)}
          </span>
        ),
      },
      {
        id: "service",
        header: "Service",
        sortable: true,
        sortValue: (e) => e.service ?? "",
        cell: (e) => e.service ?? "",
      },
    ],
    [],
  );

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Observability</h1>
      </header>

      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}

      <ResourceMetrics
        metrics={[]}
        fetchUrl="/status"
        intervalMs={30_000}
        getAccessToken={() => app.apiKey || null}
      />

      <section className="grid gap-4 md:grid-cols-3">
        <HealthWidget name="Log entries" status="ok" detail={`${entries.length} record(s)`} />
        <HealthWidget name="Source" status="ok" detail={logSource.toUpperCase()} />
        <HealthWidget name="Filtered" status="ok" detail={`${filteredEntries.length} visible`} />
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Backend health</h2>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>Status: {String(backendHealth.status ?? "unknown")}</p>
            <p>Provider: {String(backendHealth.provider ?? backendHealth.backend ?? "n/a")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Embedding health</h2>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>Status: {String(embeddingHealth.status ?? "unknown")}</p>
            <p>Model: {String(embeddingHealth.model ?? "n/a")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Queue jobs</h2>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>Total: {String(queueStatus.total ?? 0)}</p>
            <p>Queued: {String(queueStatus.queued ?? 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">job_list</h2>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>Visible jobs: {jobs.length}</p>
            <p>Data source: MCP jobs tool</p>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Audit & Application Logs</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          <SearchPanel
            placeholder="Filter by event, actor, target, outcome, or message"
            filters={[
              {
                name: "severity",
                label: "Severity",
                type: "select",
                options: [
                  { label: "Error", value: "error" },
                  { label: "Warn", value: "warn" },
                  { label: "Info", value: "info" },
                  { label: "Debug", value: "debug" },
                ],
              },
              { name: "actor", label: "Actor", type: "text", placeholder: "Filter by actor id" },
            ]}
            onSearch={handleSearch}
            results={(
              <DataTable
                tableId={`observability-log-${logSource}`}
                columns={columns}
                rows={filteredEntries}
                getRowId={(row) => `${row.timestamp ?? ""}-${row.correlation_id ?? ""}-${row.action ?? ""}`}
                page={page}
                onPageChange={setPage}
                pageSize={pageSize}
                onPageSizeChange={setPageSize}
                selectable={true}
                columnPickerEnabled={true}
              />
            )}
          />
          {query.trim() ? (
            <p role="status" className="text-sm text-muted-foreground">
              Search results for <span className="font-mono">{query}</span>: {filteredEntries.length}
            </p>
          ) : null}

          <AuditPanel
            logTypes={[...LOG_SOURCES]}
            activeType={logSource}
            onTypeChange={(value) => setLogSource(value as LogSource)}
            logs={streamEntries}
            onRefresh={() => void refresh()}
            autoFollow={autoFollow}
            onAutoFollowChange={setAutoFollow}
          />

          <div className="flex justify-end">
            <Button variant="secondary" aria-label="Refresh observability" onClick={() => void refresh()}>
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
