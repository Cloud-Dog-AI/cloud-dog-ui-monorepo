// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
// Licensed under the Apache License, Version 2.0
//
// scheduler-mcp — Backend API adapter (thin layer over @cloud-dog/api-client).

import { createApiClient } from "@cloud-dog/api-client";
import type {
  AuditEventDto,
  AuditPage,
  AuditQuery,
  AuthMe,
  ChainDto,
  ContextEntryDto,
  Health,
  PagedResult,
  RegistryProjectDto,
  RunQuery,
  ScheduleDto,
  ScheduleRunDto,
} from "./types";

export type SchedulerApi = Readonly<{
  baseUrl: string;
  health: () => Promise<Health>;
  listSchedules: () => Promise<PagedResult<ScheduleDto>>;
  getSchedule: (id: string) => Promise<ScheduleDto>;
  createSchedule: (body: Partial<ScheduleDto> & {
    name: string;
    trigger_type: string;
    trigger_spec: Record<string, unknown>;
    target_type: string;
    target_ref: string;
  }) => Promise<ScheduleDto>;
  patchSchedule: (id: string, body: Partial<ScheduleDto>) => Promise<ScheduleDto>;
  deleteSchedule: (id: string) => Promise<void>;
  listRuns: (query?: RunQuery) => Promise<PagedResult<ScheduleRunDto>>;
  getRun: (id: string) => Promise<ScheduleRunDto>;
  cancelRun: (id: string) => Promise<ScheduleRunDto>;
  triggerRun: (schedule_id: string) => Promise<{ run_id: string; schedule_run_id: string; status: string; schedule_id: string }>;
  retryRun: (id: string) => Promise<{ run_id: string; schedule_run_id: string; status: string; schedule_id: string; retried_from: string }>;
  deleteRun: (id: string) => Promise<void>;
  // W28K-1409 F-1409-6 — fetch the run report PDF and trigger a browser download.
  downloadRunReport: (id: string) => Promise<void>;
  authMe: () => Promise<AuthMe>;
  listChains: () => Promise<PagedResult<ChainDto>>;
  getChain: (id: string) => Promise<ChainDto>;
  createChain: (body: { name: string; definition: Record<string, unknown> }) => Promise<ChainDto>;
  deleteChain: (id: string) => Promise<void>;
  listContext: (scope_type: string, scope_id: string) => Promise<PagedResult<ContextEntryDto>>;
  putContext: (body: { scope_type: string; scope_id: string; key: string; value: unknown; value_type?: string }) => Promise<ContextEntryDto>;
  deleteContext: (id: string) => Promise<void>;
  listRegistryProjects: () => Promise<PagedResult<RegistryProjectDto>>;
  listAudit: (q?: AuditQuery) => Promise<AuditPage>;
  getAuditEvent: (event_id: string) => Promise<AuditEventDto>;
}>;

export function createSchedulerApi(opts: { baseUrl: string; apiKey?: string | null }): SchedulerApi {
  const baseUrl = opts.baseUrl.replace(/\/$/, "");
  const client = createApiClient({
    baseUrl,
    credentials: "include",
    defaultHeaders: opts.apiKey ? { "x-api-key": opts.apiKey } : {},
  });
  const getJson = async <T>(path: string): Promise<T> => (await client.get<T>(path)) as T;
  const postJson = async <T>(path: string, body: unknown): Promise<T> => (await client.post<T>(path, body)) as T;
  const patchJson = async <T>(path: string, body: unknown): Promise<T> => (await client.patch<T>(path, body)) as T;
  const putJson = async <T>(path: string, body: unknown): Promise<T> => (await client.put<T>(path, body)) as T;
  const delJson = async (path: string): Promise<void> => {
    await client.delete(path);
  };
  return {
    baseUrl,
    health: () => getJson<Health>("/health"),
    listSchedules: () => getJson<PagedResult<ScheduleDto>>("/v1/schedules"),
    getSchedule: (id) => getJson<ScheduleDto>(`/v1/schedules/${encodeURIComponent(id)}`),
    createSchedule: (body) => postJson<ScheduleDto>("/v1/schedules", body),
    patchSchedule: (id, body) => patchJson<ScheduleDto>(`/v1/schedules/${encodeURIComponent(id)}`, body),
    deleteSchedule: (id) => delJson(`/v1/schedules/${encodeURIComponent(id)}`),
    listRuns: (query) => {
      const params = new URLSearchParams();
      if (query?.schedule_id) params.set("schedule_id", query.schedule_id);
      if (query?.status) params.set("status", query.status);
      if (query?.dead_letter) params.set("dead_letter", "true");
      if (typeof query?.limit === "number") params.set("limit", String(query.limit));
      if (typeof query?.offset === "number") params.set("offset", String(query.offset));
      const qs = params.toString();
      return getJson<PagedResult<ScheduleRunDto>>(`/v1/runs${qs ? `?${qs}` : ""}`);
    },
    getRun: (id) => getJson<ScheduleRunDto>(`/v1/runs/${encodeURIComponent(id)}`),
    cancelRun: (id) => postJson<ScheduleRunDto>(`/v1/runs/${encodeURIComponent(id)}/cancel`, {}),
    triggerRun: (schedule_id) => postJson("/v1/runs", { schedule_id }),
    retryRun: (id) => postJson(`/v1/runs/${encodeURIComponent(id)}/retry`, {}),
    deleteRun: (id) => delJson(`/v1/runs/${encodeURIComponent(id)}`),
    downloadRunReport: async (id) => {
      // The report endpoint returns application/pdf (binary), so bypass the
      // JSON api-client and fetch the blob directly, preserving cookie + api-key auth.
      const url = `${baseUrl}/v1/runs/${encodeURIComponent(id)}/report?format=pdf`;
      const resp = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: opts.apiKey ? { "x-api-key": opts.apiKey } : {},
      });
      if (!resp.ok) throw new Error(`run report failed: HTTP ${resp.status}`);
      const blob = await resp.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = `run-report-${id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(href);
    },
    authMe: () => getJson<AuthMe>("/v1/auth/me"),
    listChains: () => getJson<PagedResult<ChainDto>>("/v1/chains"),
    getChain: (id) => getJson<ChainDto>(`/v1/chains/${encodeURIComponent(id)}`),
    createChain: (body) => postJson<ChainDto>("/v1/chains", body),
    deleteChain: (id) => delJson(`/v1/chains/${encodeURIComponent(id)}`),
    listContext: (scope_type, scope_id) =>
      getJson<PagedResult<ContextEntryDto>>(
        `/v1/context?scope_type=${encodeURIComponent(scope_type)}&scope_id=${encodeURIComponent(scope_id)}`,
      ),
    putContext: (body) => putJson<ContextEntryDto>("/v1/context", body),
    deleteContext: (id) => delJson(`/v1/context/${encodeURIComponent(id)}`),
    listRegistryProjects: () => getJson<PagedResult<RegistryProjectDto>>("/v1/registry/projects"),
    listAudit: (q?: AuditQuery) => {
      const params = new URLSearchParams();
      if (q) {
        for (const [k, v] of Object.entries(q)) {
          if (v !== undefined && v !== null && v !== "") params.set(k, String(v));
        }
      }
      const qs = params.toString();
      return getJson<AuditPage>(`/v1/audit${qs ? `?${qs}` : ""}`);
    },
    getAuditEvent: (event_id) => getJson<AuditEventDto>(`/v1/audit/${encodeURIComponent(event_id)}`),
  };
}
