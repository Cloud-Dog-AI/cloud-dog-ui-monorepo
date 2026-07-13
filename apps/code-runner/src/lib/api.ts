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

import { ApiError, createApiClient } from "@cloud-dog/api-client";
import type { RequestOptions } from "@cloud-dog/api-client";
import type {
  ApiKeySummary,
  AuditEvent,
  DataCreateResult,
  DataMutationResult,
  DataReadResult,
  EntityDetail,
  EntityItem,
  GroupSummary,
  IndexItem,
  IndexStatusItem,
  JobSummary,
  JobsHealth,
  LogEntrySummary,
  NamespaceItem,
  PingSummary,
  PrincipalSummary,
  ProfileDraft,
  ProfileSummary,
  RelationshipItem,
  ResourceMetricsSummary,
  SearchExplain,
  SearchItem,
  SearchRelatedItem,
  UserSummary,
} from "./types";

type JsonRecord = Record<string, unknown>;
type ToolRequestOptions = Pick<RequestOptions, "signal" | "timeoutMs">;
type CodeRunnerRequestMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type CodeRunnerRequestOptions = ToolRequestOptions & Readonly<{
  method?: CodeRunnerRequestMethod;
  body?: unknown;
  headers?: RequestOptions["headers"];
  query?: RequestOptions["query"];
}>;

/** PS-73 v2 SW8 per-leaf source attribution (from GET /v1/config/sources). */
export type ConfigSourceMeta = Readonly<{ source: string; secret?: boolean; servers?: string[] }>;
export type ConfigSourcesResponse = Readonly<{
  sources: Record<string, ConfigSourceMeta>;
  counts: Record<string, unknown>;
}>;

