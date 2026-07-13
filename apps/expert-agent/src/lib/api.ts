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

// @cloud-dog/app-expert-agent — Browser API client for the expert-agent UI.
// Covers: FR1.21, FR1.22, FR1.23, FR1.35

import { ApiError, createApiClient } from '@cloud-dog/api-client';

type RequestOptions = Readonly<{
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
}>;

export type RuntimeHealth = Readonly<{
  status: string;
  version?: string;
  checks?: Record<string, unknown>;
}>;

export type StatusPayload = Readonly<{
  status: string;
  service: string;
  application?: string;
  version?: string;
  uptime_seconds?: number;
  memory_mb?: number;
  memory_percent?: number;
  cpu_percent?: number;
  disk_percent?: number;
  active_connections?: number;
  active_sessions?: number;
  expert_count?: number;
  knowledge_item_count?: number;
  channel_count?: number;
  queue_depth?: number;
  active_jobs?: number;
}>;

export type QueueStatus = Readonly<{
  status?: string;
  queue_depth?: number;
  active_jobs?: number;
  failed_24h?: number;
  total?: number;
  status_counts?: Record<string, number>;
}>;

export type UserRecord = Readonly<{
  id: number;
  username: string;
  email: string;
  display_name?: string | null;
  role?: string | null;
  enabled?: boolean;
  created_at?: string | null;
  updated_at?: string | null;
}>;

export type GroupRecord = Readonly<{
  id: number;
  name: string;
  description?: string | null;
  enabled?: boolean;
  created_at?: string | null;
  updated_at?: string | null;
}>;

export type GroupMemberRecord = Readonly<{
  id: number;
  username: string;
  email?: string | null;
  display_name?: string | null;
  role?: string | null;
}>;

export type ChannelRecord = Readonly<{
  id: number;
  name: string;
  expert_id?: number | null;
  expert_config_id?: number | null;
  description?: string | null;
  context_type?: string | null;
  expected_outcomes?: string | null;
  history_scope?: string | null;
  history_limitation?: Record<string, unknown> | null;
  rerank_model?: string | null;
  access_control?: ChannelAccessControl | null;
  enabled?: boolean;
  created_at?: string | null;
  updated_at?: string | null;
}>;

export type ChannelAccessControl = Readonly<{
  users?: Array<Record<string, unknown>>;
  groups?: Array<Record<string, unknown>>;
  roles?: string[];
}>;

export type ChannelConfigRecord = Readonly<{
  channel_id: number;
  context_type?: string | null;
  expected_outcomes?: string | null;
  history_scope?: string | null;
  history_limitation?: Record<string, unknown> | null;
  rerank_model?: string | null;
  access_control?: ChannelAccessControl | null;
  llm_provider?: string | null;
  llm_model?: string | null;
  temperature?: number | null;
  max_tokens?: number | null;
}>;

export type ExpertRecord = Readonly<{
  id: number;
  name: string;
  title?: string | null;
  description?: string | null;
  prompt_template?: string | null;
  enabled?: boolean;
  llm_provider?: string | null;
  llm_model?: string | null;
  temperature?: number | null;
  top_k?: number | null;
  max_tokens?: number | null;
  num_ctx?: number | null;
  num_predict?: number | null;
  think?: boolean | null;
  llm_params?: Record<string, unknown> | null;
  created_at?: string | null;
  updated_at?: string | null;
}>;

// EA-87 (W28E-1863 fix-wave-c): the prompt-generation endpoints accept richer
// context than the UI previously sent. The backend GeneratePromptRequest /
// GenerateTestCasesRequest models accept context_type, expected_outcomes and
// available_tools; expert_id is still passed through for the workbench's
// per-expert context. This type carries the channel + knowledge + outcomes the
// workbench now wires into the request payload.
export type PromptGenerateContext = Readonly<{
  expertId?: number;
  contextType?: string;
  expectedOutcomes?: string;
  availableTools?: string[];
}>;

export type ProviderRecord = Readonly<{
  id: string;
  name: string;
  type: string;
  base_url: string;
  is_primary?: boolean;
}>;

export type ProviderModelRecord = Readonly<{
  id: string;
  name: string;
  parameter_size?: string;
  family?: string;
  quantization?: string;
  format?: string;
  owned_by?: string;
}>;

export type TestProbeResult = Readonly<{
  success: boolean;
  expert_id: number;
  provider: string;
  model: string;
  temperature?: number;
  max_tokens?: number;
  prompt?: string;
  response?: string;
  tokens_used?: number;
  error?: string;
}>;

export type JobRecord = Readonly<{
  id: number;
  job_id?: number | null;
  type?: string | null;
  job_type?: string | null;
  status?: string | null;
  trace_id?: string | null;
  actor?: string | null;
  priority?: number | null;
  attempt?: number | null;
  max_attempts?: number | null;
  request_auth_identity?: string | null;
  request_source?: string | null;
  auth_method?: string | null;
  correlation_id?: string | null;
  created_at?: string | null;
  started_at?: string | null;
  updated_at?: string | null;
  completed_at?: string | null;
  finished_at?: string | null;
  duration_seconds?: number | null;
  outcome?: string | null;
  outcome_summary?: string | null;
  result_ref?: string | null;
  last_error?: Record<string, unknown> | null;
  input_ref?: Record<string, unknown> | null;
  parameters?: Record<string, unknown> | null;
  thinking?: unknown;
  lifecycle_log?: Array<Record<string, unknown>> | null;
  user_id?: number | null;
  session_id?: number | null;
  channel_id?: number | null;
  metadata?: Record<string, unknown> | null;
  error_info?: Record<string, unknown> | null;
  response_received?: string | null;
  prompt_sent?: string | null;
  tool_calls?: Array<Record<string, unknown>> | Record<string, unknown> | null;
  call_logs?: Array<Record<string, unknown>> | null;
  performance_metrics?: Record<string, unknown>;
}>;

