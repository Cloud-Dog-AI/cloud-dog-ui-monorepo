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

// Entity types for the chart-mcp WebUI. Shapes mirror the W28F-906 backend
// (chart-mcp-server src/chart_mcp_server/api/routers/*). Backend dicts are
// permissive, so entity records keep an index signature alongside known keys.

export type DependencyCheck = Readonly<{ status?: string; [k: string]: unknown }>;

export type Health = Readonly<{
  status?: string;
  surface?: string;
  checks?: Record<string, DependencyCheck>;
  renderers?: RendererStatus;
  [k: string]: unknown;
}>;

export type RendererDetail = Readonly<{
  enabled?: boolean;
  enabled_by_default?: boolean;
  licence_class?: string;
  supported_chart_types?: string[];
  supported_output_formats?: string[];
  requires_browser?: boolean;
  requires_network?: boolean;
  approved_for_offline?: boolean;
  reason?: string;
  [k: string]: unknown;
}>;

export type RendererStatus = Readonly<{
  allowed: Record<string, RendererDetail>;
  blocked: Record<string, RendererDetail>;
}>;

export type OperationDescriptor = Readonly<{ operation: string; surfaces: string[] }>;

export type Capabilities = Readonly<{
  operations: OperationDescriptor[];
  renderers: RendererStatus;
  formats: string[];
  [k: string]: unknown;
}>;

export type Profile = Readonly<{
  profile_id: string;
  tenant_id?: string;
  name?: string;
  description?: string;
  renderer?: string;
  locale?: string;
  default_style_id?: string;
  default_style_pack_id?: string;
  asset_retention_days?: number;
  allowed_renderers?: string[];
  allowed_outputs?: string[];
  enabled?: boolean;
  created_at?: string;
  updated_at?: string;
  [k: string]: unknown;
}>;

export type Session = Readonly<{
  session_id: string;
  profile_id?: string;
  tenant_id?: string;
  owner_user_id?: string;
  status?: string;
  created_at?: string;
  expires_at?: string;
  last_accessed_at?: string;
  context_json?: unknown;
  policy_snapshot?: unknown;
  [k: string]: unknown;
}>;

export type RenderAssetRef = Readonly<{
  asset_id: string;
  format?: string;
  content_type?: string;
  size_bytes?: number;
  checksum_sha256?: string;
  storage_ref?: string;
  [k: string]: unknown;
}>;

export type RenderManifest = Readonly<{
  manifest_id: string;
  session_id?: string;
  tenant_id?: string;
  chart_type?: string;
  renderer?: string;
  renderer_version?: string;
  style?: string;
  locale?: string;
  status?: string;
  row_count?: number;
  columns?: string[];
  deterministic_key?: string;
  assets?: RenderAssetRef[];
  accessibility?: unknown;
  error_message?: string;
  job_id?: string;
  created_at?: string;
  completed_at?: string;
  [k: string]: unknown;
}>;

export type AssetMeta = Readonly<{
  asset_id: string;
  tenant_id?: string;
  owner_user_id?: string;
  format?: string;
  content_type?: string;
  mime_type?: string;
  size_bytes?: number;
  file_size_bytes?: number;
  checksum_sha256?: string;
  sha256?: string;
  storage_ref?: string;
  expires_at?: string;
  created_at?: string;
  [k: string]: unknown;
}>;

export type AssetTransfer = AssetMeta &
  Readonly<{
    base64_data?: string;
    transfer_mode?: string;
  }>;

export type StylePack = Readonly<{
  style_id: string;
  tenant_id?: string;
  name?: string;
  description?: string;
  definition?: unknown;
  spec_json?: unknown;
  created_at?: string;
  updated_at?: string;
  [k: string]: unknown;
}>;

export type Renderer = Readonly<{
  renderer_id: string;
  state?: "allowed" | "blocked";
  detail?: RendererDetail;
  [k: string]: unknown;
}>;

export type Job = Readonly<{
  job_id: string;
  operation?: string;
  status?: string;
  profile_id?: string;
  session_id?: string;
  submitted_at?: string;
  created_at?: string;
  updated_at?: string;
  expires_at?: string;
  progress?: unknown;
  inputs?: unknown;
  outputs?: unknown[];
  errors?: unknown[];
  result?: unknown;
  [k: string]: unknown;
}>;

export type Recommendation = Readonly<{
  chart_type?: string;
  x?: string | null;
  y?: string | null;
  confidence?: number;
  reasons?: string[];
  reason?: string;
  warnings?: string[];
  alternatives?: unknown[];
  [k: string]: unknown;
}>;

export type ChartData = Readonly<{ rows: Array<Record<string, unknown>> }>;

export type ChartSpec = Readonly<{
  chart_type: string;
  x?: string | null;
  y?: string | null;
  title?: string;
  renderer?: string;
  locale?: string;
  style?: string;
  output_formats?: string[];
  [k: string]: unknown;
}>;
