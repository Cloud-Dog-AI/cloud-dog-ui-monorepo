// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
// Licensed under the Apache License 2.0
import * as React from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button, Card, CardContent, CardHeader, DataTable, type DataColumn } from "@cloud-dog/ui";
import { PageHeader, StatusLine, errMessage } from "../lib/ui";
import { useSearchState } from "../state/AppState";
import type { WatchRow } from "../lib/types";

const cols: DataColumn<WatchRow>[] = [
  { id: "id", header: "Watch", cell: (r) => String(r.id ?? r.watch_id ?? "—") },
  { id: "query", header: "Query", cell: (r) => String(r.query ?? "—") },
  { id: "status", header: "Status", cell: (r) => String(r.status ?? "—") },
  { id: "events", header: "", cell: (r) => { const id = r.id ?? r.watch_id; return id ? <Link to={`/watches/${id}/events`} className="text-primary underline">Events</Link> : <span>—</span>; } },
];

export function WatchesPage() {
  const { api } = useSearchState();
  const navigate = useNavigate();
  const [rows, setRows] = React.useState<WatchRow[]>([]);
  const [query, setQuery] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const reload = React.useCallback(async () => {
    setLoading(true);
    try { const data = await api.watchesList(); setRows(data.watches ?? data.items ?? []); }
    catch (e) { setError(errMessage(e)); }
    finally { setLoading(false); }
  }, [api]);
  React.useEffect(() => { void reload(); }, [reload]);

  const create = React.useCallback(async () => {
    if (!query.trim()) return;
    try { await api.watchCreate({ query, condition: {}, backends: [], on_match_action: {}, schedule_spec: {}, budget: {} }); setQuery(""); await reload(); }
    catch (e) { setError(errMessage(e, "Create failed.")); }
  }, [api, query, reload]);

  return (
    <div className="space-y-4">
      <PageHeader title="Watches" description="Streaming-watch CRUD + per-watch event timeline." />
      <Card><CardHeader><h2 className="text-lg font-semibold">New watch</h2></CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex-1"><span className="block text-sm">Query</span>
              <input aria-label="Watch query" className="w-full rounded border px-2 py-1" value={query} onChange={(e) => setQuery(e.target.value)} /></label>
            <Button type="button" onClick={() => void create()} disabled={!query.trim()}>Create watch</Button>
          </div>
        </CardContent></Card>
      <StatusLine loading={loading} error={error} />
      <Card><CardHeader><h2 className="text-lg font-semibold">Watches</h2></CardHeader>
        <CardContent><DataTable columns={cols} rows={rows} getRowId={(r) => String(r.id ?? r.watch_id ?? Math.random())}
          ariaLabel="Watches" emptyMessage="No watches configured." /></CardContent></Card>
    </div>
  );
}
