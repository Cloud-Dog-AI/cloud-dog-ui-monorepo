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

// @cloud-dog/api-client — Public exports for the Cloud-Dog frontend API client.

export { createApiClient } from "./client/api-client";

export type {
  ApiClient,
  ApiClientConfig,
  RequestOptions,
  StreamOptions,
  JsonLineStreamOptions,
  EventStreamHandle,
  SSEEvent,
  SSEEventType,
} from "./client/types";

export { ApiError } from "./errors/api-error";
export { NetworkError } from "./errors/network-error";
export { mapErrorResponse } from "./errors/error-mapper";

export { createRequestId } from "./correlation/request-id";

export type { PaginatedResponse, PageInfo } from "./pagination/types";
export { usePaginatedQuery } from "./pagination/use-paginated-query";

export type { RetryPolicy } from "./retry/retry-policy";
export { defaultRetryPolicy } from "./retry/retry-policy";

export { createEventStream } from "./streaming/sse-consumer";
export { sseEventTypes } from "./streaming/event-types";

export { createProxyClient } from "./presets/proxy-client";

export { createLongPollStream } from "./streaming/long-poll";
export type { LongPollEvent, LongPollOptions, LongPollStatus, LongPollState } from "./streaming/long-poll";

export type { JsonRpcRequest, JsonRpcResponse, JsonRpcError } from "./mcp/types";
export { buildJsonRpcRequest, parseJsonRpcResponse } from "./mcp/json-rpc";
