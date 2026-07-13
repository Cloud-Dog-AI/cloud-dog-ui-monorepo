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

// @cloud-dog/app-imap-mcp — Backend API adapter.

import { ApiError, createApiClient } from "@cloud-dog/api-client";
import type {
  AuditEventRow,
  CallMeta,
  CallResult,
  EndpointDescriptor,
  GroupRow,
  HealthPayload,
  JobRecord,
  JobQueueStatus,
  JsonRecord,
  ManagedApiKeyRow,
  ProfileRow,
  SettingsRecord,
  ServerLogRow,
  StatusRecord,
  ToolDescriptor,
  TraceEvent,
  UserRow,
  VersionRecord,
} from "./types";

type ApiEnvelope = Readonly<{
  ok?: boolean;
  result?: unknown;
  warnings?: unknown;
  errors?: unknown;
  meta?: unknown;
}>;

type ToolEnvelope = Readonly<{
  ok?: boolean;
  result?: unknown;
  warnings?: unknown;
  errors?: unknown;
  meta?: unknown;
}>;

export const ENDPOINT_MAP: Readonly<Record<string, EndpointDescriptor>> = {
  health: { method: "GET", path: "/webapi/v1/health" },
  tools: { method: "GET", path: "/webapi/v1/tools" },
  profileList: { method: "GET", path: "/webapi/v1/admin/profiles" },
  profileGet: { method: "GET", path: "/webapi/v1/admin/profiles/{profile_id}" },
  profilePut: { method: "PUT", path: "/webapi/v1/admin/profiles/{profile_id}" },
  profileDelete: { method: "DELETE", path: "/webapi/v1/admin/profiles/{profile_id}" },
  userList: { method: "GET", path: "/webapi/v1/admin/users" },
  userGet: { method: "GET", path: "/webapi/v1/admin/users/{user_id}" },
  userCreate: { method: "POST", path: "/webapi/v1/admin/users" },
  userUpdate: { method: "PUT", path: "/webapi/v1/admin/users/{user_id}" },
  userDelete: { method: "DELETE", path: "/webapi/v1/admin/users/{user_id}" },
  groupList: { method: "GET", path: "/webapi/v1/admin/groups" },
  groupGet: { method: "GET", path: "/webapi/v1/admin/groups/{group_id}" },
  groupCreate: { method: "POST", path: "/webapi/v1/admin/groups" },
  groupUpdate: { method: "PUT", path: "/webapi/v1/admin/groups/{group_id}" },
  groupDelete: { method: "DELETE", path: "/webapi/v1/admin/groups/{group_id}" },
  groupAddMember: { method: "POST", path: "/webapi/v1/admin/groups/{group_id}/members" },
  groupRemoveMember: { method: "DELETE", path: "/webapi/v1/admin/groups/{group_id}/members/{user_id}" },
  apiKeyList: { method: "GET", path: "/webapi/v1/admin/api-keys" },
  apiKeyCreate: { method: "POST", path: "/webapi/v1/admin/api-keys" },
  apiKeyDelete: { method: "DELETE", path: "/webapi/v1/admin/api-keys/{api_key_id}" },
  rbacGet: { method: "GET", path: "/webapi/v1/admin/rbac/policies" },
  rbacPut: { method: "PUT", path: "/webapi/v1/admin/rbac/policies" },
  probe: { method: "POST", path: "/webapi/v1/tools/mail_probe" },
  audit: { method: "GET", path: "/webapi/v1/admin/audit/events" },
  archiveExport: { method: "POST", path: "/webapi/v1/admin/archive/export" },
  search: { method: "POST", path: "/webapi/v1/tools/mail_search" },
  getMessage: { method: "POST", path: "/webapi/v1/tools/mail_get_message" },
  extract: { method: "POST", path: "/webapi/v1/tools/mail_extract_message" },
  listAttachments: { method: "POST", path: "/webapi/v1/tools/mail_list_attachments" },
  downloadAttachment: { method: "POST", path: "/webapi/v1/tools/mail_download_attachment" },
  setSeen: { method: "POST", path: "/webapi/v1/tools/mail_set_seen" },
  moveDuplicates: { method: "POST", path: "/webapi/v1/tools/mail_move_duplicates_since_last_search" },
  moveMessages: { method: "POST", path: "/webapi/v1/tools/mail_move_messages" },
  deleteMessages: { method: "POST", path: "/webapi/v1/tools/mail_delete_messages" },
  a2aTools: { method: "GET", path: "/weba2a/tools" },
  a2aCall: { method: "POST", path: "/weba2a/tools/{tool_name}" },
  a2aEvents: { method: "WS", path: "/weba2a/events" },
} as const;

export type ImapMcpApi = Readonly<{
  getHealth: () => Promise<CallResult<HealthPayload>>;
  listApiTools: () => Promise<CallResult<ToolDescriptor[]>>;
  listMcpTools: () => Promise<CallResult<ToolDescriptor[]>>;
  listA2ATools: () => Promise<CallResult<ToolDescriptor[]>>;
  callTool: <T>(toolName: string, payload: JsonRecord) => Promise<CallResult<T>>;
  callMcpTool: <T>(toolName: string, payload: JsonRecord, apiKeyOverride?: string) => Promise<CallResult<T>>;
  listProfiles: () => Promise<CallResult<string[]>>;
  getProfile: (profileId: string) => Promise<CallResult<JsonRecord>>;
  upsertProfile: (profileId: string, payload: JsonRecord) => Promise<CallResult<JsonRecord>>;
  deleteProfile: (profileId: string) => Promise<CallResult<JsonRecord>>;
  listUsers: () => Promise<CallResult<UserRow[]>>;
  getUser: (userId: string) => Promise<CallResult<UserRow>>;
  createUser: (payload: JsonRecord) => Promise<CallResult<UserRow>>;
  updateUser: (userId: string, payload: JsonRecord) => Promise<CallResult<UserRow>>;
  deleteUser: (userId: string) => Promise<CallResult<JsonRecord>>;
  listGroups: () => Promise<CallResult<GroupRow[]>>;
  getGroup: (groupId: string) => Promise<CallResult<GroupRow>>;
  createGroup: (payload: JsonRecord) => Promise<CallResult<GroupRow>>;
  updateGroup: (groupId: string, payload: JsonRecord) => Promise<CallResult<GroupRow>>;
  deleteGroup: (groupId: string) => Promise<CallResult<JsonRecord>>;
  addGroupMember: (groupId: string, userId: string) => Promise<CallResult<GroupRow>>;
  removeGroupMember: (groupId: string, userId: string) => Promise<CallResult<GroupRow>>;
  listApiKeys: () => Promise<CallResult<ManagedApiKeyRow[]>>;
  createApiKey: (payload: JsonRecord) => Promise<CallResult<ManagedApiKeyRow>>;
  revokeApiKey: (apiKeyId: string) => Promise<CallResult<JsonRecord>>;
  getRbacPolicies: () => Promise<CallResult<JsonRecord>>;
  putRbacPolicies: (payload: JsonRecord) => Promise<CallResult<JsonRecord>>;
  listAuditEvents: (limit: number, contains: string) => Promise<CallResult<AuditEventRow[]>>;
  listServerLogs: (logType: string, lines: number, contains: string) => Promise<CallResult<ServerLogRow[]>>;
  getSettings: () => Promise<CallResult<SettingsRecord>>;
  updateSettings: (payload: JsonRecord) => Promise<CallResult<SettingsRecord>>;
  getVersion: () => Promise<CallResult<VersionRecord>>;
  getStatus: () => Promise<CallResult<StatusRecord>>;
  listJobs: () => Promise<CallResult<JobRecord[]>>;
  getJob: (jobId: string) => Promise<CallResult<JobRecord>>;
  getJobQueueStatus: () => Promise<CallResult<JobQueueStatus>>;
  cancelJob: (jobId: string) => Promise<CallResult<JsonRecord>>;
  retryJob: (jobId: string) => Promise<CallResult<JsonRecord>>;
  deleteJob: (jobId: string) => Promise<CallResult<JsonRecord>>;
  archiveJob: (jobId: string) => Promise<CallResult<JsonRecord>>;
  exportArchive: (payload: JsonRecord) => Promise<CallResult<JsonRecord>>;
  callA2ATool: <T>(toolName: string, payload: JsonRecord, apiKeyOverride?: string) => Promise<CallResult<T>>;
  parseProfileRow: (profileId: string, profile: JsonRecord) => ProfileRow;
}>;

