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

// @cloud-dog/app-git-mcp — Shared application types.

export type HealthResponse = Readonly<{
  status: string;
  application?: string;
  version?: string;
  env_file?: string | null;
}>;

export type ApiToolDescriptor = Readonly<{
  name: string;
  description?: string;
  input_schema?: Record<string, unknown>;
  output_schema?: Record<string, unknown>;
}>;

export type ProfileRecord = Readonly<{
  name: string;
  source: string;
  defaultBranch: string;
  // GM-PR-02: surface the configured credential mode in the profile View dialog.
  credentialMode?: string;
}>;

export type UserRecord = Readonly<{
  userId: string;
  username: string;
  email: string;
  groupIds: string[];
  roles: string[];
  status: string;
  createdAt: string;
}>;

export type GroupRecord = Readonly<{
  groupId: string;
  description: string;
  roles: string[];
  members: string[];
  createdAt: string;
}>;

export type ManagedApiKeyRecord = Readonly<{
  keyId: string;
  name: string;
  ownerUserId: string;
  keyPrefix: string;
  status: string;
  capabilities: string[];
  createdAt: string;
  expiresAt: string | null;
  rawKey?: string;
}>;

export type UiServiceMetrics = Readonly<{
  workspace_count: number;
  total_repo_size_mb: number;
  profile_count: number;
}>;

export type UiStatusPayload = Readonly<{
  uptime_seconds: number;
  memory_mb: number;
  memory_percent: number;
  cpu_percent: number;
  disk_percent: number;
  active_connections: number;
  service_metrics: UiServiceMetrics;
  services: UiServiceStatus[];
  metrics: UiMetric[];
  server_id?: string;
}>;

export type JobRecord = Readonly<{
  job_id: string;
  job_type: string;
  status: string;
  queue_name: string;
  priority: number;
  user_id: string;
  request_auth_identity: string;
  request_source: string;
  request_auth_method: string;
  correlation_id: string;
  created_at: string;
  updated_at: string;
  started_at: string;
  finished_at: string;
  claimed_by: string;
  attempt: number;
  max_attempts: number;
  progress: Record<string, unknown> | null;
  result: unknown;
  error: string;
  payload: Record<string, unknown> | null;
}>;

export type JobQueueStatus = Readonly<Record<string, number>>;

export type ToolTarget = "api" | "mcp";

export type CallMeta = Readonly<{
  requestId: string;
  correlationId: string;
  status: number;
  machineCode: string;
}>;

export type ToolCallOutcome = Readonly<{
  ok: boolean;
  data: unknown;
  errorMessage: string;
  meta: CallMeta;
}>;

export type OperationRecord = Readonly<{
  id: string;
  timestamp: string;
  target: ToolTarget;
  toolName: string;
  args: unknown;
  outcome: ToolCallOutcome;
}>;

export type UiSetting = Readonly<{
  key: string;
  label: string;
  type: "text" | "number" | "boolean" | "select";
  value: unknown;
  read_only?: boolean;
  options?: string[];
  description?: string;
}>;

export type UiSettingGroup = Readonly<{
  id: string;
  label: string;
  settings: UiSetting[];
}>;

export type AuditLogItem = Readonly<{
  id: string;
  source: string;
  source_key: string;
  event_type: string;
  eventType: string;
  action: string;
  outcome: string;
  severity: string;
  trace_id: string;
  traceId: string;
  request_id: string;
  requestId: string;
  correlation_id: string;
  correlationId: string;
  actor_type: string;
  actorType: string;
  actor_id: string;
  actorId: string;
  actor_roles: string[];
  actorRoles: string[];
  actor_ip: string;
  actorIp: string;
  actor_user_agent: string;
  actorUserAgent: string;
  target_type: string;
  targetType: string;
  target_id: string;
  targetId: string;
  target_name: string;
  targetName: string;
  service: string;
  service_instance: string;
  serviceInstance: string;
  logger: string;
  timestamp: string;
  level: string;
  message: string;
  type: string;
  details?: Record<string, unknown>;
  raw?: Record<string, unknown>;
}>;

export type ServerLogRow = AuditLogItem;

export type UiMetric = Readonly<{
  label: string;
  value: string;
  unit?: string;
  tone?: "ok" | "warning" | "error" | "neutral";
}>;

export type UiServiceStatus = Readonly<{
  name: string;
  url: string;
  status: "ok" | "warning" | "error" | "unknown";
}>;

export type UiVersion = Readonly<{
  service: string;
  version: string;
  build_date?: string;
  commit_hash?: string;
  server_id?: string;
}>;
