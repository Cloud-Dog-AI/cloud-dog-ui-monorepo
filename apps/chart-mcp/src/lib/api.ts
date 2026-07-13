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

// chart-mcp API client. Uses the shared @cloud-dog/api-client (no bespoke HTTP/proxy).
// The web tier proxies /api -> API tier (cookie -> X-API-Key bridge), so every call is
// same-origin with credentials: "include" and no client-side auth header is needed.

import { ApiError, buildJsonRpcRequest, createApiClient } from "@cloud-dog/api-client";
import type {
  AssetMeta,
  AssetTransfer,
  Capabilities,
  Health,
  Job,
  Profile,
  Recommendation,
  RenderManifest,
  Renderer,
  RendererStatus,
  Session,
  StylePack,
} from "./types";

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

export type SurfaceCallResult = Readonly<{
  body: unknown;
  httpStatus: number;
  denied: boolean;
  correlationId: string | null;
  requestId: string | null;
}>;

export type ChartApi = Readonly<{
  health: () => Promise<Health>;
  capabilities: () => Promise<Capabilities>;
  auditEvents: (limit?: number) => Promise<Array<Record<string, unknown>>>;
  config: () => Promise<Record<string, unknown>>;
  configSources: () => Promise<{ sources: string[]; [k: string]: unknown }>;
  listProfiles: () => Promise<Profile[]>;
  getProfile: (id: string) => Promise<Profile>;
  createProfile: (body: Record<string, unknown>) => Promise<Profile>;
  updateProfile: (id: string, body: Record<string, unknown>) => Promise<Profile>;
  deleteProfile: (id: string) => Promise<void>;
  listSessions: () => Promise<Session[]>;
  getSession: (id: string) => Promise<Session>;
  createSession: (body: Record<string, unknown>) => Promise<Session>;
  closeSession: (id: string) => Promise<Session>;
  listRenders: () => Promise<RenderManifest[]>;
  getRender: (id: string) => Promise<RenderManifest>;
  listAssets: () => Promise<AssetMeta[]>;
  getAssetMeta: (id: string) => Promise<AssetMeta>;
  getAssetTransfer: (id: string) => Promise<AssetTransfer>;
  deleteAsset: (id: string) => Promise<void>;
  listStylePacks: () => Promise<StylePack[]>;
  getStylePack: (id: string) => Promise<StylePack>;
  createStylePack: (body: Record<string, unknown>) => Promise<StylePack>;
  updateStylePack: (id: string, body: Record<string, unknown>) => Promise<StylePack>;
  deleteStylePack: (id: string) => Promise<void>;
  listRenderers: () => Promise<RendererStatus>;
  getRenderer: (id: string) => Promise<Renderer>;
  recommendationCapabilities: () => Promise<Record<string, unknown>>;
  recommend: (body: Record<string, unknown>) => Promise<Recommendation>;
  validate: (body: Record<string, unknown>) => Promise<Record<string, unknown>>;
  render: (body: Record<string, unknown>) => Promise<Record<string, unknown>>;
  renderDiagram: (body: Record<string, unknown>) => Promise<Record<string, unknown>>;
  listJobs: () => Promise<Job[]>;
  getJob: (id: string) => Promise<Job>;
  submitJob: (body: Record<string, unknown>) => Promise<Job>;
  cancelJob: (id: string) => Promise<Job>;
  // W28F-931 R5 PS-76 JW6 bulk-retry contract.
  bulkRetryJobs: (jobIds: string[]) => Promise<{ results: Array<{ job_id: string; retry_job_id?: string; status?: string; error?: string }>; count: number }>;
  mcpHealth: () => Promise<Record<string, unknown>>;
  mcpTools: () => Promise<Record<string, unknown>>;
  mcpCall: (toolName: string, args: unknown) => Promise<SurfaceCallResult>;
  a2aHealth: () => Promise<Record<string, unknown>>;
  a2aAgentCard: () => Promise<Record<string, unknown>>;
  a2aTask: (skillId: string, payload: unknown) => Promise<SurfaceCallResult>;
}>;

