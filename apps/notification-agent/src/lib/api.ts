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

// @cloud-dog/app-notification-agent — Real browser API client for the notification web UI.
// Covers: FR1.28, FR1.29, FR1.30, FR1.31, FR1.32

import { createApiClient } from '@cloud-dog/api-client';

export type RuntimeHealth = Readonly<{
  status: string;
  application?: string;
  version?: string;
  env_file?: string;
  checks?: Record<string, unknown>;
}>;

export type RuntimeStatus = Readonly<{
  uptime_seconds?: number | null;
  memory_mb?: number | null;
  memory_percent?: number | null;
  cpu_percent?: number | null;
  disk_percent?: number | null;
  active_connections?: number | null;
  channel_count?: number | null;
  messages_sent_24h?: number | null;
  delivery_success_rate?: number | null;
  queue_depth?: number;
  retry_queue_size?: number | null;
  oldest_queue_item_age_seconds?: number | null;
  channels?: Record<string, Readonly<{
    type?: string;
    enabled?: boolean;
    circuit_state?: string | null;
    error_count?: number;
  }>>;
  timestamp?: string | null;
}>;

export type RuntimeLogEntry = Readonly<{
  timestamp?: string | null;
  level?: string | null;
  message: string;
  source?: string | null;
}>;

export type McpToolRecord = Readonly<{
  name: string;
  description?: string | null;
  inputSchema?: unknown;
}>;

export type UserRecord = Readonly<{
  id: number;
  username: string;
  email: string;
  display_name?: string | null;
  role?: string | null;
  language?: string | null;
  preferred_channel?: string | null;
  content_style?: string | null;
}>;

export type GroupRecord = Readonly<{
  id: number;
  name: string;
  description?: string | null;
  enabled?: boolean;
}>;

export type GroupMemberRecord = Readonly<{
  id?: number;
  member_id?: number;
  user_id: number;
  username?: string | null;
  email?: string | null;
  display_name?: string | null;
  role?: string | null;
}>;

export type ChannelRecord = Readonly<{
  id: number;
  name: string;
  type: string;
  enabled?: boolean;
  config?: Record<string, unknown> | null;
  created_at?: string | null;
  message_count?: number | null;
  last_used?: string | null;
}>;

export type MessageRecord = Readonly<{
  id: number;
  status?: string | null;
  created_at?: string | null;
  created_by?: string | null;
  subject?: string | null;
  message_guid?: string | null;
  channel_name?: string | null;
  channel_type?: string | null;
  delivery_count?: number | null;
  recipients?: string[] | null;
}>;

export type MessageDetailRecord = Readonly<{
  id: number;
  guid?: string | null;
  status?: string | null;
  created_at?: string | null;
  content?: string | null;
  content_json?: unknown;
  variables_json?: unknown;
  deliveries?: Readonly<{
    total?: number | null;
    by_state?: Record<string, number> | null;
  }> | null;
  formatted_content?: string | null;
  format_applied?: string | null;
  language_applied?: string | null;
}>;

export type DeliveryRecord = Readonly<{
  id: number;
  message_id?: number | null;
  destination?: string | null;
  state?: string | null;
  channel_name?: string | null;
  error?: string | null;
  tracking_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  delivered_at?: string | null;
}>;

export type AdminApiKeyRecord = Readonly<{
  api_key_id: string;
  owner_user_id?: string | null;
  key_prefix?: string | null;
  created_at?: string | null;
  expires_at?: string | null;
  last_used?: string | null;
  last_used_at?: string | null;
  revoked?: boolean;
  status?: string | null;
}>;

export type RbacRoleRecord = Readonly<{
  name: string;
  description?: string | null;
  permissions: string[];
  channels?: string[];
  functions?: string[];
}>;

export type PromptRecord = Readonly<{
  id: number;
  name: string;
  prompt_text: string;
  channel_type?: string | null;
  group_id?: number | null;
  language?: string | null;
  keyword?: string | null;
  variables_json?: string | null;
  priority?: number | null;
  enabled?: boolean | number | null;
  created_at?: string | null;
  updated_at?: string | null;
}>;

