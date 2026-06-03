// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// @cloud-dog/app-sql-agent — Query dashboard and execution panel.

// Covers: FR-52
// Covers: FR-53
// Covers: FR-88
// Covers: FR-89

import * as React from 'react';
import { useConfig } from '@cloud-dog/config';
import { Button, Checkbox, CodeViewer, Label, Textarea } from '@cloud-dog/ui';
import { ServiceStatusBar, type ServiceStatus } from '@cloud-dog/shell';
import {
  DataList,
  EmptyState,
  ErrorState,
  JsonBlock,
  LoadingState,
  MetricTile,
  PageFrame,
  PanelCard,
  StatusBadge,
  downloadTextFile,
  requestJson,
  useApiResource,
  type QuerySubmission,
} from '../lib/sqlAgentApi';

type AppRuntimeConfig = {
  API_BASE_URL: string;
};

type HealthResponse = {
  status?: string;
  ready?: boolean;
  tables?: number;
  version?: string;
  database?: string;
  llm?: string;
};

type ContextResponse = {
  tables?: Array<Record<string, unknown>>;
};

type JobSnapshot = Record<string, unknown> & {
  job_id?: string;
  guid?: string;
  status?: string;
  question?: string;
  answer?: string;
  sql_query?: string;
  error?: string;
  thinking?: string;
  created_at?: string;
  started_at?: string;
  processing_time_seconds?: number;
};

type JobResultPayload = {
  job_id?: string;
  format?: string;
  result?: string;
  question?: string;
  sql_query?: string;
  thinking?: string;
};

const TERMINAL_JOB_STATUSES = new Set(['completed', 'failed', 'stopped', 'cancelled', 'timeout', 'timed_out']);
const SUCCESSFUL_TERMINAL_JOB_STATUSES = new Set(['completed', 'succeeded']);

function isTerminalStatus(status: unknown) {
  return TERMINAL_JOB_STATUSES.has(String(status ?? '').toLowerCase());
}

function isSuccessfulTerminalStatus(status: unknown) {
  return SUCCESSFUL_TERMINAL_JOB_STATUSES.has(String(status ?? '').toLowerCase());
}

function parseFormattedJson(payload: string | undefined): unknown {
  if (!payload) return null;

  try {
    return JSON.parse(payload);
  } catch {
    return { raw: payload };
  }
}

async function fetchJobResultWithRetry(
  apiBaseUrl: string,
  jobId: string,
  format: 'json' | 'table' | 'csv',
  timeoutMs = 30_000,
) {
  const startedAt = Date.now();
  let lastError: unknown = null;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      return await requestJson<JobResultPayload>(
        apiBaseUrl,
        `/api/v1/jobs/${jobId}/result?format=${format}`,
      );
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => {
        window.setTimeout(resolve, 1500);
      });
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`Timed out waiting for ${format} result for job ${jobId}.`);
}

