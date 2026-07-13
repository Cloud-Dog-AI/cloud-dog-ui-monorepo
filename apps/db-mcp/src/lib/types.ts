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

export type ProfileSummary = Readonly<{
  profile_id: string;
  name: string;
  source_type: string;
  source_connection: string;
  description: string;
  namespaces: string[];
  entities: string[];
  enabled_tools: string[];
  allowed_permissions: string[];
  field_masks: Record<string, string>;
  field_exclusions: string[];
  index_policy: Record<string, unknown>;
}>;

export type ProfileDraft = Readonly<{
  name: string;
  source_type: string;
  source_connection: string;
  description: string;
  namespaces: string[];
  entities: string[];
  enabled_tools: string[];
  allowed_permissions: string[];
  field_masks: Record<string, string>;
  field_exclusions: string[];
  index_policy: Record<string, unknown>;
}>;

export type SourceConnectionSummary = Readonly<{
  name: string;
  source_type: string;
  uri_template: string;
  credentials_ref?: string | null;
  description: string;
  status: string;
  last_tested_at?: string | null;
  last_test_result?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}>;

export type SourceConnectionDraft = Readonly<{
  name: string;
  source_type: string;
  uri_template: string;
  credentials_ref?: string | null;
  description: string;
}>;

export type DiscoveryCacheMeta = Readonly<{
  cache_key?: string | null;
  status?: string;
  stale?: boolean;
  refreshed_at?: string | null;
  ttl_seconds?: number | null;
}>;

export type DiscoveryResult<T> = Readonly<{
  items: T[];
  cache?: DiscoveryCacheMeta;
}>;

export type DiscoveryFieldItem = Readonly<{
  name: string;
  type?: string;
  types?: string[];
}>;

export type ProfileScopeTestApiResult = Readonly<{
  ok: boolean;
  profile_id: string;
  latency_ms?: number;
  namespace_count?: number;
  entity_count?: number;
  namespaces?: NamespaceItem[];
  entities_by_namespace?: Record<string, EntityItem[]>;
  error?: string;
}>;

export type SavedQuerySummary = Readonly<{
  id: number;
  user_id?: string;
  page_key: string;
  name: string;
  payload: Record<string, unknown>;
  description?: string;
  shared?: boolean;
  created_at?: string;
  updated_at?: string;
}>;

export type SavedQueryDraft = Readonly<{
  page_key: string;
  name: string;
  payload: Record<string, unknown>;
  description?: string;
  shared?: boolean;
}>;

export type UserSummary = Readonly<{
  user_id: string;
  username: string;
  email: string;
  display_name: string;
  status: string;
  roles: string[];
  tenant_id?: string | null;
}>;

export type GroupSummary = Readonly<{
  group_id: string;
  name: string;
  description: string;
  roles: string[];
  member_user_ids: string[];
  tenant_id?: string | null;
}>;

export type ApiKeySummary = Readonly<{
  api_key_id: string;
  owner_user_id: string;
  name: string;
  key_prefix: string;
  status: string;
  scopes: string[];
  profile_ids: string[];
  expires_at?: string | null;
  revoked_at?: string | null;
  raw_key?: string;
}>;

export type NamespaceItem = Readonly<{ name: string; type?: string }>;
export type EntityItem = Readonly<{ name: string; type?: string }>;
export type EntityField = Readonly<{ name: string; types?: string[] }>;
export type EntityDetail = Readonly<{
  namespace: string;
  entity: string;
  document_count?: number;
  options?: Record<string, unknown>;
  info?: Record<string, unknown>;
  indexes?: IndexItem[];
  fields?: EntityField[];
  field_count?: number;
}>;
export type IndexItem = Readonly<{ name: string; keys: unknown; unique?: boolean; sparse?: boolean }>;

export type DataReadResult = Readonly<{
  items: Record<string, unknown>[];
  offset: number;
  limit: number;
}>;

export type DataCreateResult = Readonly<{
  document?: Record<string, unknown>;
  documents?: Record<string, unknown>[];
  inserted_count?: number;
}>;

export type DataMutationResult = Readonly<{
  matched_count?: number;
  modified_count?: number;
  deleted_count?: number;
  upserted_id?: string | null;
}>;

export type SearchItem = Readonly<{
  document_id: string;
  doc_kind: string;
  title: string;
  excerpt?: string;
  score?: number;
  namespace?: string;
  entity?: string;
}>;

export type SearchExplain = Readonly<{
  document_id: string;
  matched_components: Array<{ field: string; terms?: string[]; value?: string; score?: number }>;
}>;

export type SearchRelatedItem = Readonly<{
  namespace: string;
  entity: string;
  score: number;
  reasons: string[];
}>;

export type RelationshipItem = Readonly<{
  relationship_id: string;
  profile_id: string;
  namespace: string;
  entity: string;
  field: string;
  target_namespace: string;
  target_entity: string;
  relationship_type: string;
  provenance: string;
  confidence?: number | null;
  description?: string;
  metadata?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}>;

export type AuditEvent = Readonly<{
  event_id: string;
  event_type: string;
  action?: string;
  outcome?: string;
  severity?: string;
  timestamp: string;
  correlation_id?: string;
  trace_id?: string;
  request_id?: string;
  session_id?: string;
  service?: string;
  service_instance?: string;
  environment?: string;
  actor?: { id?: string; type?: string; roles?: string[]; ip?: string };
  target?: { id?: string; type?: string; name?: string };
  details?: Record<string, unknown>;
  duration_ms?: number;
}>;

export type IndexStatusItem = Readonly<{
  profile_id: string;
  freshness_state: string;
  indexed_at?: string;
  namespace_count?: number;
  entity_count?: number;
  field_count?: number;
}>;

export type JobsHealth = Readonly<{
  ok: boolean;
  queue_status: Record<string, unknown>;
}>;

export type PrincipalSummary = Readonly<{
  user_id: string;
  username?: string;
  roles: string[];
  permissions: string[];
  api_key_id?: string | null;
  profile_ids?: string[];
  scopes?: string[];
}>;

export type ResourceMetricsSummary = Readonly<{
  uptime: number;
  memory_mb: number;
  cpu_percent: number;
  disk_percent: number;
  active_connections: number;
}>;

export type LogEntrySummary = Readonly<{
  id: string;
  timestamp: string;
  level: string;
  logger: string;
  message: string;
  correlation_id: string;
  source?: string;
}>;

export type JobSummary = Readonly<{
  id: string;
  name: string;
  job_id?: string;
  job_type?: string;
  queue_name: string;
  status: string;
  actor?: string | null;
  priority?: number;
  progress?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
  completed_at?: string | null;
  duration_seconds?: number | null;
  attempt?: number;
  max_attempts?: number;
  run_timeout_ms?: number | null;
  claim_timeout_ms?: number | null;
  last_heartbeat_at?: string | null;
  last_error?: Record<string, unknown> | string | null;
  result_ref?: string | null;
  correlation_id?: string | null;
  user_id?: string | null;
  request_source?: string | null;
  request_auth_method?: string | null;
  request_auth_identity?: string | null;
  server_id?: string | null;
  worker_id?: string | null;
  session_id?: string | null;
  payload?: Record<string, unknown>;
  lifecycle_history?: Array<Record<string, unknown>>;
}>;

export type PingSummary = Readonly<{
  service: string;
  surface: string;
  jobs_backend: string;
  metadata_store: string;
}>;

export type FilterConditionDraft = Readonly<{
  id: string;
  field: string;
  operator: string;
  value: string;
}>;

export type FilterGroupDraft = Readonly<{
  op: "and" | "or";
  conditions: FilterConditionDraft[];
}>;