export type KnowledgeRecord = Readonly<{
  id?: number | string;
  entry_id?: number | string;
  knowledge_id?: number;
  knowledge_type?: string | null;
  title?: string | null;
  description?: string | null;
  content?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string | null;
}>;

export type FileRecord = Readonly<{
  id: number;
  filename?: string | null;
  file_path?: string | null;
  file_type?: string | null;
  mime_type?: string | null;
  file_size?: number | null;
  size_bytes?: number | null;
  actual_size?: number | null;
  processing_status?: string | null;
  created_at?: string | null;
  processed_at?: string | null;
  session_id?: number | null;
  job_id?: number | null;
  metadata?: Record<string, unknown> | null;
  exists?: boolean;
}>;

export type ServiceRecord = Readonly<{
  id: number;
  name: string;
  enabled?: boolean;
  base_url?: string | null;
  endpoint_url?: string | null;
  service_type?: string | null;
  health_status?: string | null;
  expert_bindings?: Array<{
    id: number;
    expert_id?: number | null;
    expert_name?: string | null;
    enabled?: boolean;
    priority?: number | null;
    timeout_seconds?: number | null;
  }> | null;
  auth_config?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  usage_statistics?: Record<string, unknown> | null;
  created_at?: string | null;
  updated_at?: string | null;
}>;

export type ServiceHealthResult = Readonly<{
  service_id: number;
  healthy?: boolean;
  health_status?: string;
  detail?: string | null;
  resolved_url?: string | null;
  checked_at?: string | null;
}>;

export type ServiceEndpointTestResult = Readonly<{
  endpoint_url?: string;
  resolved_url?: string;
  detected_type?: string;
  health_status?: string;
  healthy?: boolean;
  status_code?: number | null;
  detail?: string | null;
  tools?: Array<Record<string, unknown>>;
  checked_at?: string | null;
}>;

export type ServiceToolsResult = Readonly<{
  service_id: number;
  service_name?: string | null;
  service_type?: string | null;
  enabled?: boolean;
  health_status?: string | null;
  tools?: Array<Record<string, unknown>>;
  bindings?: Array<Record<string, unknown>>;
  rbac?: Record<string, unknown>;
  discovery_error?: string | null;
}>;

export type ExpertServiceBindingRecord = Readonly<{
  id: number;
  service_id: number;
  enabled?: boolean;
  priority?: number | null;
  timeout_seconds?: number | null;
  service?: ServiceRecord | null;
  tools?: Array<{ name?: string; description?: string }>;
}>;

export type SubExpertBindingRecord = Readonly<{
  id: number;
  sub_expert_id: number;
  enabled?: boolean;
  max_depth?: number | null;
  sub_expert?: ExpertRecord | null;
}>;

export type PromptTemplateRecord = Readonly<{
  id: number;
  name: string;
  version?: number | null;
  content?: string | null;
}>;

export type PromptTemplateUpsert = Readonly<{
  name: string;
  content: string;
}>;

export type ApiKeyRecord = Readonly<{
  id: number;
  user_id?: number | null;
  group_id?: number | null;
  name?: string | null;
  description?: string | null;
  revoked?: boolean;
  read_channels?: boolean;
  read_logs?: boolean;
  read_histories?: boolean;
  created_at?: string | null;
  expires_at?: string | null;
  updated_at?: string | null;
  last_used_at?: string | null;
}>;

export type SessionRecord = Readonly<{
  id: number;
  title?: string | null;
  status?: string | null;
  expert_id?: number | null;
  expert_config_id?: number | null;
  user_id?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
}>;

export type StorageStats = Readonly<{
  total_files?: number;
  total_bytes?: number;
  storage_root?: string;
}>;

export type SessionMessageRecord = Readonly<{
  id: number;
  role?: string | null;
  content?: string | null;
  timestamp?: string | null;
}>;

export type PromptTestCase = Readonly<{
  name?: string;
  objective?: string;
  input?: string;
  category?: string;
}>;

export type PromptValidation = Readonly<{
  valid?: boolean;
  is_valid?: boolean;
  score?: number;
  issues?: string[];
  strengths?: string[];
  weaknesses?: string[];
  recommendations?: string[];
}>;

export type ExpertSuiteResult = Readonly<Record<string, unknown> & {
  test_cases_run?: number;
  test_cases_passed?: number;
  test_cases_failed?: number;
  results?: Array<Record<string, unknown>>;
}>;

export type CreateApiKeyResult = Readonly<{
  id: number;
  key: string;
  user_id?: number | null;
  group_id?: number | null;
  name?: string | null;
  expires_at?: string | null;
}>;

export type ChannelChatResult = Readonly<{
  mode?: string;
  response?: string;
  content?: string;
  message?: string;
  answer?: string;
  job_id?: number;
  session_id?: number;
  tokens_used?: number;
  model?: string;
}>;

export type AuditEventRecord = Readonly<{
  id: number;
  timestamp: string;
  event_type?: string;
  user_id?: number | null;
  session_id?: number | null;
  details?: Record<string, unknown>;
}>;

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

export type ApiDocsSummary = Readonly<{
  title?: string;
  version?: string;
  description?: string;
  endpoints?: Record<string, string>;
}>;

