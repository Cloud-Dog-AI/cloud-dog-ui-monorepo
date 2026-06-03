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

// @cloud-dog/api-client — Request builder (headers, query, timeout, abort).

import type { HttpMethod, RequestOptions } from "./types";
import { createRequestId, normaliseId } from "../correlation/request-id";

export function buildUrl(baseUrl: string, path: string, query?: RequestOptions["query"]): string {
  const normalisedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const normalisedPath = path.startsWith("/") ? path.slice(1) : path;
  const url = new URL(normalisedPath, normalisedBase);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === null || v === undefined) continue;
      url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

export function buildHeaders(opts: {
  defaultHeaders?: Record<string, string>;
  options?: RequestOptions;
}): { headers: Headers; requestId: string; correlationId?: string } {
  const headers = new Headers();
  if (opts.defaultHeaders) {
    for (const [k, v] of Object.entries(opts.defaultHeaders)) headers.set(k, v);
  }
  if (opts.options?.headers) {
    for (const [k, v] of Object.entries(opts.options.headers)) headers.set(k, v);
  }

  const requestId = normaliseId(opts.options?.requestId) ?? createRequestId();
  const correlationId = normaliseId(opts.options?.correlationId);

  headers.set("X-Request-Id", requestId);
  if (correlationId) headers.set("X-Correlation-Id", correlationId);
  headers.set("Accept", "application/json");

  return { headers, requestId, correlationId };
}

export function buildAbortSignal(opts: {
  timeoutMs?: number;
  externalSignal?: AbortSignal;
}): { signal?: AbortSignal; cancel?: () => void } {
  const timeoutMs = opts.timeoutMs;
  if (!timeoutMs && !opts.externalSignal) return {};

  const controller = new AbortController();
  const onAbort = () => controller.abort();
  if (opts.externalSignal) {
    if (opts.externalSignal.aborted) controller.abort();
    else opts.externalSignal.addEventListener("abort", onAbort, { once: true });
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  if (timeoutMs) timer = setTimeout(() => controller.abort(), timeoutMs);

  return {
    signal: controller.signal,
    cancel: () => {
      if (timer) clearTimeout(timer);
      if (opts.externalSignal) opts.externalSignal.removeEventListener("abort", onAbort);
    },
  };
}

export function isIdempotent(method: HttpMethod): boolean {
  return method === "GET" || method === "PUT" || method === "DELETE";
}