export type JobRecord = Readonly<{
  job_id: string;
  job_type: string;
  queue_name: string;
  status?: string | null;
  priority?: number | null;
  user_id?: string | null;
  request_auth_identity?: string | null;
  request_source?: string | null;
  request_auth_method?: string | null;
  request_ip?: string | null;
  request_user_agent?: string | null;
  correlation_id?: string | null;
  channel_id?: string | number | null;
  channel_name?: string | null;
  message_id?: string | number | null;
  destination?: string | null;
  attempt?: number | null;
  max_attempts?: number | null;
  started_at?: string | null;
  finished_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  claimed_by?: string | null;
  last_error?: Record<string, unknown> | string | null;
  result_ref?: string | null;
  progress?: Record<string, unknown> | null;
  outcome_summary?: string | null;
  payload?: Record<string, unknown> | null;
}>;

export type JobQueueStatus = Readonly<Record<string, number>>;

export type LogSurfaceId = 'audit' | 'api' | 'web' | 'mcp' | 'a2a';

/** PS-40 NIST AU-3 compliant audit or application log entry. */
export type AuditLogEntry = Readonly<{
  id: string;
  surface: LogSurfaceId;
  surface_label?: string;
  source_path?: string;
  line_number?: number;
  timestamp?: string | null;
  message?: string | null;
  logger?: string | null;
  level?: string | null;
  event_type?: string | null;
  action?: string | null;
  outcome?: string | null;
  severity?: string | null;
  correlation_id?: string;
  trace_id?: string;
  request_id?: string;
  service?: string;
  service_instance?: string;
  environment?: string;
  actor?: Readonly<{
    type?: string | null;
    id?: string | null;
    roles?: string[] | null;
    ip?: string | null;
    user_agent?: string | null;
  }>;
  target?: Readonly<{
    type?: string | null;
    id?: string | null;
    name?: string | null;
  }>;
  details?: Record<string, unknown> | null;
  duration_ms?: number;
  raw?: unknown;
}>;

export type LogsResponse = Readonly<{
  entries: AuditLogEntry[];
  count: number;
  surface: LogSurfaceId;
  surface_label?: string;
  source_path?: string;
  available_surfaces?: Array<{
    id: LogSurfaceId;
    label: string;
  }>;
}>;

export type ConsoleCallOptions = Readonly<{
  requestId?: string;
  correlationId?: string;
  adminOverrideKey?: string;
}>;

