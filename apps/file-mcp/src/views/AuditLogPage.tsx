// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
//
// Licensed under the Apache License, Version 2.0 (the "License");

import * as React from "react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  DataTable,
  Input,
  RelativeTime,
  Select,
  type DataColumn,
} from "@cloud-dog/ui";
import type { AuditEntry } from "../lib/types";
import { useFileMcpState } from "../state/AppState";

type AuditRow = Readonly<{
  id: string;
  timestamp: string;
  action: string;
  outcome: string;
  tool: string;
  actor: string;
  from: string;
  eventType: string;
  target: string;
  severity: string;
  traceId: string;
  service: string;
  filePath: string;
}>;

function deriveFilePath(entry: AuditEntry): string {
  const target = entry.target;
  if (target?.path) return String(target.path);
  const params = entry.params as Record<string, unknown> | undefined;
  if (params) {
    const path = params.path ?? params.src ?? params.dst;
    if (typeof path === "string" && path.trim()) return path;
  }
  const paths = entry.paths as Record<string, unknown> | undefined;
  if (paths) {
    const path = paths.path ?? paths.src ?? paths.dst;
    if (typeof path === "string" && path.trim()) return path;
  }
  if (target?.name) return String(target.name);
  if (target?.id) return String(target.id);
  return "";
}

function toCsv(rows: AuditRow[]): string {
  const header = ["timestamp", "who", "from", "event_type", "action", "target", "outcome", "severity", "tool", "trace_id", "service", "file_path"];
  const escapeCell = (value: string) => `"${value.replace(/"/g, "\"\"")}"`;
  const body = rows.map((row) =>
    [
      row.timestamp, row.actor, row.from, row.eventType, row.action,
      row.target, row.outcome, row.severity, row.tool, row.traceId,
      row.service, row.filePath,
    ].map((value) => escapeCell(value)).join(",")
  );
  return `${header.join(",")}\n${body.join("\n")}\n`;
}

