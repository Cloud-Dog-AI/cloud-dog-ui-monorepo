// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
// Licensed under the Apache License, Version 2.0.
import * as React from "react";
import { Button, Card, CardContent, CardHeader, DataTable, Spinner, type DataColumn } from "@cloud-dog/ui";
import { useCodeRunnerState } from "../state/AppState";

type JobRow = Record<string, unknown>;

export function ExecutionsPage() {
  const { api } = useCodeRunnerState();
  const [rows, setRows] = React.useState<JobRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = (await api.listJobs()) as unknown;
      const list = Array.isArray(result) ? result : ((result as { jobs?: JobRow[] })?.jobs ?? []);
      setRows(list as JobRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load executions.");
    } finally {
      setLoading(false);
    }
  }, [api]);

  React.useEffect(() => { void load(); }, [load]);

  const columns: DataColumn<JobRow>[] = [
    { id: "job_id", header: "execution id", cell: (r) => String(r.job_id ?? r.id ?? "—") },
    { id: "status", header: "status", cell: (r) => String(r.status ?? "—") },
    { id: "created_at", header: "created", cell: (r) => String(r.created_at ?? "—") },
  ];

  return (
    <section aria-labelledby="executions-heading" className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 id="executions-heading" className="text-xl font-semibold">executions</h1>
        <Button variant="outline" onClick={() => void load()}>refresh</Button>
      </div>
      <Card>
        <CardHeader><p className="text-sm text-muted-foreground">code-execution jobs submitted to the sandbox</p></CardHeader>
        <CardContent>
          {loading ? <div className="flex items-center gap-2 text-sm"><Spinner className="h-4 w-4" /> loading…</div>
            : error ? <p className="text-sm text-destructive" role="alert">{error}</p>
            : <DataTable rows={rows} columns={columns} emptyMessage="No executions yet." getRowId={(r) => String(r.job_id ?? r.id ?? Math.random())} />}
        </CardContent>
      </Card>
    </section>
  );
}
