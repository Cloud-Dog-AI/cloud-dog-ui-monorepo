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

// @cloud-dog/api-client — MCP JSON-RPC helpers.

import type { JsonRpcRequest, JsonRpcResponse } from "./types";

export function buildJsonRpcRequest(method: string, params?: unknown, id: string | number = 1): JsonRpcRequest {
  return {
    jsonrpc: "2.0",
    id,
    method,
    params,
  };
}

export function parseJsonRpcResponse(data: unknown): JsonRpcResponse {
  if (!data || typeof data !== "object") {
    throw new Error("Invalid JSON-RPC response.");
  }
  const obj = data as Record<string, unknown>;
  if (obj.jsonrpc !== "2.0") throw new Error("Invalid JSON-RPC version.");
  if (!("id" in obj)) throw new Error("Missing JSON-RPC id.");
  if ("result" in obj) {
    return { jsonrpc: "2.0", id: obj.id as any, result: obj.result };
  }
  if ("error" in obj) {
    return { jsonrpc: "2.0", id: obj.id as any, error: obj.error as any };
  }
  throw new Error("Invalid JSON-RPC response shape.");
}
