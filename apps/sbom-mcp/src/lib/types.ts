// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
// Licensed under the Apache License 2.0

export type ScanState =
  | "submitted"
  | "validated"
  | "queued"
  | "running"
  | "collecting_outputs"
  | "publishing_artefacts"
  | "completed_pass"
  | "completed_fail"
  | "infra_failed"
  | "cancel_requested"
  | "cancelled"
  | "expired";

export type ScanVerdict = "PASS" | "FAIL" | "INFRA_FAIL" | "WAIVED";

export interface ScanListItem {
  scan_id: string;
  job_id: string;
  status: ScanState;
  verdict?: ScanVerdict | null;
  boundary: string;
  target_type: string;
  target: string;
  created_at: string;
  finished_at?: string | null;
}

export interface ScanListResponse {
  items: ScanListItem[];
  total: number;
  limit: number;
  cursor?: string | null;
}

export interface SubmitScanRequest {
  boundary: string;
  target_type: string;
  target: string;
  storage_profile?: string | null;
  policy_profile?: string | null;
  requested_outputs?: string[];
  waiver_set_id?: string | null;
  wait?: boolean;
  caller_metadata?: Record<string, unknown> | null;
}

export interface SubmitScanResponse {
  scan_id: string;
  job_id: string;
  status: ScanState;
  status_uri: string;
  job_uri: string;
  result_uri: string;
  submitted_at: string;
}

export interface ScanStatusResponse {
  scan_id: string;
  job_id: string;
  status: ScanState;
  stage?: string | null;
  progress_percent?: number | null;
  started_at?: string | null;
  updated_at?: string | null;
}

export interface ScanFileEntry {
  name: string;
  mime_type?: string | null;
  size_bytes?: number | null;
  sha256?: string | null;
  classification: "public" | "sensitive";
  required: boolean;
  available: boolean;
  uri?: string | null;
}

export interface ScanResultResponse {
  scan_id: string;
  job_id: string;
  status: ScanState;
  verdict: ScanVerdict;
  exit_code: number;
  boundary: string;
  target_type: string;
  target: string;
  target_digest?: string | null;
  summary_md?: string | null;
  manifest_uri?: string | null;
  report_uri?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
  duration_ms?: number | null;
  files: ScanFileEntry[];
}

export interface ScheduledScan {
  scheduled_scan_id: string;
  name: string;
  // Human-readable operator description (config-description rollout).
  description?: string;
  boundary: string;
  target_type: string;
  target: string;
  schedule: string;
  timezone: string;
  enabled: boolean;
  next_run_at?: string | null;
  last_run_at?: string | null;
  last_scan_id?: string | null;
  last_status?: string | null;
}

export interface JobResponse {
  job_id: string;
  job_type: string;
  status: string;
  tenant_id?: string | null;
  user_id?: string | null;
  payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  attempt: number;
}

export interface JobListResponse {
  items: JobResponse[];
  total: number;
  limit: number;
}

export interface CreateWaiverRequest {
  cve_or_finding_id: string;
  scope: string;
  scope_value?: string | null;
  expiry: string;
  reason: string;
}

export interface UpdateWaiverRequest {
  reason?: string | null;
  expiry?: string | null;
}

export interface WaiverResponse {
  waiver_id: string;
  tenant_id: string;
  cve_or_finding_id: string;
  scope: string;
  scope_value?: string | null;
  expiry: string;
  granted_by: string;
  reason: string;
  status: string;
}

export interface WaiverListResponse {
  items: WaiverResponse[];
  total: number;
  limit: number;
}

export interface FindingResponse {
  scan_id: string;
  source_tool: string;
  finding_key: string;
  package_name?: string | null;
  package_version?: string | null;
  vulnerability_id?: string | null;
  severity?: string | null;
  finding_status: string;
}

export interface FindingListResponse {
  items: FindingResponse[];
  total: number;
  limit: number;
}

export interface AuditEventResponse {
  seq: number;
  event_id: string;
  event_type: string;
  caller_id: string;
  tenant_id: string;
  event_result: string;
  event_time: string;
  scan_id?: string | null;
  job_id?: string | null;
  metadata_json?: Record<string, unknown> | null;
}

export interface AuditEventListResponse {
  items: AuditEventResponse[];
  total: number;
  limit: number;
}

export interface SettingsResponse {
  settings: Record<string, unknown>;
}

export interface StorageProfileResponse {
  name: string;
  backend: string;
  default: boolean;
  config: Record<string, unknown>;
}

export interface StorageProfileListResponse {
  items: StorageProfileResponse[];
}

export interface ReportFileRow extends ScanFileEntry {
  scan_id: string;
  job_id: string;
  boundary: string;
  target_type: string;
  target: string;
  status: ScanState;
  verdict: ScanVerdict;
}

export interface CapabilitiesResponse {
  service: string;
  version: string;
  target_types: string[];
  output_types: string[];
  storage_backends: string[];
  default_storage_profile: string;
  roles: string[];
  permissions: string[];
  jobs: Record<string, unknown>;
  scanner: { container: string; entrypoint: string };
}

export interface McpToolResponse {
  name: string;
  description?: string;
  input_schema?: unknown;
  inputSchema?: unknown;
  output_schema?: unknown;
  outputSchema?: unknown;
  bound?: boolean;
}

export interface McpToolListResponse {
  tools?: McpToolResponse[];
  items?: McpToolResponse[];
  result?: { tools?: McpToolResponse[] };
  data?: McpToolResponse[] | { items?: McpToolResponse[] };
}

export interface A2aSkillResponse {
  id?: string;
  name?: string;
  description?: string;
  input?: unknown;
  input_schema?: unknown;
  inputSchema?: unknown;
  schema_ref?: string;
}

export interface A2aAgentCardResponse {
  name?: string;
  title?: string;
  service?: string;
  version?: string;
  description?: string;
  skills?: A2aSkillResponse[] | string[];
  [key: string]: unknown;
}

export interface SurfaceCallResult {
  body: unknown;
  correlationId: string | null;
  requestId: string | null;
  httpStatus: number;
  denied: boolean;
  jobId?: string | null;
  clientGenerated?: boolean;
}

export interface OpenApiDocument {
  openapi?: string;
  info?: Record<string, unknown>;
  paths?: Record<string, Record<string, unknown>>;
  [key: string]: unknown;
}
