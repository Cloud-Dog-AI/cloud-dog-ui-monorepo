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

// @cloud-dog/app-index-retriever - Jobs page.
// Standard: PS-76 (Job Control WebUI Standard) v2.0

import * as React from "react";
import {
  Badge,
  Button,
  DataTable,
  EntityDialog,
  Input,
  JsonBlock,
  MetricCard,
  RelativeTime,
  Select,
  type BulkAction,
  type DataColumn,
} from "@cloud-dog/ui";
import { useIndexRetrieverState } from "../state/AppState";
import type { JsonRecord } from "../lib/types";

type DetailTab =
  | "Overview"
  | "Parameters"
  | "Input ref"
  | "Result/Output"
  | "Thinking"
  | "Lifecycle log"
  | "Raw";

type ConfirmAction = Readonly<{
  action: "cancel" | "retry" | "delete";
  jobIds: string[];
  label: string;
}>;

const DETAIL_TABS: DetailTab[] = [
  "Overview",
  "Parameters",
  "Input ref",
  "Result/Output",
  "Thinking",
  "Lifecycle log",
  "Raw",
];

const STATUS_OPTIONS = [
  "created",
  "validated",
  "queued",
  "scheduled",
  "dispatched",
  "running",
  "retry_wait",
  "blocked",
  "paused",
  "succeeded",
  "failed",
  "cancelled",
  "timeout",
  "timed_out",
  "dead_lettered",
  "ttl_expired",
  "archived",
] as const;

const STATUS_TERMINAL = new Set([
  "succeeded",
  "completed",
  "failed",
  "cancelled",
  "timeout",
  "timed_out",
  "dead_lettered",
  "ttl_expired",
  "archived",
]);
const STATUS_CANCELLABLE = new Set([
  "created",
  "validated",
  "queued",
  "scheduled",
  "dispatched",
  "running",
  "retry_wait",
  "blocked",
  "paused",
]);
const STATUS_RETRYABLE = new Set(["failed", "timeout", "timed_out", "dead_lettered"]);

function asRecord(value: unknown): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as JsonRecord;
}

function asText(value: unknown, fallback = "-"): string {
  const text = value == null ? "" : String(value).trim();
  return text || fallback;
}

function statusOf(row: JsonRecord): string {
  return asText(row.status, "queued").toLowerCase();
}

function jobIdOf(row: JsonRecord): string {
  return asText(row.job_id ?? row.id, "");
}

function payloadOf(row: JsonRecord): JsonRecord {
  return asRecord(row.payload);
}

function actorOf(row: JsonRecord): string {
  const payload = payloadOf(row);
  return asText(
    row.request_auth_identity
      ?? row.user_id
      ?? row.actor
      ?? payload.request_auth_identity
      ?? payload.user_id
      ?? payload.actor,
  );
}

function timestampOf(row: JsonRecord, key: string): string {
  const payload = payloadOf(row);
  return asText(row[key] ?? payload[key], "");
}

function createdAt(row: JsonRecord): string {
  return timestampOf(row, "created_at");
}

function startedAt(row: JsonRecord): string {
  return timestampOf(row, "started_at");
}

function updatedAt(row: JsonRecord): string {
  return timestampOf(row, "updated_at");
}

function completedAt(row: JsonRecord): string {
  return timestampOf(row, "finished_at") || timestampOf(row, "completed_at");
}

function retryCount(row: JsonRecord): number {
  const payload = payloadOf(row);
  const raw = row.retry_count ?? row.attempt ?? payload.retry_count ?? payload.attempt ?? 0;
  const count = typeof raw === "number" ? raw : Number.parseInt(String(raw), 10);
  return Number.isFinite(count) ? Math.max(0, count) : 0;
}

function resultRef(row: JsonRecord): string {
  const payload = payloadOf(row);
  return asText(row.result_ref ?? payload.result_ref ?? payload.result_id ?? payload.output_ref, "");
}