function asRecord(value: unknown): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as JsonRecord;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asStringList(value: unknown): string[] {
  return asArray(value).map((item) => String(item ?? "").trim()).filter((item) => item.length > 0);
}

function asErrorMessage(value: unknown, fallback: string): string {
  if (typeof value === "string" && value.trim()) return value;
  return fallback;
}

function nowIso(): string {
  return new Date().toISOString();
}

function emptyMeta(status = 0): CallMeta {
  return {
    status,
    requestId: "",
    correlationId: "",
    timestamp: nowIso(),
  };
}

function normaliseMeta(envelope: unknown, status = 200): CallMeta {
  const obj = asRecord(envelope);
  const meta = asRecord(obj.meta);
  return {
    status,
    requestId: String(meta.request_id ?? meta.requestId ?? "").trim(),
    correlationId: String(meta.correlation_id ?? meta.correlationId ?? "").trim(),
    timestamp: nowIso(),
  };
}

function success<T>(data: T, meta: CallMeta, raw: unknown): CallResult<T> {
  return {
    ok: true,
    data,
    errorCode: "",
    errorMessage: "",
    meta,
    raw,
  };
}

function failure<T>(errorCode: string, errorMessage: string, meta: CallMeta, raw: unknown): CallResult<T> {
  return {
    ok: false,
    data: null,
    errorCode,
    errorMessage,
    meta,
    raw,
  };
}

function parseApiEnvelope<T>(raw: unknown, fallbackErrorCode: string, fallbackErrorMessage: string): CallResult<T> {
  const envelope = asRecord(raw) as ApiEnvelope;
  const meta = normaliseMeta(envelope, 200);
  if (envelope.ok !== true) {
    const errors = Array.isArray(envelope.errors) ? envelope.errors : [];
    const first = asRecord(errors[0]);
    return failure(
      String(first.code ?? fallbackErrorCode),
      asErrorMessage(first.message, fallbackErrorMessage),
      meta,
      raw
    );
  }
  return success(envelope.result as T, meta, raw);
}

function parseToolEnvelope<T>(raw: unknown, fallbackErrorCode: string, fallbackErrorMessage: string): CallResult<T> {
  const outer = parseApiEnvelope<ToolEnvelope>(raw, fallbackErrorCode, fallbackErrorMessage);
  if (!outer.ok || !outer.data) {
    return failure(outer.errorCode, outer.errorMessage, outer.meta, raw);
  }

  const tool = asRecord(outer.data) as ToolEnvelope;
  if (tool.ok !== true) {
    const errors = Array.isArray(tool.errors) ? tool.errors : [];
    const first = asRecord(errors[0]);
    return failure(
      String(first.code ?? fallbackErrorCode),
      asErrorMessage(first.message, fallbackErrorMessage),
      outer.meta,
      raw
    );
  }

  return success(tool.result as T, outer.meta, raw);
}

function parseHealthResponse(raw: unknown): CallResult<HealthPayload> {
  const direct = asRecord(raw);
  if (typeof direct.status === "string") {
    return success(
      {
        status: String(direct.status),
        service: String(direct.service ?? ""),
        components: asRecord(direct.components),
      } satisfies HealthPayload,
      emptyMeta(200),
      raw
    );
  }

  return parseApiEnvelope<HealthPayload>(raw, "health_failed", "Failed to read service health.");
}

function parseLooseObject(raw: unknown, fallbackErrorCode: string, fallbackErrorMessage: string): CallResult<JsonRecord> {
  const record = asRecord(raw);
  if (Object.keys(record).length > 0 && typeof record.ok !== "boolean") {
    return success(record, emptyMeta(200), raw);
  }
  return parseApiEnvelope<JsonRecord>(raw, fallbackErrorCode, fallbackErrorMessage);
}

function parseStatusResponse(raw: unknown): CallResult<StatusRecord> {
  const record = asRecord(raw);
  if (typeof record.status === "string") {
    return success(
      {
        status: String(record.status),
        uptime: Number(record.uptime ?? 0),
        memory_mb: Number(record.memory_mb ?? 0),
        cpu_percent: Number(record.cpu_percent ?? 0),
        active_connections: Number(record.active_connections ?? 0),
        jobs: asRecord(record.jobs),
      } satisfies StatusRecord,
      emptyMeta(200),
      raw
    );
  }
  return parseApiEnvelope<StatusRecord>(raw, "status_failed", "Failed to load service status.");
}

function parseMcpToolResponse<T>(raw: unknown, toolName: string): CallResult<T> {
  const body = asRecord(raw);
  if (typeof body.ok !== "boolean") {
    return success(raw as T, emptyMeta(200), raw);
  }

  const meta = normaliseMeta({ meta: body.meta ?? {} }, 200);
  if (body.ok) {
    return success((body.result as T) ?? ({} as T), meta, raw);
  }

  const errors = Array.isArray(body.errors) ? body.errors : [];
  const first = asRecord(errors[0]);
  return failure(
    String(first.code ?? "mcp_tool_failed"),
    asErrorMessage(first.message, `MCP tool ${toolName} failed.`),
    meta,
    raw
  );
}

