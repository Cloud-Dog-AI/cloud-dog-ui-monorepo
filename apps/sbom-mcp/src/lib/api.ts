// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
// Licensed under the Apache License 2.0

import {
  ApiError,
  createApiClient,
  createRequestId,
  type RequestOptions,
} from "@cloud-dog/api-client";
import type {
  A2aAgentCardResponse,
  AuditEventListResponse,
  CapabilitiesResponse,
  CreateWaiverRequest,
  FindingListResponse,
  JobListResponse,
  JobResponse,
  McpToolListResponse,
  OpenApiDocument,
  ReportFileRow,
  ScanListResponse,
  ScanResultResponse,
  ScanStatusResponse,
  ScheduledScan,
  SettingsResponse,
  StorageProfileListResponse,
  SubmitScanRequest,
  SubmitScanResponse,
  SurfaceCallResult,
  UpdateWaiverRequest,
  WaiverListResponse,
  WaiverResponse,
} from "./types";

declare global {
  interface Window {
    __SBOM_MCP_LAST_CORRELATION_ID__?: string;
  }
}

const SURFACE_BASE_URL = "/";

function requestIds(): Required<Pick<RequestOptions, "requestId" | "correlationId">> {
  const requestId = createRequestId();
  const correlationId = createRequestId();
  if (typeof window !== "undefined") {
    window.__SBOM_MCP_LAST_CORRELATION_ID__ = correlationId;
  }
  return { requestId, correlationId };
}

function qs(params: Record<string, string | number | null | undefined>): RequestOptions["query"] {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== "")
  );
}

function id(value: string): string {
  return encodeURIComponent(value);
}

function asApiErrorBody(error: ApiError): Record<string, unknown> {
  const details = error.options.details;
  if (details && typeof details === "object") return details as Record<string, unknown>;
  return {
    error: error.message,
    error_code: error.options.code ?? `http_${error.options.status}`,
  };
}

function extractJobId(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  const result = record.result && typeof record.result === "object"
    ? (record.result as Record<string, unknown>)
    : record;
  const structured = result.structuredContent && typeof result.structuredContent === "object"
    ? (result.structuredContent as Record<string, unknown>)
    : result;
  const candidates = [
    structured.job_id,
    structured.jobId,
    structured.job,
    result.job_id,
    record.job_id,
  ];
  const match = candidates.find((candidate) => typeof candidate === "string" && candidate.trim());
  return typeof match === "string" ? match.trim() : null;
}

export function countOpenApiOperations(doc: OpenApiDocument): number {
  const methods = new Set(["get", "post", "put", "patch", "delete", "options", "head", "trace"]);
  return Object.values(doc.paths ?? {}).reduce((total, pathItem) => {
    if (!pathItem || typeof pathItem !== "object") return total;
    return total + Object.keys(pathItem).filter((method) => methods.has(method.toLowerCase())).length;
  }, 0);
}

export function retryScanRequestFromJob(row: JobResponse): SubmitScanRequest | null {
  const source = row.payload;
  const boundary = source.boundary;
  const targetType = source.target_type;
  const target = source.target;
  if (typeof boundary !== "string" || typeof targetType !== "string" || typeof target !== "string") {
    return null;
  }
  return {
    boundary,
    target_type: targetType,
    target,
    storage_profile: typeof source.storage_profile === "string" ? source.storage_profile : null,
    policy_profile: typeof source.policy_profile === "string" ? source.policy_profile : null,
    requested_outputs: Array.isArray(source.requested_outputs)
      ? source.requested_outputs.filter((item): item is string => typeof item === "string")
      : undefined,
    caller_metadata: {
      retry_of_job_id: row.job_id,
      retry_requested_from: "sbom-webui",
    },
  };
}