export function createChartApi(opts: { baseUrl: string; onAuthError: () => void }): ChartApi {
  const client = createApiClient({ baseUrl: opts.baseUrl, credentials: "include" });
  const surfaceClient = createApiClient({ baseUrl: "/", credentials: "include" });

  // 401 (session expired) triggers logout; 403 (forbidden) is surfaced to the caller.
  const guard = <T>(run: () => Promise<T>): Promise<T> =>
    run().catch((error: unknown) => {
      if (error instanceof ApiError && error.options.status === 401) opts.onAuthError();
      throw error;
    });

  const get = <T>(path: string) => guard(() => client.get<T>(path));
  const post = <T>(path: string, body: unknown) => guard(() => client.post<T>(path, body));
  const put = <T>(path: string, body: unknown) => guard(() => client.put<T>(path, body));
  const del = (path: string) => guard(() => client.delete<unknown>(path)).then(() => undefined);
  const surfaceGet = <T>(path: string) => guard(() => surfaceClient.get<T>(path));
  const surfacePost = <T>(path: string, body: unknown) => guard(() => surfaceClient.post<T>(path, body));
  const id = (value: string) => encodeURIComponent(value);
  const surfaceCall = async (run: () => Promise<unknown>): Promise<SurfaceCallResult> => {
    try {
      return {
        body: await run(),
        httpStatus: 200,
        denied: false,
        correlationId: null,
        requestId: null,
      };
    } catch (error) {
      if (error instanceof ApiError) {
        return {
          body: { error: error.message, details: error.options.details ?? null },
          httpStatus: error.options.status,
          denied: true,
          correlationId: null,
          requestId: null,
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

  return {
    health: () => get<Health>("/health"),
    capabilities: () => get<Capabilities>("/capabilities"),
    auditEvents: (limit = 100) =>
      get<{ events?: Array<Record<string, unknown>> }>(`/audit-log?limit=${encodeURIComponent(String(limit))}`).then(
        (r) => r.events ?? []
      ),
    config: () => get<{ config?: Record<string, unknown> }>("/config").then((r) => r.config ?? {}),
    configSources: () => get<{ sources: string[]; [k: string]: unknown }>("/config/sources"),

    listProfiles: () => get<unknown>("/profiles").then(items<Profile>),
    getProfile: (pid) => get<Profile>(`/profiles/${id(pid)}`),
    createProfile: (body) => post<Profile>("/profiles", body),
    updateProfile: (pid, body) => put<Profile>(`/profiles/${id(pid)}`, body),
    deleteProfile: (pid) => del(`/profiles/${id(pid)}`),

    listSessions: () => get<unknown>("/sessions").then(items<Session>),
    getSession: (sid) => get<Session>(`/sessions/${id(sid)}`),
    createSession: (body) => post<Session>("/sessions", body),
    closeSession: (sid) => post<Session>(`/sessions/${id(sid)}/close`, {}),

    listRenders: () => get<unknown>("/renders").then(items<RenderManifest>),
    getRender: (mid) => get<RenderManifest>(`/renders/${id(mid)}`),

    listAssets: () => get<unknown>("/assets").then(items<AssetMeta>),
    getAssetMeta: (aid) => get<AssetMeta>(`/assets/${id(aid)}/meta`),
    // The API tier wraps the asset bytes in a transfer envelope
    // ``{mode: "base64"|"download", asset: {...flat fields..., base64_data}}``.
    // The SPA's downloadTransfer() consumes the flat asset, so unwrap here
    // (W28F-931 R3 fix; the prior wrapper-shape break silently failed the
    // gallery Download path because base64_data lived under transfer.asset).
    getAssetTransfer: (aid) =>
      get<{ mode: string; asset: AssetTransfer }>(`/assets/${id(aid)}`).then(
        (envelope) => ({ ...envelope.asset, transfer_mode: envelope.mode }),
      ),
    deleteAsset: (aid) => del(`/assets/${id(aid)}`),

    listStylePacks: () => get<unknown>("/style-packs").then(items<StylePack>),
    getStylePack: (sid) => get<StylePack>(`/style-packs/${id(sid)}`),
    createStylePack: (body) => post<StylePack>("/style-packs", body),
    updateStylePack: (sid, body) => put<StylePack>(`/style-packs/${id(sid)}`, body),
    deleteStylePack: (sid) => del(`/style-packs/${id(sid)}`),

    listRenderers: () => get<RendererStatus>("/renderers"),
    getRenderer: (rid) => get<Renderer>(`/renderers/${id(rid)}`),

    recommendationCapabilities: () => get<Record<string, unknown>>("/recommendations"),
    recommend: (body) => post<Recommendation>("/recommend", body),
    validate: (body) => post<Record<string, unknown>>("/validate", body),
    render: (body) => post<Record<string, unknown>>("/render", body),
    renderDiagram: (body) => post<Record<string, unknown>>("/render-diagram", body),

    listJobs: () => get<unknown>("/jobs").then(items<Job>),
    getJob: (jid) => get<Job>(`/jobs/${id(jid)}`),
    submitJob: (body) => post<Job>("/jobs", body),
    cancelJob: (jid) => post<Job>(`/jobs/${id(jid)}/cancel`, {}),
    bulkRetryJobs: (jobIds) =>
      post<{ results: Array<{ job_id: string; retry_job_id?: string; status?: string; error?: string }>; count: number }>(
        "/jobs/_bulk_retry",
        { job_ids: jobIds },
      ),
    mcpHealth: () => surfaceGet<Record<string, unknown>>("/mcp/health"),
    mcpTools: () => surfaceGet<Record<string, unknown>>("/mcp/tools"),
    mcpCall: (toolName, args) =>
      surfaceCall(() =>
        surfacePost<unknown>(
          "/mcp",
          buildJsonRpcRequest("tools/call", { name: toolName, arguments: args }, Date.now()),
        ),
      ),
    a2aHealth: () => surfaceGet<Record<string, unknown>>("/a2a/health"),
    a2aAgentCard: () => surfaceGet<Record<string, unknown>>("/.well-known/agent.json"),
    a2aTask: (skillId, payload) =>
      surfaceCall(() =>
        surfacePost<unknown>("/a2a/tasks", {
          task_id: `task-${Date.now()}`,
          skill_id: skillId,
          input: payload,
        }),
      ),
  };
}
