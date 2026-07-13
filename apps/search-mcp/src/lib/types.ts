// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
// Licensed under the Apache License 2.0

// Response shapes for the search-mcp /v1 REST surface (W28F-949). Kept loose
// (index signatures) where the backend returns service-domain envelopes.

export interface SurfaceCallResult {
  body: unknown;
  httpStatus: number;
  denied: boolean;
  correlationId: string | null;
  requestId: string | null;
}

export interface BackendRow {
  name: string;
  tier?: number;
  enabled?: boolean;
  requires_credentials?: boolean;
  media_types?: string[];
  [key: string]: unknown;
}
export interface BackendsResponse {
  backends: BackendRow[];
  count: number;
}

export interface ResearchReport {
  job_id?: string;
  query?: string;
  status?: string;
  synthesis?: string;
  sources?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}
export interface ResearchListResponse {
  items?: ResearchReport[];
  jobs?: ResearchReport[];
  [key: string]: unknown;
}

export interface WatchRow {
  id?: string;
  watch_id?: string;
  query?: string;
  status?: string;
  [key: string]: unknown;
}
export interface WatchListResponse {
  watches?: WatchRow[];
  items?: WatchRow[];
  [key: string]: unknown;
}

export interface AuditEventRow {
  event_type?: string;
  timestamp?: string;
  action?: string;
  outcome?: string;
  component?: string;
  actor?: Record<string, unknown>;
  target?: Record<string, unknown>;
  correlation_id?: string;
  [key: string]: unknown;
}
export interface AuditListResponse {
  items: AuditEventRow[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
  au3_components: string[];
}

export interface JobRow {
  id?: string;
  job_id?: string;
  status?: string;
  type?: string;
  created_at?: string;
  [key: string]: unknown;
}
export interface JobListResponse {
  items?: JobRow[];
  jobs?: JobRow[];
  [key: string]: unknown;
}

export interface McpToolResponse {
  name: string;
  description?: string;
  inputSchema?: unknown;
  input_schema?: unknown;
  bound?: boolean;
  [key: string]: unknown;
}
export interface McpToolListResponse {
  tools?: McpToolResponse[];
  items?: McpToolResponse[];
  data?: { items?: McpToolResponse[] } | McpToolResponse[];
  result?: { tools?: McpToolResponse[] };
  [key: string]: unknown;
}

export interface A2aAgentCardResponse {
  name?: string;
  skills?: unknown;
  [key: string]: unknown;
}

export interface AboutResponse {
  service: string;
  version: string;
  source_commit?: string;
  container_digest?: string;
  build_artefact?: string;
  config_version?: string;
  environment?: string;
  runtime_health?: string;
  [key: string]: unknown;
}

export interface OpenApiDocument {
  [key: string]: unknown;
}

// W28F-959 governance status (public-safe: no secrets, no raw query values).
export interface GovernanceModeStatus {
  service_default_mode: string;
  channel_default_mode?: string | null;
  available_modes: string[];
  request_override_allowed?: boolean;
  override_requires_role?: string;
  [key: string]: unknown;
}

export interface GovernanceRateLimitScope {
  scope: string;
  limit: number;
  usage: number;
  remaining: number;
  limited?: boolean;
  estimated_resolves_at?: string | null;
  [key: string]: unknown;
}

export interface GovernanceRateLimitBackend {
  backend: string;
  circuit_state: string;
  cooldown_active?: boolean;
  limited?: boolean;
  [key: string]: unknown;
}

export interface GovernanceRateLimitStatus {
  enabled: boolean;
  rejected_total?: number;
  scopes: GovernanceRateLimitScope[];
  backends: GovernanceRateLimitBackend[];
}

export interface GovernanceCacheStatus {
  enabled: boolean;
  namespace?: string;
  backend?: string;
  hits?: number;
  misses?: number;
  hit_ratio?: number;
  [key: string]: unknown;
}

// W28F-960 egress proxy-pool governance (public-safe: credential-free redacted URLs).
export interface GovernanceProxyMemberHealth {
  status: string;
  consecutive_failures?: number;
  cooldown_expires_at?: string | null;
  last_failure_reason?: string | null;
  [key: string]: unknown;
}

export interface GovernanceProxyEndpointBlock {
  endpoint: string;
  status: string;
  consecutive_blocks?: number;
  blocks_total?: number;
  block_expires_at?: string | null;
  last_block_reason?: string | null;
  [key: string]: unknown;
}

export interface GovernanceProxyMember {
  id: string;
  url?: string;
  protocol?: string;
  region?: string;
  enabled?: boolean;
  health: GovernanceProxyMemberHealth;
  endpoint_blocks: GovernanceProxyEndpointBlock[];
  [key: string]: unknown;
}

export interface GovernanceProxyPool {
  name: string;
  strategy: string;
  allow_direct_fallback?: boolean;
  healthy_count?: number;
  members: GovernanceProxyMember[];
}

export interface GovernanceProxyEndpointRate {
  endpoint: string;
  requests_in_window: number;
  window_seconds?: number;
  over_limit?: boolean;
}

export interface GovernanceProxyStatus {
  enabled: boolean;
  available?: boolean;
  // True only when a genuinely cross-process store (valkey) backs the state.
  shared_store?: boolean;
  shared_store_backend?: string;
  system_default_pool?: string | null;
  no_proxy?: string[] | string | { suffixes?: string[]; hosts?: string[] };
  pools?: GovernanceProxyPool[];
  endpoints?: GovernanceProxyEndpointRate[];
  [key: string]: unknown;
}

export interface GovernanceStatus {
  mode: GovernanceModeStatus;
  ratelimit: GovernanceRateLimitStatus;
  cache: GovernanceCacheStatus;
  // W28F-960: present when the egress proxy pool is wired into the status surface.
  proxy?: GovernanceProxyStatus;
}
