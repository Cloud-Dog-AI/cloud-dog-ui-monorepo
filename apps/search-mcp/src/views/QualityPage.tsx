// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
// Licensed under the Apache License 2.0
import * as React from "react";
import { Card, CardContent, CardHeader, JsonExplorer } from "@cloud-dog/ui";
import { PageHeader, StatusLine, errMessage } from "../lib/ui";
import { useSearchState } from "../state/AppState";

export function QualityPage() {
  const { api } = useSearchState();
  const [data, setData] = React.useState<unknown>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => {
    let c = false;
    void api.quality().then((d) => { if (!c) setData(d); }).catch((e) => { if (!c) setError(errMessage(e)); }).finally(() => { if (!c) setLoading(false); });
    return () => { c = true; };
  }, [api]);
  return (
    <div className="space-y-4">
      <PageHeader title="Quality" description="Quality / freshness / authenticity ranking config and classifier eval." />
      <StatusLine loading={loading} error={error} />
      <Card><CardHeader><h2 className="text-lg font-semibold">Ranking configuration</h2></CardHeader>
        <CardContent><JsonExplorer data={(data as Record<string, unknown>) ?? {}} /></CardContent></Card>
    </div>
  );
}
