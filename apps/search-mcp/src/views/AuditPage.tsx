// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
// Licensed under the Apache License 2.0
import * as React from "react";
import { Button, DataTable, Input, Select, StatusBadge, type DataColumn } from "@cloud-dog/ui";
import { useSearchState } from "../state/AppState";
import { PageHeader, StatusLine, errMessage } from "../lib/ui";
import type { AuditEventRow } from "../lib/types";

export const AUDIT_EVENT_TYPES = [
  "auth.success", "auth.failure", "authz.denied", "anon.deny", "mutation",
  "config.change", "admin.action", "mcp.call", "a2a.call", "api.call",
  "webui.action", "external.call", "audit.integrity",
] as const;

export function AuditPage() {
  const { api, appVersion } = useSearchState();
  const [rows, setRows] = React.useState<AuditEventRow[]>([]);
  const [eventType, setEventType] = React.useState("");
  const [actor, setActor] = React.useState("");
  const [outcome, setOutcome] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true); setError(null);
    try { const r = await api.auditList({ page_size: 200, event_type: eventType || undefined, outcome: outcome || undefined, actor_user_id: actor || undefined }); setRows(r.items); }
    catch (e) { setError(errMessage(e, "Failed to load audit events.")); }
    finally { setLoading(false); }
  }, [api, eventType, outcome, actor]);
  React.useEffect(() => { void load(); }, [load]);

  const columns: DataColumn<AuditEventRow>[] = [
    { id: "timestamp", header: "Time", sortable: true, sortValue: (r) => String(r.timestamp ?? ""), cell: (r) => <span className="text-xs text-muted-foreground">{String(r.timestamp ?? "—")}</span> },
    { id: "event_type", header: "Event", sortable: true, sortValue: (r) => String(r.event_type ?? ""), cell: (r) => String(r.event_type ?? "—") },
    { id: "outcome", header: "Outcome", sortable: true, sortValue: (r) => String(r.outcome ?? ""), cell: (r) => <StatusBadge value={String(r.outcome ?? "unknown")} /> },
    { id: "component", header: "Surface", sortable: true, sortValue: (r) => String(r.component ?? ""), cell: (r) => String(r.component ?? "—") },
    { id: "action", header: "Action", sortable: true, sortValue: (r) => String(r.action ?? ""), cell: (r) => String(r.action ?? "—") },
    { id: "actor", header: "Actor", cell: (r) => String((r.actor as Record<string, unknown> | undefined)?.user_id ?? "—") },
    { id: "correlation", header: "Correlation", cell: (r) => <span className="font-mono text-xs">{String(r.correlation_id ?? "—")}</span> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Audit Log" version={appVersion} description="NIST AU-3 structured audit events — filter by event, actor, and outcome.">
        <a href={api.auditExportUrl("csv")} className="rounded border px-3 py-1 text-sm" data-testid="audit-export-csv">Export CSV</a>
        <Button variant="secondary" size="sm" onClick={() => void load()}>Refresh</Button>
      </PageHeader>
      <div className="grid gap-3 md:grid-cols-3">
        <Select aria-label="Filter audit event type" value={eventType} onChange={(e) => setEventType(e.currentTarget.value)}>
          <option value="">Any event type</option>{AUDIT_EVENT_TYPES.map((i) => <option key={i} value={i}>{i}</option>)}
        </Select>
        <Input aria-label="Filter audit actor" placeholder="Actor user id" value={actor} onChange={(e) => setActor(e.currentTarget.value)} />
        <Select aria-label="Filter audit outcome" value={outcome} onChange={(e) => setOutcome(e.currentTarget.value)}>
          <option value="">Any outcome</option><option value="success">success</option><option value="failure">failure</option><option value="denied">denied</option>
        </Select>
      </div>
      <StatusLine loading={loading} error={error} status={`${rows.length} audit events visible`} />
      <DataTable columns={columns} rows={rows} getRowId={(r) => String(r.correlation_id ?? r.timestamp ?? Math.random())}
        emptyMessage="No audit events match the current filters." pageSize={50} columnPickerEnabled tableId="search-mcp-audit" />
    </div>
  );
}
