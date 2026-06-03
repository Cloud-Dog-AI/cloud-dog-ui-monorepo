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

// @cloud-dog/api-client — Client public types.

import type { z } from "zod";
import type { RetryPolicy } from "../retry/retry-policy";
import type { ApiError } from "../errors/api-error";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type RequestOptions = Readonly<{
  headers?: Record<string, string>;
  query?: Record<string, string | number | boolean | null | undefined>;
  timeoutMs?: number;
  credentials?: RequestCredentials;
  signal?: AbortSignal;
  validateWith?: z.ZodTypeAny;
  requestId?: string;
  correlationId?: string;
}>;

export type StreamOptions = Readonly<{
  onEvent: (event: SSEEvent) => void;
  onError: (error: ApiError) => void;
  onComplete?: () => void;
  getAccessToken?: () => string | null;
  requestId?: string;
  correlationId?: string;
}>;

export type JsonLineStreamOptions = Readonly<{
  onEvent: (event: unknown) => void;
  onError: (error: ApiError) => void;
  onComplete?: () => void;
  headers?: Record<string, string>;
  timeoutMs?: number;
  signal?: AbortSignal;
  requestId?: string;
  correlationId?: string;
}>;

export type ApiClientConfig = Readonly<{
  baseUrl: string;
  defaultHeaders?: Record<string, string>;
  timeoutMs?: number;
  credentials?: RequestCredentials;
  retryPolicy?: RetryPolicy;
  getAccessToken?: () => string | null;
  refreshAccessToken?: () => Promise<void>;
}>;

export type SSEEventType =
  | "started"
  | "delta"
  | "progress"
  | "tool_call"
  | "completed"
  | "error";

export type SSEEvent = Readonly<{
  type: SSEEventType;
  data: unknown;
}>;

export interface EventStreamHandle {
  close: () => void;
}

export interface ApiClient {
  get<T>(path: string, options?: RequestOptions): Promise<T>;
  post<T>(path: string, body: unknown, options?: RequestOptions): Promise<T>;
  patch<T>(path: string, body: unknown, options?: RequestOptions): Promise<T>;
  put<T>(path: string, body: unknown, options?: RequestOptions): Promise<T>;
  delete<T>(path: string, options?: RequestOptions): Promise<T>;
  stream(path: string, options: StreamOptions): EventStreamHandle;
  streamPostJsonLines(
    path: string,
    body: unknown,
    options: JsonLineStreamOptions
  ): EventStreamHandle;
}
