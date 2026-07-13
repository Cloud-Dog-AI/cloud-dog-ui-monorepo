// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
import * as React from "react";
import { Card, CardContent, CardHeader, MetricCard, Spinner } from "@cloud-dog/ui";
import { useCodeRunnerState } from "../state/AppState";

export function SandboxesPage() {
  const { api } = useCodeRunnerState();
  const [cap, setCap] = React.useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = React.useState(true);
  React.useEffect(() => {
    let on = true;
    (async () => {
      try { const r = (await api.jobsQueueStatus()) as Record<string, unknown>; if (on) setCap(r); }
      catch { /* capacity unavailable */ }
      finally { if (on) setLoading(false); }
    })();
    return () => { on = false; };
  }, [api]);
  const pool = (cap?.["code-sandbox"] ?? cap) as Record<string, unknown> | undefined;
  return (
    <section aria-labelledby="sandboxes-heading" className="space-y-4">
      <h1 id="sandboxes-heading" className="text-xl font-semibold">sandboxes</h1>
      {loading ? <div className="flex items-center gap-2 text-sm"><Spinner className="h-4 w-4" /> loading…</div> : (
        <div className="grid gap-3 sm:grid-cols-3">
          <MetricCard label="concurrency cap" value={String(pool?.["total"] ?? "4")} />
          <MetricCard label="in use" value={String(pool?.["in_use"] ?? pool?.["used"] ?? "0")} />
          <MetricCard label="provider" value="local_docker" />
        </div>
      )}
      <Card>
        <CardHeader><p className="text-sm text-muted-foreground">per-run isolated containers (hardened: hard mem cap, no-swap, pids, timeout, network-deny)</p></CardHeader>
        <CardContent><p className="text-sm">Each execution runs in a fresh container and is destroyed on completion.</p></CardContent>
      </Card>
    </section>
  );
}
