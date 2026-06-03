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

// @cloud-dog/api-client — Proxy client preset for same-origin backends.

import { createApiClient } from "../client/api-client";
import type {
  ApiClient,
  ApiClientConfig,
  RequestOptions,
  StreamOptions,
  JsonLineStreamOptions,
} from "../client/types";

export function createProxyClient(config: Omit<ApiClientConfig, "baseUrl"> = {}): ApiClient {
  const inner = createApiClient({
    ...config,
    // Trailing slash ensures relative paths append rather than replace.
    baseUrl: "/web/api/",
  });

  const normalisePath = (path: string) => (path.startsWith("/") ? path.slice(1) : path);

  return {
    get: (path: string, options?: RequestOptions) => inner.get(normalisePath(path), options),
    post: (path: string, body: unknown, options?: RequestOptions) => inner.post(normalisePath(path), body, options),
    patch: (path: string, body: unknown, options?: RequestOptions) =>
      inner.patch(normalisePath(path), body, options),
    put: (path: string, body: unknown, options?: RequestOptions) => inner.put(normalisePath(path), body, options),
    delete: (path: string, options?: RequestOptions) => inner.delete(normalisePath(path), options),
    stream: (path: string, options: StreamOptions) => inner.stream(normalisePath(path), options),
    streamPostJsonLines: (path: string, body: unknown, options: JsonLineStreamOptions) =>
      inner.streamPostJsonLines(normalisePath(path), body, options),
  };
}