export function AuditLogPage() {
  const { api, auditLogPath } = useFileMcpState();
  const [rows, setRows] = React.useState<AuditRow[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState("");
  const [actionFilter, setActionFilter] = React.useState("all");
  const [filePathFilter, setFilePathFilter] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(25);

  const load = React.useCallback(async () => {
    setError(null);
    try {
      const entries = await api.readAuditLog(auditLogPath);
      const mapped = entries.map((entry: AuditEntry, index: number) => ({
        id: `${entry.timestamp ?? "entry"}-${index}`,
        timestamp: entry.timestamp ?? "",
        action: entry.action ?? "-",
        outcome: entry.outcome ?? "-",
        tool: entry.tool ?? entry.tool_name ?? "-",
        actor: entry.actor?.id ?? entry.actor_id ?? "-",
        from: entry.actor?.ip ?? entry.client_ip ?? "-",
        eventType: entry.event_type ?? "-",
        target: entry.target ? `${entry.target.type ?? ""}:${entry.target.id ?? ""}` : "-",
        severity: entry.severity ?? "-",
        traceId: entry.trace_id ?? entry.correlation_id ?? "",
        service: entry.service ?? "-",
        filePath: deriveFilePath(entry),
      }));
      setRows(mapped);
      setStatus(`Loaded ${mapped.length} audit entries.`);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load audit log.");
    }
  }, [api, auditLogPath]);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    setPage(1);
  }, [actionFilter, filePathFilter]);

  const actionOptions = React.useMemo(() => {
    const unique = new Set<string>();
    for (const row of rows) {
      if (row.action && row.action !== "-") unique.add(row.action);
    }
    return ["all", ...Array.from(unique).sort((left, right) => left.localeCompare(right))];
  }, [rows]);

  const filteredRows = React.useMemo(() => {
    const actionNeedle = actionFilter.trim().toLowerCase();
    const pathNeedle = filePathFilter.trim().toLowerCase();
    return rows.filter((row) => {
      const actionMatches =
        actionNeedle === "all" || row.action.toLowerCase() === actionNeedle;
      const pathMatches =
        !pathNeedle ||
        `${row.filePath} ${row.tool} ${row.actor}`.toLowerCase().includes(pathNeedle);
      return actionMatches && pathMatches;
    });
  }, [actionFilter, filePathFilter, rows]);

  const exportCsv = React.useCallback(() => {
    const blob = new Blob([toCsv(filteredRows)], { type: "text/csv;charset=utf-8" });
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(blob);
    anchor.download = "file-mcp-audit-log.csv";
    anchor.click();
    URL.revokeObjectURL(anchor.href);
    setStatus(`CSV exported (${filteredRows.length} rows).`);
  }, [filteredRows]);

  const columns: DataColumn<AuditRow>[] = [
    {
      id: "timestamp",
      header: "Timestamp",
      sortable: true,
      sortValue: (row) => row.timestamp,
      cell: (row) => <RelativeTime timestamp={row.timestamp} />,
    },
    { id: "actor", header: "Who", sortable: true, sortValue: (row) => row.actor, cell: (row) => row.actor },
    { id: "from", header: "From", sortable: true, sortValue: (row) => row.from, cell: (row) => row.from || "-" },
    { id: "eventType", header: "Event Type", sortable: true, sortValue: (row) => row.eventType, cell: (row) => row.eventType || "-" },
    { id: "action", header: "Action", sortable: true, sortValue: (row) => row.action, cell: (row) => row.action },
    { id: "target", header: "Target", sortable: true, sortValue: (row) => row.target, cell: (row) => (
      <span className="max-w-[200px] truncate inline-block" title={row.target}>{row.target || "-"}</span>
    ) },
    { id: "outcome", header: "Outcome", sortable: true, sortValue: (row) => row.outcome, cell: (row) => row.outcome },
    { id: "severity", header: "Severity", sortable: true, sortValue: (row) => row.severity, cell: (row) => row.severity || "-" },
    { id: "tool", header: "Tool", sortable: true, sortValue: (row) => row.tool, cell: (row) => row.tool },
    { id: "traceId", header: "Trace ID", sortable: false, cell: (row) => (
      <span className="font-mono text-xs text-muted-foreground">{(row.traceId || "").substring(0, 8)}</span>
    ) },
    { id: "service", header: "Service", sortable: true, sortValue: (row) => row.service, cell: (row) => row.service || "-" },
    {
      id: "filePath",
      header: "File path",
      sortable: true,
      sortValue: (row) => row.filePath,
      cell: (row) => (
        <span className="font-mono text-xs break-all">{row.filePath || "-"}</span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Audit Log</h1>
          <p className="text-sm text-muted-foreground">Source: {auditLogPath}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => void load()}>
            Refresh
          </Button>
          <Button onClick={exportCsv}>Export CSV</Button>
        </div>
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
        <CardHeader className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span>Action filter</span>
              <Select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={actionFilter}
                onChange={(event) => setActionFilter(event.target.value)}
                aria-label="Action filter"
              >
                {actionOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
            </label>
            <label className="space-y-1 text-sm">
              <span>File path filter</span>
              <Input
                value={filePathFilter}
                onChange={(event) => setFilePathFilter(event.target.value)}
                aria-label="File path filter"
                placeholder="Filter by path, tool, or actor"
              />
            </label>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable
            tableId="file-mcp-audit-log"
            columns={columns}
            rows={filteredRows}
            getRowId={(row) => row.id}
            emptyMessage={error ? "Audit log unavailable." : "No audit entries found."}
            page={page}
            onPageChange={setPage}
            pageSize={pageSize}
            onPageSizeChange={setPageSize}
            selectable={true}
            columnPickerEnabled={true}
          />
        </CardContent>
      </Card>
    </div>
  );
}
