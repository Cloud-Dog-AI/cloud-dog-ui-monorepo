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

// @cloud-dog/api-client — createApiClient() factory.

import type {
  ApiClient,
  ApiClientConfig,
  HttpMethod,
  RequestOptions,
  StreamOptions,
  JsonLineStreamOptions,
} from "./types";
import { buildAbortSignal, buildHeaders, buildUrl, isIdempotent } from "./request";
import { parseJsonResponse, unwrapEnvelope, validateResponse } from "./response";
import { injectAccessToken } from "../auth/token-injector";
import { withRetry } from "../retry/retry-executor";
import { defaultRetryPolicy } from "../retry/retry-policy";
import { NetworkError } from "../errors/network-error";
import { mapErrorResponse } from "../errors/error-mapper";
import { withRefreshOn401, isUnauthorisedError } from "../auth/refresh-interceptor";
import { RequestDedup } from "../dedup/request-dedup";
import { createEventStream } from "../streaming/sse-consumer";
import { createJsonLinePostStream } from "../streaming/jsonl-post-stream";
import { ApiError } from "../errors/api-error";

function normaliseBaseUrl(baseUrl: string): string {
  if (baseUrl.startsWith("/")) {
    const origin = (globalThis as any)?.location?.origin as string | undefined;
    if (!origin) {
      throw new ApiError("Relative base URL requires window.location.origin", {
        status: 0,
        details: { baseUrl },
      });
    }
    return new URL(baseUrl, origin).toString();
  }

  let u: URL;
  try {
    u = new URL(baseUrl);
  } catch {
    throw new ApiError("Invalid API base URL", { status: 0, details: { baseUrl } });
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new ApiError("Invalid API base URL protocol", {
      status: 0,
      details: { baseUrl, protocol: u.protocol },
    });
  }
  return baseUrl;
}

async function doRequest<T>(opts: {
  config: ApiClientConfig;
  method: HttpMethod;
  path: string;
  body?: unknown;
  options?: RequestOptions;
  dedup?: RequestDedup;
}): Promise<T> {
  const { config, method, path, body, options } = opts;
  const { headers, requestId, correlationId } = buildHeaders({
    defaultHeaders: config.defaultHeaders,
    options,
  });

  injectAccessToken(headers, config.getAccessToken);
  if (body !== undefined) headers.set("Content-Type", "application/json");

  const url = buildUrl(config.baseUrl, path, options?.query);
  const abort = buildAbortSignal({
    timeoutMs: options?.timeoutMs ?? config.timeoutMs,
    externalSignal: options?.signal,
  });

  const init: RequestInit = {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: options?.credentials ?? config.credentials,
    signal: abort.signal,
  };

  const runFetch = async (): Promise<Response> => {
    try {
      return await fetch(url, init);
    } catch (e) {
      throw new NetworkError("Network request failed", {
        retryable: true,
        cause: e,
        requestId,
        correlationId,
      });
    } finally {
      abort.cancel?.();
    }
  };

  const resp =
    method === "GET" && opts.dedup
      ? await opts.dedup.dedupe(url, runFetch)
      : await runFetch();

  const parsed = await parseJsonResponse(resp);

  if (!resp.ok) {
    throw mapErrorResponse(resp.status, parsed, { requestId, correlationId });
  }

  const data = unwrapEnvelope(parsed);
  return validateResponse<T>(
    data,
    options?.validateWith as any
  );
}

export function createApiClient(config: ApiClientConfig): ApiClient {
  const baseUrl = normaliseBaseUrl(config.baseUrl);
  const effectiveConfig: ApiClientConfig = { ...config, baseUrl };

  const retryPolicy = config.retryPolicy ?? defaultRetryPolicy;
  const dedup = new RequestDedup();

  const run = async <T>(method: HttpMethod, path: string, body?: unknown, options?: RequestOptions) => {
    const execute = () =>
      doRequest<T>({
        config: effectiveConfig,
        method,
        path,
        body,
        options,
        dedup: method === "GET" ? dedup : undefined,
      });

    const guarded = () =>
      withRefreshOn401({
        fn: execute,
        refreshAccessToken: config.refreshAccessToken,
        isUnauthorised: isUnauthorisedError,
      });

    if (!retryPolicy.enabled || !isIdempotent(method)) return guarded();
    return withRetry(() => guarded(), retryPolicy);
  };

  return {
    get: (path, options) => run("GET", path, undefined, options),
    post: (path, body, options) => run("POST", path, body, options),
    patch: (path, body, options) => run("PATCH", path, body, options),
    put: (path, body, options) => run("PUT", path, body, options),
    delete: (path, options) => run("DELETE", path, undefined, options),
    stream: (path, options: StreamOptions) =>
      createEventStream({
        baseUrl: effectiveConfig.baseUrl,
        path,
        onEvent: options.onEvent,
        onError: options.onError,
        onComplete: options.onComplete,
        getAccessToken: options.getAccessToken ?? config.getAccessToken,
        requestId: options.requestId,
        correlationId: options.correlationId,
      }),
    streamPostJsonLines: (path: string, body: unknown, options: JsonLineStreamOptions) =>
      createJsonLinePostStream({
        config: effectiveConfig,
        path,
        body,
        options,
      }),
  };
}
