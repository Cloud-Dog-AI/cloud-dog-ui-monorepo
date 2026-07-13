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

// @cloud-dog/app-git-mcp — API adapter for HTTP API and MCP endpoints.

import { ApiError, createApiClient, createRequestId } from "@cloud-dog/api-client";
import type {
  AuditLogItem,
  ApiToolDescriptor,
  CallMeta,
  GroupRecord,
  HealthResponse,
  ManagedApiKeyRecord,
  ProfileRecord,
  ServerLogRow,
  JobRecord,
  JobQueueStatus,
  UiMetric,
  UiServiceStatus,
  UiStatusPayload,
  UiSettingGroup,
  UiVersion,
  ToolCallOutcome,
  UserRecord,
} from "./types";

type JsonRecord = Record<string, unknown>;

const MACHINE_CODE_UNKNOWN = "CD-UNKNOWN";

function asRecord(value: unknown): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as JsonRecord;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function toMeta(value: unknown, fallback: CallMeta): CallMeta {
  const meta = asRecord(value);
  return {
    requestId: asString(meta.request_id, fallback.requestId) || fallback.requestId,
    correlationId: asString(meta.correlation_id, fallback.correlationId) || fallback.correlationId,
    status: fallback.status,
    machineCode: fallback.machineCode,
  };
}

function outcomeError(message: string, meta: CallMeta, details: unknown): ToolCallOutcome {
  return {
    ok: false,
    data: details,
    errorMessage: message,
    meta,
  };
}

function outcomeSuccess(data: unknown, meta: CallMeta): ToolCallOutcome {
  return {
    ok: true,
    data,
    errorMessage: "",
    meta,
  };
}

function defaultMeta(status: number): CallMeta {
  return {
    requestId: createRequestId(),
    correlationId: createRequestId(),
    status,
    machineCode: MACHINE_CODE_UNKNOWN,
  };
}

/** PS-73 v2 SW8 per-leaf source attribution (from GET /settings/config/sources). */
export type ConfigSourceMeta = Readonly<{ source: string; secret?: boolean; servers?: string[] }>;
export type ConfigSourcesResponse = Readonly<{
  sources: Record<string, ConfigSourceMeta>;
  counts: Record<string, unknown>;
}>;

export type SelectionOptionRow = Readonly<{ value: string; label: string; secondary?: string }>;

export type WorkspaceRow = Readonly<{
  workspace_id: string;
  profile_id: string;
  mode: string;
  path: string;
  last_used_at: string;
  current_ref: string | null;
  is_open: boolean;
  owner: string | null;
}>;

export type GitMcpApi = Readonly<{
  probeApiKey: (apiKey: string) => Promise<void>;
  getHealth: () => Promise<HealthResponse>;
  getStatus: () => Promise<UiStatusPayload>;
  getUiVersion: (apiKey: string) => Promise<UiVersion>;
  getUiStatus: (apiKey: string) => Promise<UiStatusPayload>;
  getUiSettings: (apiKey: string) => Promise<UiSettingGroup[]>;
  getRuntimeConfig: (apiKey: string) => Promise<Record<string, unknown>>;
  getEffectiveConfig: (apiKey: string) => Promise<Record<string, unknown>>;
  getConfigSources: (apiKey: string) => Promise<ConfigSourcesResponse>;
  auditSettingsReveal: (apiKey: string) => Promise<void>;
  updateUiSettings: (apiKey: string, payload: Record<string, unknown>) => Promise<ToolCallOutcome>;
  listAuditEntries: (apiKey: string, logType?: string) => Promise<AuditLogItem[]>;
  listServerLogs: (apiKey: string, logType?: string, limit?: number, contains?: string, filters?: Record<string, string>) => Promise<ServerLogRow[]>;
  listWorkspaces: (apiKey: string, owner?: string, profileId?: string) => Promise<WorkspaceRow[]>;
  createWorkspace: (apiKey: string, profileId: string, mode?: string) => Promise<ToolCallOutcome>;
  listWorkspaceRefs: (apiKey: string, workspaceId: string, refType: string) => Promise<SelectionOptionRow[]>;
  listWorkspacePaths: (apiKey: string, workspaceId: string, ref?: string, prefix?: string) => Promise<SelectionOptionRow[]>;
  listWorkspaceAuthors: (apiKey: string, workspaceId: string) => Promise<SelectionOptionRow[]>;
  listWorkspaceStashes: (apiKey: string, workspaceId: string) => Promise<SelectionOptionRow[]>;
  listProfileBranches: (apiKey: string, profileId: string) => Promise<SelectionOptionRow[]>;
  profileSyncStatus: (apiKey: string, profileId: string) => Promise<Record<string, unknown>>;
  getA2aHealth: () => Promise<HealthResponse>;
  listApiTools: (apiKey: string) => Promise<ApiToolDescriptor[]>;
  listMcpTools: (apiKey: string) => Promise<ApiToolDescriptor[]>;
  callApiTool: (apiKey: string, toolName: string, args: Record<string, unknown>) => Promise<ToolCallOutcome>;
  callMcpTool: (apiKey: string, toolName: string, args: Record<string, unknown>) => Promise<ToolCallOutcome>;
  listProfiles: (apiKey: string) => Promise<ProfileRecord[]>;
  createProfile: (apiKey: string, name: string, profile: Record<string, unknown>) => Promise<ToolCallOutcome>;
  updateProfile: (apiKey: string, name: string, profile: Record<string, unknown>) => Promise<ToolCallOutcome>;
  deleteProfile: (apiKey: string, name: string) => Promise<ToolCallOutcome>;
  listUsers: (apiKey: string) => Promise<UserRecord[]>;
  createUser: (apiKey: string, userId: string, payload: Record<string, unknown>) => Promise<ToolCallOutcome>;
  updateUser: (apiKey: string, userId: string, payload: Record<string, unknown>) => Promise<ToolCallOutcome>;
  deleteUser: (apiKey: string, userId: string) => Promise<ToolCallOutcome>;
  listGroups: (apiKey: string) => Promise<GroupRecord[]>;
  createGroup: (apiKey: string, groupId: string, payload: Record<string, unknown>) => Promise<ToolCallOutcome>;
  updateGroup: (apiKey: string, groupId: string, payload: Record<string, unknown>) => Promise<ToolCallOutcome>;
  deleteGroup: (apiKey: string, groupId: string) => Promise<ToolCallOutcome>;
  listApiKeys: (apiKey: string) => Promise<ManagedApiKeyRecord[]>;
  createApiKey: (apiKey: string, payload: Record<string, unknown>) => Promise<ToolCallOutcome>;
  updateApiKey: (apiKey: string, keyId: string, payload: Record<string, unknown>) => Promise<ToolCallOutcome>;
  revokeApiKey: (apiKey: string, keyId: string) => Promise<ToolCallOutcome>;
  listJobs: (apiKey: string) => Promise<JobRecord[]>;
  getJob: (apiKey: string, jobId: string) => Promise<JobRecord | null>;
  getJobQueueStatus: (apiKey: string) => Promise<JobQueueStatus>;
  cancelJob: (apiKey: string, jobId: string) => Promise<void>;
  retryJob: (apiKey: string, jobId: string) => Promise<string | null>;
  deleteJob: (apiKey: string, jobId: string) => Promise<void>;
}>;

