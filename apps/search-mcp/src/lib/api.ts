// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
// Licensed under the Apache License 2.0

// search-mcp WebUI API client — all HTTP traffic goes through @cloud-dog/api-client
// (guarded fetch); NO raw fetch() in the app (RULES §1.6 / W28L-1520). The web tier
// serves /v1 on the same origin with cookie auth; MCP/A2A surfaces are same-origin
// /mcp and /a2a.

import { ApiError, createApiClient, createRequestId } from "@cloud-dog/api-client";
import type {
  AboutResponse,
  AuditListResponse,
  A2aAgentCardResponse,
  BackendsResponse,
  GovernanceStatus,
  JobListResponse,
  McpToolListResponse,
  OpenApiDocument,
  ResearchListResponse,
  ResearchReport,
  SurfaceCallResult,
  WatchListResponse,
  WatchRow,
} from "./types";

export interface SearchApi {
  health(path: string): Promise<unknown>;
  capabilities(): Promise<unknown>;
  backends(): Promise<BackendsResponse>;
  backendHealth(name: string): Promise<unknown>;
  research(query: string, depth?: string): Promise<ResearchReport>;
  researchStart(query: string, depth?: string): Promise<ResearchReport>;
  researchList(limit?: number, status?: string | null): Promise<ResearchListResponse>;
  researchStatus(jobId: string): Promise<ResearchReport>;
  researchCancel(jobId: string): Promise<unknown>;
  watchesList(): Promise<WatchListResponse>;
  watchCreate(body: Record<string, unknown>): Promise<WatchRow>;
  watchStatus(id: string): Promise<WatchRow>;
  watchEvents(id: string): Promise<unknown>;
  quality(): Promise<unknown>;
  evaluation(): Promise<unknown>;
  systemAbout(): Promise<AboutResponse>;
  systemSettings(): Promise<unknown>;
  governance(): Promise<GovernanceStatus>;
  auditList(params?: Record<string, string | number | undefined>): Promise<AuditListResponse>;
  auditExportUrl(fmt: "csv" | "json"): string;
  auditIntegrity(): Promise<unknown>;
  jobs(): Promise<JobListResponse>;
  openapi(): Promise<OpenApiDocument>;
  mcpHealth(): Promise<unknown>;
  mcpTools(): Promise<McpToolListResponse>;
  mcpCall(name: string, args: unknown): Promise<SurfaceCallResult>;
  a2aHealth(): Promise<unknown>;
  a2aAgentCard(): Promise<A2aAgentCardResponse>;
  a2aSkillCall(skill: string, payload: unknown): Promise<SurfaceCallResult>;
}

export function buildApi(baseUrl: string, onAuthError: () => void = () => undefined): SearchApi {
  const client = createApiClient({ baseUrl, credentials: "include" });

  const guard = <T>(run: () => Promise<T>): Promise<T> =>
    run().catch((error: unknown) => {
      if (error instanceof ApiError && error.options.status === 401) onAuthError();
      throw error;
    });

  const get = <T>(path: string): Promise<T> => guard(() => client.get<T>(path));
  const post = <T>(path: string, body: unknown): Promise<T> => guard(() => client.post<T>(path, body));

  const surfaceCall = async (run: () => Promise<unknown>): Promise<SurfaceCallResult> => {
    try {
      return { body: await run(), httpStatus: 200, denied: false, correlationId: null, requestId: createRequestId() };
    } catch (error) {
      if (error instanceof ApiError) {
        return {
          body: { error: error.message, details: error.options.details ?? null },
          httpStatus: error.options.status,
          denied: error.options.status === 401 || error.options.status === 403,
          correlationId: error.options.correlationId ?? null,
          requestId: error.options.requestId ?? null,
        };
      }
      return {
        body: { error: error instanceof Error ? error.message : "Network request failed" },
        httpStatus: 0,
        denied: true,
        correlationId: null,
        requestId: null,
      };
    }
  };

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const qs = (params?: Record<string, string | number | undefined>): string => {
    if (!params) return "";
    const search = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== "") search.set(k, String(v));
    }
    const s = search.toString();
    return s ? `?${s}` : "";
  };

  return {
    health: (path) => guard(() => client.get(`${origin}${path}` as string)),
    capabilities: () => get("/capabilities"),
    backends: () => get<BackendsResponse>("/backends"),
    backendHealth: (name) => get(`/backends/${encodeURIComponent(name)}/health`),
    research: (query, depth = "standard") => post("/research", { query, depth }),
    researchStart: (query, depth = "deep") => post("/research/start", { query, depth }),
    researchList: (limit = 50, status = null) => get(`/research${qs({ limit, status: status ?? undefined })}`),
    researchStatus: (jobId) => get(`/research/${encodeURIComponent(jobId)}`),
    researchCancel: (jobId) => post(`/research/${encodeURIComponent(jobId)}/cancel`, {}),
    watchesList: () => get<WatchListResponse>("/watches"),
    watchCreate: (body) => post<WatchRow>("/watches", body),
    watchStatus: (id) => get<WatchRow>(`/watches/${encodeURIComponent(id)}`),
    watchEvents: (id) => get(`/watches/${encodeURIComponent(id)}/events`),
    quality: () => get("/quality"),
    evaluation: () => get("/eval"),
    systemAbout: () => get<AboutResponse>("/system/about"),
    systemSettings: () => get("/system/settings"),
    // W28F-959: public-safe rate-limit + cache + mode governance status.
    governance: () => get<GovernanceStatus>("/governance"),
    auditList: (params) => get<AuditListResponse>(`/audit-log${qs(params)}`),
    auditExportUrl: (fmt) => `${baseUrl}/audit-log/export?fmt=${fmt}`,
    auditIntegrity: () => get("/audit-log/integrity"),
    jobs: () => get<JobListResponse>("/jobs").catch(() => ({ items: [] })),
    openapi: () => guard(() => client.get<OpenApiDocument>("/openapi.json")),
    // Developer consoles consume the RBAC-gated /v1 REST projection of the MCP +
    // A2A surfaces (the raw protocol endpoints speak JSON-RPC/SSE, not browser
    // REST). The web tier sources these from the in-process registries.
    mcpHealth: () => get("/mcp/health"),
    mcpTools: () => get<McpToolListResponse>("/mcp/tools"),
    mcpCall: (name, args) => surfaceCall(() => post("/mcp/call", { name, arguments: args })),
    a2aHealth: () => get("/a2a/health"),
    a2aAgentCard: () => get<A2aAgentCardResponse>("/a2a/agent-card"),
    a2aSkillCall: (skill, payload) => surfaceCall(() => post("/a2a/call", { skill, payload })),
  };
}
