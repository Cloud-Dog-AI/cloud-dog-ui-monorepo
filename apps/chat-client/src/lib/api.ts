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

// @cloud-dog/app-chat-client — Backend API adapter.

import { ApiError, createApiClient } from "@cloud-dog/api-client";
import type { ApiClient } from "@cloud-dog/api-client";
import type {
  ChatApiKeyRecord,
  ChatGroupRecord,
  ChatProfileRecord,
  ChatUserRecord,
  FileIntakeSettings,
  JobRecord,
  LlmTestResult,
  LogsResponse,
  LogSurfaceId,
  LogSurfaceOption,
  McpServer,
  McpServerHealth,
  MonitoringActorRecord,
  MonitoringLogRow,
  MonitoringSummary,
  MonitoringTargetRecord,
  ResourceStatusRecord,
  SessionSummary,
  ToolDescriptor,
  TranscriptEvent,
  UiConfig,
  UiConfigTree,
  VersionInfoRecord,
} from "./types";

export type StreamChatHandlers = Readonly<{
  onDelta: (delta: string) => void;
  onEvent?: (event: unknown) => void;
}>;

export type UploadSessionFileArgs = Readonly<{
  file: File;
  path: string;
  serverIndex?: number | null;
  overwrite?: boolean;
  dryRun?: boolean;
  requireInitialize?: boolean;
}>;

export type SessionFileTransferResult = Readonly<{
  path: string;
  byteSize?: number;
  bytesWritten?: number;
  dryRun?: boolean;
  serverIndex: number | null;
  toolResult: Record<string, unknown>;
}>;

export type UploadSessionFileByReferenceArgs = Readonly<{
  path: string;
  sourceUrl: string;
  serverIndex?: number | null;
  overwrite?: boolean;
  dryRun?: boolean;
  requireInitialize?: boolean;
}>;

export type DownloadSessionFileContentArgs = Readonly<{
  path: string;
  serverIndex?: number | null;
  requireInitialize?: boolean;
  downloadName?: string;
}>;

export type SessionFileContent = Readonly<{
  path: string;
  filename: string;
  contentType: string;
  serverIndex: number | null;
  blob: Blob;
}>;

/** PS-73 v2 SW8 per-leaf source attribution (from GET /ui/config/sources). */
export type ConfigSourceMeta = Readonly<{ source: string; secret?: boolean; servers?: string[] }>;
export type UiConfigSources = Readonly<{
  application: { name: string };
  sources: Record<string, ConfigSourceMeta>;
  counts: Record<string, unknown>;
}>;

export type ChatApi = Readonly<{
  getUiConfig: () => Promise<UiConfig>;
  getUiConfigTree: () => Promise<UiConfigTree>;
  getUiConfigSources: () => Promise<UiConfigSources>;
  auditSettingsReveal: () => Promise<void>;
  listSessions: () => Promise<SessionSummary[]>;
  createSession: (metadata?: Record<string, unknown>) => Promise<string>;
  deleteSession: (sessionId: string) => Promise<void>;
  getTranscript: (sessionId: string) => Promise<TranscriptEvent[]>;
  sendMessage: (sessionId: string, content: string) => Promise<string>;
  streamMessage: (
    sessionId: string,
    content: string,
    timeoutMs: number,
    handlers: StreamChatHandlers
  ) => Promise<string>;
  listMcpServers: () => Promise<McpServer[]>;
  healthMcpServers: () => Promise<McpServerHealth[]>;
  createMcpServer: (payload: Record<string, unknown>) => Promise<McpServer[]>;
  updateMcpServer: (serverIndex: number, payload: Record<string, unknown>) => Promise<McpServer[]>;
  deleteMcpServer: (serverIndex: number) => Promise<McpServer[]>;
  listTools: (sessionId: string, serverIndex: number) => Promise<ToolDescriptor[]>;
  callTool: (
    sessionId: string,
    serverIndex: number,
    name: string,
    args: Record<string, unknown>
  ) => Promise<unknown>;
  getSessionPreferences: (sessionId: string) => Promise<number[]>;
  setSessionPreferences: (sessionId: string, selectedIndices: number[]) => Promise<number[]>;
  listProfiles: () => Promise<ChatProfileRecord[]>;
  createProfile: (payload: Record<string, unknown>) => Promise<ChatProfileRecord>;
  updateProfile: (profileId: string, payload: Record<string, unknown>) => Promise<ChatProfileRecord>;
  deleteProfile: (profileId: string) => Promise<void>;
  listFileProfiles: (sessionId: string, serverIndex: number) => Promise<string[]>;
  uploadFile: (sessionId: string, args: UploadSessionFileArgs) => Promise<SessionFileTransferResult>;
  uploadFileByReference: (
    sessionId: string,
    args: UploadSessionFileByReferenceArgs
  ) => Promise<SessionFileTransferResult>;
  downloadFileContent: (
    sessionId: string,
    args: DownloadSessionFileContentArgs
  ) => Promise<SessionFileContent>;
  listUsers: () => Promise<ChatUserRecord[]>;
  createUser: (payload: Record<string, unknown>) => Promise<ChatUserRecord>;
  updateUser: (userId: string, payload: Record<string, unknown>) => Promise<ChatUserRecord>;
  deleteUser: (userId: string) => Promise<void>;
  listGroups: () => Promise<ChatGroupRecord[]>;
  createGroup: (payload: Record<string, unknown>) => Promise<ChatGroupRecord>;
  updateGroup: (groupId: string, payload: Record<string, unknown>) => Promise<ChatGroupRecord>;
  deleteGroup: (groupId: string) => Promise<void>;
  listApiKeys: () => Promise<ChatApiKeyRecord[]>;
  createApiKey: (payload: Record<string, unknown>) => Promise<ChatApiKeyRecord>;
  revokeApiKey: (keyId: string) => Promise<void>;
  getVersionInfo: () => Promise<VersionInfoRecord>;
  getStatus: () => Promise<ResourceStatusRecord>;
  testModel: () => Promise<LlmTestResult>;
  getMonitoringSummary: () => Promise<MonitoringSummary>;
  getLogs: (params?: { limit?: number; surface?: LogSurfaceId }) => Promise<LogsResponse>;
  listJobs: () => Promise<JobRecord[]>;
}>;

function toObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function toNullableServerIndex(value: unknown): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) return null;
  return parsed;
}

function parseContentDispositionFilename(value: string | null): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const utf8Match = raw.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]).trim();
    } catch {
      return utf8Match[1].trim();
    }
  }
  const plainMatch = raw.match(/filename="([^"]+)"/i) ?? raw.match(/filename=([^;]+)/i);
  return String(plainMatch?.[1] ?? "").trim();
}

function toSessionArray(value: unknown): SessionSummary[] {
  if (!Array.isArray(value)) return [];

  const out: SessionSummary[] = [];
  for (const item of value) {
    const obj = toObject(item);
    const id = String(obj.id ?? "").trim();
    const createdAt = String(obj.created_at ?? "").trim();
    if (!id || !createdAt) continue;
    const expiresAt = String(obj.expires_at ?? "").trim();
    const ttlRaw = obj.ttl_seconds;
    const ttlSeconds =
      typeof ttlRaw === "number" && Number.isFinite(ttlRaw)
        ? ttlRaw
        : ttlRaw != null && ttlRaw !== "" && Number.isFinite(Number(ttlRaw))
        ? Number(ttlRaw)
        : undefined;
    out.push({
      id,
      created_at: createdAt,
      expires_at: expiresAt || undefined,
      ttl_seconds: ttlSeconds,
      metadata: toObject(obj.metadata),
      log_path: String(obj.log_path ?? ""),
    });
  }
  return out;
}

function toMcpServerArray(value: unknown): McpServer[] {
  if (!Array.isArray(value)) return [];

  const out: McpServer[] = [];
  for (const item of value) {
    const obj = toObject(item);
    const index = Number(obj.index ?? -1);
    if (!Number.isFinite(index) || index < 0) continue;
    out.push({
      index,
      name: String(obj.name ?? ""),
      transport: String(obj.transport ?? ""),
      base_url: String(obj.base_url ?? ""),
      version: String(obj.version ?? ""),
      mcp_path: String(obj.mcp_path ?? ""),
      messages_path: String(obj.messages_path ?? ""),
      sse_path: String(obj.sse_path ?? ""),
      health_path: String(obj.health_path ?? ""),
    });
  }
  return out;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item ?? "").trim()).filter(Boolean);
}

function toLogSurfaceId(value: unknown): LogSurfaceId {
  const normalized = String(value ?? "audit").trim().toLowerCase();
  if (normalized === "api" || normalized === "web" || normalized === "mcp" || normalized === "a2a") {
    return normalized;
  }
  return "audit";
}

function toMonitoringActor(value: unknown): MonitoringActorRecord {
  const obj = toObject(value);
  return {
    type: String(obj.type ?? ""),
    id: String(obj.id ?? ""),
    ip: String(obj.ip ?? ""),
    roles: toStringArray(obj.roles),
    user_agent: String(obj.user_agent ?? ""),
  };
}

function toMonitoringTarget(value: unknown): MonitoringTargetRecord {
  const obj = toObject(value);
  return {
    type: String(obj.type ?? ""),
    id: String(obj.id ?? ""),
    name: String(obj.name ?? ""),
  };
}

function toLogSurfaceOptions(value: unknown): LogSurfaceOption[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const obj = toObject(item);
      return {
        id: toLogSurfaceId(obj.id),
        label: String(obj.label ?? "").trim() || toLogSurfaceId(obj.id).toUpperCase(),
      } satisfies LogSurfaceOption;
    })
    .filter((item, index, all) => item.id && all.findIndex((candidate) => candidate.id === item.id) === index);
}