function toApiErrorResult<T>(error: unknown, fallbackErrorCode: string, fallbackErrorMessage: string): CallResult<T> {
  if (error instanceof ApiError) {
    return failure(
      fallbackErrorCode,
      asErrorMessage(error.message, fallbackErrorMessage),
      {
        status: error.options.status,
        requestId: String(error.options.requestId ?? "").trim(),
        correlationId: String(error.options.correlationId ?? error.options.requestId ?? "").trim(),
        timestamp: nowIso(),
      },
      error.options.details
    );
  }
  return failure(
    fallbackErrorCode,
    error instanceof Error ? error.message : fallbackErrorMessage,
    emptyMeta(),
    error
  );
}

function profileField(profile: JsonRecord, keys: string[]): string {
  for (const key of keys) {
    const value = profile[key];
    if (typeof value === "string" && value.trim()) return value;
    if (typeof value === "number") return String(value);
  }
  return "";
}

function trace(event: Omit<TraceEvent, "timestamp">, onTrace: ((event: TraceEvent) => void) | undefined): void {
  if (!onTrace) return;
  onTrace({ ...event, timestamp: nowIso() });
}

function parseToolList(raw: unknown): ToolDescriptor[] {
  const root = asRecord(raw);
  const result = asRecord(root.result);
  const rows = Array.isArray(raw)
    ? raw
    : Array.isArray(root.data)
      ? (root.data as unknown[])
      : Array.isArray(result.items)
        ? (result.items as unknown[])
        : [];
  const out: ToolDescriptor[] = [];
  for (const item of rows) {
    const row = asRecord(item);
    const name = String(row.name ?? "").trim();
    if (!name) continue;
    const schema = row.inputSchema ?? row.input_schema;
    out.push({
      name,
      description: String(row.description ?? ""),
      input_schema: schema && typeof schema === "object" ? (schema as Record<string, unknown>) : undefined,
    });
  }
  return out;
}

function parseUserRow(raw: unknown): UserRow {
  const row = asRecord(raw);
  const role = String(row.role ?? "").trim();
  const roles = asStringList(row.roles);
  if (role && !roles.includes(role)) roles.unshift(role);
  return {
    userId: String(row.user_id ?? "").trim(),
    username: String(row.username ?? "").trim(),
    email: String(row.email ?? "").trim(),
    displayName: String(row.display_name ?? row.username ?? "").trim(),
    roles,
    createdAt: String(row.created_at ?? row.createdAt ?? "").trim(),
  };
}

function parseGroupRow(raw: unknown): GroupRow {
  const row = asRecord(raw);
  const activeRaw = row.active;
  return {
    groupId: String(row.group_id ?? "").trim(),
    name: String(row.name ?? "").trim(),
    description: String(row.description ?? "").trim(),
    roles: asStringList(row.roles),
    members: asStringList(row.members),
    createdAt: String(row.created_at ?? row.createdAt ?? "").trim(),
    ...(typeof activeRaw === "boolean" ? { active: activeRaw } : {}),
  };
}

function parseManagedApiKeyRow(raw: unknown): ManagedApiKeyRow {
  const row = asRecord(raw);
  return {
    apiKeyId: String(row.api_key_id ?? "").trim(),
    ownerUserId: String(row.owner_user_id ?? "").trim(),
    description: String(row.description ?? "").trim(),
    scopes: asStringList(row.scopes),
    status: String(row.status ?? "").trim(),
    rawKey: String(row.raw_key ?? "").trim(),
  };
}

function parseAuditEventRow(raw: unknown): AuditEventRow {
  const row = asRecord(raw);
  const actor = asRecord(row.actor);
  const target = asRecord(row.target);
  return {
    timestamp: String(row.timestamp ?? "").trim(),
    eventType: String(row.event_type ?? "").trim(),
    action: String(row.action ?? row.event ?? "").trim(),
    outcome: String(row.outcome ?? row.status ?? "").trim(),
    severity: String(row.severity ?? "").trim(),
    traceId: String(row.trace_id ?? "").trim(),
    requestId: String(row.request_id ?? "").trim(),
    actorType: String(actor.type ?? "").trim(),
    operation: String(row.operation ?? row.event ?? "").trim(),
    status: String(row.status ?? row.outcome ?? "").trim(),
    actorId: String(actor.actor_id ?? actor.id ?? "").trim(),
    actorRoles: asStringList(actor.roles),
    actorIp: String(actor.ip ?? "").trim(),
    actorUserAgent: String(actor.user_agent ?? "").trim(),
    targetType: String(row.target_type ?? target.type ?? "").trim(),
    targetId: String(row.target_id ?? target.id ?? "").trim(),
    targetName: String(target.name ?? "").trim(),
    correlationId: String(row.correlation_id ?? "").trim(),
    service: String(row.service ?? "").trim(),
    serviceInstance: String(row.service_instance ?? "").trim(),
    details: asRecord(row.details),
    raw: row,
  };
}

function parseServerLogRow(raw: unknown): ServerLogRow {
  const row = asRecord(raw);
  const actor = asRecord(row.actor);
  const target = asRecord(row.target);
  const timestamp = String(row.timestamp ?? "").trim();
  const source = String(row.source ?? "").trim();
  const eventType = String(row.event_type ?? "").trim();
  const action = String(row.action ?? "").trim();
  const correlationId = String(row.correlation_id ?? "").trim();
  return {
    id: `${source}-${timestamp}-${correlationId || action || eventType}`,
    source,
    timestamp,
    eventType,
    action,
    outcome: String(row.outcome ?? "").trim(),
    severity: String(row.severity ?? "").trim(),
    traceId: String(row.trace_id ?? "").trim(),
    requestId: String(row.request_id ?? "").trim(),
    actorType: String(actor.type ?? "").trim(),
    actorId: String(actor.id ?? "").trim(),
    actorRoles: asStringList(actor.roles),
    actorIp: String(actor.ip ?? "").trim(),
    actorUserAgent: String(actor.user_agent ?? "").trim(),
    targetType: String(target.type ?? "").trim(),
    targetId: String(target.id ?? "").trim(),
    targetName: String(target.name ?? "").trim(),
    correlationId,
    service: String(row.service ?? "").trim(),
    serviceInstance: String(row.service_instance ?? "").trim(),
    logger: String(row.logger ?? "").trim(),
    message: String(row.message ?? "").trim(),
    details: asRecord(row.details),
    raw: row,
  };
}

