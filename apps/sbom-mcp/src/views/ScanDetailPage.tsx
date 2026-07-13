// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
// Licensed under the Apache License 2.0

import * as React from "react";
import { useParams } from "react-router-dom";
import { Button, Card, CardContent, CardHeader, StatusBadge } from "@cloud-dog/ui";
import { useSbomState } from "../state/AppState";
import { PageHeader, StatusLine, errMessage } from "../lib/ui";
import type { ScanResultResponse } from "../lib/types";

export function ScanDetailPage() {
  const { scanId = "" } = useParams<{ scanId: string }>();
  const { api, appVersion } = useSbomState();
  const [result, setResult] = React.useState<ScanResultResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [cancelling, setCancelling] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setResult(await api.getScanResult(scanId));
    } catch (e) {
      setError(errMessage(e, "Failed to load scan."));
    } finally {
      setLoading(false);
    }
  }, [api, scanId]);

  React.useEffect(() => {
    if (scanId) void load();
  }, [scanId, load]);

  const onCancel = async () => {
    setCancelling(true);
    try {
      await api.cancelScan(scanId);
      await load();
    } catch (e) {
      setError(errMessage(e, "Failed to cancel scan."));
    } finally {
      setCancelling(false);
    }
  };

  if (!result) {
    return (
      <div className="space-y-6">
        <PageHeader title="Scan Detail" description={`scan_id=${scanId}`} version={appVersion} />
        <StatusLine loading={loading} error={error} />
      </div>
    );
  }

  const canCancel = result.status === "queued" || result.status === "running";

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Scan ${result.scan_id.slice(0, 8)}`}
        description={`${result.boundary} · ${result.target_type} · ${result.target}`}
        version={appVersion}
      >
        <Button variant="secondary" size="sm" onClick={() => void load()}>
          Refresh
        </Button>
      </PageHeader>
      <StatusLine loading={false} error={error} />
      <div className="grid gap-4 md:grid-cols-2">
        <Card data-testid="card-verdict">
          <CardHeader>
            <h2 className="text-lg font-semibold">Verdict</h2>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-3xl font-semibold">{result.verdict ?? "—"}</div>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">Status:</span>
              <StatusBadge value={result.status} />
              <span className="text-muted-foreground">Exit:</span>
              <code className="text-xs">{result.exit_code ?? "—"}</code>
            </div>
            {canCancel ? (
              <Button onClick={onCancel} disabled={cancelling} data-testid="cancel-button">
                {cancelling ? "Cancelling…" : "Cancel Scan"}
              </Button>
            ) : null}
            <a
              className="inline-block text-sm text-primary underline"
              href={`/scans/${result.scan_id}/findings`}
              data-testid="scan-detail-findings-link"
            >
              Findings
            </a>
          </CardContent>
        </Card>
        <Card data-testid="card-lifecycle">
          <CardHeader>
            <h2 className="text-lg font-semibold">Lifecycle</h2>
          </CardHeader>
          <CardContent>
            <ul className="text-sm">
              <li>
                <span className="text-muted-foreground">Started:</span> {result.started_at ?? "—"}
              </li>
              <li>
                <span className="text-muted-foreground">Finished:</span>{" "}
                {result.finished_at ?? "—"}
              </li>
              <li>
                <span className="text-muted-foreground">Duration ms:</span>{" "}
                {result.duration_ms ?? "—"}
              </li>
              <li>
                <span className="text-muted-foreground">Target digest:</span>{" "}
                <code className="break-all text-xs">{result.target_digest ?? "—"}</code>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
      <Card data-testid="card-files">
        <CardHeader>
          <h2 className="text-lg font-semibold">Report files</h2>
        </CardHeader>
        <CardContent>
          {result.files.length === 0 ? (
            <div className="text-sm text-muted-foreground">No files persisted yet.</div>
          ) : (
            <ul className="text-sm">
              {result.files.map((f) => (
                <li key={f.name} className="flex items-center justify-between border-b py-1">
                  <div>
                    <code>{f.name}</code>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {f.classification}
                      {f.required ? " · required" : ""}
                    </span>
                  </div>
                  <a
                    className="text-sm underline"
                    href={f.uri ?? "#"}
                    data-testid={`file-link-${f.name}`}
                  >
                    download
                  </a>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      {result.summary_md ? (
        <Card data-testid="card-summary">
          <CardHeader>
            <h2 className="text-lg font-semibold">Summary</h2>
          </CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap text-sm">{result.summary_md}</pre>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