function toMonitoringLogRows(value: unknown): MonitoringLogRow[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const obj = toObject(item);
      const id = String(obj.id ?? "").trim();
      const timestamp = String(obj.timestamp ?? "").trim();
      const action = String(obj.action ?? "").trim();
      if (!id && !timestamp && !action) return null;
      return {
        id: id || `${String(obj.surface ?? "audit")}-${timestamp || action}`,
        surface: toLogSurfaceId(obj.surface),
        surface_label: String(obj.surface_label ?? "").trim(),
        source_path: String(obj.source_path ?? "").trim(),
        timestamp,
        message: String(obj.message ?? "").trim(),
        level: String(obj.level ?? "").trim(),
        event_type: String(obj.event_type ?? "").trim(),
        action,
        outcome: String(obj.outcome ?? "").trim(),
        severity: String(obj.severity ?? "").trim(),
        trace_id: String(obj.trace_id ?? "").trim(),
        request_id: String(obj.request_id ?? "").trim(),
        service: String(obj.service ?? "").trim(),
        service_instance: String(obj.service_instance ?? "").trim(),
        environment: String(obj.environment ?? "").trim(),
        actor: toMonitoringActor(obj.actor),
        target: toMonitoringTarget(obj.target),
        details: Object.keys(toObject(obj.details)).length ? toObject(obj.details) : null,
        raw: toObject(obj.raw),
      } satisfies MonitoringLogRow;
    })
    .filter((item): item is MonitoringLogRow => item != null);
}

function toChatUserArray(value: unknown): ChatUserRecord[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const obj = toObject(item);
      const userId = String(obj.user_id ?? "").trim();
      if (!userId) return null;
      return {
        id: Number(obj.id ?? 0),
        user_id: userId,
        display_name: String(obj.display_name ?? ""),
        email: String(obj.email ?? ""),
        role: String(obj.role ?? "user"),
        status: String(obj.status ?? "active"),
        group_ids: toStringArray(obj.group_ids),
        metadata: toObject(obj.metadata),
        created_at: String(obj.created_at ?? ""),
        updated_at: String(obj.updated_at ?? ""),
      } satisfies ChatUserRecord;
    })
    .filter((item): item is ChatUserRecord => item != null);
}

function toChatProfileArray(value: unknown): ChatProfileRecord[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const obj = toObject(item);
      const profileId = String(obj.profile_id ?? "").trim();
      if (!profileId) return null;
      const bindings = Array.isArray(obj.mcp_bindings)
        ? obj.mcp_bindings.filter(
            (entry): entry is Record<string, unknown> =>
              !!entry && typeof entry === "object" && !Array.isArray(entry)
          )
        : [];
      return {
        id: Number(obj.id ?? 0),
        profile_id: profileId,
        name: String(obj.name ?? ""),
        description: String(obj.description ?? ""),
        mcp_bindings: bindings,
        session_defaults: toObject(obj.session_defaults),
        access_control: toObject(obj.access_control),
        created_at: String(obj.created_at ?? ""),
        updated_at: String(obj.updated_at ?? ""),
      } satisfies ChatProfileRecord;
    })
    .filter((item): item is ChatProfileRecord => item != null);
}

function toChatGroupArray(value: unknown): ChatGroupRecord[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const obj = toObject(item);
      const groupId = String(obj.group_id ?? "").trim();
      if (!groupId) return null;
      return {
        id: Number(obj.id ?? 0),
        group_id: groupId,
        name: String(obj.name ?? ""),
        description: String(obj.description ?? ""),
        roles: toStringArray(obj.roles),
        member_user_ids: toStringArray(obj.member_user_ids),
        metadata: toObject(obj.metadata),
        created_at: String(obj.created_at ?? ""),
        updated_at: String(obj.updated_at ?? ""),
      } satisfies ChatGroupRecord;
    })
    .filter((item): item is ChatGroupRecord => item != null);
}

function toChatApiKeyArray(value: unknown): ChatApiKeyRecord[] {
  if (!Array.isArray(value)) return [];
  const out: ChatApiKeyRecord[] = [];
  for (const item of value) {
    const obj = toObject(item);
    const keyId = String(obj.key_id ?? "").trim();
    if (!keyId) continue;
    out.push({
      id: Number(obj.id ?? 0),
      key_id: keyId,
      user_id: obj.user_id == null ? null : String(obj.user_id),
      name: String(obj.name ?? ""),
      key_prefix: String(obj.key_prefix ?? ""),
      scopes: toStringArray(obj.scopes),
      is_revoked: Boolean(obj.is_revoked),
      revoked_at: obj.revoked_at == null ? null : String(obj.revoked_at),
      metadata: toObject(obj.metadata),
      created_at: String(obj.created_at ?? ""),
      updated_at: String(obj.updated_at ?? ""),
      api_key: obj.api_key == null ? undefined : String(obj.api_key),
    });
  }
  return out;
}

