// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
//
// Licensed under the Apache License, Version 2.0.

// geospatial-mcp API client. Uses the shared @cloud-dog/api-client (no bespoke
// HTTP/proxy). The web tier proxies /api -> API tier and bridges the cookie
// session to the principal's identity headers, so every call is same-origin
// with credentials: "include" and no client-side auth header is needed. The
// geospatial API mounts its routes under /v1 and /idam/v1; the web tier strips
// the /api prefix, so paths here are "/v1/..." against baseUrl "/api".

import { ApiError, buildJsonRpcRequest, createApiClient } from "@cloud-dog/api-client";

/** Result of a raw surface (MCP/A2A) call — body + transport metadata. Matches
 * the canonical chart-mcp pattern (no raw fetch — GE-DEF-012 / CSR-001). */
export type SurfaceCallResult = Readonly<{
  body: unknown;
  httpStatus: number;
  denied: boolean;
  correlationId: string | null;
  requestId: string | null;
}>;

function items<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === "object" && Array.isArray((value as { items?: unknown }).items)) {
    return (value as { items: T[] }).items;
  }
  return [];
}

/** True when the error is a 403 (valid session, operation not permitted). */
export function isForbidden(error: unknown): boolean {
  return error instanceof ApiError && error.options.status === 403;
}

export function statusOf(error: unknown): number | undefined {
  return error instanceof ApiError ? error.options.status : undefined;
}

export type GeoProfile = Record<string, unknown> & { profile_id?: string; name?: string };
export type GeoSession = Record<string, unknown> & { session_id?: string };
export type GeoProvider = Record<string, unknown> & { provider_id?: string; enabled?: boolean };
export type GeoAsset = Record<string, unknown> & { asset_id?: string };
export type GeoJob = Record<string, unknown> & { job_id?: string; status?: string };

export type GeoApi = Readonly<{
  health: () => Promise<Record<string, unknown>>;
  capabilities: () => Promise<Record<string, unknown>>;
  operations: () => Promise<Record<string, unknown>>;
  /** W28H-1122 governance status (modes/TTLs/rate windows/provider budgets/queue). */
  egressStatus: () => Promise<Record<string, unknown>>;
  auditEvents: (limit?: number) => Promise<Array<Record<string, unknown>>>;
  config: () => Promise<Record<string, unknown>>;
  // domain: profiles / sessions (CRUD) ------------------------------------
  listProfiles: () => Promise<GeoProfile[]>;
  getProfile: (id: string) => Promise<GeoProfile>;
  createProfile: (body: Record<string, unknown>) => Promise<GeoProfile>;
  updateProfile: (id: string, body: Record<string, unknown>) => Promise<GeoProfile>;
  deleteProfile: (id: string) => Promise<void>;
  listSessions: () => Promise<GeoSession[]>;
  getSession: (id: string) => Promise<GeoSession>;
  createSession: (body: Record<string, unknown>) => Promise<GeoSession>;
  closeSession: (id: string) => Promise<GeoSession>;
  // domain: providers (read; credentials masked at the backend) -----------
  listProviders: () => Promise<GeoProvider[]>;
  getProvider: (id: string) => Promise<GeoProvider>;
  // domain: assets --------------------------------------------------------
  listAssets: () => Promise<GeoAsset[]>;
  assetMetadata: (body: Record<string, unknown>) => Promise<Record<string, unknown>>;
  purgeExpired: (body: Record<string, unknown>) => Promise<Record<string, unknown>>;
  downloadAsset: (body: Record<string, unknown>) => Promise<Record<string, unknown>>;
  // domain: active query/render ops (reader -> 403) -----------------------
  geocode: (body: Record<string, unknown>) => Promise<Record<string, unknown>>;
  reverseGeocode: (body: Record<string, unknown>) => Promise<Record<string, unknown>>;
  searchFeatures: (body: Record<string, unknown>) => Promise<Record<string, unknown>>;
  discoverFeatures: (body: Record<string, unknown>) => Promise<Record<string, unknown>>;
  featureLookup: (body: Record<string, unknown>) => Promise<Record<string, unknown>>;
  basemapTiles: (body: Record<string, unknown>) => Promise<Record<string, unknown>>;
  searchImagery: (body: Record<string, unknown>) => Promise<Record<string, unknown>>;
  imageryTimeseries: (body: Record<string, unknown>) => Promise<Record<string, unknown>>;
  compareImagery: (body: Record<string, unknown>) => Promise<Record<string, unknown>>;
  renderMap: (body: Record<string, unknown>) => Promise<Record<string, unknown>>;
  createEvidenceBundle: (body: Record<string, unknown>) => Promise<Record<string, unknown>>;
  generateReport: (body: Record<string, unknown>) => Promise<Record<string, unknown>>;
  searchEvidence: (body: Record<string, unknown>) => Promise<Record<string, unknown>>;
  // jobs ------------------------------------------------------------------
  listJobs: () => Promise<GeoJob[]>;
  getJob: (id: string) => Promise<GeoJob>;
  cancelJob: (id: string) => Promise<GeoJob>;
  // machine surfaces (MCP / A2A) via @cloud-dog/api-client root client --------
  serviceHealth: (path: string) => Promise<boolean>;
  mcpHealth: () => Promise<Record<string, unknown>>;
  mcpTools: () => Promise<Record<string, unknown>>;
  mcpCall: (toolName: string, args: unknown) => Promise<SurfaceCallResult>;
  a2aHealth: () => Promise<Record<string, unknown>>;
  a2aAgentCard: () => Promise<Record<string, unknown>>;
  a2aTask: (skillId: string, payload: unknown) => Promise<SurfaceCallResult>;
}>;