function joinPath(basePath: string, suffix: string): string {
  const normalizedBase = basePath.endsWith("/") ? basePath.slice(0, -1) : basePath;
  const normalizedSuffix = suffix.startsWith("/") ? suffix : `/${suffix}`;
  return `${normalizedBase}${normalizedSuffix}`;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => asString(item).trim()).filter(Boolean);
}

function mapUserRecord(userId: string, value: unknown): UserRecord {
  const raw = asRecord(value);
  return {
    userId,
    username: asString(raw.username),
    email: asString(raw.email),
    groupIds: asStringArray(raw.group_ids),
    roles: asStringArray(raw.roles),
    status: asString(raw.status, "active") || "active",
    createdAt: asString(raw.created_at),
  };
}

function mapGroupRecord(groupId: string, value: unknown): GroupRecord {
  const raw = asRecord(value);
  return {
    groupId,
    description: asString(raw.description),
    roles: asStringArray(raw.roles),
    members: asStringArray(raw.members),
    createdAt: asString(raw.created_at),
  };
}

function mapManagedApiKey(value: unknown): ManagedApiKeyRecord {
  const raw = asRecord(value);
  return {
    keyId: asString(raw.key_id),
    name: asString(raw.name),
    ownerUserId: asString(raw.owner_user_id),
    keyPrefix: asString(raw.key_prefix),
    status: asString(raw.status),
    capabilities: asStringArray(raw.capabilities),
    createdAt: asString(raw.created_at),
    expiresAt: typeof raw.expires_at === "string" ? raw.expires_at : null,
    rawKey: asString(raw.raw_key) || undefined,
  };
}

function toNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatDuration(createdAt: string, updatedAt: string): string {
  const start = Date.parse(createdAt);
  const end = Date.parse(updatedAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    return "N/A";
  }
  const totalSeconds = Math.round((end - start) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes <= 0) return `${seconds}s`;
  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

function mapStatusPayload(value: unknown): UiStatusPayload {
  const raw = asRecord(value);
  const serviceMetrics = asRecord(raw.service_metrics);
  return {
    uptime_seconds: toNumber(raw.uptime_seconds),
    memory_mb: toNumber(raw.memory_mb),
    memory_percent: toNumber(raw.memory_percent),
    cpu_percent: toNumber(raw.cpu_percent),
    disk_percent: toNumber(raw.disk_percent),
    active_connections: toNumber(raw.active_connections),
    service_metrics: {
      workspace_count: toNumber(serviceMetrics.workspace_count),
      total_repo_size_mb: toNumber(serviceMetrics.total_repo_size_mb),
      profile_count: toNumber(serviceMetrics.profile_count),
    },
    services: Array.isArray(raw.services) ? (raw.services as UiServiceStatus[]) : [],
    metrics: Array.isArray(raw.metrics) ? (raw.metrics as UiMetric[]) : [],
    server_id: asString(raw.server_id) || undefined,
  };
}

function mapJobRecord(value: unknown): JobRecord {
  const raw = asRecord(value);
  const progress = raw.progress != null && typeof raw.progress === "object" ? (raw.progress as Record<string, unknown>) : null;
  return {
    job_id: asString(raw.job_id),
    job_type: asString(raw.job_type),
    status: asString(raw.status, "unknown") || "unknown",
    queue_name: asString(raw.queue_name),
    priority: toNumber(raw.priority),
    user_id: asString(raw.user_id),
    request_auth_identity: asString(raw.request_auth_identity),
    request_source: asString(raw.request_source),
    request_auth_method: asString(raw.request_auth_method),
    correlation_id: asString(raw.correlation_id),
    created_at: asString(raw.created_at),
    updated_at: asString(raw.updated_at),
    started_at: asString(raw.started_at),
    finished_at: asString(raw.finished_at),
    claimed_by: asString(raw.claimed_by),
    attempt: toNumber(raw.attempt) || 1,
    max_attempts: toNumber(raw.max_attempts) || 3,
    progress,
    result: raw.result ?? null,
    error: asString(raw.error),
    payload: raw.payload != null && typeof raw.payload === "object" ? (raw.payload as Record<string, unknown>) : null,
  };
}

export function createGitMcpApi(baseUrl: string, mcpBaseUrl: string, apiBasePath = "/api/v1", a2aBaseUrl = ""): GitMcpApi {
  const apiClient = createApiClient({ baseUrl });
  const mcpClient = createApiClient({ baseUrl: mcpBaseUrl });
  const a2aClient = createApiClient({ baseUrl: a2aBaseUrl || baseUrl });
  const apiPath = (suffix: string) => joinPath(apiBasePath, suffix);

  async function listApiTools(apiKey: string): Promise<ApiToolDescriptor[]> {
    const body = await apiClient.get<unknown>(apiPath("/tools"), {
      headers: { "x-api-key": apiKey },
    });
    const root = asRecord(body);
    const result = asRecord(root.result);
    const items = result.items;
    if (!Array.isArray(items)) return [];

    const mapped: ApiToolDescriptor[] = [];
    for (const item of items) {
      const obj = asRecord(item);
      const name = asString(obj.name).trim();
      if (!name) continue;
      mapped.push({
        name,
        description: asString(obj.description),
        input_schema: asRecord(obj.input_schema),
        output_schema: asRecord(obj.output_schema),
      });
    }
    return mapped;
  }

  async function getUiVersion(apiKey: string): Promise<UiVersion> {
    const body = await apiClient.get<unknown>(apiPath("/ui/version"), {
      headers: { "x-api-key": apiKey },
    });
    return asRecord(asRecord(body).result) as unknown as UiVersion;
  }

  async function getStatus(): Promise<UiStatusPayload> {
    const body = await apiClient.get<unknown>("/status");
    return mapStatusPayload(body);
  }

  async function getUiStatus(apiKey: string): Promise<UiStatusPayload> {
    const body = await apiClient.get<unknown>(apiPath("/ui/status"), {
      headers: { "x-api-key": apiKey },
    });
    return mapStatusPayload(asRecord(body).result);
  }

  async function getUiSettings(apiKey: string): Promise<UiSettingGroup[]> {
    const body = await apiClient.get<unknown>(apiPath("/settings"), {
      headers: { "x-api-key": apiKey },
    });
    const groups = asRecord(body).result;
    return Array.isArray(asRecord(groups).groups) ? (asRecord(groups).groups as UiSettingGroup[]) : [];
  }

  async function getRuntimeConfig(apiKey: string): Promise<Record<string, unknown>> {
    const body = await apiClient.get<unknown>(apiPath("/settings/runtime-config"), {
      headers: { "x-api-key": apiKey },
    });
    return asRecord(asRecord(body).result);
  }

  async function getEffectiveConfig(apiKey: string): Promise<Record<string, unknown>> {
    const body = await apiClient.get<unknown>(apiPath("/settings/config"), {
      headers: { "x-api-key": apiKey },
    });
    return asRecord(asRecord(body).result);
  }

  async function getConfigSources(apiKey: string): Promise<ConfigSourcesResponse> {
    const body = await apiClient.get<unknown>(apiPath("/settings/config/sources"), {
      headers: { "x-api-key": apiKey },
    });
    const result = asRecord(asRecord(body).result);
    return {
      sources: asRecord(result.sources) as Record<string, ConfigSourceMeta>,
      counts: asRecord(result.counts),
    };
  }

  async function auditSettingsReveal(apiKey: string): Promise<void> {
    await apiClient.post(apiPath("/settings/config/audit-reveal"), {}, {
      headers: { "x-api-key": apiKey },
    });
  }

  async function updateUiSettings(apiKey: string, payload: Record<string, unknown>): Promise<ToolCallOutcome> {
    const fallback = defaultMeta(200);
    try {
      const body = await apiClient.put<unknown>(apiPath("/settings"), payload, {
        headers: { "x-api-key": apiKey },
        requestId: fallback.requestId,
        correlationId: fallback.correlationId,
      });
      return outcomeSuccess(body, fallback);
    } catch (error) {
      if (error instanceof ApiError) {
        return outcomeError(error.message, {
          requestId: error.options.requestId ?? fallback.requestId,
          correlationId: error.options.correlationId ?? fallback.correlationId,
          status: error.options.status,
          machineCode: error.options.code ?? MACHINE_CODE_UNKNOWN,
        }, error.options.details ?? {});
      }
      return outcomeError(error instanceof Error ? error.message : "Settings update failed", fallback, {});
    }
  }

  async function listAuditEntries(apiKey: string, logType = ""): Promise<AuditLogItem[]> {
    const query = new URLSearchParams();
    if (logType.trim()) {
      query.set("log_type", logType.trim());
    }
    const path = query.size ? `${apiPath("/audit")}?${query.toString()}` : apiPath("/audit");
    const body = await apiClient.get<unknown>(path, {
      headers: { "x-api-key": apiKey },
    });
    const items = asRecord(asRecord(body).result).items;
    return Array.isArray(items) ? (items as AuditLogItem[]) : [];
  }

  async function listServerLogs(
    apiKey: string,
    logType = "audit",
    limit = 200,
    contains = "",
    filters: Record<string, string> = {},
  ): Promise<ServerLogRow[]> {
    const source = logType.trim() || "audit";
    const activeFilters = Object.entries(filters).filter(([, value]) => value && String(value).trim());
    // W28J-1309: audit deep-links (correlation_id, workspace_id, ...) route to /audit which
    // applies the W28J-1308 structured filters; other sources use /logs.
    const useAudit = source === "audit" && activeFilters.length > 0;
    const query = new URLSearchParams({ limit: String(limit) });
    if (!useAudit) {
      query.set("log_type", source);
    }
    if (contains.trim()) {
      query.set("contains", contains.trim());
    }
    for (const [key, value] of activeFilters) {
      query.set(key, String(value).trim());
    }
    const endpoint = useAudit ? "/audit" : "/logs";
    const body = await apiClient.get<unknown>(`${apiPath(endpoint)}?${query.toString()}`, {
      headers: { "x-api-key": apiKey },
    });
    const items = asRecord(asRecord(body).result).items;
    return Array.isArray(items) ? (items as ServerLogRow[]) : [];
  }

  async function listWorkspaces(apiKey: string, owner = "me", profileId = ""): Promise<WorkspaceRow[]> {
    const query = new URLSearchParams();
    if (owner.trim()) query.set("owner", owner.trim());
    if (profileId.trim()) query.set("profile_id", profileId.trim());
    const suffix = query.toString() ? `?${query.toString()}` : "";
    const body = await apiClient.get<unknown>(`${apiPath("/workspaces")}${suffix}`, {
      headers: { "x-api-key": apiKey },
    });
    const items = asRecord(asRecord(body).result).items;
    return Array.isArray(items) ? (items as WorkspaceRow[]) : [];
  }

  async function createWorkspace(apiKey: string, profileId: string, mode = "persistent"): Promise<ToolCallOutcome> {
    const fallback = defaultMeta(200);
    try {
      const body = await apiClient.post<unknown>(apiPath("/workspaces"), { profile_id: profileId, mode }, {
        headers: { "x-api-key": apiKey },
        requestId: fallback.requestId,
        correlationId: fallback.correlationId,
      });
      return outcomeSuccess(body, fallback);
    } catch (error) {
      if (error instanceof ApiError) {
        return outcomeError(error.message, {
          requestId: error.options.requestId ?? fallback.requestId,
          correlationId: error.options.correlationId ?? fallback.correlationId,
          status: error.options.status,
          machineCode: error.options.code ?? MACHINE_CODE_UNKNOWN,
        }, error.options.details ?? {});
      }
      return outcomeError(error instanceof Error ? error.message : "Create workspace failed", fallback, {});
    }
  }

  async function getEnumItems(apiKey: string, path: string): Promise<Record<string, unknown>[]> {
    const body = await apiClient.get<unknown>(apiPath(path), { headers: { "x-api-key": apiKey } });
    const items = asRecord(asRecord(body).result).items;
    return Array.isArray(items) ? (items as Record<string, unknown>[]) : [];
  }

  async function listWorkspaceRefs(apiKey: string, workspaceId: string, refType: string): Promise<SelectionOptionRow[]> {
    const items = await getEnumItems(apiKey, `/workspaces/${encodeURIComponent(workspaceId)}/refs?type=${encodeURIComponent(refType)}`);
    return items.map((i) => ({
      value: String(i.ref_id ?? i.ref_name ?? ""),
      label: String(i.ref_name ?? i.ref_id ?? ""),
      secondary: i.secondary ? String(i.secondary) : i.ref_type ? String(i.ref_type) : undefined,
    }));
  }

  async function listWorkspacePaths(apiKey: string, workspaceId: string, ref = "", prefix = ""): Promise<SelectionOptionRow[]> {
    const q = new URLSearchParams();
    if (ref) q.set("ref", ref);
    if (prefix) q.set("prefix", prefix);
    const suffix = q.toString() ? `?${q.toString()}` : "";
    const items = await getEnumItems(apiKey, `/workspaces/${encodeURIComponent(workspaceId)}/paths${suffix}`);
    return items.map((i) => ({ value: String(i.path ?? ""), label: String(i.path ?? ""), secondary: i.kind ? String(i.kind) : undefined }));
  }

  async function listWorkspaceAuthors(apiKey: string, workspaceId: string): Promise<SelectionOptionRow[]> {
    const items = await getEnumItems(apiKey, `/workspaces/${encodeURIComponent(workspaceId)}/authors`);
    return items.map((i) => ({ value: String(i.author ?? ""), label: String(i.author ?? ""), secondary: i.email ? String(i.email) : undefined }));
  }

  async function listWorkspaceStashes(apiKey: string, workspaceId: string): Promise<SelectionOptionRow[]> {
    const items = await getEnumItems(apiKey, `/workspaces/${encodeURIComponent(workspaceId)}/stashes`);
    return items.map((i) => ({ value: String(i.stash_id ?? ""), label: String(i.stash_id ?? ""), secondary: i.message ? String(i.message) : undefined }));
  }

  async function listProfileBranches(apiKey: string, profileId: string): Promise<SelectionOptionRow[]> {
    const items = await getEnumItems(apiKey, `/profiles/${encodeURIComponent(profileId)}/branches`);
    return items.map((i) => ({ value: String(i.ref_name ?? ""), label: String(i.ref_name ?? ""), secondary: i.is_default ? "default" : undefined }));
  }

  async function profileSyncStatus(apiKey: string, profileId: string): Promise<Record<string, unknown>> {
    const body = await apiClient.get<unknown>(apiPath(`/profiles/${encodeURIComponent(profileId)}/sync-status`), {
      headers: { "x-api-key": apiKey },
    });
    return asRecord(asRecord(body).result);
  }

  async function getA2aHealth(): Promise<HealthResponse> {
    return a2aClient.get<HealthResponse>("/health");
  }

  async function listMcpTools(apiKey: string): Promise<ApiToolDescriptor[]> {
    const body = await mcpClient.get<unknown>("/mcp/tools", {
      headers: { "x-api-key": apiKey },
    });
    const values = Array.isArray(body) ? body : asRecord(body).data;
    if (!Array.isArray(values)) return [];

    const mapped: ApiToolDescriptor[] = [];
    for (const item of values) {
      const obj = asRecord(item);
      const name = asString(obj.name).trim();
      if (!name) continue;
      mapped.push({
        name,
        description: asString(obj.description),
        input_schema: asRecord(obj.input_schema),
        output_schema: asRecord(obj.output_schema),
      });
    }
    return mapped;
  }

  async function callApiTool(apiKey: string, toolName: string, args: Record<string, unknown>): Promise<ToolCallOutcome> {
    const fallback = defaultMeta(200);
    try {
      const body = await apiClient.post<unknown>(apiPath(`/tools/${toolName}`), args, {
        headers: { "x-api-key": apiKey },
        requestId: fallback.requestId,
        correlationId: fallback.correlationId,
      });
      const root = asRecord(body);
      const ok = root.ok !== false;
      const meta = toMeta(root.meta, fallback);
      if (!ok) {
        const errors = root.errors;
        let message = `Tool call failed: ${toolName}`;
        let machineCode = MACHINE_CODE_UNKNOWN;
        if (Array.isArray(errors) && errors.length > 0) {
          const first = asRecord(errors[0]);
          const firstMessage = asString(first.message).trim();
          if (firstMessage) message = firstMessage;
          machineCode = asString(first.code, MACHINE_CODE_UNKNOWN);
        }
        return outcomeError(
          message,
          {
            requestId: meta.requestId,
            correlationId: meta.correlationId,
            status: meta.status,
            machineCode,
          },
          root
        );
      }
      return outcomeSuccess(root.result ?? {}, meta);
    } catch (error) {
      if (error instanceof ApiError) {
        const meta: CallMeta = {
          requestId: error.options.requestId ?? fallback.requestId,
          correlationId: error.options.correlationId ?? fallback.correlationId,
          status: error.options.status,
          machineCode: error.options.code ?? MACHINE_CODE_UNKNOWN,
        };
        return outcomeError(error.message, meta, error.options.details ?? {});
      }
      return outcomeError(error instanceof Error ? error.message : "Unexpected API failure", fallback, {});
    }
  }

  async function callMcpTool(apiKey: string, toolName: string, args: Record<string, unknown>): Promise<ToolCallOutcome> {
    const fallback = defaultMeta(200);
    try {
      const body = await mcpClient.post<unknown>(`/mcp/tools/${toolName}`, args, {
        headers: { "x-api-key": apiKey },
        requestId: fallback.requestId,
        correlationId: fallback.correlationId,
      });

      const root = asRecord(body);
      if (root.ok === false) {
        const meta = toMeta(root.meta, fallback);
        return outcomeError(
          `MCP tool failed: ${toolName}`,
          {
            requestId: meta.requestId,
            correlationId: meta.correlationId,
            status: meta.status,
            machineCode: meta.machineCode,
          },
          root
        );
      }

      const meta = toMeta(root.meta, fallback);
      if ("result" in root) {
        return outcomeSuccess(root.result ?? {}, meta);
      }
      return outcomeSuccess(body, meta);
    } catch (error) {
      if (error instanceof ApiError) {
        const meta: CallMeta = {
          requestId: error.options.requestId ?? fallback.requestId,
          correlationId: error.options.correlationId ?? fallback.correlationId,
          status: error.options.status,
          machineCode: error.options.code ?? MACHINE_CODE_UNKNOWN,
        };
        return outcomeError(error.message, meta, error.options.details ?? {});
      }
      return outcomeError(error instanceof Error ? error.message : "Unexpected MCP failure", fallback, {});
    }
  }

  async function listProfiles(apiKey: string): Promise<ProfileRecord[]> {
    const body = await apiClient.get<unknown>(apiPath("/admin/profiles"), {
      headers: { "x-api-key": apiKey },
    });
    const root = asRecord(body);
    const result = asRecord(root.result);
    const items = asRecord(result.items);

    const profiles: ProfileRecord[] = [];
    for (const [name, raw] of Object.entries(items)) {
      const profile = asRecord(raw);
      const repo = asRecord(profile.repo);
      profiles.push({
        name,
        source: asString(repo.source),
        defaultBranch: asString(repo.default_branch, "main") || "main",
        // GM-PR-02: credential mode is part of the profile's auth config.
        credentialMode: asString(asRecord(profile.auth).credential_mode, "session") || "session",
      });
    }
    return profiles.sort((a, b) => a.name.localeCompare(b.name));
  }

  async function createProfile(apiKey: string, name: string, profile: Record<string, unknown>): Promise<ToolCallOutcome> {
    const fallback = defaultMeta(200);
    try {
      const body = await apiClient.post<unknown>(apiPath(`/admin/profiles/${encodeURIComponent(name)}`), profile, {
        headers: { "x-api-key": apiKey },
        requestId: fallback.requestId,
        correlationId: fallback.correlationId,
      });
      return outcomeSuccess(body, fallback);
    } catch (error) {
      if (error instanceof ApiError) {
        return outcomeError(error.message, {
          requestId: error.options.requestId ?? fallback.requestId,
          correlationId: error.options.correlationId ?? fallback.correlationId,
          status: error.options.status,
          machineCode: error.options.code ?? MACHINE_CODE_UNKNOWN,
        }, error.options.details ?? {});
      }
      return outcomeError(error instanceof Error ? error.message : "Create profile failed", fallback, {});
    }
  }

  async function updateProfile(apiKey: string, name: string, profile: Record<string, unknown>): Promise<ToolCallOutcome> {
    const fallback = defaultMeta(200);
    try {
      const body = await apiClient.put<unknown>(apiPath(`/admin/profiles/${encodeURIComponent(name)}`), profile, {
        headers: { "x-api-key": apiKey },
        requestId: fallback.requestId,
        correlationId: fallback.correlationId,
      });
      return outcomeSuccess(body, fallback);
    } catch (error) {
      if (error instanceof ApiError) {
        return outcomeError(error.message, {
          requestId: error.options.requestId ?? fallback.requestId,
          correlationId: error.options.correlationId ?? fallback.correlationId,
          status: error.options.status,
          machineCode: error.options.code ?? MACHINE_CODE_UNKNOWN,
        }, error.options.details ?? {});
      }
      return outcomeError(error instanceof Error ? error.message : "Update profile failed", fallback, {});
    }
  }

  async function deleteProfile(apiKey: string, name: string): Promise<ToolCallOutcome> {
    const fallback = defaultMeta(200);
    try {
      const body = await apiClient.delete<unknown>(apiPath(`/admin/profiles/${encodeURIComponent(name)}`), {
        headers: { "x-api-key": apiKey },
        requestId: fallback.requestId,
        correlationId: fallback.correlationId,
      });
      return outcomeSuccess(body, fallback);
    } catch (error) {
      if (error instanceof ApiError) {
        return outcomeError(error.message, {
          requestId: error.options.requestId ?? fallback.requestId,
          correlationId: error.options.correlationId ?? fallback.correlationId,
          status: error.options.status,
          machineCode: error.options.code ?? MACHINE_CODE_UNKNOWN,
        }, error.options.details ?? {});
      }
      return outcomeError(error instanceof Error ? error.message : "Delete profile failed", fallback, {});
    }
  }

  async function listUsers(apiKey: string): Promise<UserRecord[]> {
    const body = await apiClient.get<unknown>(apiPath("/admin/users"), {
      headers: { "x-api-key": apiKey },
    });
    const items = asRecord(asRecord(body).result).items;
    const mapped: UserRecord[] = [];
    for (const [userId, value] of Object.entries(asRecord(items))) {
      mapped.push(mapUserRecord(userId, value));
    }
    return mapped.sort((a, b) => a.userId.localeCompare(b.userId));
  }

  async function createUser(apiKey: string, userId: string, payload: Record<string, unknown>): Promise<ToolCallOutcome> {
    const fallback = defaultMeta(200);
    try {
      const body = await apiClient.post<unknown>(apiPath(`/admin/users/${encodeURIComponent(userId)}`), payload, {
        headers: { "x-api-key": apiKey },
        requestId: fallback.requestId,
        correlationId: fallback.correlationId,
      });
      return outcomeSuccess(body, fallback);
    } catch (error) {
      if (error instanceof ApiError) {
        return outcomeError(error.message, {
          requestId: error.options.requestId ?? fallback.requestId,
          correlationId: error.options.correlationId ?? fallback.correlationId,
          status: error.options.status,
          machineCode: error.options.code ?? MACHINE_CODE_UNKNOWN,
        }, error.options.details ?? {});
      }
      return outcomeError(error instanceof Error ? error.message : "Create user failed", fallback, {});
    }
  }

  async function updateUser(apiKey: string, userId: string, payload: Record<string, unknown>): Promise<ToolCallOutcome> {
    const fallback = defaultMeta(200);
    try {
      const body = await apiClient.put<unknown>(apiPath(`/admin/users/${encodeURIComponent(userId)}`), payload, {
        headers: { "x-api-key": apiKey },
        requestId: fallback.requestId,
        correlationId: fallback.correlationId,
      });
      return outcomeSuccess(body, fallback);
    } catch (error) {
      if (error instanceof ApiError) {
        return outcomeError(error.message, {
          requestId: error.options.requestId ?? fallback.requestId,
          correlationId: error.options.correlationId ?? fallback.correlationId,
          status: error.options.status,
          machineCode: error.options.code ?? MACHINE_CODE_UNKNOWN,
        }, error.options.details ?? {});
      }
      return outcomeError(error instanceof Error ? error.message : "Update user failed", fallback, {});
    }
  }

  async function deleteUser(apiKey: string, userId: string): Promise<ToolCallOutcome> {
    const fallback = defaultMeta(200);
    try {
      const body = await apiClient.delete<unknown>(apiPath(`/admin/users/${encodeURIComponent(userId)}`), {
        headers: { "x-api-key": apiKey },
        requestId: fallback.requestId,
        correlationId: fallback.correlationId,
      });
      return outcomeSuccess(body, fallback);
    } catch (error) {
      if (error instanceof ApiError) {
        return outcomeError(error.message, {
          requestId: error.options.requestId ?? fallback.requestId,
          correlationId: error.options.correlationId ?? fallback.correlationId,
          status: error.options.status,
          machineCode: error.options.code ?? MACHINE_CODE_UNKNOWN,
        }, error.options.details ?? {});
      }
      return outcomeError(error instanceof Error ? error.message : "Delete user failed", fallback, {});
    }
  }

  async function listGroups(apiKey: string): Promise<GroupRecord[]> {
    const body = await apiClient.get<unknown>(apiPath("/admin/groups"), {
      headers: { "x-api-key": apiKey },
    });
    const items = asRecord(asRecord(body).result).items;
    const mapped: GroupRecord[] = [];
    for (const [groupId, value] of Object.entries(asRecord(items))) {
      mapped.push(mapGroupRecord(groupId, value));
    }
    return mapped.sort((a, b) => a.groupId.localeCompare(b.groupId));
  }

  async function createGroup(apiKey: string, groupId: string, payload: Record<string, unknown>): Promise<ToolCallOutcome> {
    const fallback = defaultMeta(200);
    try {
      const body = await apiClient.post<unknown>(apiPath(`/admin/groups/${encodeURIComponent(groupId)}`), payload, {
        headers: { "x-api-key": apiKey },
        requestId: fallback.requestId,
        correlationId: fallback.correlationId,
      });
      return outcomeSuccess(body, fallback);
    } catch (error) {
      if (error instanceof ApiError) {
        return outcomeError(error.message, {
          requestId: error.options.requestId ?? fallback.requestId,
          correlationId: error.options.correlationId ?? fallback.correlationId,
          status: error.options.status,
          machineCode: error.options.code ?? MACHINE_CODE_UNKNOWN,
        }, error.options.details ?? {});
      }
      return outcomeError(error instanceof Error ? error.message : "Create group failed", fallback, {});
    }
  }

  async function updateGroup(apiKey: string, groupId: string, payload: Record<string, unknown>): Promise<ToolCallOutcome> {
    const fallback = defaultMeta(200);
    try {
      const body = await apiClient.put<unknown>(apiPath(`/admin/groups/${encodeURIComponent(groupId)}`), payload, {
        headers: { "x-api-key": apiKey },
        requestId: fallback.requestId,
        correlationId: fallback.correlationId,
      });
      return outcomeSuccess(body, fallback);
    } catch (error) {
      if (error instanceof ApiError) {
        return outcomeError(error.message, {
          requestId: error.options.requestId ?? fallback.requestId,
          correlationId: error.options.correlationId ?? fallback.correlationId,
          status: error.options.status,
          machineCode: error.options.code ?? MACHINE_CODE_UNKNOWN,
        }, error.options.details ?? {});
      }
      return outcomeError(error instanceof Error ? error.message : "Update group failed", fallback, {});
    }
  }

  async function deleteGroup(apiKey: string, groupId: string): Promise<ToolCallOutcome> {
    const fallback = defaultMeta(200);
    try {
      const body = await apiClient.delete<unknown>(apiPath(`/admin/groups/${encodeURIComponent(groupId)}`), {
        headers: { "x-api-key": apiKey },
        requestId: fallback.requestId,
        correlationId: fallback.correlationId,
      });
      return outcomeSuccess(body, fallback);
    } catch (error) {
      if (error instanceof ApiError) {
        return outcomeError(error.message, {
          requestId: error.options.requestId ?? fallback.requestId,
          correlationId: error.options.correlationId ?? fallback.correlationId,
          status: error.options.status,
          machineCode: error.options.code ?? MACHINE_CODE_UNKNOWN,
        }, error.options.details ?? {});
      }
      return outcomeError(error instanceof Error ? error.message : "Delete group failed", fallback, {});
    }
  }

  async function listApiKeys(apiKey: string): Promise<ManagedApiKeyRecord[]> {
    const body = await apiClient.get<unknown>(apiPath("/admin/api-keys"), {
      headers: { "x-api-key": apiKey },
    });
    const items = asRecord(asRecord(body).result).items;
    if (!Array.isArray(items)) return [];
    return items.map((item) => mapManagedApiKey(item)).sort((a, b) => a.name.localeCompare(b.name));
  }

  async function createApiKey(apiKey: string, payload: Record<string, unknown>): Promise<ToolCallOutcome> {
    const fallback = defaultMeta(200);
    try {
      const body = await apiClient.post<unknown>(apiPath("/admin/api-keys"), payload, {
        headers: { "x-api-key": apiKey },
        requestId: fallback.requestId,
        correlationId: fallback.correlationId,
      });
      return outcomeSuccess(body, fallback);
    } catch (error) {
      if (error instanceof ApiError) {
        return outcomeError(error.message, {
          requestId: error.options.requestId ?? fallback.requestId,
          correlationId: error.options.correlationId ?? fallback.correlationId,
          status: error.options.status,
          machineCode: error.options.code ?? MACHINE_CODE_UNKNOWN,
        }, error.options.details ?? {});
      }
      return outcomeError(error instanceof Error ? error.message : "Create API key failed", fallback, {});
    }
  }

  async function updateApiKey(
    apiKey: string,
    keyId: string,
    payload: Record<string, unknown>
  ): Promise<ToolCallOutcome> {
    const fallback = defaultMeta(200);
    try {
      const body = await apiClient.put<unknown>(apiPath(`/admin/api-keys/${encodeURIComponent(keyId)}`), payload, {
        headers: { "x-api-key": apiKey },
        requestId: fallback.requestId,
        correlationId: fallback.correlationId,
      });
      return outcomeSuccess(body, fallback);
    } catch (error) {
      if (error instanceof ApiError) {
        return outcomeError(error.message, {
          requestId: error.options.requestId ?? fallback.requestId,
          correlationId: error.options.correlationId ?? fallback.correlationId,
          status: error.options.status,
          machineCode: error.options.code ?? MACHINE_CODE_UNKNOWN,
        }, error.options.details ?? {});
      }
      return outcomeError(error instanceof Error ? error.message : "Update API key failed", fallback, {});
    }
  }

  async function revokeApiKey(apiKey: string, keyId: string): Promise<ToolCallOutcome> {
    const fallback = defaultMeta(200);
    try {
      const body = await apiClient.delete<unknown>(apiPath(`/admin/api-keys/${encodeURIComponent(keyId)}`), {
        headers: { "x-api-key": apiKey },
        requestId: fallback.requestId,
        correlationId: fallback.correlationId,
      });
      return outcomeSuccess(body, fallback);
    } catch (error) {
      if (error instanceof ApiError) {
        return outcomeError(error.message, {
          requestId: error.options.requestId ?? fallback.requestId,
          correlationId: error.options.correlationId ?? fallback.correlationId,
          status: error.options.status,
          machineCode: error.options.code ?? MACHINE_CODE_UNKNOWN,
        }, error.options.details ?? {});
      }
      return outcomeError(error instanceof Error ? error.message : "Revoke API key failed", fallback, {});
    }
  }

  async function listJobs(apiKey: string): Promise<JobRecord[]> {
    const body = await apiClient.get<unknown>(apiPath("/jobs"), {
      headers: { "x-api-key": apiKey },
    });
    const items = asRecord(asRecord(body).result).items;
    if (!Array.isArray(items)) return [];
    return items.map((item) => mapJobRecord(item));
  }

  async function getJob(apiKey: string, jobId: string): Promise<JobRecord | null> {
    const body = await apiClient.get<unknown>(apiPath(`/jobs/${encodeURIComponent(jobId)}`), {
      headers: { "x-api-key": apiKey },
    });
    const result = asRecord(asRecord(body).result);
    if (!Object.keys(result).length) return null;
    return mapJobRecord(result);
  }

  return {
    probeApiKey: async (apiKey: string) => {
      const key = apiKey.trim();
      if (!key) throw new Error("API key is required.");
      await listApiTools(key);
    },
    getHealth: async () => apiClient.get<HealthResponse>("/health"),
    getStatus,
    getUiVersion,
    getUiStatus,
    getUiSettings,
    getRuntimeConfig,
    getEffectiveConfig,
    getConfigSources,
    auditSettingsReveal,
    updateUiSettings,
    listAuditEntries,
    listServerLogs,
    listWorkspaces,
    createWorkspace,
    listWorkspaceRefs,
    listWorkspacePaths,
    listWorkspaceAuthors,
    listWorkspaceStashes,
    listProfileBranches,
    profileSyncStatus,
    getA2aHealth,
    listApiTools,
    listMcpTools,
    callApiTool,
    callMcpTool,
    listProfiles,
    createProfile,
    updateProfile,
    deleteProfile,
    listUsers,
    createUser,
    updateUser,
    deleteUser,
    listGroups,
    createGroup,
    updateGroup,
    deleteGroup,
    listApiKeys,
    createApiKey,
    updateApiKey,
    revokeApiKey,
    listJobs,
    getJob,
    getJobQueueStatus: async (apiKey: string): Promise<JobQueueStatus> => {
      const body = await apiClient.get<unknown>(apiPath("/jobs/queue/status"), {
        headers: { "x-api-key": apiKey },
      });
      const result = asRecord(asRecord(body).result);
      return result as unknown as JobQueueStatus;
    },
    cancelJob: async (apiKey: string, jobId: string): Promise<void> => {
      await apiClient.post<unknown>(apiPath(`/jobs/${encodeURIComponent(jobId)}/cancel`), {}, {
        headers: { "x-api-key": apiKey },
      });
    },
    retryJob: async (apiKey: string, jobId: string): Promise<string | null> => {
      const body = await apiClient.post<unknown>(apiPath(`/jobs/${encodeURIComponent(jobId)}/retry`), {}, {
        headers: { "x-api-key": apiKey },
      });
      return asString(asRecord(asRecord(body).result).new_job_id) || null;
    },
    deleteJob: async (apiKey: string, jobId: string): Promise<void> => {
      await apiClient.delete<unknown>(apiPath(`/jobs/${encodeURIComponent(jobId)}`), {
        headers: { "x-api-key": apiKey },
      });
    },
  };
}