function parseTime(value: string): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function durationMs(row: JsonRecord): number | null {
  const raw = row.duration_ms ?? payloadOf(row).duration_ms;
  if (raw != null) {
    const n = typeof raw === "number" ? raw : Number.parseFloat(String(raw));
    if (Number.isFinite(n) && n >= 0) return n;
  }

  const start = parseTime(startedAt(row) || createdAt(row));
  const end = parseTime(completedAt(row) || updatedAt(row));
  if (start == null || end == null || end < start) return null;
  return end - start;
}

function formatDuration(row: JsonRecord): string {
  const ms = durationMs(row);
  if (ms == null) return "-";
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest > 0 ? `${minutes}m ${rest}s` : `${minutes}m`;
}

function renderTime(value: string): React.ReactNode {
  return value ? <RelativeTime timestamp={value} /> : "-";
}

function statusBadgeVariant(status: string): "default" | "secondary" | "destructive" {
  const s = status.toLowerCase();
  if (["failed", "dead_lettered", "timeout", "timed_out"].includes(s)) return "destructive";
  return "secondary";
}

function statusBadgeClassName(status: string): string {
  const s = status.toLowerCase();
  if (s === "succeeded" || s === "completed") {
    return "bg-green-100 text-green-800 border-green-300 dark:bg-green-900 dark:text-green-100 dark:border-green-800";
  }
  if (["failed", "dead_lettered", "timeout", "timed_out"].includes(s)) {
    return "bg-red-100 text-red-800 border-red-300 dark:bg-red-900 dark:text-red-100 dark:border-red-800";
  }
  if (["retry_wait", "blocked", "paused"].includes(s)) {
    return "bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900 dark:text-yellow-100 dark:border-yellow-800";
  }
  if (s === "cancelled") {
    return "bg-secondary text-secondary-foreground line-through opacity-80";
  }
  if (["ttl_expired", "archived"].includes(s)) {
    return "bg-muted text-muted-foreground border-muted-foreground/20";
  }
  return "bg-secondary text-secondary-foreground";
}

