// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
// Licensed under the Apache License 2.0
import * as React from "react";
import { Card, CardContent, CardHeader } from "@cloud-dog/ui";
import { useSearchState } from "../state/AppState";
import { manifest } from "../routes/manifest";
import { PageHeader, StatusLine, errMessage } from "../lib/ui";
import type { AboutResponse } from "../lib/types";

export function AboutPage() {
  const { api, appVersion } = useSearchState();
  const [about, setAbout] = React.useState<AboutResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => {
    let c = false;
    void api.systemAbout().then((a) => { if (!c) setAbout(a); }).catch((e) => { if (!c) setError(errMessage(e)); }).finally(() => { if (!c) setLoading(false); });
    return () => { c = true; };
  }, [api]);
  const rows: Array<[string, string]> = [
    ["Service", String(about?.service ?? manifest.serviceName)],
    ["Version", String(about?.version ?? appVersion)],
    ["Source commit", String(about?.source_commit ?? "—")],
    ["Container digest", String(about?.container_digest ?? "—")],
    ["Build artefact", String(about?.build_artefact ?? "—")],
    ["Config version", String(about?.config_version ?? "—")],
    ["Environment", String(about?.environment ?? "—")],
    ["Runtime health", String(about?.runtime_health ?? "—")],
  ];
  return (
    <div className="space-y-6">
      <PageHeader title="About" version={appVersion} description={`${manifest.appName} — Smart Search Agent (multi-backend, LLM-orchestrated research).`} />
      <StatusLine loading={loading} error={error} />
      <Card>
        <CardHeader><h2 className="text-lg font-semibold">Deployment identity</h2><p className="text-sm text-muted-foreground">CSR-029 — source commit · package version · container digest · build artefact · config version · runtime health.</p></CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2" data-testid="about-deployment-identity">
            {rows.map(([k, v]) => (<div key={k} className="flex flex-col"><dt className="text-xs text-muted-foreground">{k}</dt><dd className="font-mono text-sm">{v}</dd></div>))}
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