export type CodeRunnerApi = Readonly<{
  request: <T>(path: string, options?: CodeRunnerRequestOptions) => Promise<T>;
  ping: () => Promise<PingSummary>;
  currentPrincipal: () => Promise<PrincipalSummary>;
  getConfig: () => Promise<Record<string, unknown>>;
  getConfigSources: () => Promise<ConfigSourcesResponse>;
  auditSettingsReveal: () => Promise<void>;
  jobsHealth: () => Promise<JobsHealth>;
  listProfiles: () => Promise<ProfileSummary[]>;
  createProfile: (payload: ProfileDraft) => Promise<ProfileSummary>;
  updateProfile: (profileId: string, payload: ProfileDraft) => Promise<ProfileSummary>;
  deleteProfile: (profileId: string) => Promise<void>;
  listUsers: () => Promise<UserSummary[]>;
  createUser: (payload: Record<string, unknown>) => Promise<UserSummary>;
  updateUser: (userId: string, payload: Record<string, unknown>) => Promise<UserSummary>;
  deleteUser: (userId: string) => Promise<void>;
  listGroups: () => Promise<GroupSummary[]>;
  createGroup: (payload: Record<string, unknown>) => Promise<GroupSummary>;
  updateGroup: (groupId: string, payload: Record<string, unknown>) => Promise<GroupSummary>;
  deleteGroup: (groupId: string) => Promise<void>;
  listApiKeys: () => Promise<ApiKeySummary[]>;
  createApiKey: (payload: Record<string, unknown>) => Promise<ApiKeySummary>;
  revokeApiKey: (apiKeyId: string, reason?: string) => Promise<void>;
  getMetrics: () => Promise<ResourceMetricsSummary>;
  listLogs: (surface?: string, limit?: number) => Promise<LogEntrySummary[]>;
  listJobs: (limit?: number, jobType?: string) => Promise<JobSummary[]>;
  getJob: (jobId: string) => Promise<JobSummary | null>;
  cancelJob: (jobId: string) => Promise<boolean>;
  retryJob: (jobId: string) => Promise<boolean>;
  deleteJob: (jobId: string) => Promise<boolean>;
  jobsQueueStatus: () => Promise<Record<string, number>>;
  listNamespaces: (profileId: string, options?: ToolRequestOptions) => Promise<NamespaceItem[]>;
  listEntities: (profileId: string, namespace: string, options?: ToolRequestOptions) => Promise<EntityItem[]>;
  getEntity: (profileId: string, namespace: string, entity: string) => Promise<EntityDetail>;
  describeFields: (profileId: string, namespace: string, entity: string) => Promise<{ fields: Array<Record<string, unknown>> }>;
  listIndexes: (profileId: string, namespace: string, entity: string) => Promise<IndexItem[]>;
  sampleShapes: (profileId: string, namespace: string, entity: string, count?: number) => Promise<Array<Record<string, unknown>>>;
  dataRead: (payload: Record<string, unknown>) => Promise<DataReadResult>;
  dataCreate: (payload: Record<string, unknown>) => Promise<DataCreateResult>;
  dataUpdate: (payload: Record<string, unknown>) => Promise<DataMutationResult>;
  dataDelete: (payload: Record<string, unknown>) => Promise<DataMutationResult>;
  dataCount: (payload: Record<string, unknown>) => Promise<{ count: number }>;
  searchMetadata: (profileId: string, query: string, limit?: number) => Promise<SearchItem[]>;
  searchContent: (profileId: string, query: string, limit?: number) => Promise<SearchItem[]>;
  searchRelated: (profileId: string, namespace: string, entity: string, limit?: number) => Promise<SearchRelatedItem[]>;
  explainMatch: (profileId: string, query: string, documentId: string) => Promise<SearchExplain>;
  listRelationships: (profileId: string, namespace: string, entity: string) => Promise<RelationshipItem[]>;
  inferRelationships: (profileId: string, namespace: string, entity: string) => Promise<RelationshipItem[]>;
  createRelationship: (payload: Record<string, unknown>) => Promise<RelationshipItem>;
  updateRelationship: (relationshipId: string, payload: Record<string, unknown>) => Promise<RelationshipItem>;
  deleteRelationship: (relationshipId: string) => Promise<void>;
  listAuditEvents: (limit?: number, eventType?: string) => Promise<AuditEvent[]>;
  indexStatus: (profileId?: string) => Promise<IndexStatusItem[]>;
  syncProfile: (profileId: string) => Promise<Record<string, unknown>>;
  rebuildIndex: (profileIds?: string[]) => Promise<Record<string, unknown>>;
  planSchemaChange: (profileId: string, operation: Record<string, unknown>) => Promise<Record<string, unknown>>;
  applySchemaChange: (profileId: string, plan: Record<string, unknown>) => Promise<Record<string, unknown>>;
  // W28I-1240 allowlisted programme-service egress.
  egressStatus: () => Promise<EgressStatusResult>;
  egressAllowlist: () => Promise<EgressAllowlistResult>;
  egressAudit: (limit?: number) => Promise<EgressAuditResult>;
  egressExecute: (payload: EgressExecutePayload) => Promise<EgressExecuteResult>;
}>;

export type EgressServiceView = Readonly<{
  methods?: string[];
  path_patterns?: string[];
  auth_mode?: string;
  rate_limit_per_minute?: number;
}>;
export type EgressStatusResult = Readonly<{
  enabled?: boolean;
  can_egress?: boolean;
  preflight_reason?: string;
  profile?: string;
  available_profiles?: string[];
  effective_allowlist?: { profile?: string; caller_can_egress?: boolean; services?: Record<string, EgressServiceView> };
}>;
export type EgressAllowlistResult = Readonly<{ enabled?: boolean; services?: Record<string, Record<string, unknown>>; profiles?: Record<string, unknown> }>;
export type EgressTraceRow = Readonly<{ service_id?: string; method?: string; path?: string; allowed?: boolean; reason?: string; status_code?: number; subject?: string; latency_ms?: number }>;
export type EgressAuditResult = Readonly<{ count?: number; trace?: EgressTraceRow[] }>;
export type EgressExecuteOp = Readonly<{ service_id: string; method?: string; path?: string; body?: unknown; op?: string }>;
export type EgressExecutePayload = Readonly<{ profile?: string; operations: EgressExecuteOp[] }>;
export type EgressResultRow = Readonly<{ service_id?: string; method?: string; path?: string; allowed?: boolean; reason?: string; status_code?: number; response_json?: unknown }>;
export type EgressExecuteResult = Readonly<{ status?: string; profile?: string; allowed_count?: number; denied_count?: number; results?: EgressResultRow[]; mode?: string }>;

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};
}

