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

// @cloud-dog/app-index-retriever — Shared app types.

export type JsonRecord = Record<string, unknown>;

export type HealthResponse = Readonly<{
  status: string;
  correlation_id?: string;
  checks?: Record<string, unknown>;
}>;

export type StatusResponse = Readonly<{
  status: string;
  correlation_id?: string;
  uptime_seconds?: number;
  memory_mb?: number;
  memory_percent?: number;
  cpu_percent?: number;
  disk_percent?: number;
  active_connections?: number;
  index_count?: number;
  document_count?: number;
  collection_count?: number;
  host?: string;
}>;

export type LogRecord = Readonly<{
  timestamp?: string;
  level: string;
  logger: string;
  message: string;
  correlation_id?: string;
  source?: string;
  phase?: string;
}>;

/** PS-40 NIST AU-3 compliant audit/application log entry. */
export type AuditLogEntry = Readonly<{
  timestamp?: string;
  event_type?: string;
  action?: string;
  outcome?: string;
  severity?: string;
  correlation_id?: string;
  trace_id?: string;
  request_id?: string;
  service?: string;
  service_instance?: string;
  environment?: string;
  component?: string;
  source_host?: string;
  source_process?: string;
  source_application?: string;
  source_address?: string;
  destination_address?: string;
  process_id?: string | number;
  affected_files?: string[];
  level?: string;
  logger?: string;
  message?: string;
  actor?: Readonly<{
    type?: string;
    id?: string;
    roles?: string[];
    ip?: string;
  }>;
  target?: Readonly<{
    type?: string;
    id?: string;
    name?: string;
  }>;
  details?: Record<string, unknown>;
  duration_ms?: number;
}>;

export type ToolDescriptor = Readonly<{
  name: string;
  input_schema?: JsonRecord;
  output_schema?: JsonRecord;
  description?: string;
}>;

export type ApiFailureInfo = Readonly<{
  message: string;
  status: number;
  code?: string;
  requestId?: string;
  correlationId?: string;
}>;

export type SourceConfig = Readonly<{
  profile: string;
  collection: string;
  sourceUri: string;
  dedupePolicy: "skip" | "replace" | "version";
  indexingSignature: string;
  staleAfterDays: number;
  metadataJson: string;
}>;

export type ActivityEvent = Readonly<{
  timestamp: string;
  action: string;
  outcome: "ok" | "error";
  detail?: string;
}>;

export type ProfileRecord = Readonly<{
  profile: string;
  description?: string;
  enabled?: boolean;
  backend?: string;
  embedding_model?: string;
  embedding_dimension?: number | null;
  chunking_strategy?: string;
  llm_model?: string;
  chunk_size?: number | null;
  max_tokens?: number | null;
  mineru_enabled?: boolean;
  marker_enabled?: boolean;
  parser_options?: JsonRecord;
  ocr_enabled?: boolean;
  owner_user_id?: string;
  owner_groups?: string[];
  roles?: string[];
  created_at?: string;
  updated_at?: string;
}>;

export type CollectionRecord = Readonly<{
  profile: string;
  collection: string;
  description: string;
  dimensions?: number | null;
  distance_metric: string;
  metadata: JsonRecord;
  allowed_roles: string[];
  created_at?: string;
  updated_at?: string;
}>;

export type SourceConfigRecord = Readonly<{
  source_id: string;
  source_type: string;
  uri: string;
  schedule: string;
  profile: string;
  collection: string;
  enabled: boolean;
  metadata: JsonRecord;
  created_at?: string;
  updated_at?: string;
}>;

export type StoredFileRecord = Readonly<{
  file_id: string;
  filename: string;
  profile: string;
  size_bytes: number;
  content_hash?: string;
  actor?: string;
  created_at?: string;
}>;

export type UserRecord = Readonly<{
  user_id: string;
  display_name: string;
  roles: string[];
  groups: string[];
  enabled: boolean;
  created_at?: string;
  updated_at?: string;
}>;

export type GroupRecord = Readonly<{
  group_id: string;
  description: string;
  roles: string[];
  members: string[];
  created_at?: string;
  updated_at?: string;
}>;

export type ApiKeyRecord = Readonly<{
  key_id: string;
  token?: string;
  label: string;
  roles: string[];
  capabilities: string[];
  user_id?: string | null;
  revoked: boolean;
  created_at?: string;
  updated_at?: string;
  expires_at?: string | null;
}>;

export type ConfigEventRecord = Readonly<{
  entity_type: string;
  entity_id: string;
  action: string;
  actor?: string;
  timestamp?: string;
  payload?: unknown;
}>;

export type RbacBindingRecord = Readonly<{
  entity_type: string;
  entity_id: string;
  role: string;
  created_at?: string;
  updated_at?: string;
}>;

export const DEFAULT_SOURCE_CONFIG: SourceConfig = {
  profile: "default",
  collection: "",
  sourceUri: "",
  dedupePolicy: "skip",
  indexingSignature: "chunk:v1",
  staleAfterDays: 30,
  metadataJson: "{}",
};
