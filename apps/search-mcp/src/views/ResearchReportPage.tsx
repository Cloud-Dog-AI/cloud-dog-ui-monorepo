// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
// Licensed under the Apache License 2.0
import * as React from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, JsonExplorer } from "@cloud-dog/ui";
import { PageHeader, StatusLine, errMessage } from "../lib/ui";
import { useSearchState } from "../state/AppState";
import type { ResearchReport } from "../lib/types";

export function ResearchReportPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const { api } = useSearchState();
  const [report, setReport] = React.useState<ResearchReport | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => {
    let c = false;
    void (async () => {
      try { const r = await api.researchStatus(jobId ?? ""); if (!c) setReport(r); }
      catch (e) { if (!c) setError(errMessage(e)); }
      finally { if (!c) setLoading(false); }
    })();
    return () => { c = true; };
  }, [api, jobId]);
  return (
    <div className="space-y-4">
      <PageHeader title="Research report" description={`Job ${jobId ?? ""}`} />
      <StatusLine loading={loading} error={error} />
      <Card><CardHeader><h2 className="text-lg font-semibold">Report</h2></CardHeader>
        <CardContent><JsonExplorer data={(report as Record<string, unknown>) ?? {}} /></CardContent></Card>
    </div>
  );
}
