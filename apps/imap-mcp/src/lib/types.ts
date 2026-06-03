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

// @cloud-dog/app-imap-mcp — Shared API/UI types.

export type JsonRecord = Record<string, unknown>;

export type CallMeta = Readonly<{
  status: number;
  requestId: string;
  correlationId: string;
  timestamp: string;
}>;

export type CallResult<T> = Readonly<{
  ok: boolean;
  data: T | null;
  errorCode: string;
  errorMessage: string;
  meta: CallMeta;
  raw: unknown;
}>;

export type TraceEvent = Readonly<{
  scope: "api" | "mcp" | "a2a";
  action: string;
  ok: boolean;
  errorCode: string;
  errorMessage: string;
  status: number;
  requestId: string;
  correlationId: string;
  timestamp: string;
}>;

export type ToolDescriptor = Readonly<{
  name: string;
  description: string;
  input_schema?: Record<string, unknown>;
}>;

export type HealthPayload = Readonly<{
  status?: string;
  service?: string;
  components?: Record<string, unknown>;
}>;

export type ProfileRow = Readonly<{
  profileId: string;
  provider: string;
  host: string;
  port: string;
  security: string;
  includeGlobs: string;
  excludeGlobs: string;
  maxAgeDays: string;
}>;

export type UserRow = Readonly<{
  userId: string;
  username: string;
  email: string;
  displayName: string;
  roles: string[];
  createdAt: string;
}>;

export type GroupRow = Readonly<{
  groupId: string;
  name: string;
  description: string;
  roles: string[];
  members: string[];
  createdAt: string;
  /** When omitted, UI treats the group as active. */
  active?: boolean;
}>;

export type ManagedApiKeyRow = Readonly<{
  apiKeyId: string;
  ownerUserId: string;
  description: string;
  scopes: string[];
  status: string;
  rawKey: string;
}>;

export type AuditEventRow = Readonly<{
  timestamp: string;
  eventType: string;
  action: string;
  outcome: string;
  severity: string;
  traceId: string;
  requestId: string;
  actorType: string;
  operation: string;
  status: string;
  actorId: string;
  actorRoles: string[];
  actorIp: string;
  actorUserAgent: string;
  targetType: string;
  targetId: string;
  targetName: string;
  correlationId: string;
  service: string;
  serviceInstance: string;
  details: JsonRecord;
  raw: JsonRecord;
}>;

export type ServerLogRow = Readonly<{
  id: string;
  source: string;
  timestamp: string;
  eventType: string;
  action: string;
  outcome: string;
  severity: string;
  traceId: string;
  requestId: string;
  actorType: string;
  actorId: string;
  actorRoles: string[];
  actorIp: string;
  actorUserAgent: string;
  targetType: string;
  targetId: string;
  targetName: string;
  correlationId: string;
  service: string;
  serviceInstance: string;
  logger: string;
  message: string;
  details: JsonRecord;
  raw: JsonRecord;
}>;

export type SettingsRecord = Readonly<Record<string, unknown>>;

export type VersionRecord = Readonly<Record<string, unknown>>;

export type StatusRecord = Readonly<{
  status: string;
  uptime: number;
  memory_mb: number;
  cpu_percent: number;
  active_connections: number;
  jobs?: Readonly<Record<string, unknown>>;
}>;

export type JobRecord = Readonly<{
  jobId: string;
  jobType: string;
  queueName: string;
  profileId: string;
  mailbox: string;
  status: string;
  claimedBy: string;
  attempts: number;
  attempt: number;
  maxAttempts: number;
  priority: number;
  lastError: string;
  serverId: string;
  createdAtUtc: string;
  updatedAtUtc: string;
  startedAtUtc: string;
  finishedAtUtc: string;
  correlationId: string;
  userId: string;
  requestSource: string;
  requestAuthMethod: string;
  requestAuthIdentity: string;
  traceId: string;
  progressPct: number;
  progressStage: string;
  payload: JsonRecord;
  result: JsonRecord | null;
}>;

export type JobQueueStatus = Readonly<{
  backend: string;
  healthy: boolean;
  trackedJobs: number;
  serverId: string;
  counts: Readonly<Record<string, number>>;
}>;

export type EndpointDescriptor = Readonly<{
  method: string;
  path: string;
}>;
