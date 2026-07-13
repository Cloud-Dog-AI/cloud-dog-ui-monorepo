// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
// Licensed under the Apache License 2.0
import * as React from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button, Card, CardContent, CardHeader, DataTable, JsonExplorer, type DataColumn } from "@cloud-dog/ui";
import { PageHeader, StatusLine, errMessage } from "../lib/ui";
import { useSearchState } from "../state/AppState";
import type { ResearchReport } from "../lib/types";

const cols: DataColumn<ResearchReport>[] = [
  { id: "job", header: "Job", cell: (r) => String(r.job_id ?? "—") },
  { id: "query", header: "Query", cell: (r) => String(r.query ?? "—") },
  { id: "status", header: "Status", cell: (r) => String(r.status ?? "—") },
  { id: "view", header: "", cell: (r) => (r.job_id ? <Link to={`/research/${r.job_id}`} className="text-primary underline">View</Link> : <span>—</span>) },
];

export function ResearchPage() {
  const { api } = useSearchState();
  const navigate = useNavigate();
  const [query, setQuery] = React.useState("");
  const [depth, setDepth] = React.useState("standard");
  const [result, setResult] = React.useState<ResearchReport | null>(null);
  const [history, setHistory] = React.useState<ResearchReport[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const reload = React.useCallback(async () => {
    try {
      const data = await api.researchList(25);
      setHistory(data.items ?? data.jobs ?? []);
    } catch (e) { setError(errMessage(e)); }
  }, [api]);
  React.useEffect(() => { void reload(); }, [reload]);

  const run = React.useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true); setError(null);
    try {
      if (depth === "deep" || depth === "exhaustive") { await api.researchStart(query, depth); await reload(); }
      else { setResult(await api.research(query, depth)); }
    } catch (e) { setError(errMessage(e, "Research failed.")); }
    finally { setLoading(false); }
  }, [api, query, depth, reload]);

  return (
    <div className="space-y-4">
      <PageHeader title="Research" description="Interactive research console — query, depth, live synthesis." />
      <Card>
        <CardHeader><h2 className="text-lg font-semibold">New research</h2></CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex-1">
              <span className="block text-sm">Query</span>
              <input aria-label="Research query" className="w-full rounded border px-2 py-1" value={query} onChange={(e) => setQuery(e.target.value)} />
            </label>
            <label>
              <span className="block text-sm">Depth</span>
              <select aria-label="Depth" className="rounded border px-2 py-1" value={depth} onChange={(e) => setDepth(e.target.value)}>
                <option value="quick">quick</option><option value="standard">standard</option>
                <option value="deep">deep</option><option value="exhaustive">exhaustive</option>
              </select>
            </label>
            <Button type="button" onClick={() => void run()} disabled={loading || !query.trim()}>Run</Button>
          </div>
          <StatusLine loading={loading} error={error} />
          {result ? <div className="mt-3"><JsonExplorer data={(result as Record<string, unknown>) ?? {}} /></div> : null}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><h2 className="text-lg font-semibold">Recent reports</h2></CardHeader>
        <CardContent>
          <DataTable columns={cols} rows={history} getRowId={(r) => String(r.job_id ?? r.query ?? Math.random())}
            ariaLabel="Research history" emptyMessage="No research jobs yet." />
        </CardContent>
      </Card>
    </div>
  );
}
