// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
// Licensed under the Apache License 2.0

import * as React from "react";
import { useNavigate } from "react-router-dom";
import { Button, Card, CardContent, CardHeader, Input, Select } from "@cloud-dog/ui";
import { useSbomState } from "../state/AppState";
import { PageHeader, errMessage } from "../lib/ui";
import type { ScanResultResponse, ScanStatusResponse, SubmitScanResponse } from "../lib/types";

const BOUNDARIES = ["github", "gitea"];
const TARGET_TYPES = ["container_image", "git_repository", "archive_file"];
const TERMINAL_STATES = new Set(["completed_pass", "completed_fail", "infra_failed", "cancelled", "expired"]);

export function SubmitScanPage() {
  const { api, appVersion } = useSbomState();
  const navigate = useNavigate();
  const [boundary, setBoundary] = React.useState(BOUNDARIES[0]);
  const [targetType, setTargetType] = React.useState(TARGET_TYPES[0]);
  const [target, setTarget] = React.useState("");
  const [storageProfile, setStorageProfile] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [submitted, setSubmitted] = React.useState<SubmitScanResponse | null>(null);
  const [status, setStatus] = React.useState<ScanStatusResponse | null>(null);
  const [result, setResult] = React.useState<ScanResultResponse | null>(null);
  const [pollError, setPollError] = React.useState<string | null>(null);

  const onSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!target.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const resp = await api.submitScan({
        boundary,
        target_type: targetType,
        target: target.trim(),
        storage_profile: storageProfile || null,
      });
      setSubmitted(resp);
      setStatus({ scan_id: resp.scan_id, job_id: resp.job_id, status: resp.status });
      setResult(null);
    } catch (e) {
      setError(errMessage(e, "Failed to submit scan."));
    } finally {
      setBusy(false);
    }
  };

  React.useEffect(() => {
    if (!submitted || result) return;
    let cancelled = false;
    let timer: number | undefined;

    const poll = async () => {
      try {
        const nextStatus = await api.getScanStatus(submitted.scan_id);
        if (cancelled) return;
        setStatus(nextStatus);
        setPollError(null);
        if (TERMINAL_STATES.has(nextStatus.status)) {
          const nextResult = await api.getScanResult(submitted.scan_id);
          if (!cancelled) setResult(nextResult);
          return;
        }
        timer = window.setTimeout(() => {
          void poll();
        }, 1500);
      } catch (e) {
        if (!cancelled) {
          setPollError(errMessage(e, "Failed to poll scan status."));
          timer = window.setTimeout(() => {
            void poll();
          }, 3000);
        }
      }
    };

    void poll();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [api, result, submitted]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Submit Scan"
        version={appVersion}
        description="Queue an SBOM scan via sbomscanner0."
      />
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Scan parameters</h2>
        </CardHeader>
        <CardContent>
          <form className="grid max-w-2xl gap-3" onSubmit={onSubmit} data-testid="submit-form">
            <label className="grid gap-1 text-sm">
              <span className="text-muted-foreground">Boundary</span>
              <Select
                value={boundary}
                onChange={(e) => setBoundary(e.target.value)}
                data-testid="field-boundary"
              >
                {BOUNDARIES.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </Select>
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-muted-foreground">Target type</span>
              <Select
                value={targetType}
                onChange={(e) => setTargetType(e.target.value)}
                data-testid="field-target-type"
              >
                {TARGET_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-muted-foreground">Target</span>
              <Input
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="ghcr.io/org/image:tag OR pkg==1.0.0"
                data-testid="field-target"
                required
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-muted-foreground">Storage profile (optional)</span>
              <Input
                value={storageProfile}
                onChange={(e) => setStorageProfile(e.target.value)}
                placeholder="file / s3 / webdav / ftp"
                data-testid="field-storage-profile"
              />
            </label>
            {error ? (
              <div
                className="rounded border border-rose-300 bg-rose-50 p-2 text-sm text-rose-700"
                data-testid="submit-error"
              >
                {error}
              </div>
            ) : null}
            <div className="flex gap-2">
              <Button type="submit" disabled={busy} data-testid="submit-button">
                {busy ? "Submitting…" : "Submit Scan"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      {submitted ? (
        <Card data-testid="scan-submission-status">
          <CardHeader>
            <h2 className="text-lg font-semibold">Submitted scan</h2>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid gap-1 sm:grid-cols-2">
              <div>
                <span className="text-muted-foreground">Scan:</span>{" "}
                <code>{submitted.scan_id}</code>
              </div>
              <div>
                <span className="text-muted-foreground">Job:</span>{" "}
                <a className="font-mono text-primary underline" href={`/system/jobs?job_id=${encodeURIComponent(submitted.job_id)}`}>
                  {submitted.job_id}
                </a>
              </div>
              <div>
                <span className="text-muted-foreground">Status:</span>{" "}
                <span data-testid="scan-flow-status">{status?.status ?? submitted.status}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Progress:</span>{" "}
                {status?.progress_percent ?? 0}%
              </div>
            </div>
            {pollError ? (
              <div className="rounded border border-amber-300 bg-amber-50 p-2 text-amber-800">
                {pollError}
              </div>
            ) : null}
            {result ? (
              <div className="space-y-2 rounded border border-emerald-300 bg-emerald-50 p-3">
                <div className="text-lg font-semibold" data-testid="scan-flow-verdict">
                  Verdict: {result.verdict}
                </div>
                <div className="flex flex-wrap gap-3">
                  <a className="text-primary underline" href={`/scans/${result.scan_id}/findings`} data-testid="scan-flow-findings-link">
                    Findings
                  </a>
                  <button
                    type="button"
                    className="text-primary underline"
                    onClick={() => navigate(`/scans/${result.scan_id}`)}
                  >
                    Scan detail
                  </button>
                </div>
              </div>
            ) : (
              <div role="status" className="text-muted-foreground">
                Polling queued scan...
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