export function QueryPage() {
  const cfg = useConfig<AppRuntimeConfig>();
  const [question, setQuestion] = React.useState('Show top 5 countries by GDP for the latest year.');
  const [waitForCompletion, setWaitForCompletion] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [elapsedSeconds, setElapsedSeconds] = React.useState(0);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<QuerySubmission | null>(null);
  const [jobSnapshot, setJobSnapshot] = React.useState<JobSnapshot | null>(null);
  const [resultPreview, setResultPreview] = React.useState<unknown | null>(null);
  const [downloadError, setDownloadError] = React.useState<string | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);

  const health = useApiResource<HealthResponse>(
    () => requestJson(cfg.API_BASE_URL, '/api/v1/health'),
    [cfg.API_BASE_URL],
  );
  const context = useApiResource<ContextResponse>(
    () => requestJson(cfg.API_BASE_URL, '/api/v1/context/full'),
    [cfg.API_BASE_URL],
  );
  const mcpStatus = useApiResource<Record<string, unknown>>(
    () => requestJson(cfg.API_BASE_URL, '/api/v1/servers/mcp/status'),
    [cfg.API_BASE_URL],
  );
  const a2aStatus = useApiResource<Record<string, unknown>>(
    () => requestJson(cfg.API_BASE_URL, '/api/v1/servers/a2a/status'),
    [cfg.API_BASE_URL],
  );

  const services = React.useMemo<ServiceStatus[]>(
    () => [
      {
        name: 'API',
        url: `${cfg.API_BASE_URL}/api/v1/health`,
        status:
          health.data?.status === 'healthy' || health.data?.status === 'ok'
            ? 'ok'
            : health.error || health.data?.status === 'error'
              ? 'error'
              : 'warning',
      },
      {
        name: 'MCP',
        url: `${cfg.API_BASE_URL}/api/v1/servers/mcp/status`,
        status: mcpStatus.data?.running === true ? 'ok' : mcpStatus.error ? 'error' : 'warning',
      },
      {
        name: 'A2A',
        url: `${cfg.API_BASE_URL}/api/v1/servers/a2a/status`,
        status: a2aStatus.data?.running === true ? 'ok' : a2aStatus.error ? 'error' : 'warning',
      },
    ],
    [a2aStatus.data, a2aStatus.error, cfg.API_BASE_URL, health.data?.status, health.error, mcpStatus.data, mcpStatus.error],
  );

  const currentJobId = String(jobSnapshot?.job_id ?? result?.job_id ?? '');
  const activeStatus = String(jobSnapshot?.status ?? result?.status ?? '');

  React.useEffect(() => {
    if (!submitting) {
      setElapsedSeconds(0);
      return undefined;
    }

    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [submitting]);

  React.useEffect(() => {
    if (!currentJobId) {
      return undefined;
    }

    let cancelled = false;
    let timer: number | null = null;

    async function loadSnapshot() {
      try {
        const snapshot = await requestJson<JobSnapshot>(cfg.API_BASE_URL, `/api/v1/jobs/${currentJobId}`);
        if (cancelled) return;
        setJobSnapshot(snapshot);

        if (isSuccessfulTerminalStatus(snapshot.status)) {
          const formatted = await fetchJobResultWithRetry(
            cfg.API_BASE_URL,
            currentJobId,
            'json',
            60_000,
          );
          if (!cancelled) {
            setResultPreview(parseFormattedJson(formatted.result));
          }
          return;
        }

        if (!isTerminalStatus(snapshot.status)) {
          timer = window.setTimeout(loadSnapshot, 2000);
        }
      } catch (error) {
        if (!cancelled) {
          setDownloadError(error instanceof Error ? error.message : String(error));
        }
      }
    }

    if (!isTerminalStatus(activeStatus)) {
      void loadSnapshot();
    } else if (isSuccessfulTerminalStatus(activeStatus) && resultPreview == null) {
      void loadSnapshot();
    }

    return () => {
      cancelled = true;
      if (timer !== null) {
        window.clearTimeout(timer);
      }
    };
  }, [activeStatus, cfg.API_BASE_URL, currentJobId, resultPreview]);

  async function submitQuery(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    abortRef.current?.abort();

    const controller = new AbortController();
    abortRef.current = controller;

    setSubmitting(true);
    setSubmitError(null);
    setDownloadError(null);
    setResult(null);
    setJobSnapshot(null);
    setResultPreview(null);

    try {
      const path = waitForCompletion ? '/api/v1/query-sync' : '/api/v1/query';
      const payload = await requestJson<QuerySubmission>(cfg.API_BASE_URL, path, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question,
          use_history: false,
        }),
        signal: controller.signal,
      });

      setResult(payload);

      if (payload.job_id) {
        const snapshot = await requestJson<JobSnapshot>(cfg.API_BASE_URL, `/api/v1/jobs/${payload.job_id}`);
        setJobSnapshot(snapshot);
      }
    } catch (error) {
      if (controller.signal.aborted) {
        setSubmitError('Query cancelled by operator.');
      } else {
        setSubmitError(error instanceof Error ? error.message : String(error));
      }
    } finally {
      setSubmitting(false);
      abortRef.current = null;
    }
  }

  async function cancelSyncQuery() {
    abortRef.current?.abort();
    try {
      await requestJson(cfg.API_BASE_URL, '/api/v1/stop', { method: 'POST' });
    } catch {
      // The request abort is the primary user-visible outcome.
    }
  }

  async function downloadResult(format: 'json' | 'table' | 'csv') {
    if (!currentJobId) {
      setDownloadError('No job ID available for result download.');
      return;
    }

    try {
      setDownloadError(null);
      const payload = await fetchJobResultWithRetry(
        cfg.API_BASE_URL,
        currentJobId,
        format,
        60_000,
      );
      const baseName = `sql-agent-${currentJobId}.${format === 'json' ? 'json' : format === 'csv' ? 'csv' : 'txt'}`;
      downloadTextFile(
        baseName,
        payload.result ?? '',
        format === 'json'
          ? 'application/json;charset=utf-8'
          : format === 'csv'
            ? 'text/csv;charset=utf-8'
            : 'text/plain;charset=utf-8',
      );
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <PageFrame
      eyebrow="FR-52 / FR-53 / FR-88 / FR-89"
      title="New Query"
      description="Submit operational SQL-agent questions through the authenticated Web proxy, choose async or wait-for-completion execution, and download the completed result as JSON, ASCII table, or CSV."
      actions={
        <Button
          variant="outline"
          onClick={() => {
            health.refresh();
            context.refresh();
          }}
          type="button"
        >
          Refresh panel
        </Button>
      }
    >
      <ServiceStatusBar className="rounded-3xl border border-slate-200 bg-white shadow-sm shadow-slate-200/50" services={services} />

      <div className="grid gap-4 xl:grid-cols-4">
        <MetricTile label="API status" value={<StatusBadge value={health.data?.status} />} />
        <MetricTile
          label="Ready"
          tone={health.data?.ready ? 'success' : 'warning'}
          value={health.data?.ready ? 'true' : 'false'}
        />
        <MetricTile label="Connected tables" value={health.data?.tables ?? '—'} />
        <MetricTile label="Context tables" value={context.data?.tables?.length ?? '—'} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <PanelCard
          id="panelQuery"
          title="Query console"
          subtitle="Async mode returns a job reference immediately. Wait-for-completion mode can run for up to 480 seconds through the web proxy."
        >
          <form className="space-y-4" onSubmit={submitQuery}>
            <label className="block space-y-2">
              <Label className="text-sm font-semibold text-slate-700" htmlFor="queryInput">Question</Label>
              <Textarea
                className="min-h-40"
                id="queryInput"
                name="question"
                onChange={(event) => setQuestion(event.target.value)}
                value={question}
              />
            </label>

            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <Checkbox
                checked={waitForCompletion}
                onChange={(event) => setWaitForCompletion(event.target.checked)}
              />
              Wait for completion in this tab instead of returning a background job reference
            </label>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                disabled={submitting || !question.trim()}
                id="submitQueryBtn"
                loading={submitting}
                type="submit"
              >
                {waitForCompletion ? 'Run synchronously' : 'Queue async job'}
              </Button>
              {submitting && waitForCompletion ? (
                <Button
                  id="cancelSyncQueryBtn"
                  onClick={cancelSyncQuery}
                  type="button"
                  variant="destructive"
                >
                  Cancel sync query
                </Button>
              ) : null}
              <span className="text-xs uppercase tracking-[0.18em] text-slate-500">
                Route: {waitForCompletion ? '/api/v1/query-sync' : '/api/v1/query'}
              </span>
            </div>
          </form>

          {submitError ? <div className="mt-4"><ErrorState message={submitError} /></div> : null}
        </PanelCard>

        <PanelCard title="Execution summary" subtitle="Live query status, job reference, and result exports.">
          {submitting ? (
            <div className="space-y-4">
              <LoadingState label="query execution" />
              <DataList
                items={[
                  { label: 'Execution mode', value: waitForCompletion ? 'sync / wait for completion' : 'async / background job' },
                  { label: 'Elapsed', value: `${elapsedSeconds}s` },
                  { label: 'Proxy timeout budget', value: '480s' },
                ]}
              />
            </div>
          ) : currentJobId ? (
            <div className="space-y-4">
              <DataList
                items={[
                  { label: 'Job ID', value: currentJobId },
                  { label: 'Status', value: <StatusBadge value={jobSnapshot?.status ?? result?.status ?? 'submitted'} /> },
                  { label: 'Question', value: question },
                  { label: 'Answer', value: jobSnapshot?.answer ?? result?.answer ?? 'Waiting for completed result' },
                ]}
              />
              <JsonBlock
                value={{
                  job_id: currentJobId,
                  status: jobSnapshot?.status ?? result?.status ?? 'submitted',
                  sql: jobSnapshot?.sql_query ?? null,
                  answer: jobSnapshot?.answer ?? result?.answer ?? null,
                }}
              />

              <div className="flex flex-wrap gap-2">
                <Button disabled={!isSuccessfulTerminalStatus(activeStatus)} onClick={() => void downloadResult('json')} type="button" variant="outline">
                  Download JSON
                </Button>
                <Button disabled={!isSuccessfulTerminalStatus(activeStatus)} onClick={() => void downloadResult('table')} type="button" variant="outline">
                  Download ASCII table
                </Button>
                <Button disabled={!isSuccessfulTerminalStatus(activeStatus)} onClick={() => void downloadResult('csv')} type="button" variant="outline">
                  Download CSV
                </Button>
              </div>

              {downloadError ? <ErrorState message={downloadError} /> : null}
            </div>
          ) : (
            <EmptyState title="No query submitted yet" body="Run a question in async or sync mode to capture a job reference and result exports." />
          )}
        </PanelCard>
      </div>

      {currentJobId ? (
        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <PanelCard title="Generated SQL" subtitle="SQL captured from the completed or active job record.">
            {jobSnapshot?.sql_query ? (
              <CodeViewer code={jobSnapshot.sql_query} language="sql" title="sql_query.sql" />
            ) : (
              <LoadingState label="generated SQL" />
            )}
          </PanelCard>

          <PanelCard title="Formatted JSON preview" subtitle="Result payload fetched from `/api/v1/jobs/{job_id}/result?format=json`.">
            {resultPreview ? (
              <JsonBlock value={resultPreview} />
            ) : isSuccessfulTerminalStatus(activeStatus) ? (
              <LoadingState label="formatted result preview" />
            ) : (
              <LoadingState label="completed job result" />
            )}
          </PanelCard>
        </div>
      ) : null}

      {jobSnapshot?.thinking ? (
        <PanelCard title="Thinking trace" subtitle="Captured job-level reasoning trace from the API response.">
          <CodeViewer code={String(jobSnapshot.thinking)} language="markdown" title="thinking.md" />
        </PanelCard>
      ) : null}

      <PanelCard title="Backend health snapshot" subtitle="Live proxy data used by the operator dashboard">
        {health.loading ? <LoadingState label="health" /> : null}
        {health.error ? <ErrorState message={health.error} /> : null}
        {health.data ? (
          <DataList
            items={[
              { label: 'Status', value: <StatusBadge value={health.data.status} /> },
              { label: 'Database', value: health.data.database ?? 'unknown' },
              { label: 'LLM', value: health.data.llm ?? 'unknown' },
              { label: 'Ready', value: `${health.data.ready}` },
              { label: 'Version', value: health.data.version ?? 'unknown' },
            ]}
          />
        ) : null}
      </PanelCard>
    </PageFrame>
  );
}