function selectedOptionValues(select: HTMLSelectElement): string[] {
  return Array.from(select.selectedOptions)
    .map((option) => option.value.trim())
    .filter(Boolean);
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

export function JobsPageView() {
  const app = useIndexRetrieverState();
  const isAdmin = app.roles.includes("admin");
  const currentUserId = app.userId;

  const [rows, setRows] = React.useState<JsonRecord[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [detailError, setDetailError] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  const [statusFilters, setStatusFilters] = React.useState<string[]>([]);
  const [typeFilters, setTypeFilters] = React.useState<string[]>([]);
  const [actorFilter, setActorFilter] = React.useState("");
  const [createdFrom, setCreatedFrom] = React.useState("");
  const [createdTo, setCreatedTo] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(25);
  const [detailJob, setDetailJob] = React.useState<JsonRecord | null>(null);
  const [detailTab, setDetailTab] = React.useState<DetailTab>("Overview");
  const [confirmAction, setConfirmAction] = React.useState<ConfirmAction | null>(null);
  const deepLinkJobIdRef = React.useRef<string | null>(null);

  const refresh = React.useCallback(async () => {
    setError(null);
    try {
      const out = asRecord(await app.api.callTool("job_list", { limit: 2000 }));
      const items = Array.isArray(out.jobs) ? out.jobs.map(asRecord) : [];
      setRows(items);
      app.recordActivity("jobs.refresh", "ok", String(items.length));
    } catch (err) {
      const message = app.captureFailure(err);
      setError(message);
    }
  }, [app]);

  React.useEffect(() => { void refresh(); }, [refresh]);

  const canReadJob = React.useCallback(
    (row: JsonRecord) => isAdmin || actorOf(row) === currentUserId,
    [currentUserId, isAdmin],
  );

  const isOwnJob = React.useCallback(
    (row: JsonRecord) => actorOf(row) === currentUserId,
    [currentUserId],
  );

  const canCancelJob = React.useCallback(
    (row: JsonRecord) => STATUS_CANCELLABLE.has(statusOf(row)) && (isAdmin || isOwnJob(row)),
    [isAdmin, isOwnJob],
  );

  const canRetryJob = React.useCallback(
    (row: JsonRecord) => STATUS_RETRYABLE.has(statusOf(row)) && (isAdmin || isOwnJob(row)),
    [isAdmin, isOwnJob],
  );

  const canDeleteJob = React.useCallback(
    (row: JsonRecord) => isAdmin && STATUS_TERMINAL.has(statusOf(row)),
    [isAdmin],
  );

  const loadDetail = React.useCallback(
    async (jobId: string, fallbackRow?: JsonRecord) => {
      const id = jobId.trim();
      if (!id) return;
      setDetailError(null);
      setDetailTab("Overview");
      if (fallbackRow && !canReadJob(fallbackRow)) {
        setDetailJob(null);
        setDetailError("403 inline: non-admin users may only view their own jobs.");
        return;
      }
      try {
        const result = asRecord(await app.api.callTool("job_get", { job_id: id }));
        const job = result.job && typeof result.job === "object" ? asRecord(result.job) : result;
        if (!canReadJob(job)) {
          setDetailJob(null);
          setDetailError("403 inline: non-admin users may only view their own jobs.");
          return;
        }
        setDetailJob(job);
      } catch (err) {
        setDetailError(app.captureFailure(err));
      }
    },
    [app, canReadJob],
  );

  React.useEffect(() => {
    const jobId = new URLSearchParams(window.location.search).get("job_id")?.trim();
    if (!jobId) {
      deepLinkJobIdRef.current = null;
      return;
    }
    if (deepLinkJobIdRef.current === jobId) return;
    deepLinkJobIdRef.current = jobId;
    const row = rows.find((candidate) => jobIdOf(candidate) === jobId);
    void loadDetail(jobId, row);
  }, [loadDetail, rows]);

  const actionRows = React.useMemo(() => {
    const map = new Map<string, JsonRecord>();
    for (const row of rows) {
      const id = jobIdOf(row);
      if (id) map.set(id, row);
    }
    return map;
  }, [rows]);

  const performAction = React.useCallback(
    async (action: ConfirmAction["action"], jobIds: string[]) => {
      const selectedRows = jobIds
        .map((id) => actionRows.get(id))
        .filter((row): row is JsonRecord => Boolean(row));
      const eligible = selectedRows.every((row) => {
        if (action === "cancel") return canCancelJob(row);
        if (action === "retry") return canRetryJob(row);
        return canDeleteJob(row);
      });
      if (!eligible) {
        setError(`Selected job state or role does not permit ${action}.`);
        setConfirmAction(null);
        return;
      }

      for (const id of jobIds) {
        try {
          if (action === "cancel") {
            await app.api.callTool("job_cancel", { job_id: id });
          } else if (action === "retry") {
            await app.api.callTool("job_retry", { job_id: id });
          } else {
            await app.api.callTool("job_delete", { job_id: id });
          }
        } catch (err) {
          setError(app.captureFailure(err));
        }
      }
      setConfirmAction(null);
      void refresh();
    },
    [actionRows, app, canCancelJob, canDeleteJob, canRetryJob, refresh],
  );

  const metrics = React.useMemo(() => {
    let active = 0;
    let failed = 0;
    let queued = 0;
    for (const row of rows) {
      const s = statusOf(row);
      if (s === "running" || s === "dispatched") active++;
      if (s === "queued") queued++;
      if (s === "failed" || s === "dead_lettered") failed++;
    }
    return { total: rows.length, queued, active, failed };
  }, [rows]);

  const visibleRows = React.useMemo(() => rows.filter(canReadJob), [canReadJob, rows]);

  const availableTypes = React.useMemo(
    () => uniqueSorted(visibleRows.map((row) => asText(row.job_type ?? row.type ?? row.name, ""))),
    [visibleRows],
  );

  const filteredRows = React.useMemo(() => {
    const exactJobId = query.trim().toLowerCase();
    const actorNeedle = actorFilter.trim().toLowerCase();
    const from = createdFrom ? Date.parse(`${createdFrom}T00:00:00`) : null;
    const to = createdTo ? Date.parse(`${createdTo}T23:59:59.999`) : null;
    const statusSet = new Set(statusFilters);
    const typeSet = new Set(typeFilters);

    return visibleRows
      .filter((row) => {
        const id = jobIdOf(row).toLowerCase();
        const s = statusOf(row);
        const type = asText(row.job_type ?? row.type ?? row.name, "").toLowerCase();
        const actor = actorOf(row).toLowerCase();
        const created = parseTime(createdAt(row));

        if (exactJobId && id !== exactJobId) return false;
        if (statusSet.size > 0 && !statusSet.has(s)) return false;
        if (typeSet.size > 0 && !typeSet.has(type)) return false;
        if (isAdmin && actorNeedle && !actor.includes(actorNeedle)) return false;
        if (from != null && created != null && created < from) return false;
        if (to != null && created != null && created > to) return false;
        return true;
      })
      .sort((a, b) => {
        const aTime = parseTime(createdAt(a)) ?? 0;
        const bTime = parseTime(createdAt(b)) ?? 0;
        if (aTime !== bTime) return bTime - aTime;
        return jobIdOf(b).localeCompare(jobIdOf(a));
      });
  }, [actorFilter, createdFrom, createdTo, isAdmin, query, statusFilters, typeFilters, visibleRows]);

  React.useEffect(() => {
    setPage(1);
  }, [actorFilter, createdFrom, createdTo, query, statusFilters, typeFilters]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const effectivePage = Math.min(page, totalPages);

  const bulkActions = React.useMemo<BulkAction[]>(
    () => [
      { label: "Cancel Selected", action: "cancel" },
      { label: "Retry Selected", action: "retry" },
      ...(isAdmin ? [{ label: "Delete Selected", action: "delete" }] : []),
    ],
    [isAdmin],
  );

  const openResult = React.useCallback(
    (row: JsonRecord) => {
      setDetailTab("Result/Output");
      void loadDetail(jobIdOf(row), row);
    },
    [loadDetail],
  );

  const columns: DataColumn<JsonRecord>[] = React.useMemo(
    () => [
      {
        id: "job_id",
        header: "Job ID",
        cell: (row) => {
          const id = jobIdOf(row);
          return (
            <Button
              variant="link"
              className="h-auto max-w-[10rem] p-0 font-mono text-xs text-sky-700"
              onClick={() => loadDetail(id, row)}
              title={id}
              type="button"
            >
              {id.slice(0, 12) || "-"}
            </Button>
          );
        },
        sortable: true,
        sortValue: (row) => jobIdOf(row),
      },
      {
        id: "job_type",
        header: "Type",
        cell: (row) => asText(row.job_type ?? row.type ?? row.name),
        sortable: true,
        sortValue: (row) => asText(row.job_type ?? row.type ?? row.name, ""),
      },
      {
        id: "status",
        header: "Status",
        cell: (row) => {
          const s = statusOf(row);
          return (
            <Badge
              variant={statusBadgeVariant(s)}
              className={statusBadgeClassName(s)}
              aria-label={`${s} status`}
              title={`${s} status`}
            >
              {s}
            </Badge>
          );
        },
        sortable: true,
        sortValue: (row) => statusOf(row),
      },
      {
        id: "created_at",
        header: "Created",
        cell: (row) => renderTime(createdAt(row)),
        sortable: true,
        sortValue: (row) => createdAt(row),
      },
      {
        id: "started_at",
        header: "Started",
        cell: (row) => renderTime(startedAt(row)),
        sortable: true,
        sortValue: (row) => startedAt(row),
      },
      {
        id: "updated_at",
        header: "Updated",
        cell: (row) => renderTime(updatedAt(row)),
        sortable: true,
        sortValue: (row) => updatedAt(row),
      },
      {
        id: "completed_at",
        header: "Completed",
        cell: (row) => renderTime(completedAt(row)),
        sortable: true,
        sortValue: (row) => completedAt(row),
      },
      {
        id: "actor",
        header: "Actor",
        cell: (row) => <span className="text-xs">{actorOf(row)}</span>,
        sortable: true,
        sortValue: (row) => actorOf(row),
      },
      {
        id: "duration",
        header: "Duration",
        cell: (row) => formatDuration(row),
        sortable: true,
        sortValue: (row) => durationMs(row) ?? 0,
      },
      {
        id: "result_link",
        header: "Result link",
        cell: (row) => (
          <Button type="button" variant="link" className="h-auto p-0 text-xs text-sky-700" onClick={() => openResult(row)}>
            Result
          </Button>
        ),
        sortable: true,
        sortValue: (row) => resultRef(row),
      },
      {
        id: "log_link",
        header: "Log link",
        cell: (row) => (
          <Button
            type="button"
            variant="link"
            className="h-auto p-0 text-xs text-sky-700"
            onClick={() => {
              window.location.href = `/observability?query=correlation_id:${encodeURIComponent(asText(row.correlation_id ?? jobIdOf(row), ""))}`;
            }}
          >
            Log
          </Button>
        ),
        sortable: true,
        sortValue: (row) => asText(row.correlation_id ?? jobIdOf(row), ""),
      },
      {
        id: "retry_count",
        header: "Retry count",
        cell: (row) => String(retryCount(row)),
        sortable: true,
        sortValue: (row) => retryCount(row),
      },
      {
        id: "progress",
        header: "Progress",
        cell: (row) => {
          const progress = asRecord(row.progress);
          const stage = asText(progress.phase ?? progress.stage ?? row.progress_stage ?? row.stage, "");
          const percent = row.progress_pct ?? progress.percentage;
          return stage ? `${stage}${percent != null ? ` (${Math.round(Number(percent))}%)` : ""}` : "-";
        },
        sortable: true,
        sortValue: (row) => Number(asRecord(row.progress).percentage ?? row.progress_pct ?? 0),
      },
      {
        id: "actions",
        header: "Actions",
        cell: (row) => {
          const id = jobIdOf(row);
          const cancelAllowed = canCancelJob(row);
          const retryAllowed = canRetryJob(row);
          const deleteAllowed = canDeleteJob(row);
          return (
            <div className="flex flex-wrap gap-1">
              <Button variant="ghost" size="sm" onClick={() => loadDetail(id, row)}>Detail</Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={!cancelAllowed}
                title={cancelAllowed ? "Cancel job" : "Cancel unavailable for this state or role"}
                onClick={() => setConfirmAction({ action: "cancel", jobIds: [id], label: "Cancel this job?" })}
              >
                Cancel
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={!retryAllowed}
                title={retryAllowed ? "Retry job" : "Retry unavailable for this state or role"}
                onClick={() => setConfirmAction({ action: "retry", jobIds: [id], label: "Retry this job?" })}
              >
                Retry
              </Button>
              {isAdmin ? (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={!deleteAllowed}
                  title={deleteAllowed ? "Delete job" : "Delete unavailable for this state"}
                  onClick={() => setConfirmAction({ action: "delete", jobIds: [id], label: "Delete this job?" })}
                >
                  Delete
                </Button>
              ) : null}
            </div>
          );
        },
      },
    ],
    [canCancelJob, canDeleteJob, canRetryJob, isAdmin, loadDetail, openResult],
  );

  const detailActions = detailJob ? (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => void navigator.clipboard.writeText(jobIdOf(detailJob))}
      >
        Copy Job ID
      </Button>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={!canRetryJob(detailJob)}
        title={canRetryJob(detailJob) ? "Retry job" : "Retry unavailable for this state or role"}
        onClick={() => setConfirmAction({ action: "retry", jobIds: [jobIdOf(detailJob)], label: "Retry this job?" })}
      >
        Retry
      </Button>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={!canCancelJob(detailJob)}
        title={canCancelJob(detailJob) ? "Cancel job" : "Cancel unavailable for this state or role"}
        onClick={() => setConfirmAction({ action: "cancel", jobIds: [jobIdOf(detailJob)], label: "Cancel this job?" })}
      >
        Cancel
      </Button>
      {isAdmin ? (
        <Button
          type="button"
          variant="destructive"
          size="sm"
          disabled={!canDeleteJob(detailJob)}
          title={canDeleteJob(detailJob) ? "Delete job" : "Delete unavailable for this state"}
          onClick={() => setConfirmAction({ action: "delete", jobIds: [jobIdOf(detailJob)], label: "Delete this job?" })}
        >
          Delete
        </Button>
      ) : null}
    </div>
  ) : null;

  const detailBody = detailJob ? (
    <div className="space-y-4">
      {detailActions}
      <div className="flex flex-wrap gap-1" role="tablist" aria-label="Job detail tabs">
        {DETAIL_TABS.map((tab) => (
          <Button
            key={tab}
            type="button"
            size="sm"
            role="tab"
            aria-selected={detailTab === tab}
            variant={detailTab === tab ? "default" : "secondary"}
            onClick={() => setDetailTab(tab)}
          >
            {tab}
          </Button>
        ))}
      </div>

      {detailTab === "Overview" ? (
        <div role="tabpanel" className="grid gap-3 text-sm sm:grid-cols-2">
          {[
            ["Job ID", jobIdOf(detailJob)],
            ["Type", asText(detailJob.job_type ?? detailJob.type ?? detailJob.name)],
            ["Status", statusOf(detailJob)],
            ["Actor", actorOf(detailJob)],
            ["Created", createdAt(detailJob) || "-"],
            ["Started", startedAt(detailJob) || "-"],
            ["Updated", updatedAt(detailJob) || "-"],
            ["Completed", completedAt(detailJob) || "-"],
            ["Duration", formatDuration(detailJob)],
            ["Retry count", String(retryCount(detailJob))],
            ["Result link", resultRef(detailJob) || "-"],
            ["Log link", asText(detailJob.correlation_id ?? jobIdOf(detailJob))],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs font-medium uppercase text-muted-foreground">{label}</dt>
              <dd className="mt-1 break-all">{value}</dd>
            </div>
          ))}
        </div>
      ) : null}
      {detailTab === "Parameters" ? <div role="tabpanel"><JsonBlock title="Parameters" value={payloadOf(detailJob)} defaultCollapsed={false} /></div> : null}
      {detailTab === "Input ref" ? (
        <div role="tabpanel">
          <JsonBlock
            title="Input ref"
            value={{
              profile: detailJob.profile ?? null,
              collection: detailJob.collection ?? null,
              source: payloadOf(detailJob).source ?? payloadOf(detailJob).source_uri ?? null,
              correlation_id: detailJob.correlation_id ?? null,
            }}
            defaultCollapsed={false}
          />
        </div>
      ) : null}
      {detailTab === "Result/Output" ? (
        <div role="tabpanel">
          <JsonBlock
            title="Result/Output"
            value={{
              status: statusOf(detailJob),
              result_ref: resultRef(detailJob) || null,
              result: payloadOf(detailJob).result ?? asRecord(detailJob.progress).result ?? null,
              last_error: detailJob.last_error ?? detailJob.error ?? null,
            }}
            defaultCollapsed={false}
          />
        </div>
      ) : null}
      {detailTab === "Thinking" ? (
        <div role="tabpanel">
          <JsonBlock title="Thinking" value={payloadOf(detailJob).thinking ?? asRecord(detailJob.progress).thinking ?? []} defaultCollapsed={false} />
        </div>
      ) : null}
      {detailTab === "Lifecycle log" ? (
        <div role="tabpanel">
          <JsonBlock
            title="Lifecycle log"
            value={Array.isArray(asRecord(detailJob.progress).events)
              ? asRecord(detailJob.progress).events
              : [
                  { timestamp: createdAt(detailJob), to_state: "created", actor: actorOf(detailJob) },
                  { timestamp: startedAt(detailJob), to_state: "running", actor: actorOf(detailJob) },
                  { timestamp: updatedAt(detailJob), to_state: statusOf(detailJob), actor: actorOf(detailJob) },
                ].filter((entry) => entry.timestamp)}
            defaultCollapsed={false}
          />
        </div>
      ) : null}
      {detailTab === "Raw" ? <div role="tabpanel"><JsonBlock title="Raw" value={detailJob} defaultCollapsed={false} /></div> : null}
    </div>
  ) : null;

  return (
    <div className="space-y-6" data-testid="jobs-page">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Jobs</h1>
        <Button variant="outline" size="sm" onClick={() => void refresh()}>Refresh</Button>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <MetricCard label="Total Jobs" value={metrics.total} />
        <MetricCard label="Queue Depth" value={metrics.queued} />
        <MetricCard label="Active" value={metrics.active} />
        <MetricCard label="Failed" value={metrics.failed} tone={metrics.failed > 0 ? "warning" : "default"} />
      </div>

      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      {detailError ? <p role="alert" className="text-sm text-destructive">{detailError}</p> : null}

      <div className="grid gap-3 md:grid-cols-[minmax(12rem,1fr)_minmax(10rem,0.8fr)_minmax(10rem,0.8fr)_minmax(10rem,0.8fr)_minmax(10rem,0.8fr)]">
        <label className="space-y-1 text-xs font-medium text-muted-foreground">
          Search
          <Input
            placeholder="Search by Job ID"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search by Job ID"
          />
        </label>
        <label className="space-y-1 text-xs font-medium text-muted-foreground">
          Status
          <Select
            multiple
            size={4}
            value={statusFilters}
            onChange={(e) => setStatusFilters(selectedOptionValues(e.currentTarget))}
            aria-label="Status filter"
            className="h-24"
          >
            {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}
          </Select>
        </label>
        <label className="space-y-1 text-xs font-medium text-muted-foreground">
          Type
          <Select
            multiple
            size={4}
            value={typeFilters}
            onChange={(e) => setTypeFilters(selectedOptionValues(e.currentTarget))}
            aria-label="Type filter"
            className="h-24"
          >
            {availableTypes.map((type) => <option key={type} value={type.toLowerCase()}>{type}</option>)}
          </Select>
        </label>
        {isAdmin ? (
          <label className="space-y-1 text-xs font-medium text-muted-foreground">
            Actor
            <Input
              placeholder="Filter actor"
              value={actorFilter}
              onChange={(e) => setActorFilter(e.target.value)}
              aria-label="Actor filter"
            />
          </label>
        ) : null}
        <div className="space-y-1 text-xs font-medium text-muted-foreground">
          <span>Date range</span>
          <div className="grid gap-2">
            <Input type="date" value={createdFrom} onChange={(e) => setCreatedFrom(e.target.value)} aria-label="Created from" />
            <Input type="date" value={createdTo} onChange={(e) => setCreatedTo(e.target.value)} aria-label="Created to" />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
        <span>Total Records: {filteredRows.length}</span>
        <span>Page {effectivePage} of {totalPages}</span>
      </div>

      <DataTable
        columns={columns}
        rows={filteredRows}
        emptyMessage="No jobs found."
        ariaLabel="Jobs"
        getRowId={(row) => jobIdOf(row)}
        getRowName={(row) => `Job ${jobIdOf(row)}`}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        pageSizeOptions={[10, 25, 50, 100]}
        selectable
        bulkActions={bulkActions}
        onBulkAction={(action, selectedIds) => {
          if (action !== "cancel" && action !== "retry" && action !== "delete") return;
          const labels = {
            cancel: `Cancel ${selectedIds.length} job(s)?`,
            retry: `Retry ${selectedIds.length} job(s)?`,
            delete: `Delete ${selectedIds.length} job(s)?`,
          };
          setConfirmAction({ action, jobIds: selectedIds, label: labels[action] });
        }}
        getSelectionLabel={(row) => `Select job ${jobIdOf(row)}`}
        columnPickerEnabled
        tableId="index-retriever-jobs"
      />

      <EntityDialog
        open={detailJob !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDetailJob(null);
            setDetailTab("Overview");
          }
        }}
        title={detailJob ? `Job ID ${jobIdOf(detailJob).slice(0, 12)}` : "Job detail"}
        body={detailBody}
      />

      {confirmAction ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label={confirmAction.label}>
          <div className="w-full max-w-sm rounded-lg border bg-background p-6 shadow-lg space-y-4">
            <h3 className="text-lg font-semibold">{confirmAction.label}</h3>
            <p className="text-sm text-muted-foreground">This action is applied only when the selected jobs and current role permit it.</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirmAction(null)}>Cancel</Button>
              <Button
                variant={confirmAction.action === "delete" ? "destructive" : "default"}
                onClick={() => void performAction(confirmAction.action, confirmAction.jobIds)}
              >
                Confirm
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
