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

// @cloud-dog/api-client — ErrorResponse → ApiError mapping.

import { ApiError } from "./api-error";

type ErrorEnvelope = {
  ok: false;
  error: {
    code?: string;
    message?: string;
    details?: unknown;
    retryable?: boolean;
  };
  meta?: {
    request_id?: string;
    correlation_id?: string;
  };
};

function isErrorEnvelope(body: unknown): body is ErrorEnvelope {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  if (b.ok !== false) return false;
  return typeof b.error === "object" && b.error !== null;
}

export function mapErrorResponse(
  status: number,
  body: unknown,
  ids: { requestId?: string; correlationId?: string }
): ApiError {
  if (isErrorEnvelope(body)) {
    const msg = body.error.message ?? `Request failed with status ${status}`;
    return new ApiError(msg, {
      code: body.error.code,
      status,
      details: body.error.details,
      retryable: body.error.retryable,
      requestId: body.meta?.request_id ?? ids.requestId,
      correlationId: body.meta?.correlation_id ?? ids.correlationId,
    });
  }

  return new ApiError(`Request failed with status ${status}`, {
    status,
    details: body,
    requestId: ids.requestId,
    correlationId: ids.correlationId,
  });
}