function withAuthError<T>(fn: () => Promise<T>, onAuthError: () => void) {
  return fn().catch((error) => {
    // Only treat 401 (Unauthorized) as an auth session error that requires
    // logout.  403 (Forbidden) means the session is valid but the operation
    // is not permitted — do NOT log the user out for that.
    if (error instanceof ApiError && error.options.status === 401) {
      onAuthError();
    }
    throw error;
  });
}

export async function validateApiKey(baseUrl: string, apiKey: string): Promise<void> {
  const client = createApiClient({ baseUrl });
  const key = apiKey.trim();
  const headers = {
    Authorization: `Bearer ${key}`,
    "x-api-key": key,
  };
  const paths = ["/webapi/v1/ping"];
  let lastError: unknown = null;
  for (const path of paths) {
    try {
      await client.get(path, {
        timeoutMs: 15000,
        headers,
      });
      return;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("API key validation failed.");
}

export function createCodeRunnerApi(opts: {
  baseUrl: string;
  mcpBaseUrl: string;
  getAccessToken: () => string | null;
  onAuthError: () => void;
}): CodeRunnerApi {
  const client = createApiClient({
    baseUrl: opts.baseUrl,
    getAccessToken: opts.getAccessToken,
    credentials: "same-origin",
  });
  const mcpClient = createApiClient({
    baseUrl: opts.mcpBaseUrl,
    getAccessToken: opts.getAccessToken,
    credentials: "same-origin",
  });

  const safeGet = <T>(path: string) => withAuthError(() => client.get<T>(path), opts.onAuthError);
  const safePost = <T>(path: string, payload: unknown) => withAuthError(() => client.post<T>(path, payload), opts.onAuthError);
  const safePut = <T>(path: string, payload: unknown) => withAuthError(() => client.put<T>(path, payload), opts.onAuthError);
  const safeDelete = (path: string) => withAuthError(() => client.delete(path), opts.onAuthError);
  const request = <T>(path: string, options: CodeRunnerRequestOptions = {}) => {
    const requestOptions: RequestOptions = {
      signal: options.signal,
      timeoutMs: options.timeoutMs,
      headers: options.headers,
      query: options.query,
    };
    const method = options.method ?? "GET";
    if (method === "POST") return withAuthError(() => client.post<T>(path, options.body, requestOptions), opts.onAuthError);
    if (method === "PUT") return withAuthError(() => client.put<T>(path, options.body, requestOptions), opts.onAuthError);
    if (method === "PATCH") return withAuthError(() => client.patch<T>(path, options.body, requestOptions), opts.onAuthError);
    if (method === "DELETE") return withAuthError(() => client.delete<T>(path, requestOptions), opts.onAuthError);
    return withAuthError(() => client.get<T>(path, requestOptions), opts.onAuthError);
  };

  const callTool = async <T>(
    toolName: string,
    payload: Record<string, unknown>,
    options?: ToolRequestOptions
  ): Promise<T> => {
    return withAuthError(() => mcpClient.post<T>(`/webmcp/tools/${toolName}`, payload, options), opts.onAuthError);
  };

  return {
    request,
    ping: () => safeGet<PingSummary>("/webapi/v1/ping"),
    currentPrincipal: () => safeGet<PrincipalSummary>("/webapi/v1/auth/me"),
    getConfig: () => safeGet<Record<string, unknown>>("/webapi/v1/config"),
    getConfigSources: () => safeGet<ConfigSourcesResponse>("/webapi/v1/config/sources"),
    auditSettingsReveal: async () => {
      await safePost("/webapi/v1/config/audit-reveal", {});
    },
    jobsHealth: () => safeGet<JobsHealth>("/webapi/v1/jobs/health"),
    listProfiles: () => safeGet<ProfileSummary[]>("/webapi/v1/profiles"),
    createProfile: (payload) => safePost<ProfileSummary>("/webapi/v1/profiles", payload),
    updateProfile: (profileId, payload) => safePut<ProfileSummary>(`/webapi/v1/profiles/${profileId}`, payload),
    deleteProfile: async (profileId) => {
      await safeDelete(`/webapi/v1/profiles/${profileId}`);
    },
    listUsers: () => safeGet<UserSummary[]>("/webapi/v1/users"),
    createUser: (payload) => safePost<UserSummary>("/webapi/v1/users", payload),
    updateUser: (userId, payload) => safePut<UserSummary>(`/webapi/v1/users/${userId}`, payload),
    deleteUser: async (userId) => {
      await safeDelete(`/webapi/v1/users/${userId}`);
    },
    listGroups: () => safeGet<GroupSummary[]>("/webapi/v1/groups"),
    createGroup: (payload) => safePost<GroupSummary>("/webapi/v1/groups", payload),
    updateGroup: (groupId, payload) => safePut<GroupSummary>(`/webapi/v1/groups/${groupId}`, payload),
    deleteGroup: async (groupId) => {
      await safeDelete(`/webapi/v1/groups/${groupId}`);
    },
    listApiKeys: () => safeGet<ApiKeySummary[]>("/webapi/v1/api-keys"),
    createApiKey: (payload) => safePost<ApiKeySummary>("/webapi/v1/api-keys", payload),
    revokeApiKey: async (apiKeyId, reason = "revoked") => {
      await safePost(`/webapi/v1/api-keys/${apiKeyId}/revoke`, { reason });
    },
    getMetrics: () => safeGet<ResourceMetricsSummary>("/webapi/v1/metrics"),
    listLogs: (surface = "api", limit = 200) =>
      safeGet<{ items: LogEntrySummary[] }>(`/webapi/v1/logs?surface=${encodeURIComponent(surface)}&limit=${limit}`)
        .then((body) => asArray<LogEntrySummary>(asRecord(body).items)),
    listJobs: (limit = 50, jobType) => {
      const query = new URLSearchParams({ limit: String(limit) });
      if (jobType) query.set("job_type", jobType);
      return safeGet<{ items: JobSummary[] }>(`/webapi/v1/jobs?${query.toString()}`)
        .then((body) => asArray<JobSummary>(asRecord(body).items));
    },
    getJob: (jobId) => safeGet<JobSummary>(`/webapi/v1/jobs/${jobId}`).then((body) => {
      const payload = asRecord(body);
      return Object.keys(payload).length ? (payload as JobSummary) : null;
    }),
    cancelJob: (jobId) =>
      safePost<{ cancelled?: boolean }>(`/webapi/v1/jobs/${jobId}/cancel`, {}).then((body) => Boolean(asRecord(body).cancelled)),
    retryJob: (jobId) =>
      safePost<{ retried?: boolean }>(`/webapi/v1/jobs/${jobId}/retry`, {}).then((body) => Boolean(asRecord(body).retried ?? true)),
    deleteJob: (jobId) =>
      safeDelete(`/webapi/v1/jobs/${jobId}`).then((body) => Boolean(asRecord(body).deleted ?? true)),
    jobsQueueStatus: () =>
      safeGet<Record<string, number>>("/webapi/v1/jobs/queue/status").then((body) => asRecord(body) as Record<string, number>),
    listNamespaces: (profileId, options) => callTool<{ items: NamespaceItem[] }>("catalog.list_namespaces", { profile_id: profileId }, options).then((body) => asArray<NamespaceItem>(asRecord(body).items)),
    listEntities: (profileId, namespace, options) => callTool<{ items: EntityItem[] }>("catalog.list_entities", { profile_id: profileId, namespace }, options).then((body) => asArray<EntityItem>(asRecord(body).items)),
    getEntity: (profileId, namespace, entity) => callTool<EntityDetail>("catalog.get_entity", { profile_id: profileId, namespace, entity }),
    describeFields: (profileId, namespace, entity) => callTool<{ fields: Array<Record<string, unknown>> }>("schema.describe_fields", { profile_id: profileId, namespace, entity }),
    listIndexes: (profileId, namespace, entity) => callTool<{ items: IndexItem[] }>("schema.list_indexes", { profile_id: profileId, namespace, entity }).then((body) => asArray<IndexItem>(asRecord(body).items)),
    sampleShapes: (profileId, namespace, entity, count = 5) => callTool<{ items: Array<Record<string, unknown>> }>("schema.sample_shapes", { profile_id: profileId, namespace, entity, count }).then((body) => asArray<Record<string, unknown>>(asRecord(body).items)),
    dataRead: (payload) => callTool<DataReadResult>("data.read", payload),
    dataCreate: (payload) => callTool<DataCreateResult>("data.create", payload),
    dataUpdate: (payload) => callTool<DataMutationResult>("data.update", payload),
    dataDelete: (payload) => callTool<DataMutationResult>("data.delete", payload),
    dataCount: (payload) => callTool<{ count: number }>("data.count", payload),
    searchMetadata: (profileId, query, limit = 10) => callTool<{ items: SearchItem[] }>("search.metadata", { profile_id: profileId, query, limit }).then((body) => asArray<SearchItem>(asRecord(body).items)),
    searchContent: (profileId, query, limit = 10) => callTool<{ items: SearchItem[] }>("search.content", { profile_id: profileId, query, limit }).then((body) => asArray<SearchItem>(asRecord(body).items)),
    searchRelated: (profileId, namespace, entity, limit = 10) => callTool<{ items: SearchRelatedItem[] }>("search.related", { profile_id: profileId, namespace, entity, limit }).then((body) => asArray<SearchRelatedItem>(asRecord(body).items)),
    explainMatch: (profileId, query, documentId) => callTool<SearchExplain>("search.explain_match", { profile_id: profileId, query, document_id: documentId }),
    listRelationships: (profileId, namespace, entity) => callTool<{ items: RelationshipItem[] }>("relationship.list", { profile_id: profileId, namespace, entity }).then((body) => asArray<RelationshipItem>(asRecord(body).items)),
    inferRelationships: (profileId, namespace, entity) => callTool<{ items: RelationshipItem[] }>("relationship.infer", { profile_id: profileId, namespace, entity }).then((body) => asArray<RelationshipItem>(asRecord(body).items)),
    createRelationship: (payload) => callTool<RelationshipItem>("relationship.create", payload),
    updateRelationship: (relationshipId, payload) => callTool<RelationshipItem>("relationship.update", { relationship_id: relationshipId, ...payload }),
    deleteRelationship: async (relationshipId) => {
      await callTool("relationship.delete", { relationship_id: relationshipId });
    },
    listAuditEvents: (limit = 25, eventType) => callTool<{ items: AuditEvent[] }>("audit.list_events", { limit, event_type: eventType }).then((body) => asArray<AuditEvent>(asRecord(body).items)),
    indexStatus: (profileId) => callTool<{ items: IndexStatusItem[] }>("index.status", profileId ? { profile_id: profileId } : {}).then((body) => asArray<IndexStatusItem>(asRecord(body).items)),
    syncProfile: (profileId) => callTool<Record<string, unknown>>("index.sync_profile", { profile_id: profileId }),
    rebuildIndex: (profileIds) => callTool<Record<string, unknown>>("index.rebuild", { profile_ids: profileIds ?? [] }),
    planSchemaChange: (profileId, operation) => callTool<Record<string, unknown>>("schema.change.plan", { profile_id: profileId, operation }),
    applySchemaChange: (profileId, plan) => callTool<Record<string, unknown>>("schema.change.apply", { profile_id: profileId, plan }),
    // W28I-1240 allowlisted programme-service egress (via the /webapi bridge).
    egressStatus: () => safeGet<EgressStatusResult>("/webapi/v1/egress/status"),
    egressAllowlist: () => safeGet<EgressAllowlistResult>("/webapi/v1/egress/allowlist"),
    egressAudit: (limit = 50) => safeGet<EgressAuditResult>(`/webapi/v1/egress/audit?limit=${limit}`),
    egressExecute: (payload) => safePost<EgressExecuteResult>("/webapi/v1/egress/execute", payload),
  };
}