function parseJobRow(raw: unknown): JobRecord {
  const row = asRecord(raw);
  return {
    jobId: String(row.job_id ?? "").trim(),
    jobType: String(row.job_type ?? "").trim(),
    queueName: String(row.queue_name ?? "").trim(),
    profileId: String(row.profile_id ?? "").trim(),
    mailbox: String(row.mailbox ?? "").trim(),
    status: String(row.status ?? "").trim(),
    claimedBy: String(row.claimed_by ?? "").trim(),
    attempts: Number(row.attempts ?? 0),
    attempt: Number(row.attempt ?? row.attempts ?? 0),
    maxAttempts: Number(row.max_attempts ?? 0),
    priority: Number(row.priority ?? 0),
    lastError: String(row.last_error ?? "").trim(),
    serverId: String(row.server_id ?? "").trim(),
    createdAtUtc: String(row.created_at_utc ?? "").trim(),
    updatedAtUtc: String(row.updated_at_utc ?? "").trim(),
    startedAtUtc: String(row.started_at_utc ?? "").trim(),
    finishedAtUtc: String(row.finished_at_utc ?? "").trim(),
    correlationId: String(row.correlation_id ?? "").trim(),
    userId: String(row.user_id ?? "").trim(),
    requestSource: String(row.request_source ?? "").trim(),
    requestAuthMethod: String(row.request_auth_method ?? "").trim(),
    requestAuthIdentity: String(row.request_auth_identity ?? "").trim(),
    traceId: String(row.trace_id ?? "").trim(),
    progressPct: Number(row.progress_pct ?? 0),
    progressStage: String(row.progress_stage ?? "").trim(),
    payload: asRecord(row.payload),
    result: Object.keys(asRecord(row.result)).length > 0 ? asRecord(row.result) : null,
  };
}

function parseJobQueueStatus(raw: unknown): JobQueueStatus {
  const row = asRecord(raw);
  const counts = asRecord(row.counts);
  return {
    backend: String(row.backend ?? "").trim(),
    healthy: Boolean(row.healthy),
    trackedJobs: Number(row.tracked_jobs ?? 0),
    serverId: String(row.server_id ?? "").trim(),
    counts: Object.fromEntries(
      Object.entries(counts).map(([key, value]) => [key, Number(value ?? 0)])
    ),
  };
}

function formatActionId(prefix: string, id: string): string {
  return `${prefix}:${id}`;
}