export function createGeoApi(opts: { baseUrl: string; onAuthError: () => void }): GeoApi {
  const client = createApiClient({ baseUrl: opts.baseUrl, credentials: "include" });
  // Root-relative client for the web-tier-proxied machine surfaces (/mcp, /a2a,
  // /.well-known) — same @cloud-dog/api-client, no bespoke fetch (GE-DEF-012).
  const surfaceClient = createApiClient({ baseUrl: "/", credentials: "include" });

  // 401 (session expired) triggers logout; 403 (forbidden) is surfaced to the caller.
  const guard = <T>(run: () => Promise<T>): Promise<T> =>
    run().catch((error: unknown) => {
      if (error instanceof ApiError && error.options.status === 401) opts.onAuthError();
      throw error;
    });

  const get = <T>(path: string) => guard(() => client.get<T>(path));
  const post = <T>(path: string, body: unknown) => guard(() => client.post<T>(path, body));
  const patch = <T>(path: string, body: unknown) => guard(() => client.patch<T>(path, body));
  const del = (path: string) => guard(() => client.delete<unknown>(path)).then(() => undefined);
  const surfaceGet = <T>(path: string) => guard(() => surfaceClient.get<T>(path));
  const surfacePost = <T>(path: string, body: unknown) => guard(() => surfaceClient.post<T>(path, body));
  const id = (value: string) => encodeURIComponent(value);

  // Wrap a surface call so a 4xx/5xx becomes a structured denied result (the
  // PS-72 consoles render httpStatus/denied), not a thrown error.
  const surfaceCall = async (run: () => Promise<unknown>): Promise<SurfaceCallResult> => {
    try {
      return { body: await run(), httpStatus: 200, denied: false, correlationId: null, requestId: null };
    } catch (error) {
      if (error instanceof ApiError) {
        return {
          body: { error: error.message, details: error.options.details ?? null },
          httpStatus: error.options.status,
          denied: true,
          correlationId: error.options.correlationId ?? null,
          requestId: error.options.requestId ?? null,
        };
      }
      return {
        body: { error: error instanceof Error ? error.message : "Network request failed" },
        httpStatus: 0, denied: true, correlationId: null, requestId: null,
      };
    }
  };

  return {
    health: () => get<Record<string, unknown>>("/health"),
    capabilities: () => get<Record<string, unknown>>("/v1/capabilities"),
    operations: () => get<Record<string, unknown>>("/v1/operations"),
    egressStatus: () => get<Record<string, unknown>>("/v1/status/egress"),
    auditEvents: (limit = 100) =>
      get<{ events?: Array<Record<string, unknown>> }>(
        `/api/audit-log?limit=${encodeURIComponent(String(limit))}`,
      )
        .then((r) => r.events ?? [])
        .catch(() => []),
    config: () => get<Record<string, unknown>>("/api/config").catch(() => ({})),

    listProfiles: () => get<unknown>("/v1/profiles").then(items<GeoProfile>),
    getProfile: (pid) => get<GeoProfile>(`/v1/profiles/${id(pid)}`),
    createProfile: (body) => post<GeoProfile>("/v1/profiles", body),
    updateProfile: (pid, body) => patch<GeoProfile>(`/v1/profiles/${id(pid)}`, body),
    deleteProfile: (pid) => del(`/v1/profiles/${id(pid)}`),

    listSessions: () => get<unknown>("/v1/sessions").then(items<GeoSession>),
    getSession: (sid) => get<GeoSession>(`/v1/sessions/${id(sid)}`),
    createSession: (body) => post<GeoSession>("/v1/sessions", body),
    closeSession: (sid) => post<GeoSession>(`/v1/sessions/${id(sid)}/close`, {}),

    listProviders: () => get<unknown>("/v1/providers").then(items<GeoProvider>),
    getProvider: (pid) => get<GeoProvider>(`/v1/providers/${id(pid)}`),

    listAssets: () => get<unknown>("/v1/assets").then(items<GeoAsset>),
    assetMetadata: (body) => post<Record<string, unknown>>("/v1/assets/metadata", body),
    purgeExpired: (body) => post<Record<string, unknown>>("/v1/assets/purge-expired", body),
    downloadAsset: (body) => post<Record<string, unknown>>("/v1/assets/download", body),

    geocode: (body) => post<Record<string, unknown>>("/v1/geocode", body),
    reverseGeocode: (body) => post<Record<string, unknown>>("/v1/reverse-geocode", body),
    searchFeatures: (body) => post<Record<string, unknown>>("/v1/features/search", body),
    discoverFeatures: (body) => post<Record<string, unknown>>("/v1/features/discover", body),
    featureLookup: (body) => post<Record<string, unknown>>("/v1/features/lookup", body),
    basemapTiles: (body) => post<Record<string, unknown>>("/v1/basemap/tiles", body),
    searchImagery: (body) => post<Record<string, unknown>>("/v1/imagery/search", body),
    imageryTimeseries: (body) => post<Record<string, unknown>>("/v1/imagery/timeseries", body),
    compareImagery: (body) => post<Record<string, unknown>>("/v1/imagery/compare", body),
    renderMap: (body) => post<Record<string, unknown>>("/v1/render/map", body),
    createEvidenceBundle: (body) => post<Record<string, unknown>>("/v1/evidence/bundles", body),
    generateReport: (body) => post<Record<string, unknown>>("/v1/evidence/reports", body),
    searchEvidence: (body) => post<Record<string, unknown>>("/v1/evidence/search", body),

    listJobs: () => get<unknown>("/v1/jobs").then(items<GeoJob>),
    getJob: (jid) => get<GeoJob>(`/v1/jobs/${id(jid)}`),
    cancelJob: (jid) => post<GeoJob>(`/v1/jobs/${id(jid)}/cancel`, {}),

    // machine surfaces — proxied by the web tier, called via @cloud-dog/api-client.
    serviceHealth: (path) =>
      surfaceGet<unknown>(path).then(() => true).catch(() => false),
    mcpHealth: () => surfaceGet<Record<string, unknown>>("/mcp/health"),
    mcpTools: () => surfaceGet<Record<string, unknown>>("/mcp/tools"),
    mcpCall: (toolName, args) =>
      surfaceCall(() =>
        surfacePost<unknown>("/mcp", buildJsonRpcRequest("tools/call", { name: toolName, arguments: args }, Date.now())),
      ),
    a2aHealth: () => surfaceGet<Record<string, unknown>>("/a2a/health"),
    a2aAgentCard: () => surfaceGet<Record<string, unknown>>("/.well-known/agent.json"),
    a2aTask: (skillId, payload) =>
      surfaceCall(() =>
        surfacePost<unknown>("/a2a/tasks", { task_id: `task-${Date.now()}`, skill_id: skillId, input: payload }),
      ),
  };
}
