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

// @cloud-dog/app-index-retriever — PS-72 console API adapters.

import type { Ps72ExecuteResult } from "@cloud-dog/ui";
import type { JsonRecord } from "./types";

export function maskBoundKey(apiKey: string): string {
  const trimmed = apiKey.trim();
  if (!trimmed) return "session-bound key";
  const last4 = trimmed.slice(-4).padStart(Math.min(4, trimmed.length), "*");
  return `••••••••${last4}`;
}

export function extractA2aSkills(agentCard: Record<string, unknown> | null): string[] {
  const rawSkills = Array.isArray(agentCard?.skills) ? agentCard.skills : [];
  const names = rawSkills
    .map((item) => {
      if (!item || typeof item !== "object") return "";
      const record = item as Record<string, unknown>;
      return String(record.id ?? record.name ?? "").trim();
    })
    .filter(Boolean);
  return Array.from(new Set(names));
}

export function resolveAppUrl(path: string, baseUrl: string | undefined): string {
  const base = baseUrl?.trim();
  if (!base) return new URL(path, window.location.origin).toString();
  try {
    return new URL(path, base).toString();
  } catch {
    return new URL(path, window.location.origin).toString();
  }
}

export async function ps72McpToolCall(opts: {
  apiBaseUrl: string;
  toolName: string;
  args: unknown;
  boundApiKey: string;
  overrideKey: string;
}): Promise<Ps72ExecuteResult> {
  return ps72JsonRequest({
    url: resolveAppUrl(`/api/v1/tools/${encodeURIComponent(opts.toolName)}`, opts.apiBaseUrl),
    body: opts.args && typeof opts.args === "object" && !Array.isArray(opts.args) ? opts.args : {},
    boundApiKey: opts.boundApiKey,
    overrideKey: opts.overrideKey,
    // bulk_index is idempotent in the service: the profile, collection,
    // source and content derive the queue idempotency key. A transport failure
    // before the browser receives the response can therefore be recovered once
    // without creating a second job. Other tool calls are never retried here.
    recoverNetworkFailureOnce: opts.toolName === "bulk_index",
  });
}

export async function ps72A2aTaskCall(opts: {
  apiBaseUrl: string;
  action: string;
  payload: unknown;
  boundApiKey: string;
  overrideKey: string;
}): Promise<Ps72ExecuteResult> {
  const taskId = `ps72-${crypto.randomUUID()}`;
  return ps72JsonRequest({
    url: resolveAppUrl("/a2a/tasks", opts.apiBaseUrl),
    body: {
      id: taskId,
      skill_id: opts.action,
      input: {
        text: JSON.stringify(opts.payload && typeof opts.payload === "object" ? opts.payload : {}),
      },
    },
    boundApiKey: opts.boundApiKey,
    overrideKey: opts.overrideKey,
    fallbackRequestId: taskId,
  });
}

function responseJobId(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const output = record.output && typeof record.output === "object" ? (record.output as Record<string, unknown>) : {};
  const outputJson = output.json && typeof output.json === "object" ? (output.json as Record<string, unknown>) : {};
  const result = record.result && typeof record.result === "object" ? (record.result as Record<string, unknown>) : {};
  const job =
    record.job_id ??
    record.jobId ??
    record.job ??
    result.job_id ??
    result.jobId ??
    outputJson.job_id ??
    outputJson.jobId;
  return typeof job === "string" && job.trim() ? job.trim() : null;
}

async function ps72JsonRequest(opts: {
  url: string;
  body: unknown;
  boundApiKey: string;
  overrideKey: string;
  fallbackRequestId?: string;
  recoverNetworkFailureOnce?: boolean;
}): Promise<Ps72ExecuteResult> {
  const generatedCorrelationId = crypto.randomUUID();
  const generatedRequestId = opts.fallbackRequestId ?? crypto.randomUUID();
  const headers = new Headers({
    accept: "application/json",
    "content-type": "application/json",
    "x-correlation-id": generatedCorrelationId,
    "x-request-id": generatedRequestId,
  });
  const apiKey = opts.overrideKey.trim() || opts.boundApiKey.trim();
  if (apiKey) {
    headers.set("x-api-key", apiKey);
  }

  const request: RequestInit = {
    method: "POST",
    credentials: "include",
    headers,
    body: JSON.stringify(opts.body),
  };
  let response: Response;
  try {
    response = await fetch(opts.url, request);
  } catch (firstError) {
    if (!opts.recoverNetworkFailureOnce) throw firstError;
    // Preserve the original request/correlation identity on the single safe
    // recovery attempt so backend logs and idempotency evidence stay linked.
    response = await fetch(opts.url, request);
  }
  const parsedBody = await parseBody(response);
  const body = response.ok ? parsedBody : withHttpStatus(parsedBody, response.status);
  const bodyRecord = body && typeof body === "object" && !Array.isArray(body) ? (body as JsonRecord) : {};
  const correlationId =
    response.headers.get("x-correlation-id") ??
    response.headers.get("x-request-id") ??
    stringField(bodyRecord, "correlation_id") ??
    generatedCorrelationId;
  const requestId =
    response.headers.get("x-request-id") ??
    stringField(bodyRecord, "request_id") ??
    stringField(bodyRecord, "id") ??
    generatedRequestId;

  return {
    body,
    correlationId,
    requestId,
    httpStatus: response.status,
    denied: response.status === 401 || response.status === 403,
    jobId: responseJobId(body),
  };
}

async function parseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { text };
  }
}

function stringField(record: JsonRecord, key: string): string | null {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function withHttpStatus(body: unknown, status: number): unknown {
  if (body && typeof body === "object" && !Array.isArray(body)) {
    return { http_status: status, ...(body as JsonRecord) };
  }
  return { http_status: status, body };
}