export async function validateApiKey(
  apiBaseUrl: string,
  apiKey: string,
  authMode: "api_key" | "cookie" | "oidc" = "api_key"
): Promise<void> {
  const key = apiKey.trim();
  if (!key) throw new Error("API key is required.");

  const probe = createApiClient({ baseUrl: apiBaseUrl });
  const headers = {
    "x-api-key": key,
    "x-role": "admin",
    "x-user-roles": "admin",
    Authorization: `Bearer ${key}`,
  };
  const paths = authMode === "cookie" ? ["/webapi/v1/tools"] : ["/api/v1/tools", "/webapi/v1/tools"];
  let lastError: unknown = null;
  for (const path of paths) {
    try {
      await probe.get(path, { headers });
      return;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("API key validation failed.");
}

export function isBrowserProxySurface(): boolean {
  return typeof window !== "undefined";
}

function useWebSurface(authMode: "api_key" | "cookie" | "oidc"): boolean {
  return authMode === "cookie" || isBrowserProxySurface();
}

export function apiSurfacePaths(authMode: "api_key" | "cookie" | "oidc") {
  const browserMode = useWebSurface(authMode);
  return {
    apiPath: browserMode ? "/webapi/v1" : "/api/v1",
    mcpPath: browserMode ? "/webmcp/tools" : "/mcp/tools",
    a2aPath: browserMode ? "/weba2a/tools" : "/a2a/tools",
  };
}

function authenticatedHeaders(key: string) {
  return {
    "x-api-key": key,
    "x-role": "admin",
    "x-user-roles": "admin",
    Authorization: `Bearer ${key}`,
  };
}

export async function validateApiKeyOnPath(apiBaseUrl: string, apiKey: string, path: string): Promise<void> {
  const key = apiKey.trim();
  if (!key) throw new Error("API key is required.");
  const probe = createApiClient({ baseUrl: apiBaseUrl });
  await probe.get(path, {
    headers: {
      ...authenticatedHeaders(key),
    },
  });
}

export function createImapMcpApi(opts: {
  apiBaseUrl: string;
  mcpBaseUrl: string;
  a2aBaseUrl: string;
  authMode: "api_key" | "cookie" | "oidc";
  getApiKey: () => string;
  getRole: () => string;
  onTrace?: (event: TraceEvent) => void;
  onAuthError?: () => void;
}): ImapMcpApi {
  const preferSameOriginProxy = typeof window !== "undefined";
  const apiClient = createApiClient({
    baseUrl: opts.apiBaseUrl,
    getAccessToken: () => opts.getApiKey() || null,
  });
  const mcpClient = createApiClient({
    baseUrl: preferSameOriginProxy ? opts.apiBaseUrl : opts.mcpBaseUrl,
    getAccessToken: () => opts.getApiKey() || null,
  });
  const a2aClient = createApiClient({
    baseUrl: preferSameOriginProxy ? opts.apiBaseUrl : opts.a2aBaseUrl,
    getAccessToken: () => opts.getApiKey() || null,
  });
  const { apiPath, mcpPath, a2aPath } = apiSurfacePaths(opts.authMode);

  const apiHeaders = (apiKeyOverride = ""): Record<string, string> | undefined => {
    const overrideKey = apiKeyOverride.trim();
    const key = overrideKey || opts.getApiKey().trim();
    if (!key) return undefined;
    if (overrideKey) {
      return {
        "x-api-key": key,
        Authorization: `Bearer ${key}`,
      };
    }
    const role = opts.getRole().trim() || "admin";
    return {
      "x-api-key": key,
      "x-role": role,
      "x-user-roles": role,
      Authorization: `Bearer ${key}`,
    };
  };

  const authGuard = <T>(result: CallResult<T>): CallResult<T> => {
    if (result.meta.status === 401) {
      opts.onAuthError?.();
    }
    return result;
  };

  const runTrace = <T>(scope: TraceEvent["scope"], action: string, result: CallResult<T>): CallResult<T> => {
    trace(
      {
        scope,
        action,
        ok: result.ok,
        errorCode: result.errorCode,
        errorMessage: result.errorMessage,
        status: result.meta.status,
        requestId: result.meta.requestId,
        correlationId: result.meta.correlationId,
      },
      opts.onTrace
    );
    return result;
  };

  const runApi = async <T>(action: string, fn: () => Promise<CallResult<T>>): Promise<CallResult<T>> => {
    return runTrace("api", action, authGuard(await fn()));
  };

  const runMcp = async <T>(action: string, fn: () => Promise<CallResult<T>>): Promise<CallResult<T>> => {
    return runTrace("mcp", action, authGuard(await fn()));
  };

  const runA2A = async <T>(action: string, fn: () => Promise<CallResult<T>>): Promise<CallResult<T>> => {
    return runTrace("a2a", action, authGuard(await fn()));
  };

  const callTool = async <T>(toolName: string, payload: JsonRecord): Promise<CallResult<T>> => {
    return runApi(`tool:${toolName}`, async () => {
      try {
        const raw = await apiClient.post<unknown>(`${apiPath}/tools/${toolName}`, payload, { headers: apiHeaders() });
        return parseToolEnvelope<T>(raw, "tool_failed", `Tool ${toolName} failed.`);
      } catch (error) {
        return toApiErrorResult<T>(error, "tool_http_failed", `Tool ${toolName} request failed.`);
      }
    });
  };

  return {
    getHealth: () =>
      runApi("health", async () => {
        try {
          const raw = await apiClient.get<unknown>("/health", { headers: apiHeaders() });
          return parseHealthResponse(raw);
        } catch (error) {
          return toApiErrorResult<HealthPayload>(error, "health_http_failed", "Health request failed.");
        }
      }),

    listApiTools: () =>
      runApi("tools:list", async () => {
        try {
          const raw = await apiClient.get<unknown>(`${apiPath}/tools`, { headers: apiHeaders() });
          const parsed = parseApiEnvelope<{ items?: unknown[] }>(raw, "tools_failed", "Failed to list API tools.");
          if (!parsed.ok || !parsed.data) return failure(parsed.errorCode, parsed.errorMessage, parsed.meta, raw);
          const items = asArray(parsed.data.items).map((item) => {
            const row = asRecord(item);
            const name = String(row.name ?? "").trim();
            if (!name) return null;
            const schema = row.inputSchema ?? row.input_schema;
            const descriptor: ToolDescriptor = {
              name,
              description: String(row.description ?? ""),
              ...(schema && typeof schema === "object" ? { input_schema: schema as Record<string, unknown> } : {}),
            };
            return descriptor;
          }).filter((item): item is ToolDescriptor => item !== null);
          return success(items, parsed.meta, raw);
        } catch (error) {
          return toApiErrorResult<ToolDescriptor[]>(error, "tools_http_failed", "Tool catalogue request failed.");
        }
      }),

    listMcpTools: () =>
      runMcp("mcp:tools:list", async () => {
        try {
          const raw = await mcpClient.get<unknown>(mcpPath, { headers: apiHeaders() });
          return success(parseToolList(raw), emptyMeta(200), raw);
        } catch (error) {
          return toApiErrorResult<ToolDescriptor[]>(error, "mcp_tools_failed", "Failed to list MCP tools.");
        }
      }),

    listA2ATools: () =>
      runA2A("a2a:tools:list", async () => {
        try {
          const raw = await a2aClient.get<unknown>(a2aPath, { headers: apiHeaders() });
          const parsed = parseApiEnvelope<{ items?: unknown[] }>(raw, "a2a_tools_failed", "Failed to list A2A tools.");
          if (!parsed.ok || !parsed.data) return failure(parsed.errorCode, parsed.errorMessage, parsed.meta, raw);
          const items = asArray(parsed.data.items).map((item) => {
            const row = asRecord(item);
            const name = String(row.name ?? "").trim();
            if (!name) return null;
            const schema = row.inputSchema ?? row.input_schema;
            const descriptor: ToolDescriptor = {
              name,
              description: String(row.description ?? ""),
              ...(schema && typeof schema === "object" ? { input_schema: schema as Record<string, unknown> } : {}),
            };
            return descriptor;
          }).filter((item): item is ToolDescriptor => item !== null);
          return success(items, parsed.meta, raw);
        } catch (error) {
          return toApiErrorResult<ToolDescriptor[]>(error, "a2a_tools_http_failed", "A2A tool catalogue request failed.");
        }
      }),

    callTool,

    callMcpTool: <T>(toolName: string, payload: JsonRecord, apiKeyOverride = "") =>
      runMcp(`mcp:tool:${toolName}`, async () => {
        try {
          const raw = await mcpClient.post<unknown>(`${mcpPath}/${toolName}`, payload, { headers: apiHeaders(apiKeyOverride) });
          return parseMcpToolResponse<T>(raw, toolName);
        } catch (error) {
          return toApiErrorResult<T>(error, "mcp_tool_http_failed", `MCP tool ${toolName} request failed.`);
        }
      }),

    listProfiles: () =>
      runApi("profiles:list", async () => {
        try {
          const raw = await apiClient.get<unknown>(`${apiPath}/admin/profiles`, { headers: apiHeaders() });
          const parsed = parseApiEnvelope<{ profiles?: unknown[] }>(raw, "profiles_failed", "Failed to list profiles.");
          if (!parsed.ok || !parsed.data) return failure(parsed.errorCode, parsed.errorMessage, parsed.meta, raw);
          const ids = asArray(parsed.data.profiles).map((item) => String(item ?? "")).filter((item) => item.trim().length > 0);
          return success(ids, parsed.meta, raw);
        } catch (error) {
          return toApiErrorResult<string[]>(error, "profiles_http_failed", "Profile list request failed.");
        }
      }),

    getProfile: (profileId: string) =>
      runApi(formatActionId("profiles:get", profileId), async () => {
        try {
          const raw = await apiClient.get<unknown>(`${apiPath}/admin/profiles/${encodeURIComponent(profileId)}`, { headers: apiHeaders() });
          return parseApiEnvelope<JsonRecord>(raw, "profile_get_failed", `Failed to read profile ${profileId}.`);
        } catch (error) {
          return toApiErrorResult<JsonRecord>(error, "profile_get_http_failed", `Profile ${profileId} request failed.`);
        }
      }),

    upsertProfile: (profileId: string, payload: JsonRecord) =>
      runApi(formatActionId("profiles:put", profileId), async () => {
        try {
          const raw = await apiClient.put<unknown>(`${apiPath}/admin/profiles/${encodeURIComponent(profileId)}`, payload, { headers: apiHeaders() });
          return parseApiEnvelope<JsonRecord>(raw, "profile_put_failed", `Failed to save profile ${profileId}.`);
        } catch (error) {
          return toApiErrorResult<JsonRecord>(error, "profile_put_http_failed", `Profile ${profileId} save failed.`);
        }
      }),

    deleteProfile: (profileId: string) =>
      runApi(formatActionId("profiles:delete", profileId), async () => {
        try {
          const raw = await apiClient.delete<unknown>(`${apiPath}/admin/profiles/${encodeURIComponent(profileId)}`, { headers: apiHeaders() });
          return parseApiEnvelope<JsonRecord>(raw, "profile_delete_failed", `Failed to delete profile ${profileId}.`);
        } catch (error) {
          return toApiErrorResult<JsonRecord>(error, "profile_delete_http_failed", `Profile ${profileId} delete failed.`);
        }
      }),

    listUsers: () =>
      runApi("users:list", async () => {
        try {
          const raw = await apiClient.get<unknown>(`${apiPath}/admin/users`, { headers: apiHeaders() });
          const parsed = parseApiEnvelope<{ items?: unknown[] }>(raw, "users_failed", "Failed to list users.");
          if (!parsed.ok || !parsed.data) return failure(parsed.errorCode, parsed.errorMessage, parsed.meta, raw);
          return success(asArray(parsed.data.items).map(parseUserRow), parsed.meta, raw);
        } catch (error) {
          return toApiErrorResult<UserRow[]>(error, "users_http_failed", "User list request failed.");
        }
      }),

    getUser: (userId: string) =>
      runApi(formatActionId("users:get", userId), async () => {
        try {
          const raw = await apiClient.get<unknown>(`${apiPath}/admin/users/${encodeURIComponent(userId)}`, { headers: apiHeaders() });
          const parsed = parseApiEnvelope<JsonRecord>(raw, "user_get_failed", `Failed to read user ${userId}.`);
          if (!parsed.ok || !parsed.data) return failure(parsed.errorCode, parsed.errorMessage, parsed.meta, raw);
          return success(parseUserRow(parsed.data), parsed.meta, raw);
        } catch (error) {
          return toApiErrorResult<UserRow>(error, "user_get_http_failed", `User ${userId} request failed.`);
        }
      }),

    createUser: (payload: JsonRecord) =>
      runApi("users:create", async () => {
        try {
          const raw = await apiClient.post<unknown>(`${apiPath}/admin/users`, payload, { headers: apiHeaders() });
          const parsed = parseApiEnvelope<JsonRecord>(raw, "user_create_failed", "Failed to create user.");
          if (!parsed.ok || !parsed.data) return failure(parsed.errorCode, parsed.errorMessage, parsed.meta, raw);
          return success(parseUserRow(parsed.data), parsed.meta, raw);
        } catch (error) {
          return toApiErrorResult<UserRow>(error, "user_create_http_failed", "User create request failed.");
        }
      }),

    updateUser: (userId: string, payload: JsonRecord) =>
      runApi(formatActionId("users:update", userId), async () => {
        try {
          const raw = await apiClient.put<unknown>(`${apiPath}/admin/users/${encodeURIComponent(userId)}`, payload, { headers: apiHeaders() });
          const parsed = parseApiEnvelope<JsonRecord>(raw, "user_update_failed", `Failed to update user ${userId}.`);
          if (!parsed.ok || !parsed.data) return failure(parsed.errorCode, parsed.errorMessage, parsed.meta, raw);
          return success(parseUserRow(parsed.data), parsed.meta, raw);
        } catch (error) {
          return toApiErrorResult<UserRow>(error, "user_update_http_failed", `User ${userId} update failed.`);
        }
      }),

    deleteUser: (userId: string) =>
      runApi(formatActionId("users:delete", userId), async () => {
        try {
          const raw = await apiClient.delete<unknown>(`${apiPath}/admin/users/${encodeURIComponent(userId)}`, { headers: apiHeaders() });
          return parseApiEnvelope<JsonRecord>(raw, "user_delete_failed", `Failed to delete user ${userId}.`);
        } catch (error) {
          return toApiErrorResult<JsonRecord>(error, "user_delete_http_failed", `User ${userId} delete failed.`);
        }
      }),

    listGroups: () =>
      runApi("groups:list", async () => {
        try {
          const raw = await apiClient.get<unknown>(`${apiPath}/admin/groups`, { headers: apiHeaders() });
          const parsed = parseApiEnvelope<{ items?: unknown[] }>(raw, "groups_failed", "Failed to list groups.");
          if (!parsed.ok || !parsed.data) return failure(parsed.errorCode, parsed.errorMessage, parsed.meta, raw);
          return success(asArray(parsed.data.items).map(parseGroupRow), parsed.meta, raw);
        } catch (error) {
          return toApiErrorResult<GroupRow[]>(error, "groups_http_failed", "Group list request failed.");
        }
      }),

    getGroup: (groupId: string) =>
      runApi(formatActionId("groups:get", groupId), async () => {
        try {
          const raw = await apiClient.get<unknown>(`${apiPath}/admin/groups/${encodeURIComponent(groupId)}`, { headers: apiHeaders() });
          const parsed = parseApiEnvelope<JsonRecord>(raw, "group_get_failed", `Failed to read group ${groupId}.`);
          if (!parsed.ok || !parsed.data) return failure(parsed.errorCode, parsed.errorMessage, parsed.meta, raw);
          return success(parseGroupRow(parsed.data), parsed.meta, raw);
        } catch (error) {
          return toApiErrorResult<GroupRow>(error, "group_get_http_failed", `Group ${groupId} request failed.`);
        }
      }),

    createGroup: (payload: JsonRecord) =>
      runApi("groups:create", async () => {
        try {
          const raw = await apiClient.post<unknown>(`${apiPath}/admin/groups`, payload, { headers: apiHeaders() });
          const parsed = parseApiEnvelope<JsonRecord>(raw, "group_create_failed", "Failed to create group.");
          if (!parsed.ok || !parsed.data) return failure(parsed.errorCode, parsed.errorMessage, parsed.meta, raw);
          return success(parseGroupRow(parsed.data), parsed.meta, raw);
        } catch (error) {
          return toApiErrorResult<GroupRow>(error, "group_create_http_failed", "Group create request failed.");
        }
      }),

    updateGroup: (groupId: string, payload: JsonRecord) =>
      runApi(formatActionId("groups:update", groupId), async () => {
        try {
          const raw = await apiClient.put<unknown>(`${apiPath}/admin/groups/${encodeURIComponent(groupId)}`, payload, { headers: apiHeaders() });
          const parsed = parseApiEnvelope<JsonRecord>(raw, "group_update_failed", `Failed to update group ${groupId}.`);
          if (!parsed.ok || !parsed.data) return failure(parsed.errorCode, parsed.errorMessage, parsed.meta, raw);
          return success(parseGroupRow(parsed.data), parsed.meta, raw);
        } catch (error) {
          return toApiErrorResult<GroupRow>(error, "group_update_http_failed", `Group ${groupId} update failed.`);
        }
      }),

    deleteGroup: (groupId: string) =>
      runApi(formatActionId("groups:delete", groupId), async () => {
        try {
          const raw = await apiClient.delete<unknown>(`${apiPath}/admin/groups/${encodeURIComponent(groupId)}`, { headers: apiHeaders() });
          return parseApiEnvelope<JsonRecord>(raw, "group_delete_failed", `Failed to delete group ${groupId}.`);
        } catch (error) {
          return toApiErrorResult<JsonRecord>(error, "group_delete_http_failed", `Group ${groupId} delete failed.`);
        }
      }),

    addGroupMember: (groupId: string, userId: string) =>
      runApi(formatActionId("groups:add_member", groupId), async () => {
        try {
          const raw = await apiClient.post<unknown>(`${apiPath}/admin/groups/${encodeURIComponent(groupId)}/members`, { user_id: userId }, { headers: apiHeaders() });
          const parsed = parseApiEnvelope<JsonRecord>(raw, "group_add_member_failed", `Failed to add member to ${groupId}.`);
          if (!parsed.ok || !parsed.data) return failure(parsed.errorCode, parsed.errorMessage, parsed.meta, raw);
          return success(parseGroupRow(parsed.data), parsed.meta, raw);
        } catch (error) {
          return toApiErrorResult<GroupRow>(error, "group_add_member_http_failed", `Failed to add member to ${groupId}.`);
        }
      }),

    removeGroupMember: (groupId: string, userId: string) =>
      runApi(formatActionId("groups:remove_member", groupId), async () => {
        try {
          const raw = await apiClient.delete<unknown>(`${apiPath}/admin/groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(userId)}`, { headers: apiHeaders() });
          const parsed = parseApiEnvelope<JsonRecord>(raw, "group_remove_member_failed", `Failed to remove member from ${groupId}.`);
          if (!parsed.ok || !parsed.data) return failure(parsed.errorCode, parsed.errorMessage, parsed.meta, raw);
          return success(parseGroupRow(parsed.data), parsed.meta, raw);
        } catch (error) {
          return toApiErrorResult<GroupRow>(error, "group_remove_member_http_failed", `Failed to remove member from ${groupId}.`);
        }
      }),

    listApiKeys: () =>
      runApi("api_keys:list", async () => {
        try {
          const raw = await apiClient.get<unknown>(`${apiPath}/admin/api-keys`, { headers: apiHeaders() });
          const parsed = parseApiEnvelope<{ items?: unknown[] }>(raw, "api_keys_failed", "Failed to list API keys.");
          if (!parsed.ok || !parsed.data) return failure(parsed.errorCode, parsed.errorMessage, parsed.meta, raw);
          return success(asArray(parsed.data.items).map(parseManagedApiKeyRow), parsed.meta, raw);
        } catch (error) {
          return toApiErrorResult<ManagedApiKeyRow[]>(error, "api_keys_http_failed", "API key list request failed.");
        }
      }),

    createApiKey: (payload: JsonRecord) =>
      runApi("api_keys:create", async () => {
        try {
          const raw = await apiClient.post<unknown>(`${apiPath}/admin/api-keys`, payload, { headers: apiHeaders() });
          const parsed = parseApiEnvelope<JsonRecord>(raw, "api_key_create_failed", "Failed to create API key.");
          if (!parsed.ok || !parsed.data) return failure(parsed.errorCode, parsed.errorMessage, parsed.meta, raw);
          return success(parseManagedApiKeyRow(parsed.data), parsed.meta, raw);
        } catch (error) {
          return toApiErrorResult<ManagedApiKeyRow>(error, "api_key_create_http_failed", "API key create request failed.");
        }
      }),

    revokeApiKey: (apiKeyId: string) =>
      runApi(formatActionId("api_keys:revoke", apiKeyId), async () => {
        try {
          const raw = await apiClient.delete<unknown>(`${apiPath}/admin/api-keys/${encodeURIComponent(apiKeyId)}`, { headers: apiHeaders() });
          return parseApiEnvelope<JsonRecord>(raw, "api_key_revoke_failed", `Failed to revoke API key ${apiKeyId}.`);
        } catch (error) {
          return toApiErrorResult<JsonRecord>(error, "api_key_revoke_http_failed", `API key ${apiKeyId} revoke failed.`);
        }
      }),

    getRbacPolicies: () =>
      runApi("rbac:get", async () => {
        try {
          const raw = await apiClient.get<unknown>(`${apiPath}/admin/rbac/policies`, { headers: apiHeaders() });
          return parseApiEnvelope<JsonRecord>(raw, "rbac_get_failed", "Failed to read RBAC policies.");
        } catch (error) {
          return toApiErrorResult<JsonRecord>(error, "rbac_get_http_failed", "RBAC read request failed.");
        }
      }),

    putRbacPolicies: (payload: JsonRecord) =>
      runApi("rbac:put", async () => {
        try {
          const raw = await apiClient.put<unknown>(`${apiPath}/admin/rbac/policies`, payload, { headers: apiHeaders() });
          return parseApiEnvelope<JsonRecord>(raw, "rbac_put_failed", "Failed to save RBAC policies.");
        } catch (error) {
          return toApiErrorResult<JsonRecord>(error, "rbac_put_http_failed", "RBAC save request failed.");
        }
      }),

    listAuditEvents: (limit: number, contains: string) =>
      runApi("audit:list", async () => {
        try {
          const query = new URLSearchParams({ limit: String(limit), contains }).toString();
          const raw = await apiClient.get<unknown>(`${apiPath}/admin/audit/events?${query}`, { headers: apiHeaders() });
          const parsed = parseApiEnvelope<{ items?: unknown[] }>(raw, "audit_list_failed", "Failed to list audit events.");
          if (!parsed.ok || !parsed.data) return failure(parsed.errorCode, parsed.errorMessage, parsed.meta, raw);
          return success(asArray(parsed.data.items).map(parseAuditEventRow), parsed.meta, raw);
        } catch (error) {
          return toApiErrorResult<AuditEventRow[]>(error, "audit_list_http_failed", "Audit event query failed.");
        }
      }),

    listServerLogs: (logType: string, lines: number, contains: string) =>
      runApi("logs:list", async () => {
        try {
          const query = new URLSearchParams({
            log_type: logType,
            lines: String(lines),
            contains,
          }).toString();
          const raw = await apiClient.get<unknown>(`${apiPath}/admin/logs?${query}`, { headers: apiHeaders() });
          const parsed = parseApiEnvelope<{ items?: unknown[] }>(raw, "log_list_failed", "Failed to list server logs.");
          if (!parsed.ok || !parsed.data) return failure(parsed.errorCode, parsed.errorMessage, parsed.meta, raw);
          return success(asArray(parsed.data.items).map(parseServerLogRow), parsed.meta, raw);
        } catch (error) {
          return toApiErrorResult<ServerLogRow[]>(error, "log_list_http_failed", "Server log query failed.");
        }
      }),

    getSettings: () =>
      runApi("settings:get", async () => {
        try {
          const raw = await apiClient.get<unknown>(`${apiPath}/admin/settings`, { headers: apiHeaders() });
          return parseApiEnvelope<SettingsRecord>(raw, "settings_get_failed", "Failed to load settings.");
        } catch (error) {
          return toApiErrorResult<SettingsRecord>(error, "settings_get_http_failed", "Settings request failed.");
        }
      }),

    updateSettings: (payload: JsonRecord) =>
      runApi("settings:update", async () => {
        try {
          const raw = await apiClient.put<unknown>(`${apiPath}/admin/settings`, payload, { headers: apiHeaders() });
          return parseApiEnvelope<SettingsRecord>(raw, "settings_update_failed", "Failed to save settings.");
        } catch (error) {
          return toApiErrorResult<SettingsRecord>(error, "settings_update_http_failed", "Settings save request failed.");
        }
      }),

    getVersion: () =>
      runApi("version:get", async () => {
        try {
          const raw = await apiClient.get<unknown>(`${apiPath}/version`, { headers: apiHeaders() });
          return parseLooseObject(raw, "version_failed", "Failed to load version.");
        } catch (error) {
          return toApiErrorResult<VersionRecord>(error, "version_http_failed", "Version request failed.");
        }
      }),

    getStatus: () =>
      runApi("status:get", async () => {
        try {
          const raw = await apiClient.get<unknown>("/status", { headers: apiHeaders() });
          return parseStatusResponse(raw);
        } catch (error) {
          return toApiErrorResult<StatusRecord>(error, "status_http_failed", "Status request failed.");
        }
      }),

    listJobs: () =>
      runApi("jobs:list", async () => {
        try {
          const raw = await apiClient.get<unknown>(`${apiPath}/admin/jobs`, { headers: apiHeaders() });
          const parsed = parseApiEnvelope<{ items?: unknown[] }>(raw, "jobs_failed", "Failed to load jobs.");
          if (!parsed.ok || !parsed.data) return failure(parsed.errorCode, parsed.errorMessage, parsed.meta, raw);
          return success(asArray(parsed.data.items).map(parseJobRow), parsed.meta, raw);
        } catch (error) {
          return toApiErrorResult<JobRecord[]>(error, "jobs_http_failed", "Jobs request failed.");
        }
      }),

    getJob: (jobId: string) =>
      runApi("jobs:get", async () => {
        try {
          const raw = await apiClient.get<unknown>(`${apiPath}/admin/jobs/${encodeURIComponent(jobId)}`, { headers: apiHeaders() });
          const parsed = parseApiEnvelope<unknown>(raw, "job_get_failed", "Failed to load job.");
          if (!parsed.ok || !parsed.data) return failure(parsed.errorCode, parsed.errorMessage, parsed.meta, raw);
          return success(parseJobRow(parsed.data), parsed.meta, raw);
        } catch (error) {
          return toApiErrorResult<JobRecord>(error, "job_get_http_failed", "Job request failed.");
        }
      }),

    getJobQueueStatus: () =>
      runApi("jobs:queue-status", async () => {
        try {
          const raw = await apiClient.get<unknown>(`${apiPath}/admin/jobs/queue/status`, { headers: apiHeaders() });
          const parsed = parseApiEnvelope<unknown>(raw, "jobs_queue_status_failed", "Failed to load queue status.");
          if (!parsed.ok || !parsed.data) return failure(parsed.errorCode, parsed.errorMessage, parsed.meta, raw);
          return success(parseJobQueueStatus(parsed.data), parsed.meta, raw);
        } catch (error) {
          return toApiErrorResult<JobQueueStatus>(error, "jobs_queue_status_http_failed", "Queue status request failed.");
        }
      }),

    cancelJob: (jobId: string) =>
      runApi("jobs:cancel", async () => {
        try {
          const raw = await apiClient.post<unknown>(`${apiPath}/admin/jobs/${encodeURIComponent(jobId)}/cancel`, {}, { headers: apiHeaders() });
          return parseApiEnvelope<JsonRecord>(raw, "job_cancel_failed", "Failed to cancel job.");
        } catch (error) {
          return toApiErrorResult<JsonRecord>(error, "job_cancel_http_failed", "Cancel job request failed.");
        }
      }),

    retryJob: (jobId: string) =>
      runApi("jobs:retry", async () => {
        try {
          const raw = await apiClient.post<unknown>(`${apiPath}/admin/jobs/${encodeURIComponent(jobId)}/retry`, {}, { headers: apiHeaders() });
          return parseApiEnvelope<JsonRecord>(raw, "job_retry_failed", "Failed to retry job.");
        } catch (error) {
          return toApiErrorResult<JsonRecord>(error, "job_retry_http_failed", "Retry job request failed.");
        }
      }),

    deleteJob: (jobId: string) =>
      runApi("jobs:delete", async () => {
        try {
          const raw = await apiClient.delete<unknown>(`${apiPath}/admin/jobs/${encodeURIComponent(jobId)}`, { headers: apiHeaders() });
          return parseApiEnvelope<JsonRecord>(raw, "job_delete_failed", "Failed to delete job.");
        } catch (error) {
          return toApiErrorResult<JsonRecord>(error, "job_delete_http_failed", "Delete job request failed.");
        }
      }),

    archiveJob: (jobId: string) =>
      runApi("jobs:archive", async () => {
        try {
          const raw = await apiClient.post<unknown>(`${apiPath}/admin/jobs/${encodeURIComponent(jobId)}/archive`, {}, { headers: apiHeaders() });
          return parseApiEnvelope<JsonRecord>(raw, "job_archive_failed", "Failed to archive job.");
        } catch (error) {
          return toApiErrorResult<JsonRecord>(error, "job_archive_http_failed", "Archive job request failed.");
        }
      }),

    exportArchive: (payload: JsonRecord) =>
      runApi("archive:export", async () => {
        try {
          const raw = await apiClient.post<unknown>(`${apiPath}/admin/archive/export`, payload, { headers: apiHeaders() });
          return parseApiEnvelope<JsonRecord>(raw, "archive_export_failed", "Archive export failed.");
        } catch (error) {
          return toApiErrorResult<JsonRecord>(error, "archive_export_http_failed", "Archive export request failed.");
        }
      }),

    callA2ATool: <T>(toolName: string, payload: JsonRecord, apiKeyOverride = "") =>
      runA2A(`a2a:tool:${toolName}`, async () => {
        try {
          const raw = await a2aClient.post<unknown>(`${a2aPath}/${encodeURIComponent(toolName)}`, payload, { headers: apiHeaders(apiKeyOverride) });
          return parseApiEnvelope<T>(raw, "a2a_tool_failed", `A2A tool ${toolName} failed.`);
        } catch (error) {
          return toApiErrorResult<T>(error, "a2a_tool_http_failed", `A2A tool ${toolName} request failed.`);
        }
      }),

    parseProfileRow: (profileId: string, profile: JsonRecord): ProfileRow => {
      const imap = asRecord(profile.imap);
      const sync = asRecord(profile.sync);
      const folderPolicy = asRecord(sync.folder_policy);
      const retention = asRecord(sync.retention);
      const include = asStringList(folderPolicy.include_globs);
      const exclude = asStringList(folderPolicy.exclude_globs);

      return {
        profileId,
        provider: profileField(profile, ["provider"]),
        host: profileField(imap, ["host"]),
        port: profileField(imap, ["port"]),
        security: profileField(imap, ["security"]),
        includeGlobs: include.join(","),
        excludeGlobs: exclude.join(","),
        maxAgeDays: profileField(retention, ["max_age_days"]),
      } satisfies ProfileRow;
    },
  };
}
