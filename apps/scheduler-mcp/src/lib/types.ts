// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
// Licensed under the Apache License, Version 2.0
//
// scheduler-mcp — typed payloads for the /v1/* surfaces W28K-1402 wired.

export type HealthCheck = Readonly<{ status: string; [k: string]: unknown }>;
export type Health = Readonly<{
  status: string;
  service: string;
  version: string;
  checks: Readonly<{ db: HealthCheck; cache: HealthCheck; jobs: HealthCheck; registry: HealthCheck }>;
}>;

export type ScheduleDto = Readonly<{
  schedule_id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  enabled: boolean;
  paused: boolean;
  status: string;
  trigger_type: string;
  trigger_spec: Readonly<Record<string, unknown>>;
  timezone: string;
  next_fire_at: string | null;
  last_fire_at: string | null;
  target_type: string;
  target_ref: string;
  target_spec: Readonly<Record<string, unknown>>;
  owner_user_id: string | null;
  created_at: string | null;
  updated_at: string | null;
}>;

export type ScheduleRunDto = Readonly<{
  schedule_run_id: string;
  schedule_id: string;
  tenant_id: string;
  status: string;
  scheduled_for: string | null;
  started_at: string | null;
  finished_at: string | null;
  attempt: number;
  // W28K-1408 — lineage + result surfacing (backend _to_dto W28K-1407/1408).
  trigger_type?: string | null;
  trigger_source_id?: string | null;
  result_ref?: string | null;
  error_summary?: string | null;
  error_code: string | null;
  root_job_id: string | null;
  chain_run_id: string | null;
}>;

export type RunQuery = Readonly<{
  schedule_id?: string;
  status?: string;
  dead_letter?: boolean;
  limit?: number;
  offset?: number;
}>;

export type AuthMe = Readonly<{
  user: { api_key_id: string; username: string; scopes: ReadonlyArray<string> } | null;
}>;

export type ChainDto = Readonly<{
  chain_id: string;
  name: string;
  description: string | null;
  version: number;
  status: string;
  definition?: Readonly<{ steps?: ReadonlyArray<Readonly<{ step_id: string; type: string; needs?: ReadonlyArray<string> }>> }>;
  created_at: string | null;
  updated_at: string | null;
}>;

export type ContextEntryDto = Readonly<{
  context_entry_id: string;
  scope_type: string;
  scope_id: string;
  key: string;
  value: unknown;
  value_type: string;
  visibility: string;
  created_at: string | null;
  updated_at: string | null;
}>;

export type RegistryProjectDto = Readonly<{
  project_id: string;
  name: string;
  service_kind: string;
  base_url: string;
  last_health_status: string | null;
  enabled: boolean;
}>;

export type AuditActorDto = Readonly<{
  type: string | null;
  id: string | null;
  roles: ReadonlyArray<string>;
  ip: string | null;
  user_agent: string | null;
}>;

export type AuditTargetDto = Readonly<{
  type: string | null;
  id: string | null;
  name: string | null;
}>;

export type AuditEventDto = Readonly<{
  event_id: string;
  timestamp: string;
  event_type: string | null;
  action: string | null;
  outcome: string | null;
  severity: string | null;
  correlation_id: string | null;
  actor: AuditActorDto;
  target: AuditTargetDto;
  details: Record<string, unknown>;
  duration_ms: number | null;
}>;

export type AuditPage = Readonly<{
  items: ReadonlyArray<AuditEventDto>;
  count: number;
  total: number;
  limit: number;
  offset: number;
  order: "asc" | "desc";
}>;

export type AuditQuery = Readonly<{
  actor_id?: string;
  action?: string;
  outcome?: string;
  target_type?: string;
  target_id?: string;
  since?: string;
  until?: string;
  correlation_id?: string;
  limit?: number;
  offset?: number;
  order?: "asc" | "desc";
}>;

export type PagedResult<T> = Readonly<{ items: ReadonlyArray<T>; count: number; limit?: number; offset?: number }>;
