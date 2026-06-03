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

// @cloud-dog/api-client — JSON Lines POST streaming helper.

import type { ApiError } from "../errors/api-error";
import { ApiError as ApiErrorClass } from "../errors/api-error";
import { mapErrorResponse } from "../errors/error-mapper";
import { NetworkError } from "../errors/network-error";
import { injectAccessToken } from "../auth/token-injector";
import { buildAbortSignal, buildHeaders, buildUrl } from "../client/request";
import { parseJsonResponse } from "../client/response";
import type { ApiClientConfig, EventStreamHandle, JsonLineStreamOptions } from "../client/types";

function parseJsonLine(line: string): unknown {
  try {
    return JSON.parse(line);
  } catch {
    return { type: "delta", content_delta: line };
  }
}

function asApiError(error: unknown, fallback: string): ApiError {
  if (error instanceof ApiErrorClass) return error;
  if (error instanceof NetworkError) {
    return new ApiErrorClass(error.message, {
      status: 0,
      retryable: true,
      details: { cause: String(error.cause ?? "") },
    });
  }
  return new ApiErrorClass(fallback, {
    status: 0,
    retryable: false,
    details: { cause: String(error ?? "unknown") },
  });
}

export function createJsonLinePostStream(opts: {
  config: ApiClientConfig;
  path: string;
  body: unknown;
  options: JsonLineStreamOptions;
}): EventStreamHandle {
  const { headers, requestId, correlationId } = buildHeaders({
    defaultHeaders: opts.config.defaultHeaders,
    options: {
      headers: opts.options.headers,
      timeoutMs: opts.options.timeoutMs,
      signal: opts.options.signal,
      requestId: opts.options.requestId,
      correlationId: opts.options.correlationId,
    },
  });

  injectAccessToken(headers, opts.config.getAccessToken);
  headers.set("Content-Type", "application/json");
  headers.set("Accept", "application/jsonl, application/json");

  const url = buildUrl(opts.config.baseUrl, opts.path);
  const timeoutAbort = buildAbortSignal({
    timeoutMs: opts.options.timeoutMs ?? opts.config.timeoutMs,
    externalSignal: opts.options.signal,
  });

  const closeController = new AbortController();
  if (timeoutAbort.signal) {
    timeoutAbort.signal.addEventListener("abort", () => closeController.abort(), {
      once: true,
    });
  }

  let closed = false;

  void (async () => {
    try {
      let response: Response;
      try {
        response = await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify(opts.body),
          signal: closeController.signal,
        });
      } catch (error) {
        throw new NetworkError("Network request failed", {
          retryable: true,
          cause: error,
          requestId,
          correlationId,
        });
      }

      if (!response.ok) {
        const parsed = await parseJsonResponse(response);
        throw mapErrorResponse(response.status, parsed, {
          requestId,
          correlationId,
        });
      }

      const body = response.body;
      if (!body) {
        throw new ApiErrorClass("Streaming response body is not available", {
          status: response.status,
          requestId,
          correlationId,
        });
      }

      const reader = body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (!closed) {
        const chunk = await reader.read();
        if (chunk.done) break;

        buffer += decoder.decode(chunk.value, { stream: true });

        let newLineIndex = buffer.indexOf("\n");
        while (newLineIndex >= 0) {
          const line = buffer.slice(0, newLineIndex).trim();
          buffer = buffer.slice(newLineIndex + 1);
          if (line.length > 0) {
            opts.options.onEvent(parseJsonLine(line));
          }
          newLineIndex = buffer.indexOf("\n");
        }
      }

      const remaining = buffer.trim();
      if (!closed && remaining.length > 0) {
        opts.options.onEvent(parseJsonLine(remaining));
      }

      if (!closed) {
        opts.options.onComplete?.();
      }
    } catch (error) {
      if (closed) return;
      if (error instanceof Error && error.name === "AbortError") return;
      opts.options.onError(asApiError(error, "JSON lines stream failed"));
    } finally {
      timeoutAbort.cancel?.();
    }
  })();

  return {
    close: () => {
      closed = true;
      closeController.abort();
      timeoutAbort.cancel?.();
    },
  };
}