export type PromptGenerateResult = Readonly<{
  success?: boolean;
  prompt?: string;
  temperature?: number;
  max_tokens?: number;
  tool_recommendations?: string[];
  reasoning?: string;
  expert_id?: number | null;
}>;

export type ExpertAgentApi = Readonly<{
  getHealth: () => Promise<RuntimeHealth>;
  getStatus: () => Promise<StatusPayload>;
  getRuntimeConfig: () => Promise<Record<string, unknown>>;
  getQueueStatus: () => Promise<QueueStatus>;
  changePassword: (payload: { current_password: string; new_password: string }) => Promise<{ changed?: boolean }>;
  getApiDocs: () => Promise<ApiDocsSummary>;
  listAuditEvents: (params?: { limit?: number; offset?: number }) => Promise<AuditEventRecord[]>;
  listLogs: (params?: { limit?: number; surface?: LogSurfaceId; query?: string }) => Promise<LogsResponse>;
  listAuditLogEntries: (params?: { limit?: number; log_source?: string }) => Promise<AuditLogEntry[]>;
  listUsers: () => Promise<UserRecord[]>;
  createUser: (payload: Partial<UserRecord> & { username: string; email: string; password?: string; display_name?: string; role?: string }) => Promise<UserRecord>;
  updateUser: (userId: number, payload: Partial<UserRecord> & { password?: string }) => Promise<UserRecord>;
  deleteUser: (userId: number) => Promise<void>;
  listGroups: () => Promise<GroupRecord[]>;
  createGroup: (payload: { name: string; description?: string; enabled?: boolean }) => Promise<GroupRecord>;
  updateGroup: (groupId: number, payload: { name?: string; description?: string; enabled?: boolean }) => Promise<GroupRecord>;
  deleteGroup: (groupId: number) => Promise<void>;
  listGroupMembers: (groupId: number) => Promise<GroupMemberRecord[]>;
  addGroupMember: (groupId: number, userId: number, role?: 'member' | 'admin') => Promise<void>;
  updateGroupMemberRole: (groupId: number, userId: number, role: 'member' | 'admin') => Promise<void>;
  removeGroupMember: (groupId: number, userId: number) => Promise<void>;
  listChannels: () => Promise<ChannelRecord[]>;
  createChannel: (payload: { name: string; expert_config_id?: number | null; description?: string; context_type?: string; expected_outcomes?: string; history_scope?: string; history_limitation?: Record<string, unknown>; rerank_model?: string; access_control?: ChannelAccessControl; enabled?: boolean }) => Promise<ChannelRecord>;
  updateChannel: (channelId: number, payload: { name?: string; expert_config_id?: number | null; description?: string; context_type?: string; expected_outcomes?: string; history_scope?: string; history_limitation?: Record<string, unknown>; rerank_model?: string; access_control?: ChannelAccessControl; enabled?: boolean }) => Promise<ChannelRecord>;
  deleteChannel: (channelId: number) => Promise<void>;
  getChannelPermissions: (channelId: number) => Promise<ChannelAccessControl>;
  updateChannelPermissions: (channelId: number, payload: ChannelAccessControl) => Promise<ChannelAccessControl>;
  getChannelConfig: (channelId: number) => Promise<ChannelConfigRecord>;
  getChannelHistorySummary: (channelId: number) => Promise<{ count: number }>;
  getChannelHistory: (channelId: number) => Promise<{ messages: Array<{ id?: number; role?: string; content?: string; timestamp?: string }> }>;
  exportChannelHistory: (channelId: number) => Promise<{ channel_id: number; format: string; exported_count: number; history: { messages?: Array<Record<string, unknown>>; count?: number } }>;
  sendChannelMessage: (channelId: number, payload: { message: string; user_id: number; session_id?: number | null; async_mode?: boolean; max_tokens?: number }) => Promise<ChannelChatResult>;
  listExperts: () => Promise<ExpertRecord[]>;
  createExpert: (payload: { name: string; title: string; description: string; prompt_template?: string; llm_provider?: string; llm_model?: string; temperature?: number; top_k?: number; max_tokens?: number; num_ctx?: number; num_predict?: number; think?: boolean; llm_params?: Record<string, unknown>; enabled?: boolean }) => Promise<ExpertRecord>;
  updateExpert: (expertId: number, payload: Partial<ExpertRecord> & { prompt_template?: string }) => Promise<ExpertRecord>;
  deleteExpert: (expertId: number) => Promise<void>;
  listJobs: () => Promise<JobRecord[]>;
  getJob: (jobId: number) => Promise<JobRecord>;
  cancelJob: (jobId: number) => Promise<void>;
  removeJob: (jobId: number) => Promise<void>;
  retryJob: (jobId: number, priority?: number) => Promise<{ new_job_id?: number }>;
  resubmitJob: (jobId: number, priority?: number) => Promise<{ new_job_id?: number }>;
  listKnowledge: () => Promise<KnowledgeRecord[]>;
  createKnowledge: (payload: { knowledge_type: string; knowledge_id: number; content: string; metadata?: Record<string, unknown> }) => Promise<KnowledgeRecord>;
  updateKnowledge: (payload: { knowledge_type: string; knowledge_id: number; entry_id: string | number; content?: string; metadata?: Record<string, unknown> }) => Promise<KnowledgeRecord>;
  deleteKnowledge: (payload: { knowledge_type: string; knowledge_id: number; entry_id?: string | number }) => Promise<void>;
  uploadFile: (file: File, metadata?: Record<string, unknown>) => Promise<FileRecord>;
  listFiles: () => Promise<FileRecord[]>;
  getFile: (fileId: number) => Promise<FileRecord>;
  deleteFile: (fileId: number) => Promise<void>;
  bulkDeleteFiles: (fileIds: number[]) => Promise<{ deleted_count?: number; failed_count?: number; failed_ids?: number[] }>;
  ingestFileToKnowledge: (fileId: number, payload: { knowledge_type: string; knowledge_id: number; metadata?: Record<string, unknown>; chunk_size?: number; chunk_overlap?: number; embedding_model?: string }) => Promise<{ success?: boolean; processing_status?: string }>;
  downloadFileUrl: (fileId: number) => string;
  getFileStorageStats: () => Promise<StorageStats>;
  createDirectory: (path: string) => Promise<{ success?: boolean; path?: string }>;
  listServices: () => Promise<ServiceRecord[]>;
  createService: (payload: { name: string; service_type: string; endpoint_url: string; enabled?: boolean; auth_config?: Record<string, unknown>; metadata?: Record<string, unknown> }) => Promise<ServiceRecord>;
  updateService: (serviceId: number, payload: { service_type?: string; endpoint_url?: string; enabled?: boolean; auth_config?: Record<string, unknown>; metadata?: Record<string, unknown> }) => Promise<ServiceRecord>;
  deleteService: (serviceId: number) => Promise<void>;
  checkServiceHealth: (serviceId: number) => Promise<ServiceHealthResult>;
  testServiceEndpoint: (payload: { endpoint_url: string; service_type?: string; auth_config?: Record<string, unknown> }) => Promise<ServiceEndpointTestResult>;
  getServiceTools: (serviceId: number) => Promise<ServiceToolsResult>;
  listExpertServices: (expertId: number) => Promise<ExpertServiceBindingRecord[]>;
  addExpertService: (expertId: number, payload: { service_id: number; priority?: number; enabled?: boolean }) => Promise<ExpertServiceBindingRecord>;
  removeExpertService: (expertId: number, serviceId: number) => Promise<void>;
  batchSetExpertServices: (expertId: number, serviceIds: number[]) => Promise<{ services: ExpertServiceBindingRecord[]; count: number }>;
  listExpertSubExperts: (expertId: number) => Promise<SubExpertBindingRecord[]>;
  addExpertSubExpert: (expertId: number, payload: { sub_expert_id: number; max_depth?: number; enabled?: boolean }) => Promise<SubExpertBindingRecord>;
  removeExpertSubExpert: (expertId: number, subExpertId: number) => Promise<void>;
  batchSetExpertSubExperts: (expertId: number, subExpertIds: number[]) => Promise<{ sub_experts: SubExpertBindingRecord[]; count: number }>;
  testExpertQuery: (expertId: number, payload: { query: string; user_id?: number }) => Promise<Record<string, unknown>>;
  listProviders: () => Promise<ProviderRecord[]>;
  listProviderModels: (providerId: string) => Promise<ProviderModelRecord[]>;
  testProbeExpert: (expertId: number, prompt?: string) => Promise<TestProbeResult>;
  listApiKeys: (filters?: { userId?: number; groupId?: number; includeRevoked?: boolean }) => Promise<ApiKeyRecord[]>;
  createApiKey: (payload: { user_id?: number; group_id?: number; name?: string; expires_days?: number; read_logs?: boolean; read_histories?: boolean; read_channels?: boolean }) => Promise<CreateApiKeyResult>;
  revokeApiKey: (keyId: number) => Promise<void>;
  listSessions: () => Promise<SessionRecord[]>;
  getSession: (sessionId: number) => Promise<SessionRecord>;
  listSessionMessages: (sessionId: number) => Promise<SessionMessageRecord[]>;
  deleteSession: (sessionId: number) => Promise<void>;
  listPromptTemplates: () => Promise<PromptTemplateRecord[]>;
  createPromptTemplate: (payload: PromptTemplateUpsert) => Promise<PromptTemplateRecord>;
  updatePromptTemplate: (promptId: number, payload: { content: string }) => Promise<PromptTemplateRecord>;
  deletePromptTemplate: (promptId: number) => Promise<void>;
  generatePrompt: (prompt: string, context?: PromptGenerateContext) => Promise<PromptGenerateResult>;
  generatePromptTestCases: (prompt: string, context?: PromptGenerateContext) => Promise<PromptTestCase[]>;
  validatePrompt: (prompt: string) => Promise<PromptValidation>;
  listPromptExperts: (promptId: number) => Promise<Array<{ assignment_id: number; expert_id: number; expert_name?: string; expert_title?: string; is_active?: boolean }>>;
  assignPromptExpert: (promptId: number, expertId: number) => Promise<{ assignment_id: number; expert_id: number; prompt_id: number }>;
  unassignPromptExpert: (promptId: number, expertId: number) => Promise<void>;
  extractPromptVariables: (promptId: number) => Promise<{ variables: string[]; count: number }>;
  testPromptTemplate: (promptId: number, inputText: string) => Promise<{ preview?: string }>;
  runExpertTestSuite: (payload: { channel_id: number; user_id?: number; test_cases?: Array<Record<string, unknown>> }) => Promise<ExpertSuiteResult>;
}>;