export function buildApi(apiBaseUrl: string) {
  const client = createApiClient({ baseUrl: apiBaseUrl.replace(/\/$/, ""), credentials: "include" });
  const surface = createApiClient({ baseUrl: SURFACE_BASE_URL, credentials: "include" });
  const scanFileUrl = (scanId: string, filename: string) =>
    `${apiBaseUrl.replace(/\/$/, "")}/scans/${id(scanId)}/files/${id(filename)}`;

  const get = <T>(path: string, options?: RequestOptions) => client.get<T>(path, options);
  const post = <T>(path: string, body: unknown, options?: RequestOptions) =>
    client.post<T>(path, body, options);
  const patch = <T>(path: string, body: unknown, options?: RequestOptions) =>
    client.patch<T>(path, body, options);
  const put = <T>(path: string, body: unknown, options?: RequestOptions) =>
    client.put<T>(path, body, options);
  const del = <T>(path: string, options?: RequestOptions) => client.delete<T>(path, options);

  const surfaceCall = async (
    run: (options: RequestOptions) => Promise<unknown>
  ): Promise<SurfaceCallResult> => {
    const ids = requestIds();
    try {
      const body = await run(ids);
      return {
        body,
        correlationId: ids.correlationId,
        requestId: ids.requestId,
        httpStatus: 200,
        denied: false,
        jobId: extractJobId(body),
        clientGenerated: false,
      };
    } catch (error) {
      if (error instanceof ApiError) {
        return {
          body: asApiErrorBody(error),
          correlationId: error.options.correlationId ?? ids.correlationId,
          requestId: error.options.requestId ?? ids.requestId,
          httpStatus: error.options.status,
          denied: true,
          clientGenerated: false,
        };
      }
      throw error;
    }
  };

  return {
    capabilities: () => get<CapabilitiesResponse>("/capabilities"),
    health: (path = "/health") => surface.get<Record<string, unknown>>(path, requestIds()),
    currentSession: () => surface.get<Record<string, unknown>>("/auth/me", requestIds()),
    getOpenApi: () => surface.get<OpenApiDocument>("/openapi.json", requestIds()),
    listScans: (limit = 50) => get<ScanListResponse>("/scans", { query: { limit } }),
    submitScan: (body: SubmitScanRequest) => post<SubmitScanResponse>("/scans", body, requestIds()),
    getScanStatus: (scanId: string) => get<ScanStatusResponse>(`/scans/${id(scanId)}/status`),
    getScanResult: (scanId: string) => get<ScanResultResponse>(`/scans/${id(scanId)}`),
    cancelScan: (scanId: string) =>
      post<{ scan_id: string; job_id: string; status: string }>(
        `/scans/${id(scanId)}/cancel`,
        {},
        requestIds()
      ),
    retryJob: (row: JobResponse) => {
      const body = retryScanRequestFromJob(row);
      if (!body) throw new Error(`Job ${row.job_id} does not carry retryable scan parameters.`);
      return post<SubmitScanResponse>("/scans", body, requestIds());
    },
    listJobs: (limit = 100) => get<JobListResponse>("/jobs", { query: { limit } }),
    getJob: (jobId: string) => get<JobResponse>(`/jobs/${id(jobId)}`),
    listScheduled: (limit = 50) =>
      get<{ items: ScheduledScan[]; total: number }>("/scheduled-scans", { query: { limit } }),
    runScheduledNow: (scheduledScanId: string) =>
      post<SubmitScanResponse>(`/scheduled-scans/${id(scheduledScanId)}/run-now`, {}, requestIds()),
    listWaivers: (limit = 100) => get<WaiverListResponse>("/waivers", { query: { limit } }),
    createWaiver: (body: CreateWaiverRequest) => post<WaiverResponse>("/waivers", body, requestIds()),
    updateWaiver: (waiverId: string, body: UpdateWaiverRequest) =>
      patch<WaiverResponse>(`/waivers/${id(waiverId)}`, body, requestIds()),
    revokeWaiver: (waiverId: string) => del<WaiverResponse>(`/waivers/${id(waiverId)}`, requestIds()),
    listFindings: (params: { scanId?: string; limit?: number } = {}) => {
      const limit = params.limit ?? 100;
      if (params.scanId) {
        return get<FindingListResponse>(`/scans/${id(params.scanId)}/findings`, {
          query: qs({ limit }),
        });
      }
      return get<FindingListResponse>("/findings", { query: qs({ limit }) });
    },
    listAudit: (limit = 100) => get<AuditEventListResponse>("/audit", { query: { limit } }),
    getSettings: () => get<SettingsResponse>("/settings"),
    updateSettings: (settings: Record<string, unknown>) =>
      put<SettingsResponse>("/settings", settings, requestIds()),
    listStorageProfiles: () => get<StorageProfileListResponse>("/storage-profiles"),
    mcpHealth: () => surface.get<Record<string, unknown>>("/mcp/health", requestIds()),
    mcpTools: () => surface.post<McpToolListResponse>("/mcp/tools/list", {}, requestIds()),
    mcpCall: (toolName: string, args: unknown) =>
      surfaceCall((options) =>
        surface.post<unknown>("/mcp/tools/call", { name: toolName, arguments: args }, options)
      ),
    a2aHealth: () => surface.get<Record<string, unknown>>("/a2a/health", requestIds()),
    a2aAgentCard: () => surface.get<A2aAgentCardResponse>("/.well-known/agent-card", requestIds()),
    a2aSkillCall: (skill: string, args: unknown) =>
      surfaceCall((options) =>
        surface.post<unknown>("/a2a/skills/call", { skill, arguments: args }, options)
      ),
    scanFileUrl,
    listReportFiles: async (limit = 100): Promise<{ items: ReportFileRow[]; total: number; limit: number }> => {
      const scans = await get<ScanListResponse>("/scans", { query: { limit } });
      const results = await Promise.all(
        scans.items.slice(0, limit).map(async (scan) => {
          try {
            return await get<ScanResultResponse>(`/scans/${id(scan.scan_id)}`);
          } catch {
            return null;
          }
        })
      );
      const items = results.flatMap((result) =>
        result
          ? result.files.map((file) => ({
              ...file,
              scan_id: result.scan_id,
              job_id: result.job_id,
              boundary: result.boundary,
              target_type: result.target_type,
              target: result.target,
              status: result.status,
              verdict: result.verdict,
              uri: file.uri ?? scanFileUrl(result.scan_id, file.name),
            }))
          : []
      );
      return { items, total: items.length, limit };
    },
  };
}

export type SbomApi = ReturnType<typeof buildApi>;