function toToolArray(value: unknown): ToolDescriptor[] {
  if (!Array.isArray(value)) return [];

  const out: ToolDescriptor[] = [];
  for (const item of value) {
    const obj = toObject(item);
    const name = String(obj.name ?? "").trim();
    if (!name) continue;
    out.push({
      name,
      description: String(obj.description ?? ""),
      inputSchema: toObject(obj.inputSchema),
    });
  }
  return out;
}

export function createChatApi(opts: {
  baseUrl: string;
  apiKeyHeader: string;
  getApiKey: () => string;
  onAuthError: () => void;
}): ChatApi {
  const originFallback =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : "http://127.0.0.1";
  const rawBaseUrl = new URL(
    opts.baseUrl.endsWith("/") ? opts.baseUrl : `${opts.baseUrl}/`,
    originFallback
  );
  const client: ApiClient = createApiClient({
    baseUrl: opts.baseUrl,
    credentials: "include",
  });

  const authHeaders = (): Record<string, string> => {
    const key = opts.getApiKey().trim();
    if (!key) return {};
    return {
      [opts.apiKeyHeader]: key,
    };
  };

  const guarded = async <T>(fn: () => Promise<T>): Promise<T> => {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof ApiError && (error.options.status === 401 || error.options.status === 403)) {
        opts.onAuthError();
      }
      throw error;
    }
  };

  const buildRawUrl = (path: string, query?: Record<string, string>) => {
    const url = new URL(path.replace(/^\//, ""), rawBaseUrl);
    for (const [key, value] of Object.entries(query ?? {})) {
      if (!value) continue;
      url.searchParams.set(key, value);
    }
    return url;
  };

  const rawRequest = async (
    path: string,
    init: RequestInit,
    query?: Record<string, string>
  ): Promise<Response> => {
    const headers = new Headers(init.headers ?? {});
    const response = await fetch(buildRawUrl(path, query), {
      ...init,
      headers,
      credentials: "include",
    });

    if (response.status === 401 || response.status === 403) {
      opts.onAuthError();
    }

    if (response.ok) return response;

    let detail = response.statusText || `Request failed (${response.status})`;
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const payload = toObject(await response.json().catch(() => ({})));
      detail = String(payload.detail ?? payload.message ?? detail);
    } else {
      const text = (await response.text().catch(() => "")).trim();
      if (text) detail = text;
    }

    throw new ApiError(detail, {
      status: response.status,
      details: { path },
    });
  };

  return {
    getUiConfig: async () => {
      // W28A-798: /ui/config requires WebUI auth; send the api-key header (was
      // previously unauthenticated, producing a 401 on every authenticated load).
      const data = await client.get<unknown>("ui/config", { headers: authHeaders() });
      return toObject(data) as unknown as UiConfig;
    },

    getUiConfigTree: async () => {
      const data = await client.get<unknown>("ui/config/tree", {
        headers: authHeaders(),
      });
      return toObject(data) as unknown as UiConfigTree;
    },

    getUiConfigSources: async () => {
      const data = await client.get<unknown>("ui/config/sources", {
        headers: authHeaders(),
      });
      return toObject(data) as unknown as UiConfigSources;
    },

    auditSettingsReveal: async () => {
      await client.post<unknown>("ui/config/audit-reveal", {}, {
        headers: authHeaders(),
      });
    },

    listSessions: () =>
      guarded(async () => {
        const data = await client.get<unknown>("sessions", {
          headers: authHeaders(),
        });
        const obj = toObject(data);
        return toSessionArray(obj.sessions);
      }),

    createSession: (metadata = {}) =>
      guarded(async () => {
        const data = await client.post<unknown>("sessions", { metadata }, {
          headers: authHeaders(),
        });
        const obj = toObject(data);
        return String(obj.session_id ?? "").trim();
      }),

    deleteSession: (sessionId: string) =>
      guarded(async () => {
        await client.delete<unknown>(`sessions/${encodeURIComponent(sessionId)}`, {
          headers: authHeaders(),
        });
      }),

    getTranscript: (sessionId: string) =>
      guarded(async () => {
        const data = await client.get<unknown>(
          `sessions/${encodeURIComponent(sessionId)}/transcript`,
          {
            headers: authHeaders(),
          }
        );
        const obj = toObject(data);
        if (!Array.isArray(obj.events)) return [];
        return obj.events
          .map((item) => {
            const ev = toObject(item);
            return {
              event_type: String(ev.event_type ?? ""),
              timestamp: String(ev.timestamp ?? ""),
              data: toObject(ev.data),
              sequence: Number(ev.sequence ?? 0),
            } satisfies TranscriptEvent;
          })
          .filter((event) => !!event.event_type && !!event.timestamp);
      }),

    sendMessage: (sessionId: string, content: string) =>
      guarded(async () => {
        const data = await client.post<unknown>(
          `sessions/${encodeURIComponent(sessionId)}/messages`,
          { content, stream: false },
          { headers: authHeaders() }
        );
        return String(toObject(data).content ?? "");
      }),

    streamMessage: (sessionId: string, content: string, timeoutMs: number, handlers: StreamChatHandlers) =>
      guarded(
        async () =>
          new Promise<string>((resolve, reject) => {
            let finalText = "";
            let settled = false;

            const settle = (fn: () => void) => {
              if (settled) return;
              settled = true;
              fn();
            };

            client.streamPostJsonLines(
              `sessions/${encodeURIComponent(sessionId)}/messages/stream`,
              { content, stream: true },
              {
                headers: authHeaders(),
                timeoutMs,
                onEvent: (event) => {
                  handlers.onEvent?.(event);
                  const obj = toObject(event);
                  const type = String(obj.type ?? "").toLowerCase();
                  if (type === "delta") {
                    const delta = String(obj.content_delta ?? "");
                    if (delta) {
                      finalText += delta;
                      handlers.onDelta(delta);
                    }
                    return;
                  }
                  if (type === "done") {
                    settle(() => resolve(finalText));
                  }
                },
                onComplete: () => {
                  settle(() => resolve(finalText));
                },
                onError: (error) => {
                  settle(() => reject(error));
                },
              }
            );
          })
      ),

    listMcpServers: () =>
      guarded(async () => {
        const data = await client.get<unknown>("mcp/servers", {
          headers: authHeaders(),
        });
        return toMcpServerArray(toObject(data).servers);
      }),

    healthMcpServers: () =>
      guarded(async () => {
        const data = await client.get<unknown>("mcp/servers/health", {
          headers: authHeaders(),
        });
        const servers = toObject(data).servers;
        if (!Array.isArray(servers)) return [];
        return servers.map((item) => {
          const obj = toObject(item);
          return {
            index: Number(obj.index ?? -1),
            name: String(obj.name ?? ""),
            transport: String(obj.transport ?? ""),
            base_url: String(obj.base_url ?? ""),
            mcp_path: String(obj.mcp_path ?? ""),
            messages_path: String(obj.messages_path ?? ""),
            sse_path: String(obj.sse_path ?? ""),
            health_path: String(obj.health_path ?? ""),
            ok: typeof obj.ok === "boolean" ? obj.ok : undefined,
            latency_ms: Number(obj.latency_ms ?? 0),
            tool_count: Number(obj.tool_count ?? 0),
            error: obj.error == null ? null : String(obj.error),
            warning: obj.warning == null ? null : String(obj.warning),
          } satisfies McpServerHealth;
        });
      }),

    createMcpServer: (payload: Record<string, unknown>) =>
      guarded(async () => {
        const data = await client.post<unknown>("mcp/servers", { server: payload }, {
          headers: authHeaders(),
        });
        return toMcpServerArray(toObject(data).servers);
      }),

    updateMcpServer: (serverIndex: number, payload: Record<string, unknown>) =>
      guarded(async () => {
        const data = await client.put<unknown>(
          `mcp/servers/${serverIndex}`,
          { server: payload },
          { headers: authHeaders() }
        );
        return toMcpServerArray(toObject(data).servers);
      }),

    deleteMcpServer: (serverIndex: number) =>
      guarded(async () => {
        const data = await client.delete<unknown>(`mcp/servers/${serverIndex}`, {
          headers: authHeaders(),
        });
        return toMcpServerArray(toObject(data).servers);
      }),

    listTools: (sessionId: string, serverIndex: number) =>
      guarded(async () => {
        const data = await client.post<unknown>(
          `sessions/${encodeURIComponent(sessionId)}/mcp/tools/list`,
          { server_index: serverIndex },
          { headers: authHeaders() }
        );
        return toToolArray(toObject(data).tools);
      }),

    callTool: (sessionId: string, serverIndex: number, name: string, args: Record<string, unknown>) =>
      guarded(async () => {
        return client.post<unknown>(
          `sessions/${encodeURIComponent(sessionId)}/mcp/tools/call`,
          {
            server_index: serverIndex,
            name,
            arguments: args,
          },
          { headers: authHeaders() }
        );
      }),

    getSessionPreferences: (sessionId: string) =>
      guarded(async () => {
        const data = await client.get<unknown>(
          `sessions/${encodeURIComponent(sessionId)}/preferences`,
          { headers: authHeaders() }
        );
        const selected = toObject(data).selected_mcp_server_indices;
        if (!Array.isArray(selected)) return [];
        return selected
          .map((index) => Number(index))
          .filter((index) => Number.isInteger(index) && index >= 0);
      }),

    setSessionPreferences: (sessionId: string, selectedIndices: number[]) =>
      guarded(async () => {
        const data = await client.put<unknown>(
          `sessions/${encodeURIComponent(sessionId)}/preferences`,
          { selected_mcp_server_indices: selectedIndices },
          { headers: authHeaders() }
        );
        const selected = toObject(data).selected_mcp_server_indices;
        if (!Array.isArray(selected)) return [];
        return selected
          .map((index) => Number(index))
          .filter((index) => Number.isInteger(index) && index >= 0);
      }),

    listProfiles: () =>
      guarded(async () => {
        const data = await client.get<unknown>("v1/profiles", {
          headers: authHeaders(),
        });
        return toChatProfileArray(toObject(data).profiles);
      }),

    createProfile: (payload: Record<string, unknown>) =>
      guarded(async () => {
        const data = await client.post<unknown>("v1/profiles", payload, {
          headers: authHeaders(),
        });
        return toChatProfileArray([toObject(data).profile])[0];
      }),

    updateProfile: (profileId: string, payload: Record<string, unknown>) =>
      guarded(async () => {
        const data = await client.put<unknown>(
          `v1/profiles/${encodeURIComponent(profileId)}`,
          payload,
          { headers: authHeaders() }
        );
        return toChatProfileArray([toObject(data).profile])[0];
      }),

    deleteProfile: (profileId: string) =>
      guarded(async () => {
        await client.delete<unknown>(`v1/profiles/${encodeURIComponent(profileId)}`, {
          headers: authHeaders(),
        });
      }),

    listFileProfiles: (sessionId: string, serverIndex: number) =>
      guarded(async () => {
        const data = await client.get<unknown>(
          `sessions/${encodeURIComponent(sessionId)}/mcp/file-profiles?server_index=${encodeURIComponent(String(serverIndex))}`,
          {
            headers: authHeaders(),
          }
        );
        const items = toObject(data).profiles;
        if (!Array.isArray(items)) return [];
        return items
          .map((item) => {
            if (typeof item === "string") return item.trim();
            if (item && typeof item === "object" && !Array.isArray(item)) {
              return String((item as Record<string, unknown>).name ?? "").trim();
            }
            return "";
          })
          .filter(Boolean);
      }),

    uploadFile: (sessionId: string, args: UploadSessionFileArgs) =>
      guarded(async () => {
        const formData = new FormData();
        formData.set("path", args.path);
        formData.set("file", args.file, args.file.name);
        if (args.serverIndex != null) {
          formData.set("server_index", String(args.serverIndex));
        }
        formData.set("overwrite", String(args.overwrite ?? true));
        formData.set("dry_run", String(args.dryRun ?? false));
        if (args.requireInitialize != null) {
          formData.set("require_initialize", String(args.requireInitialize));
        }

        const response = await rawRequest(
          `sessions/${encodeURIComponent(sessionId)}/mcp/files/upload-multipart`,
          {
            method: "POST",
            body: formData,
            headers: authHeaders(),
          }
        );

        const payload = toObject(await response.json().catch(() => ({})));
        return {
          path: String(payload.path ?? "").trim(),
          bytesWritten:
            payload.bytes_written == null ? undefined : Number(payload.bytes_written ?? 0),
          dryRun: payload.dry_run == null ? undefined : Boolean(payload.dry_run),
          serverIndex: toNullableServerIndex(payload.mcp_server_index),
          toolResult: toObject(payload.tool_result),
        } satisfies SessionFileTransferResult;
      }),

    uploadFileByReference: (sessionId: string, args: UploadSessionFileByReferenceArgs) =>
      guarded(async () => {
        const body: Record<string, unknown> = {
          path: args.path,
          source_url: args.sourceUrl,
          overwrite: args.overwrite ?? true,
          dry_run: args.dryRun ?? false,
        };
        if (args.serverIndex != null) {
          body.server_index = args.serverIndex;
        }
        if (args.requireInitialize != null) {
          body.require_initialize = args.requireInitialize;
        }

        const response = await rawRequest(
          `sessions/${encodeURIComponent(sessionId)}/mcp/files/upload`,
          {
            method: "POST",
            body: JSON.stringify(body),
            headers: {
              ...authHeaders(),
              "Content-Type": "application/json",
            },
          }
        );

        const payload = toObject(await response.json().catch(() => ({})));
        return {
          path: String(payload.path ?? "").trim(),
          bytesWritten:
            payload.bytes_written == null ? undefined : Number(payload.bytes_written ?? 0),
          dryRun: payload.dry_run == null ? undefined : Boolean(payload.dry_run),
          serverIndex: toNullableServerIndex(payload.mcp_server_index),
          toolResult: toObject(payload.tool_result),
        } satisfies SessionFileTransferResult;
      }),

    downloadFileContent: (sessionId: string, args: DownloadSessionFileContentArgs) =>
      guarded(async () => {
        const response = await rawRequest(
          `sessions/${encodeURIComponent(sessionId)}/mcp/files/download/content`,
          {
            method: "GET",
            headers: authHeaders(),
          },
          {
            path: args.path,
            server_index: args.serverIndex == null ? "" : String(args.serverIndex),
            require_initialize:
              args.requireInitialize == null ? "" : String(args.requireInitialize),
            download_name: args.downloadName ?? "",
          }
        );

        const blob = await response.blob();
        return {
          path: args.path,
          filename:
            parseContentDispositionFilename(response.headers.get("content-disposition")) ||
            args.downloadName ||
            args.path.split("/").filter(Boolean).pop() ||
            "download.bin",
          contentType: response.headers.get("content-type") || "application/octet-stream",
          serverIndex:
            toNullableServerIndex(response.headers.get("x-mcp-server-index")) ??
            toNullableServerIndex(args.serverIndex),
          blob,
        } satisfies SessionFileContent;
      }),

    listUsers: () =>
      guarded(async () => {
        const data = await client.get<unknown>("v1/users", {
          headers: authHeaders(),
        });
        return toChatUserArray(toObject(data).users);
      }),

    createUser: (payload: Record<string, unknown>) =>
      guarded(async () => {
        const data = await client.post<unknown>("v1/users", payload, {
          headers: authHeaders(),
        });
        return toChatUserArray([toObject(data).user])[0];
      }),

    updateUser: (userId: string, payload: Record<string, unknown>) =>
      guarded(async () => {
        const data = await client.put<unknown>(`v1/users/${encodeURIComponent(userId)}`, payload, {
          headers: authHeaders(),
        });
        return toChatUserArray([toObject(data).user])[0];
      }),

    deleteUser: (userId: string) =>
      guarded(async () => {
        await client.delete<unknown>(`v1/users/${encodeURIComponent(userId)}`, {
          headers: authHeaders(),
        });
      }),

    listGroups: () =>
      guarded(async () => {
        const data = await client.get<unknown>("v1/groups", {
          headers: authHeaders(),
        });
        return toChatGroupArray(toObject(data).groups);
      }),

    createGroup: (payload: Record<string, unknown>) =>
      guarded(async () => {
        const data = await client.post<unknown>("v1/groups", payload, {
          headers: authHeaders(),
        });
        return toChatGroupArray([toObject(data).group])[0];
      }),

    updateGroup: (groupId: string, payload: Record<string, unknown>) =>
      guarded(async () => {
        const data = await client.put<unknown>(`v1/groups/${encodeURIComponent(groupId)}`, payload, {
          headers: authHeaders(),
        });
        return toChatGroupArray([toObject(data).group])[0];
      }),

    deleteGroup: (groupId: string) =>
      guarded(async () => {
        await client.delete<unknown>(`v1/groups/${encodeURIComponent(groupId)}`, {
          headers: authHeaders(),
        });
      }),

    listApiKeys: () =>
      guarded(async () => {
        const data = await client.get<unknown>("v1/api-keys", {
          headers: authHeaders(),
        });
        return toChatApiKeyArray(toObject(data).api_keys);
      }),

    createApiKey: (payload: Record<string, unknown>) =>
      guarded(async () => {
        const data = await client.post<unknown>("v1/api-keys", payload, {
          headers: authHeaders(),
        });
        return toChatApiKeyArray([toObject(data).api_key])[0];
      }),

    revokeApiKey: (keyId: string) =>
      guarded(async () => {
        await client.delete<unknown>(`v1/api-keys/${encodeURIComponent(keyId)}`, {
          headers: authHeaders(),
        });
      }),

    getVersionInfo: () =>
      guarded(async () => {
        const data = await client.get<unknown>("version", {
          headers: authHeaders(),
        });
        const obj = toObject(data);
        return {
          application: String(obj.application ?? ""),
          version: String(obj.version ?? ""),
          environment: String(obj.environment ?? ""),
          server_id: String(obj.server_id ?? ""),
          // W28E-1863 fix-wave-d (WSC-014): build provenance for the About page.
          source_commit: String(obj.source_commit ?? obj.commit ?? ""),
          build_date: String(obj.build_date ?? ""),
        } satisfies VersionInfoRecord;
      }),

    getStatus: () =>
      guarded(async () => {
        const data = await client.get<unknown>("metrics", {
          headers: authHeaders(),
        });
        const obj = toObject(data);
        const resources = toObject(obj.resources);
        return {
          uptime_seconds: Number(resources.uptime_seconds ?? 0),
          memory_mb: resources.memory_mb == null ? null : Number(resources.memory_mb ?? 0),
          memory_percent: resources.memory_percent == null ? null : Number(resources.memory_percent ?? 0),
          cpu_percent: resources.cpu_percent == null ? null : Number(resources.cpu_percent ?? 0),
          disk_percent: resources.disk_percent == null ? null : Number(resources.disk_percent ?? 0),
          active_connections: Number(resources.active_connections ?? 0),
          active_chat_sessions: Number(resources.active_chat_sessions ?? 0),
          connected_mcp_endpoints: Number(resources.connected_mcp_endpoints ?? 0),
          message_count: Number(resources.message_count ?? 0),
          llm_model: String(resources.llm_model ?? ""),
          environment: String(resources.environment ?? ""),
          server_id: String(resources.server_id ?? ""),
        } satisfies ResourceStatusRecord;
      }),

    testModel: () =>
      guarded(async () => {
        const data = await client.post<unknown>("llm/test", {}, {
          headers: authHeaders(),
        });
        const obj = toObject(data);
        return {
          ok: Boolean(obj.ok),
          model: String(obj.model ?? ""),
          provider: String(obj.provider ?? ""),
          latency_ms: Number(obj.latency_ms ?? 0),
          sample: String(obj.sample ?? ""),
          error: String(obj.error ?? ""),
        } satisfies LlmTestResult;
      }),

    getMonitoringSummary: () =>
      guarded(async () => {
        const data = await client.get<unknown>("ui/monitoring", {
          headers: authHeaders(),
        });
        const obj = toObject(data);
        const metrics = toObject(obj.metrics);
        const logs = Array.isArray(obj.logs)
          ? obj.logs.map((item) => {
              const entry = toObject(item);
              return {
                timestamp: String(entry.timestamp ?? ""),
                level: String(entry.level ?? "info"),
                logger: String(entry.logger ?? "runtime"),
                message: String(entry.message ?? ""),
                raw_message: String(entry.raw_message ?? entry.message ?? ""),
                correlation_id: String(entry.correlation_id ?? ""),
                source: String(entry.source ?? ""),
                type: String(entry.type ?? "sessions"),
              };
            })
          : [];
        const resources = toObject(obj.resources);
        return {
          metrics: {
            active_sessions: Number(metrics.active_sessions ?? 0),
            messages_last_hour: Number(metrics.messages_last_hour ?? 0),
            tool_calls_last_hour: Number(metrics.tool_calls_last_hour ?? 0),
            average_response_ms: Number(metrics.average_response_ms ?? 0),
            connected_mcp_endpoints: Number(metrics.connected_mcp_endpoints ?? 0),
            message_count: Number(metrics.message_count ?? 0),
            llm_model: String(metrics.llm_model ?? ""),
          },
          resources: {
            uptime_seconds: Number(resources.uptime_seconds ?? 0),
            memory_mb: resources.memory_mb == null ? null : Number(resources.memory_mb ?? 0),
            memory_percent: resources.memory_percent == null ? null : Number(resources.memory_percent ?? 0),
            cpu_percent: resources.cpu_percent == null ? null : Number(resources.cpu_percent ?? 0),
            disk_percent: resources.disk_percent == null ? null : Number(resources.disk_percent ?? 0),
            active_connections: Number(resources.active_connections ?? 0),
            active_chat_sessions: Number(resources.active_chat_sessions ?? 0),
            connected_mcp_endpoints: Number(resources.connected_mcp_endpoints ?? 0),
            message_count: Number(resources.message_count ?? 0),
            llm_model: String(resources.llm_model ?? ""),
            environment: String(resources.environment ?? ""),
            server_id: String(resources.server_id ?? ""),
          },
          logs,
        } satisfies MonitoringSummary;
      }),

    getLogs: (params = {}) =>
      guarded(async () => {
        const limit = Number(params.limit ?? 100);
        const surface = params.surface ?? "audit";
        const data = await client.get<unknown>(
          `ui/logs?limit=${encodeURIComponent(String(limit))}&surface=${encodeURIComponent(surface)}`,
          {
            headers: authHeaders(),
          }
        );
        const obj = toObject(data);
        return {
          entries: toMonitoringLogRows(obj.entries),
          count: Number(obj.count ?? 0),
          surface: toLogSurfaceId(obj.surface ?? surface),
          surface_label: String(obj.surface_label ?? "").trim(),
          source_path: String(obj.source_path ?? "").trim(),
          available_surfaces: toLogSurfaceOptions(obj.available_surfaces),
        } satisfies LogsResponse;
      }),

    listJobs: () =>
      guarded(async () => {
        const data = await client.get<unknown>("v1/jobs", {
          headers: authHeaders(),
        });
        const obj = toObject(data);
        const jobs = obj.jobs;
        if (!Array.isArray(jobs)) return [];
        return jobs.map((item) => {
          const job = toObject(item);
          return {
            job_id: String(job.job_id ?? ""),
            job_type: String(job.job_type ?? ""),
            status: String(job.status ?? ""),
            created_at: String(job.created_at ?? ""),
            updated_at: String(job.updated_at ?? ""),
            started_at: job.started_at == null ? undefined : String(job.started_at),
            finished_at: job.finished_at == null ? undefined : String(job.finished_at),
            session_id: String(job.session_id ?? ""),
            correlation_id: String(job.correlation_id ?? ""),
            user_id: String(job.user_id ?? ""),
            attempt: job.attempt == null ? undefined : Number(job.attempt),
            max_attempts: job.max_attempts == null ? undefined : Number(job.max_attempts),
            result_ref: job.result_ref == null ? undefined : String(job.result_ref),
            payload: toObject(job.payload),
          } satisfies JobRecord;
        }).filter((item) => item.job_id);
      }),
  };
}