export async function requestJson<T>(baseUrl: string, path: string, options: RequestOptions = {}): Promise<T> {
  const client = createApiClient({ baseUrl, timeoutMs: 300_000, credentials: 'include' });
  const method = options.method ?? 'GET';
  const requestPath = method === 'GET' ? withQuery(path, { _ts: Date.now() }) : path;

  try {
    if (method === 'POST') return await client.post<T>(requestPath, options.body ?? {});
    if (method === 'PUT') return await client.put<T>(requestPath, options.body ?? {});
    if (method === 'PATCH') return await client.patch<T>(requestPath, options.body ?? {});
    if (method === 'DELETE') return await client.delete<T>(requestPath);
    return await client.get<T>(requestPath);
  } catch (error) {
    if (error instanceof ApiError) throw new Error(error.message);
    throw error;
  }
}

function asArray<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (!payload || typeof payload !== 'object') return [];

  const candidates = [
    'items',
    'users',
    'groups',
    'channels',
    'experts',
    'jobs',
    'entries',
    'files',
    'services',
    'sub_experts',
    'prompts',
    'api_keys',
    'sessions',
    'messages',
    'members',
    'events',
    'providers',
    'models',
  ] as const;

  for (const key of candidates) {
    const value = (payload as Record<string, unknown>)[key];
    if (Array.isArray(value)) return value as T[];
  }

  return [];
}

