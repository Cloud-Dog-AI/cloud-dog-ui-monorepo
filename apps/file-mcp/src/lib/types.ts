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

// @cloud-dog/app-file-mcp — Shared application types.

export type HealthResponse = Readonly<{
  status: string;
  checks?: Record<string, BackendState>;
  service?: string;
  profile?: string;
  readiness?: string;
  transport?: string;
  version?: string;
  build_date?: string;
  commit?: string;
}>;

export type BackendState = Readonly<{
  backend: string;
  status: string;
  reason?: string;
  last_error?: string;
  updated_at?: string;
  failures_in_window?: number;
  consecutive_failures?: number;
  retries_used?: number;
  requires_restart?: boolean;
}>;

export type BackendStatusResponse = Readonly<{
  profile: string;
  active_backend: string;
  states: Record<string, BackendState>;
}>;

export type ToolDescriptor = Readonly<{
  name: string;
  description?: string;
  input_schema?: Record<string, unknown>;
}>;

export type StatusResponse = Readonly<{
  uptime_seconds: number;
  memory_mb: number | null;
  memory_percent: number | null;
  cpu_percent: number | null;
  disk_percent: number | null;
  active_connections: number;
  service_metrics: Readonly<{
    file_count: number;
    profile_count: number;
    storage_used_mb: number;
  }>;
}>;

export type ListDirResponse = Readonly<{
  path: string;
  entries: string[];
  entry_details?: ReadonlyArray<
    Readonly<{
      path: string;
      is_dir: boolean;
      size: number | null;
      modified_at: string | null;
      created_at: string | null;
      accessed_at?: string | null;
      owner?: string | null;
    }>
  >;
}>;

export type SearchPathResult = Readonly<{
  path: string;
}>;

export type SearchContentResult = Readonly<{
  path: string;
  line_no: number;
  line: string;
}>;

export type AuditEntry = Readonly<{
  timestamp: string;
  service?: string;
  service_instance?: string;
  environment?: string;
  client_ip?: string;
  event_type?: string;
  action?: string;
  outcome?: string;
  severity?: string;
  tool?: string;
  tool_name?: string;
  correlation_id?: string;
  trace_id?: string;
  request_id?: string;
  actor_id?: string;
  actor?: Readonly<{
    id?: string;
    type?: string;
    ip?: string;
    roles?: string[];
  }>;
  target?: Readonly<{
    type?: string;
    id?: string;
    name?: string;
    path?: string;
  }>;
  params?: Record<string, unknown>;
  paths?: Record<string, unknown>;
}>;

export type StorageProfile = Readonly<{
  id: string;
  name: string;
  type: "local" | "s3" | "webdav" | "ftp" | "google-drive";
  endpoint: string;
  username: string;
  notes: string;
  updatedAt: string;
}>;

export type AdminUser = Readonly<{
  id: string;
  username: string;
  display_name: string;
  is_active: boolean;
  groups: string[];
  created_at?: string | null;
  updated_at?: string | null;
}>;

export type AdminGroup = Readonly<{
  id: string;
  name: string;
  description: string;
  roles: string[];
  is_active: boolean;
  members: string[];
  created_at?: string | null;
  updated_at?: string | null;
}>;

export type AdminApiKey = Readonly<{
  id: string;
  user_id: string;
  label: string;
  scopes: string[];
  profile_name: string;
  is_active: boolean;
  masked_value?: string | null;
  expires_at?: string | null;
  revoked_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  secret?: string | null;
}>;

export type AdminProfile = Readonly<{
  name: string;
  display_name?: string;
  backend: string;
  roots: string[];
  api_keys_count: number;
  status?: string;
  reason?: string;
  profile: Record<string, unknown>;
}>;

export type AdminReloadResult = Readonly<{
  profile?: string;
  reloaded?: boolean;
  profiles?: string[];
  endpoint_health?: Record<string, unknown>;
}>;

export type RuntimeConfigSnapshot = Readonly<{
  service: Readonly<{
    name: string;
    version?: string;
    environment?: string;
    profile: string;
    transport: string;
    env_file?: string;
    config_path?: string;
    defaults_path?: string;
    api_base_url: string;
    mcp_base_url: string;
    a2a_base_url: string;
    auth_mode: string;
  }>;
  status: StatusResponse;
  health: HealthResponse;
  profiles: AdminProfile[];
  selected_profile?: AdminProfile | null;
}>;

/** W28A-799 / PS-73 v2 effective config payload from /admin/effective-config. */
export type EffectiveConfigSource = Readonly<{
  source: "default" | "config" | "env" | "vault" | string;
  source_detail?: string;
  secret?: boolean;
  servers?: readonly string[];
}>;
export type EffectiveConfigResponse = Readonly<{
  config: unknown;
  sources: Readonly<Record<string, EffectiveConfigSource>>;
  servers: readonly string[];
  counts: Readonly<{ total_keys: number; secret_keys: number; per_server: Readonly<Record<string, number>> }>;
}>;

export type JobSummary = Readonly<{
  job_id: string;
  job_type: string;
  queue_name?: string;
  status: string;
  priority?: number;
  progress?: number | null;
  created_at?: string | null;
  started_at?: string | null;
  updated_at?: string | null;
  completed_at?: string | null;
  finished_at?: string | null;
  duration_s?: number | null;
  duration_seconds?: number | null;
  attempt?: number;
  max_attempts?: number;
  run_timeout_ms?: number | null;
  last_error?: Record<string, unknown> | string | null;
  outcome?: string | null;
  correlation_id?: string | null;
  user_id?: string | null;
  request_source?: string | null;
  request_auth_identity?: string | null;
  server_id?: string | null;
  worker_id?: string | null;
  session_id?: string | null;
  payload?: Record<string, unknown>;
}>;

export type QueueStatus = Readonly<{
  queue_depth?: number;
  active_jobs?: number;
  failed_24h?: number;
  [key: string]: unknown;
}>;