export type NotificationAdminApi = Readonly<{
  getHealth: () => Promise<RuntimeHealth>;
  getStatus: () => Promise<RuntimeStatus>;
  getConfigDump: () => Promise<Record<string, unknown>>;
  listLogs: (logType?: string, lines?: number) => Promise<RuntimeLogEntry[]>;
  listStructuredLogs: (params?: { surface?: LogSurfaceId; limit?: number; query?: string }) => Promise<LogsResponse>;
  listMcpTools: () => Promise<McpToolRecord[]>;
  callMcpTool: (toolName: string, args: unknown, options?: ConsoleCallOptions) => Promise<unknown>;
  sendA2a: (topic: string, payload: unknown, options?: ConsoleCallOptions) => Promise<unknown>;
  listUsers: (query?: string) => Promise<UserRecord[]>;
  createUser: (payload: Record<string, unknown>) => Promise<UserRecord>;
  updateUser: (userId: number, payload: Record<string, unknown>) => Promise<UserRecord>;
  deleteUser: (userId: number) => Promise<void>;
  listGroups: () => Promise<GroupRecord[]>;
  createGroup: (payload: Record<string, unknown>) => Promise<GroupRecord>;
  updateGroup: (groupId: number, payload: Record<string, unknown>) => Promise<Record<string, unknown>>;
  deleteGroup: (groupId: number) => Promise<void>;
  listGroupMembers: (groupId: number) => Promise<GroupMemberRecord[]>;
  addGroupMember: (groupId: number, payload: Record<string, unknown>) => Promise<Record<string, unknown>>;
  removeGroupMember: (groupId: number, userId: number) => Promise<Record<string, unknown>>;
  listChannels: () => Promise<ChannelRecord[]>;
  createChannel: (payload: Record<string, unknown>) => Promise<ChannelRecord>;
  updateChannel: (channelId: number, payload: Record<string, unknown>) => Promise<ChannelRecord>;
  deleteChannel: (channelId: number) => Promise<void>;
  testChannel: (channelId: number, payload: Record<string, unknown>) => Promise<Record<string, unknown>>;
  enableChannel: (channelId: number) => Promise<Record<string, unknown>>;
  disableChannel: (channelId: number) => Promise<Record<string, unknown>>;
  listMessages: () => Promise<MessageRecord[]>;
  getMessage: (messageId: number) => Promise<MessageDetailRecord>;
  createMessage: (payload: Record<string, unknown>) => Promise<Record<string, unknown>>;
  deleteMessage: (messageId: number) => Promise<void>;
  cancelMessage: (messageId: number) => Promise<Record<string, unknown>>;
  listMessageDeliveries: (messageId: number) => Promise<DeliveryRecord[]>;
  listDeliveries: (messageId?: string) => Promise<DeliveryRecord[]>;
  deleteDelivery: (deliveryId: number) => Promise<void>;
  resendDelivery: (deliveryId: number) => Promise<Record<string, unknown>>;
  abortDelivery: (deliveryId: number) => Promise<Record<string, unknown>>;
  listJobs: (limit?: number) => Promise<JobRecord[]>;
  getJob: (jobId: string) => Promise<JobRecord>;
  getJobQueueStatus: () => Promise<JobQueueStatus>;
  cancelJob: (jobId: string) => Promise<Record<string, unknown>>;
  retryJob: (jobId: string) => Promise<Record<string, unknown>>;
  deleteJob: (jobId: string) => Promise<Record<string, unknown>>;
  listAdminApiKeys: (ownerUserId?: string) => Promise<AdminApiKeyRecord[]>;
  createAdminApiKey: (payload: Record<string, unknown>) => Promise<Record<string, unknown>>;
  revokeAdminApiKey: (keyId: string) => Promise<Record<string, unknown>>;
  listRbacRoles: () => Promise<RbacRoleRecord[]>;
  createRbacRole: (payload: Record<string, unknown>) => Promise<RbacRoleRecord>;
  updateRbacRole: (roleName: string, payload: Record<string, unknown>) => Promise<RbacRoleRecord>;
  deleteRbacRole: (roleName: string) => Promise<Record<string, unknown>>;
  listPrompts: () => Promise<PromptRecord[]>;
  createPrompt: (payload: Record<string, unknown>) => Promise<PromptRecord>;
  updatePrompt: (promptId: number, payload: Record<string, unknown>) => Promise<PromptRecord>;
  deletePrompt: (promptId: number) => Promise<void>;
  queryConfig: (keys: string[]) => Promise<Record<string, unknown>>;
  updateConfig: (payload: Record<string, unknown>) => Promise<Record<string, unknown>>;
}>;

function asArray<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === 'object' && Array.isArray((payload as { items?: unknown[] }).items)) {
    return (payload as { items: T[] }).items;
  }
  return [];
}