function withQuery(path: string, params: Record<string, string | number | boolean | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    query.set(key, String(value));
  }
  const encoded = query.toString();
  if (!encoded) return path;
  return `${path}${path.includes('?') ? '&' : '?'}${encoded}`;
}

export function createExpertAgentApi(baseUrl: string): ExpertAgentApi {
  const normalizeQueueStatus = (payload: QueueStatus): QueueStatus => {
    const statusCounts = payload.status_counts ?? {};
    const pending = Number(statusCounts.pending ?? 0);
    const created = Number(statusCounts.created ?? 0);
    const validated = Number(statusCounts.validated ?? 0);
    const queued = Number(statusCounts.queued ?? 0);
    const scheduled = Number(statusCounts.scheduled ?? 0);
    const retryWait = Number(statusCounts.retry_wait ?? 0);
    const dispatched = Number(statusCounts.dispatched ?? 0);
    const running = Number(statusCounts.running ?? 0);
    const processing = Number(statusCounts.processing ?? 0);
    const completed = Number(statusCounts.completed ?? 0);
    const succeeded = Number(statusCounts.succeeded ?? 0);
    const failed = Number(statusCounts.failed ?? 0);
    const cancelled = Number(statusCounts.cancelled ?? 0);
    const timedOut = Number(statusCounts.timed_out ?? 0) + Number(statusCounts.timeout ?? 0);
    const deadLettered = Number(statusCounts.dead_lettered ?? 0);
    const archived = Number(statusCounts.archived ?? 0);
    const total =
      payload.total ??
      pending + created + validated + queued + scheduled + retryWait + dispatched + running + processing + completed + succeeded + failed + cancelled + timedOut + deadLettered + archived;
    return {
      ...payload,
      total,
      queue_depth:
        payload.queue_depth ??
        pending + created + validated + queued + scheduled + retryWait,
      active_jobs:
        payload.active_jobs ??
        dispatched + running + processing,
    };
  };

  const normalizePromptValidation = (payload: PromptValidation): PromptValidation => ({
    ...payload,
    valid: payload.valid ?? payload.is_valid,
  });

  return {
    getHealth: () => requestJson<RuntimeHealth>(baseUrl, '/health'),
    getStatus: () => requestJson<StatusPayload>(baseUrl, '/status'),
    getRuntimeConfig: () => requestJson<Record<string, unknown>>(baseUrl, '/runtime-config-dump'),
    getQueueStatus: async () => normalizeQueueStatus(await requestJson<QueueStatus>(baseUrl, '/jobs/queue/status')),
    changePassword: (payload) => requestJson<{ changed?: boolean }>(baseUrl, '/auth/change-password', { method: 'POST', body: payload }),
    getApiDocs: () => requestJson<ApiDocsSummary>(baseUrl, '/docs/api'),
    listAuditEvents: async (params = {}) => asArray<AuditEventRecord>(await requestJson<unknown>(baseUrl, withQuery('/audit', {
      limit: params.limit ?? 25,
      offset: params.offset ?? 0,
    }))),
    listLogs: async (params = {}) => {
      const response = await requestJson<LogsResponse>(baseUrl, withQuery('/logs', {
        limit: params.limit ?? 100,
        surface: params.surface ?? 'audit',
        query: params.query,
      }));
      return {
        entries: response.entries ?? [],
        count: Number(response.count ?? response.entries?.length ?? 0),
        surface: response.surface ?? (params.surface ?? 'audit'),
        surface_label: response.surface_label,
        source_path: response.source_path,
        available_surfaces: response.available_surfaces ?? [],
      };
    },
    listAuditLogEntries: async (params = {}) => {
      const resp = await requestJson<LogsResponse>(baseUrl, withQuery('/audit-log', {
        limit: params.limit ?? 100,
        log_source: params.log_source ?? 'audit',
      }));
      return resp.entries ?? [];
    },
    listUsers: async () => asArray<UserRecord>(await requestJson<unknown>(baseUrl, withQuery('/users', { limit: 200 }))),
    createUser: (payload) => requestJson<UserRecord>(baseUrl, '/users', { method: 'POST', body: payload }),
    updateUser: (userId, payload) => requestJson<UserRecord>(baseUrl, `/users/${userId}`, { method: 'PUT', body: payload }),
    deleteUser: async (userId) => { await requestJson(baseUrl, `/users/${userId}`, { method: 'DELETE' }); },
    listGroups: async () => asArray<GroupRecord>(await requestJson<unknown>(baseUrl, withQuery('/groups', { limit: 200 }))),
    createGroup: (payload) => requestJson<GroupRecord>(baseUrl, '/groups', { method: 'POST', body: payload }),
    updateGroup: (groupId, payload) => requestJson<GroupRecord>(baseUrl, `/groups/${groupId}`, { method: 'PUT', body: payload }),
    deleteGroup: async (groupId) => { await requestJson(baseUrl, `/groups/${groupId}`, { method: 'DELETE' }); },
    listGroupMembers: async (groupId) => asArray<GroupMemberRecord>(await requestJson<unknown>(baseUrl, `/groups/${groupId}/members`)),
    addGroupMember: async (groupId, userId, role = 'member') => {
      await requestJson(baseUrl, `/groups/${groupId}/members`, { method: 'POST', body: { user_id: userId, role } });
    },
    updateGroupMemberRole: async (groupId, userId, role) => {
      await requestJson(baseUrl, `/groups/${groupId}/members/${userId}/role`, { method: 'PUT', body: { role } });
    },
    removeGroupMember: async (groupId, userId) => {
      await requestJson(baseUrl, `/groups/${groupId}/members/${userId}`, { method: 'DELETE' });
    },
    listChannels: async () => asArray<ChannelRecord>(await requestJson<unknown>(baseUrl, withQuery('/channels', { limit: 200 }))),
    createChannel: (payload) => requestJson<ChannelRecord>(baseUrl, '/channels', { method: 'POST', body: payload }),
    updateChannel: (channelId, payload) => requestJson<ChannelRecord>(baseUrl, `/channels/${channelId}`, { method: 'PUT', body: payload }),
    deleteChannel: async (channelId) => { await requestJson(baseUrl, `/channels/${channelId}`, { method: 'DELETE' }); },
    getChannelPermissions: async (channelId) => requestJson<ChannelAccessControl>(baseUrl, `/channels/${channelId}/permissions`),
    updateChannelPermissions: async (channelId, payload) => requestJson<ChannelAccessControl>(baseUrl, `/channels/${channelId}/permissions`, { method: 'PUT', body: payload }),
    getChannelConfig: async (channelId) => requestJson<ChannelConfigRecord>(baseUrl, `/channels/${channelId}/config`),
    getChannelHistorySummary: async (channelId) => {
      const result = await requestJson<{ count?: number }>(baseUrl, withQuery(`/channels/${channelId}/history`, {
        scope: 'channel',
        limit: 1,
        offset: 0,
      }));
      return { count: Number(result.count ?? 0) };
    },
    getChannelHistory: async (channelId) => {
      const result = await requestJson<{ messages?: Array<Record<string, unknown>> }>(baseUrl, withQuery(`/channels/${channelId}/history`, {
        scope: 'channel',
        limit: 100,
        offset: 0,
      }));
      return { messages: (result.messages ?? []).map((m: Record<string, unknown>) => ({ id: m.id as number, role: m.role as string, content: m.content as string, timestamp: m.timestamp as string })) };
    },
    exportChannelHistory: async (channelId) => requestJson(baseUrl, withQuery(`/channels/${channelId}/history/export`, { format: 'json', scope: 'channel', limit: 500 })),
    sendChannelMessage: (channelId, payload) => requestJson<ChannelChatResult>(baseUrl, `/channels/${channelId}/chat`, { method: 'POST', body: payload }),
    listExperts: async () => asArray<ExpertRecord>(await requestJson<unknown>(baseUrl, withQuery('/experts', { limit: 200 }))),
    createExpert: (payload) => requestJson<ExpertRecord>(baseUrl, '/experts', { method: 'POST', body: payload }),
    updateExpert: (expertId, payload) => requestJson<ExpertRecord>(baseUrl, `/experts/${expertId}`, { method: 'PUT', body: payload }),
    deleteExpert: async (expertId) => { await requestJson(baseUrl, `/experts/${expertId}`, { method: 'DELETE' }); },
    listJobs: async () => asArray<JobRecord>(await requestJson<unknown>(baseUrl, withQuery('/jobs', { limit: 200 }))).map((job) => ({
      ...job,
      type: job.type ?? job.job_type,
      updated_at: job.updated_at ?? job.created_at,
      finished_at: job.finished_at ?? job.completed_at,
    })),
    getJob: async (jobId) => {
      const job = await requestJson<JobRecord>(baseUrl, `/jobs/${jobId}`);
      return {
        ...job,
        type: job.type ?? job.job_type,
        updated_at: job.updated_at ?? job.created_at,
        finished_at: job.finished_at ?? job.completed_at,
      };
    },
    cancelJob: async (jobId) => { await requestJson(baseUrl, `/jobs/${jobId}/cancel`, { method: 'POST' }); },
    removeJob: async (jobId) => { await requestJson(baseUrl, `/jobs/${jobId}`, { method: 'DELETE' }); },
    retryJob: (jobId, priority = 0) => requestJson<{ new_job_id?: number }>(baseUrl, `/jobs/${jobId}/retry`, { method: 'POST', body: { priority } }),
    resubmitJob: (jobId, priority = 0) => requestJson<{ new_job_id?: number }>(baseUrl, `/jobs/${jobId}/resubmit`, { method: 'POST', body: { priority } }),
    listKnowledge: async () => asArray<KnowledgeRecord>(await requestJson<unknown>(baseUrl, '/knowledge')),
    createKnowledge: async (payload) => {
      const result = await requestJson<{ entry?: KnowledgeRecord }>(baseUrl, '/knowledge', { method: 'POST', body: payload });
      return result.entry ?? {};
    },
    updateKnowledge: async (payload) => {
      const result = await requestJson<{ entry?: KnowledgeRecord }>(baseUrl, `/knowledge/${payload.knowledge_type}/${payload.knowledge_id}/${payload.entry_id}`, {
        method: 'PUT',
        body: { content: payload.content, metadata: payload.metadata },
      });
      return result.entry ?? {};
    },
    deleteKnowledge: async (payload) => {
      const path = withQuery(`/knowledge/${payload.knowledge_type}/${payload.knowledge_id}`, {
        entry_id: payload.entry_id,
      });
      await requestJson(baseUrl, path, { method: 'DELETE' });
    },
    uploadFile: async (file, metadata) => {
      const form = new FormData();
      form.append('uploaded_file', file);
      if (metadata) form.append('metadata_json', JSON.stringify(metadata));
      const resp = await fetch(`${baseUrl}/files/upload`, { method: 'POST', body: form, credentials: 'include' });
      if (!resp.ok) throw new Error(`Upload failed: ${resp.status} ${resp.statusText}`);
      const result = await resp.json() as { file?: FileRecord; success?: boolean };
      const uploaded = result.file ?? (result as unknown as FileRecord);
      return { ...uploaded, filename: uploaded.filename ?? file.name, size_bytes: uploaded.size_bytes ?? uploaded.file_size ?? null };
    },
    listFiles: async () => asArray<FileRecord>(await requestJson<unknown>(baseUrl, withQuery('/files', { limit: 200 }))).map((file) => ({
      ...file,
      filename: file.filename ?? file.file_path?.split('/').pop() ?? null,
      size_bytes: file.size_bytes ?? file.actual_size ?? file.file_size ?? null,
    })),
    getFile: async (fileId) => {
      const file = await requestJson<FileRecord>(baseUrl, `/files/${fileId}`);
      return {
        ...file,
        filename: file.filename ?? file.file_path?.split('/').pop() ?? null,
        size_bytes: file.size_bytes ?? file.actual_size ?? file.file_size ?? null,
      };
    },
    deleteFile: async (fileId) => { await requestJson(baseUrl, `/files/${fileId}`, { method: 'DELETE' }); },
    bulkDeleteFiles: (fileIds) => requestJson<{ deleted_count?: number; failed_count?: number; failed_ids?: number[] }>(baseUrl, '/files/bulk-delete', { method: 'POST', body: fileIds }),
    ingestFileToKnowledge: (fileId, payload) => requestJson<{ success?: boolean; processing_status?: string }>(baseUrl, `/files/${fileId}/ingest_to_knowledge`, { method: 'POST', body: payload }),
    downloadFileUrl: (fileId) => `${baseUrl}/files/${fileId}/download`,
    getFileStorageStats: async () => {
      const stats = await requestJson<StorageStats & { total_size_bytes?: number; storage_root?: string }>(baseUrl, '/files/storage/stats');
      return {
        ...stats,
        total_bytes: stats.total_bytes ?? stats.total_size_bytes,
        storage_root: stats.storage_root,
      };
    },
    createDirectory: (path) => requestJson<{ success?: boolean; path?: string }>(baseUrl, '/files/mkdir', { method: 'POST', body: { path } }),
    listServices: async () => asArray<ServiceRecord>(await requestJson<unknown>(baseUrl, withQuery('/services', { limit: 200 }))),
    createService: (payload) => requestJson<ServiceRecord>(baseUrl, '/services', { method: 'POST', body: payload }),
    updateService: (serviceId, payload) => requestJson<ServiceRecord>(baseUrl, `/services/${serviceId}`, { method: 'PUT', body: payload }),
    deleteService: async (serviceId) => { await requestJson(baseUrl, `/services/${serviceId}`, { method: 'DELETE' }); },
    checkServiceHealth: (serviceId) => requestJson<ServiceHealthResult>(baseUrl, `/services/${serviceId}/health`, { method: 'POST' }),
    testServiceEndpoint: (payload) => requestJson<ServiceEndpointTestResult>(baseUrl, '/services/test-endpoint', { method: 'POST', body: payload }),
    getServiceTools: (serviceId) => requestJson<ServiceToolsResult>(baseUrl, `/services/${serviceId}/tools`),
    listExpertServices: async (expertId) => asArray<ExpertServiceBindingRecord>(await requestJson<unknown>(baseUrl, `/experts/${expertId}/services`)),
    addExpertService: (expertId, payload) => requestJson<ExpertServiceBindingRecord>(baseUrl, `/experts/${expertId}/services`, { method: 'POST', body: payload }),
    removeExpertService: async (expertId, serviceId) => { await requestJson(baseUrl, `/experts/${expertId}/services/${serviceId}`, { method: 'DELETE' }); },
    batchSetExpertServices: (expertId, serviceIds) => requestJson<{ services: ExpertServiceBindingRecord[]; count: number }>(baseUrl, `/experts/${expertId}/services/batch`, { method: 'PUT', body: { service_ids: serviceIds } }),
    listExpertSubExperts: async (expertId) => asArray<SubExpertBindingRecord>(await requestJson<unknown>(baseUrl, `/experts/${expertId}/sub-experts`)),
    addExpertSubExpert: (expertId, payload) => requestJson<SubExpertBindingRecord>(baseUrl, `/experts/${expertId}/sub-experts`, { method: 'POST', body: payload }),
    removeExpertSubExpert: async (expertId, subExpertId) => { await requestJson(baseUrl, `/experts/${expertId}/sub-experts/${subExpertId}`, { method: 'DELETE' }); },
    batchSetExpertSubExperts: (expertId, subExpertIds) => requestJson<{ sub_experts: SubExpertBindingRecord[]; count: number }>(baseUrl, `/experts/${expertId}/sub-experts/batch`, { method: 'PUT', body: { sub_expert_ids: subExpertIds } }),
    testExpertQuery: async (expertId, payload) => {
      // EXPWEB-029: the Test Query popup submits the execution as an async job so it can
      // render job/progress and poll GET /jobs/{id} for the final response.
      const result = await requestJson<unknown>(baseUrl, `/experts/${expertId}/execute`, { method: 'POST', body: { input_text: payload.query, async_mode: true, context: payload.user_id ? { user_id: payload.user_id } : undefined } });
      return (result && typeof result === 'object') ? (result as Record<string, unknown>) : { result };
    },
    listProviders: async () => asArray<ProviderRecord>(await requestJson<unknown>(baseUrl, '/providers')),
    listProviderModels: async (providerId) => asArray<ProviderModelRecord>(await requestJson<unknown>(baseUrl, `/providers/${providerId}/models`)),
    testProbeExpert: (expertId, prompt) => requestJson<TestProbeResult>(baseUrl, `/experts/${expertId}/test-probe`, { method: 'POST', body: { prompt } }),
    listApiKeys: async (filters = {}) => asArray<ApiKeyRecord>(await requestJson<unknown>(baseUrl, withQuery('/api-keys', {
      user_id: filters.userId,
      group_id: filters.groupId,
      include_revoked: filters.includeRevoked,
      limit: 200,
    }))),
    createApiKey: (payload) => requestJson<CreateApiKeyResult>(baseUrl, '/api-keys', { method: 'POST', body: payload }),
    revokeApiKey: async (keyId) => { await requestJson(baseUrl, `/api-keys/${keyId}`, { method: 'DELETE' }); },
    listSessions: async () => asArray<SessionRecord>(await requestJson<unknown>(baseUrl, withQuery('/sessions', { limit: 200 }))),
    getSession: (sessionId) => requestJson<SessionRecord>(baseUrl, `/sessions/${sessionId}`),
    listSessionMessages: async (sessionId) => asArray<SessionMessageRecord>(await requestJson<unknown>(baseUrl, withQuery(`/sessions/${sessionId}/messages`, { limit: 200 }))),
    deleteSession: async (sessionId) => { await requestJson(baseUrl, `/sessions/${sessionId}`, { method: 'DELETE' }); },
    listPromptTemplates: async () => asArray<PromptTemplateRecord>(await requestJson<unknown>(baseUrl, '/prompts')),
    createPromptTemplate: (payload) => requestJson<PromptTemplateRecord>(baseUrl, '/prompts', { method: 'POST', body: payload }),
    updatePromptTemplate: (promptId, payload) => requestJson<PromptTemplateRecord>(baseUrl, `/prompts/${promptId}`, { method: 'PUT', body: payload }),
    deletePromptTemplate: async (promptId) => { await requestJson(baseUrl, `/prompts/${promptId}`, { method: 'DELETE' }); },
    generatePrompt: async (prompt, context) => {
      // EA-87: forward channel context (context_type), outcomes
      // (expected_outcomes) and knowledge/tools (available_tools) — all
      // supported by the backend GeneratePromptRequest — alongside the
      // per-expert context. Omitted fields stay undefined so the payload is
      // unchanged when no extra context is selected.
      return requestJson<PromptGenerateResult>(baseUrl, '/prompts/generate', {
        method: 'POST',
        body: {
          title: 'Prompt workbench',
          details: prompt,
          expert_id: context?.expertId,
          context_type: context?.contextType || undefined,
          expected_outcomes: context?.expectedOutcomes || undefined,
          available_tools: context?.availableTools && context.availableTools.length > 0 ? context.availableTools : undefined,
        },
      });
    },
    generatePromptTestCases: async (prompt, context) => {
      const payload = await requestJson<unknown>(baseUrl, '/prompts/test-cases', {
        method: 'POST',
        body: {
          title: 'Prompt workbench',
          details: prompt,
          prompt,
          expert_id: context?.expertId,
          // EA-87: the test-case generator accepts the same channel + outcomes context.
          context_type: context?.contextType || undefined,
          expected_outcomes: context?.expectedOutcomes || undefined,
        },
      });
      if (payload && typeof payload === 'object') {
        const testCases = (payload as { test_cases?: PromptTestCase[] }).test_cases;
        if (Array.isArray(testCases)) return testCases;
      }
      return asArray<PromptTestCase>(payload);
    },
    validatePrompt: async (prompt) => normalizePromptValidation(await requestJson<PromptValidation>(baseUrl, '/prompts/validate', { method: 'POST', body: { prompt } })),
    listPromptExperts: async (promptId) => {
      const resp = await requestJson<{ experts?: Array<Record<string, unknown>> }>(baseUrl, `/prompts/${promptId}/experts`);
      return (resp.experts ?? []) as Array<{ assignment_id: number; expert_id: number; expert_name?: string; expert_title?: string; is_active?: boolean }>;
    },
    assignPromptExpert: (promptId, expertId) => requestJson<{ assignment_id: number; expert_id: number; prompt_id: number }>(baseUrl, `/prompts/${promptId}/experts`, { method: 'POST', body: { expert_id: expertId } }),
    unassignPromptExpert: async (promptId, expertId) => { await requestJson(baseUrl, `/prompts/${promptId}/experts/${expertId}`, { method: 'DELETE' }); },
    extractPromptVariables: (promptId) => requestJson<{ variables: string[]; count: number }>(baseUrl, `/prompts/${promptId}/variables`),
    testPromptTemplate: (promptId, inputText) => requestJson<{ preview?: string }>(baseUrl, `/prompts/${promptId}/test`, { method: 'POST', body: { input_text: inputText } }),
    runExpertTestSuite: (payload) => requestJson<ExpertSuiteResult>(baseUrl, '/testing/expert-suite', { method: 'POST', body: payload }),
  };
}
