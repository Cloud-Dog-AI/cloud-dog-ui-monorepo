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

// @cloud-dog/api-client — Retry executor with exponential backoff + jitter.

import type { RetryPolicy } from "./retry-policy";
import { NetworkError } from "../errors/network-error";
import { ApiError } from "../errors/api-error";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function shouldRetryError(error: unknown): boolean {
  if (error instanceof NetworkError) return error.options.retryable;
  if (error instanceof ApiError) {
    if (error.options.retryable) return true;
    return [502, 503, 504].includes(error.options.status);
  }
  return false;
}

export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  policy: RetryPolicy
): Promise<T> {
  if (!policy.enabled) return fn(0);

  let attempt = 0;
  // attempt=0 is the first execution.
  for (;;) {
    try {
      return await fn(attempt);
    } catch (e) {
      attempt += 1;
      if (attempt >= policy.maxAttempts || !shouldRetryError(e)) throw e;

      const backoff = Math.min(
        policy.backoffBaseMs * Math.pow(2, attempt - 1),
        policy.backoffMaxMs
      );
      const jitter = Math.floor(Math.random() * policy.jitterMs);
      await sleep(backoff + jitter);
    }
  }
}