// W28A-#A89: Cookie-to-api-key bridge — read the non-HttpOnly notification_api_key
// cookie set by /auth/login (see notification-agent-mcp-server web_server.py),
// forward as X-API-Key on every request. The API tier (`/api/v1/*`) mounts
// cloud_dog_idam.AuthContextMiddleware with auth_scheme="api_key" and only
// honours the X-API-Key header — it does NOT consult cookies. Mirrors
// chat-client's chat_client_api_key bridge.
function readNotificationApiKeyFromCookie(): string | undefined {
  if (typeof document === 'undefined' || !document.cookie) return undefined;
  const match = document.cookie.match(/(?:^|;\s*)notification_api_key=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : undefined;
}

export function createNotificationAdminApi(baseUrl: string): NotificationAdminApi {
  const apiKey = readNotificationApiKeyFromCookie();
  const client = createApiClient({
    baseUrl,
    defaultHeaders: apiKey ? { 'X-API-Key': apiKey } : undefined,
  });

  return {
    getHealth: () => client.get<RuntimeHealth>('/health'),
    getStatus: () => client.get<RuntimeStatus>('/webapi/proxy/status'),
    getConfigDump: () => client.get<Record<string, unknown>>('/webapi/proxy/config'),
    listLogs: async (logType, lines) =>
      asArray<RuntimeLogEntry>(
        await client.get<unknown>('/webapi/proxy/logs', {
          query: {
            log_type: logType?.trim() || 'api',
            lines: lines ?? 200,
          },
        }),
      ),
    listStructuredLogs: async (params = {}) => {
      const response = await client.get<LogsResponse>('/webapi/proxy/structured-logs', {
        query: {
          surface: params.surface ?? 'audit',
          limit: params.limit ?? 100,
          query: params.query || undefined,
        },
      });
      return {
        entries: response.entries ?? [],
        count: Number(response.count ?? response.entries?.length ?? 0),
        surface: response.surface ?? (params.surface ?? 'audit'),
        surface_label: response.surface_label,
        source_path: response.source_path,
        available_surfaces: response.available_surfaces ?? [],
      };
    },
    listMcpTools: async () => asArray<McpToolRecord>(await client.get<unknown>('/webapi/proxy/mcp/tools')),
    callMcpTool: (toolName, args, options) =>
      client.post<unknown>(
        '/webapi/proxy/mcp/tools/call',
        { name: toolName, arguments: args, admin_override_key: options?.adminOverrideKey || undefined },
        {
          requestId: options?.requestId,
          correlationId: options?.correlationId,
          headers: options?.adminOverrideKey ? { 'X-Admin-Override-Key': options.adminOverrideKey } : undefined,
        },
      ),
    sendA2a: (topic, payload, options) =>
      client.post<unknown>(
        '/webapi/proxy/a2a/send',
        { topic, payload, admin_override_key: options?.adminOverrideKey || undefined },
        {
          requestId: options?.requestId,
          correlationId: options?.correlationId,
          headers: options?.adminOverrideKey ? { 'X-Admin-Override-Key': options.adminOverrideKey } : undefined,
        },
      ),
    listUsers: async (query) => {
      return asArray<UserRecord>(
        await client.get<unknown>('/webapi/proxy/users', {
          query: { limit: 1000, q: query?.trim() || undefined },
        }),
      );
    },
    createUser: (payload) => client.post<UserRecord>('/webapi/proxy/users', payload),
    updateUser: (userId, payload) => client.patch<UserRecord>(`/webapi/proxy/users/${userId}`, payload),
    deleteUser: async (userId) => {
      await client.delete<unknown>(`/webapi/proxy/users/${userId}`);
    },
    listGroups: async () => asArray<GroupRecord>(await client.get<unknown>('/webapi/proxy/groups')),
    createGroup: (payload) => client.post<GroupRecord>('/webapi/proxy/groups', payload),
    updateGroup: (groupId, payload) => client.put<Record<string, unknown>>(`/webapi/proxy/groups/${groupId}`, payload),
    deleteGroup: async (groupId) => {
      await client.delete<unknown>(`/webapi/proxy/groups/${groupId}`);
    },
    listGroupMembers: async (groupId) =>
      asArray<GroupMemberRecord>(await client.get<unknown>(`/webapi/proxy/groups/${groupId}/members`)),
    addGroupMember: (groupId, payload) =>
      client.post<Record<string, unknown>>(`/webapi/proxy/groups/${groupId}/members`, payload),
    removeGroupMember: (groupId, userId) =>
      client.delete<Record<string, unknown>>(`/webapi/proxy/groups/${groupId}/members/${userId}`),
    listChannels: async () => asArray<ChannelRecord>(await client.get<unknown>('/webapi/proxy/channels')),
    createChannel: (payload) => client.post<ChannelRecord>('/webapi/proxy/channels', payload),
    updateChannel: (channelId, payload) =>
      client.patch<ChannelRecord>(`/webapi/proxy/channels/${channelId}`, payload),
    deleteChannel: async (channelId) => {
      await client.delete<unknown>(`/webapi/proxy/channels/${channelId}`);
    },
    testChannel: (channelId, payload) =>
      client.post<Record<string, unknown>>(`/webapi/proxy/channels/${channelId}/test`, payload),
    enableChannel: (channelId) =>
      client.post<Record<string, unknown>>(`/webapi/proxy/channels/${channelId}/enable`, {}),
    disableChannel: (channelId) =>
      client.post<Record<string, unknown>>(`/webapi/proxy/channels/${channelId}/disable`, {}),
    listMessages: async () =>
      asArray<MessageRecord>(await client.get<unknown>('/webapi/proxy/messages', { query: { limit: 1000 } })),
    getMessage: (messageId) => client.get<MessageDetailRecord>(`/webapi/proxy/messages/${messageId}`, {
      query: { format: 'json' },
    }),
    createMessage: (payload) => client.post<Record<string, unknown>>('/webapi/proxy/messages', payload),
    deleteMessage: async (messageId) => {
      await client.delete<unknown>(`/webapi/proxy/messages/${messageId}`);
    },
    cancelMessage: (messageId) =>
      client.post<Record<string, unknown>>(`/webapi/proxy/messages/${messageId}/cancel`, {}),
    listMessageDeliveries: async (messageId) =>
      asArray<DeliveryRecord>(await client.get<unknown>(`/webapi/proxy/messages/${messageId}/deliveries`)),
    listDeliveries: async (messageId) => {
      return asArray<DeliveryRecord>(
        await client.get<unknown>('/webapi/proxy/deliveries', {
          query: { limit: 500, message_id: messageId?.trim() || undefined },
        }),
      );
    },
    deleteDelivery: async (deliveryId) => {
      await client.delete<unknown>(`/webapi/proxy/deliveries/${deliveryId}`);
    },
    resendDelivery: (deliveryId) => client.post<Record<string, unknown>>(`/webapi/proxy/deliveries/${deliveryId}/resend`, {}),
    abortDelivery: (deliveryId) => client.post<Record<string, unknown>>(`/webapi/proxy/deliveries/${deliveryId}/abort`, {}),
    listJobs: async (limit) =>
      asArray<JobRecord>(
        await client.get<unknown>('/webapi/proxy/jobs', {
          query: { limit: limit ?? 100 },
        }),
      ),
    getJob: (jobId) => client.get<JobRecord>(`/webapi/proxy/jobs/${jobId}`),
    getJobQueueStatus: () => client.get<JobQueueStatus>('/webapi/proxy/jobs/queue/status'),
    cancelJob: (jobId) => client.post<Record<string, unknown>>(`/webapi/proxy/jobs/${jobId}/cancel`, {}),
    retryJob: (jobId) => client.post<Record<string, unknown>>(`/webapi/proxy/jobs/${jobId}/retry`, {}),
    deleteJob: (jobId) => client.delete<Record<string, unknown>>(`/webapi/proxy/jobs/${jobId}`),
    listAdminApiKeys: async (ownerUserId) =>
      asArray<AdminApiKeyRecord>(
        await client.get<unknown>('/webapi/proxy/admin/api-keys', {
          query: { owner_user_id: ownerUserId?.trim() || undefined },
        }),
      ),
    createAdminApiKey: (payload) => client.post<Record<string, unknown>>('/webapi/proxy/admin/api-keys', payload),
    revokeAdminApiKey: (keyId) => client.delete<Record<string, unknown>>(`/webapi/proxy/admin/api-keys/${keyId}`),
    listRbacRoles: async () => asArray<RbacRoleRecord>(await client.get<unknown>('/webapi/proxy/rbac/roles')),
    createRbacRole: (payload) => client.post<RbacRoleRecord>('/webapi/proxy/rbac/roles', payload),
    updateRbacRole: (roleName, payload) =>
      client.put<RbacRoleRecord>(`/webapi/proxy/rbac/roles/${encodeURIComponent(roleName)}`, payload),
    deleteRbacRole: (roleName) =>
      client.delete<Record<string, unknown>>(`/webapi/proxy/rbac/roles/${encodeURIComponent(roleName)}`),
    listPrompts: async () => asArray<PromptRecord>(await client.get<unknown>('/webapi/proxy/prompts')),
    createPrompt: (payload) => client.post<PromptRecord>('/webapi/proxy/prompts', payload),
    updatePrompt: (promptId, payload) => client.patch<PromptRecord>(`/webapi/proxy/prompts/${promptId}`, payload),
    deletePrompt: async (promptId) => {
      await client.delete<unknown>(`/webapi/proxy/prompts/${promptId}`);
    },
    queryConfig: (keys) => client.post<Record<string, unknown>>('/webapi/proxy/config/query', { keys }),
    updateConfig: (payload) => client.post<Record<string, unknown>>('/webapi/proxy/config/update', payload),
  };
}
