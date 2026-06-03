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

// @cloud-dog/api-client — Server-Sent Events consumer.

import type { ApiError } from "../errors/api-error";
import { ApiError as ApiErrorClass } from "../errors/api-error";
import type { EventStreamHandle, SSEEvent } from "../client/types";
import { createRequestId, normaliseId } from "../correlation/request-id";

function safeParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export function createEventStream(opts: {
  baseUrl: string;
  path: string;
  onEvent: (event: SSEEvent) => void;
  onError: (error: ApiError) => void;
  onComplete?: () => void;
  getAccessToken?: () => string | null;
  requestId?: string;
  correlationId?: string;
}): EventStreamHandle {
  const requestId = normaliseId(opts.requestId) ?? createRequestId();
  const correlationId = normaliseId(opts.correlationId);

  const url = new URL(opts.path, opts.baseUrl);
  url.searchParams.set("request_id", requestId);
  if (correlationId) url.searchParams.set("correlation_id", correlationId);
  const token = opts.getAccessToken?.();
  if (token) url.searchParams.set("access_token", token);

  const ES = (globalThis as unknown as { EventSource?: typeof EventSource }).EventSource;
  if (!ES) {
    // Environment does not provide EventSource (e.g. Node/JSDOM). Provide a safe handle and report.
    const err = new ApiErrorClass("EventSource is not available in this environment", {
      status: 0,
      retryable: false,
      requestId,
      correlationId,
    });
    opts.onError(err);
    return { close: () => {} };
  }

  const source = new ES(url.toString());

  source.onmessage = (ev) => {
    const data = safeParseJson(ev.data);
    if (data && typeof data === "object" && "type" in (data as any) && "data" in (data as any)) {
      opts.onEvent(data as SSEEvent);
      if ((data as any).type === "completed") opts.onComplete?.();
      return;
    }
    opts.onEvent({ type: "delta", data });
  };

  source.onerror = () => {
    const err = new ApiErrorClass("Event stream error", {
      status: 0,
      retryable: true,
      requestId,
      correlationId,
    });
    opts.onError(err);
    source.close();
  };

  return {
    close: () => source.close(),
  };
}
