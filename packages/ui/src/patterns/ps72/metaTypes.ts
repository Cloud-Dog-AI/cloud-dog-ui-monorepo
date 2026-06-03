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

// @cloud-dog/app-sql-agent — PS-72 v2 console shared meta types (W28A-774).
//
// These types implement the PS-72 v2 §5 result/meta contract that the shared
// @cloud-dog/ui McpConsole/A2aConsole patterns do not yet carry. Per W28A-774
// the sql-agent-local PS-72 console wrappers land first (option 2); the contract
// here is the promotion target for the shared component (option 1).

/** PS-72 v2 §7 canonical lifecycle status states. Projects MUST NOT invent new states. */
export type Ps72LifecycleState =
  | "queued"
  | "dispatched"
  | "running"
  | "blocked"
  | "waiting"
  | "retrying"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "timed-out"
  | "dead-lettered"
  | "archived";

/** PS-72 v2 §7 canonical top-of-page health states. */
export type Ps72HealthState = "healthy" | "degraded" | "unhealthy" | "unknown";

/**
 * PS-72 v2 §5 meta panel payload. correlation_id and request_id are REQUIRED
 * and MUST NEVER be N/A — if the backend omits them the console generates a
 * client-side value and flags it via {@link clientGenerated}.
 */
export type Ps72Meta = Readonly<{
  correlationId: string;
  requestId: string;
  /** Whole-call duration in milliseconds; rendered relative (e.g. "243 ms"). */
  durationMs: number;
  status: Ps72LifecycleState;
  /** True when correlation_id and/or request_id were client-generated (backend omitted them). */
  clientGenerated: boolean;
}>;

/**
 * Structured result returned by a PS-72 console execute/send call. The page-level
 * execute function captures the X-Correlation-Id / X-Request-Id response headers
 * (emitted by the sql-agent web proxy, see web_server.py) so the meta panel can
 * cross-check against the API log per W28A-774 T.1.6 / T.2.1.
 */
export type Ps72ExecuteResult = Readonly<{
  /** Raw backend result body (rendered through JsonBlock in the result widget). */
  body: unknown;
  /** Backend X-Correlation-Id response header, if present. */
  correlationId?: string | null;
  /** Backend X-Request-Id response header, if present (else the JSON-RPC id). */
  requestId?: string | null;
  /** HTTP status code of the call (used for RBAC 403 surfacing per §9). */
  httpStatus: number;
  /** True when the call was denied (4xx) — body holds the denial payload. */
  denied: boolean;
  /** Async tools (PS-75): non-empty when the response carried a Job ID. */
  jobId?: string | null;
}>;

/** Relative duration formatter per PS-72 v2 §5.3 (e.g. "243 ms", "1.2 s"). */
export function formatDuration(durationMs: number): string {
  if (!Number.isFinite(durationMs) || durationMs < 0) return "0 ms";
  if (durationMs < 1000) return `${Math.round(durationMs)} ms`;
  return `${(durationMs / 1000).toFixed(1)} s`;
}

/** Map a PS-72 lifecycle state to a StatusBadge tone. */
export function lifecycleTone(state: Ps72LifecycleState): "ok" | "warning" | "error" | "neutral" {
  switch (state) {
    case "succeeded":
      return "ok";
    case "failed":
    case "timed-out":
    case "dead-lettered":
      return "error";
    case "running":
    case "queued":
    case "dispatched":
    case "blocked":
    case "waiting":
    case "retrying":
      return "warning";
    default:
      return "neutral";
  }
}
