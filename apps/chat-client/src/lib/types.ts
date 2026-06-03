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

// @cloud-dog/app-chat-client — API and view model types.

export type SessionSummary = Readonly<{
  id: string;
  created_at: string;
  metadata?: Record<string, unknown>;
  log_path?: string;
}>;

export type TranscriptEvent = Readonly<{
  event_type: string;
  timestamp: string;
  data?: Record<string, unknown>;
  sequence?: number;
}>;

export type McpServer = Readonly<{
  index: number;
  name: string;
  transport: string;
  base_url: string;
  version?: string;
  mcp_path: string;
  messages_path: string;
  sse_path: string;
  health_path: string;
}>;

export type McpServerHealth = McpServer &
  Readonly<{
    ok?: boolean;
    latency_ms?: number;
    tool_count?: number;
    error?: string | null;
    warning?: string | null;
  }>;

export type UiConfig = Readonly<{
  application: {
    name: string;
    release: string;
  };
  version?: string;
  env?: string;
  apiBaseUrl?: string;
  llm: Record<string, unknown>;
  client_api: {
    api_key_required: boolean;
    api_key_header: string;
    ui_wait_timeout_seconds: number;
  };
  a2a?: {
    port: number;
    ws_path: string;
    events_path: string;
    topics: string[];
    api_key_query_param: string;
  };
  mcp_servers: McpServer[];
}>;

export type UiConfigTree = Readonly<{
  application: {
    name: string;
  };
  config: Record<string, unknown>;
}>;

export type ToolDescriptor = Readonly<{
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}>;

export type ToolExecutionResult = Readonly<{
  toolName: string;
  serverIndex: number;
  arguments: Record<string, unknown>;
  result: unknown;
  timestamp: string;
}>;

export type ChatUserRecord = Readonly<{
  id: number;
  user_id: string;
  display_name: string;
  email: string;
  role: string;
  status: string;
  group_ids: string[];
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}>;

export type FileIntakeSettings = Readonly<{
  uploads_enabled?: boolean;
  allowed_modes?: string[];
  file_server_index?: number | null;
  max_size_bytes?: number;
  allowed_source_schemes?: string[];
  artifact_rendering_enabled?: boolean;
}>;

export type ChatProfileRecord = Readonly<{
  id: number;
  profile_id: string;
  name: string;
  description: string;
  mcp_bindings: Record<string, unknown>[];
  session_defaults: Record<string, unknown>;
  access_control: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}>;

export type ChatGroupRecord = Readonly<{
  id: number;
  group_id: string;
  name: string;
  description: string;
  roles: string[];
  member_user_ids: string[];
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}>;

export type ChatApiKeyRecord = Readonly<{
  id: number;
  key_id: string;
  user_id: string | null;
  name: string;
  key_prefix: string;
  scopes: string[];
  is_revoked: boolean;
  revoked_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  api_key?: string;
}>;

export type VersionInfoRecord = Readonly<{
  application: string;
  version: string;
  environment: string;
  server_id: string;
}>;

export type ResourceStatusRecord = Readonly<{
  uptime_seconds: number;
  memory_mb: number | null;
  memory_percent: number | null;
  cpu_percent: number | null;
  disk_percent: number | null;
  active_connections: number;
  active_chat_sessions: number;
  connected_mcp_endpoints: number;
  message_count: number;
  llm_model: string;
  environment: string;
  server_id: string;
}>;

export type LogSurfaceId = "audit" | "api" | "web" | "mcp" | "a2a";

export type LogSurfaceOption = Readonly<{
  id: LogSurfaceId;
  label: string;
}>;

export type MonitoringActorRecord = Readonly<{
  type: string;
  id: string;
  ip: string;
  roles: string[];
  user_agent: string;
}>;

export type MonitoringTargetRecord = Readonly<{
  type: string;
  id: string;
  name: string;
}>;

export type MonitoringLogRecord = Readonly<{
  timestamp: string;
  level: string;
  logger: string;
  message: string;
  raw_message: string;
  correlation_id: string;
  source: string;
  type: string;
}>;

export type MonitoringLogRow = Readonly<{
  id: string;
  surface: LogSurfaceId;
  surface_label: string;
  source_path: string;
  timestamp: string;
  message: string;
  level: string;
  event_type: string;
  action: string;
  outcome: string;
  severity: string;
  trace_id: string;
  request_id: string;
  service: string;
  service_instance: string;
  environment: string;
  actor: MonitoringActorRecord;
  target: MonitoringTargetRecord;
  details: Record<string, unknown> | null;
  raw: Record<string, unknown>;
}>;

export type LogsResponse = Readonly<{
  entries: MonitoringLogRow[];
  count: number;
  surface: LogSurfaceId;
  surface_label: string;
  source_path: string;
  available_surfaces: LogSurfaceOption[];
}>;

export type JobRecord = Readonly<{
  job_id: string;
  job_type: string;
  status: string;
  created_at: string;
  updated_at: string;
  started_at?: string;
  finished_at?: string;
  session_id: string;
  correlation_id: string;
  user_id: string;
  attempt?: number;
  max_attempts?: number;
  result_ref?: string;
  payload: Record<string, unknown>;
}>;

export type MonitoringSummary = Readonly<{
  metrics: {
    active_sessions: number;
    messages_last_hour: number;
    tool_calls_last_hour: number;
    average_response_ms: number;
    connected_mcp_endpoints: number;
    message_count: number;
    llm_model: string;
  };
  resources: ResourceStatusRecord;
  logs: MonitoringLogRecord[];
}>;
