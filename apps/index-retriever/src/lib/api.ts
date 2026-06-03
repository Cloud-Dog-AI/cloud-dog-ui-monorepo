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

// @cloud-dog/app-index-retriever — Backend API adapter.

import { ApiError, createApiClient } from "@cloud-dog/api-client";
import type { ApiFailureInfo, AuditLogEntry, HealthResponse, JsonRecord, LogRecord, StatusResponse, ToolDescriptor } from "./types";

const TOOL_BASE_PATH = "/api/v1/tools";

function asRecord(value: unknown): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as JsonRecord;
}

function asToolArray(value: unknown): ToolDescriptor[] {
  if (!Array.isArray(value)) return [];

  const tools: ToolDescriptor[] = [];
  for (const item of value) {
    const obj = asRecord(item);
    const name = String(obj.name ?? "").trim();
    if (!name) continue;

    tools.push({
      name,
      input_schema: asRecord(obj.input_schema),
      output_schema: asRecord(obj.output_schema),
      description: typeof obj.description === "string" ? obj.description : undefined,
    });
  }
  return tools;
}

export function formatApiFailure(error: unknown): ApiFailureInfo {
  if (error instanceof ApiError) {
    return {
      message: error.message,
      status: error.options.status,
      code: error.options.code,
      requestId: error.options.requestId,
      correlationId: error.options.correlationId,
    };
  }

  if (error instanceof Error) {
    return {
      message: error.message || "Unknown API error",
      status: 0,
    };
  }

  return {
    message: String(error ?? "Unknown API error"),
    status: 0,
  };
}

export type IndexRetrieverApi = Readonly<{
  getCurrentUser: () => Promise<unknown>;
  getHealth: () => Promise<HealthResponse>;
  getStatus: () => Promise<StatusResponse>;
  getConfig: () => Promise<Record<string, unknown>>;
  getLogs: (params?: { level?: string[]; phase?: string; limit?: number }) => Promise<{ logs: LogRecord[]; count: number }>;
  getAuditLog: (params?: { limit?: number; log_source?: string }) => Promise<{ entries: AuditLogEntry[]; count: number; source: string }>;
  listTools: () => Promise<ToolDescriptor[]>;
  callTool: <T = unknown>(toolName: string, args: JsonRecord) => Promise<T>;
  getToolStatus: <T = unknown>(toolName: string) => Promise<T>;
  listCollections: (profile: string) => Promise<unknown>;
  getCollection: (profile: string, collection: string) => Promise<unknown>;
  createCollection: (payload: JsonRecord) => Promise<unknown>;
  updateCollection: (profile: string, collection: string, payload: JsonRecord) => Promise<unknown>;
  deleteCollection: (profile: string, collection: string) => Promise<unknown>;
  listSourceConfigs: () => Promise<unknown>;
  getSourceConfig: (sourceId: string) => Promise<unknown>;
  createSourceConfig: (payload: JsonRecord) => Promise<unknown>;
  updateSourceConfig: (sourceId: string, payload: JsonRecord) => Promise<unknown>;
  deleteSourceConfig: (sourceId: string) => Promise<unknown>;
  listStoredFiles: (profile?: string) => Promise<unknown>;
  uploadStoredFile: (args: {
    profile: string;
    file: File;
    metadata?: JsonRecord;
  }) => Promise<unknown>;
  getStoredFile: (fileId: string) => Promise<unknown>;
  downloadStoredFile: (fileId: string) => Promise<unknown>;
  deleteStoredFile: (fileId: string) => Promise<unknown>;
  listRbacBindings: () => Promise<unknown>;
  createRbacBinding: (payload: JsonRecord) => Promise<unknown>;
  deleteRbacBinding: (entityType: string, entityId: string, role: string) => Promise<unknown>;
  getA2aRoot: () => Promise<unknown>;
  getA2aHealth: () => Promise<unknown>;
  getA2aEvents: () => Promise<unknown>;
  uploadFile: (args: {
    profile: string;
    collection: string;
    file: File;
    metadata?: JsonRecord;
  }) => Promise<unknown>;
}>;

export async function validateApiKey(baseUrl: string, apiKey: string): Promise<void> {
  const key = apiKey.trim();
  if (!key) {
    throw new Error("API key is required.");
  }

  const probe = createApiClient({
    baseUrl,
    credentials: "include",
    getAccessToken: () => key,
  });

  await probe.get<unknown>(TOOL_BASE_PATH);
}

export function createIndexRetrieverApi(opts: {
  baseUrl: string;
  getAccessToken: () => string | null;
  onAuthError: () => void;
}): IndexRetrieverApi {
  const client = createApiClient({
    baseUrl: opts.baseUrl,
    credentials: "include",
    getAccessToken: opts.getAccessToken,
  });

  const guarded = async <T>(fn: () => Promise<T>): Promise<T> => {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof ApiError && error.options.status === 401) {
        opts.onAuthError();
      }
      throw error;
    }
  };

  const safeGet = <T>(path: string) => guarded(async () => client.get<T>(path));
  const safePost = <T>(path: string, payload: unknown) => guarded(async () => client.post<T>(path, payload));
  const safePut = <T>(path: string, payload: unknown) => guarded(async () => client.put<T>(path, payload));
  const safeDelete = <T>(path: string) => guarded(async () => client.delete<T>(path));
  const safeDeleteRaw = <T>(path: string) =>
    guarded(async () => {
      const token = opts.getAccessToken()?.trim();
      const headers: Record<string, string> = {};
      if (token) {
        headers["x-api-key"] = token;
      }
      const response = await fetch(new URL(path, opts.baseUrl).toString(), {
        method: "DELETE",
        credentials: "include",
        headers,
      });
      const body = (await response.json().catch(() => ({}))) as T;
      if (!response.ok) throw new Error(`Delete failed with status ${response.status}`);
      return body;
    });

  return {
    getCurrentUser: () => safeGet("/auth/me"),
    getHealth: () => safeGet<HealthResponse>("/health"),
    getStatus: () => safeGet<StatusResponse>("/status"),
    getConfig: () => safeGet<Record<string, unknown>>("/api/config"),
    getLogs: (params) => {
      const query = new URLSearchParams();
      for (const level of params?.level ?? []) query.append("level", level);
      if (params?.phase) query.set("phase", params.phase);
      if (params?.limit != null) query.set("limit", String(params.limit));
      const suffix = query.toString();
      return safeGet<{ logs: LogRecord[]; count: number }>(`/api/logs${suffix ? `?${suffix}` : ""}`);
    },

    getAuditLog: (params) => {
      const query = new URLSearchParams();
      if (params?.limit != null) query.set("limit", String(params.limit));
      if (params?.log_source) query.set("log_source", params.log_source);
      const suffix = query.toString();
      return safeGet<{ entries: AuditLogEntry[]; count: number; source: string }>(`/api/audit-log${suffix ? `?${suffix}` : ""}`);
    },

    listTools: () =>
      guarded(async () => {
        const result = await client.get<unknown>(TOOL_BASE_PATH);
        return asToolArray(result);
      }),

    callTool: <T = unknown>(toolName: string, args: JsonRecord) =>
      guarded(async () => {
        return client.post<T>(`${TOOL_BASE_PATH}/${encodeURIComponent(toolName)}`, args);
      }),

    getToolStatus: <T = unknown>(toolName: string) =>
      guarded(async () => {
        return client.post<T>(`${TOOL_BASE_PATH}/${encodeURIComponent(toolName)}`, {});
      }),

    listCollections: (profile: string) => safeGet(`/admin/collections?profile=${encodeURIComponent(profile)}`),
    getCollection: (profile: string, collection: string) =>
      safeGet(`/admin/collections/${encodeURIComponent(collection)}?profile=${encodeURIComponent(profile)}`),
    createCollection: (payload: JsonRecord) => safePost("/admin/collections", payload),
    updateCollection: (profile: string, collection: string, payload: JsonRecord) =>
      safePut(`/admin/collections/${encodeURIComponent(collection)}`, { ...payload, profile }),
    deleteCollection: (profile: string, collection: string) =>
      safeDeleteRaw(`/admin/collections/${encodeURIComponent(collection)}?profile=${encodeURIComponent(profile)}`),

    listSourceConfigs: () => safeGet("/admin/source-configs"),
    getSourceConfig: (sourceId: string) => safeGet(`/admin/source-configs/${encodeURIComponent(sourceId)}`),
    createSourceConfig: (payload: JsonRecord) => safePost("/admin/source-configs", payload),
    updateSourceConfig: (sourceId: string, payload: JsonRecord) =>
      safePut(`/admin/source-configs/${encodeURIComponent(sourceId)}`, payload),
    deleteSourceConfig: (sourceId: string) => safeDeleteRaw(`/admin/source-configs/${encodeURIComponent(sourceId)}`),

    listStoredFiles: (profile?: string) =>
      safeGet(`/api/v1/files${profile ? `?profile=${encodeURIComponent(profile)}` : ""}`),
    uploadStoredFile: ({ profile, file, metadata }) =>
      guarded(async () => {
        const token = opts.getAccessToken()?.trim();
        const formData = new FormData();
        formData.append("profile", profile);
        formData.append("metadata_json", JSON.stringify(metadata ?? {}));
        formData.append("upload", file);
        const headers: Record<string, string> = {};
        if (token) {
          headers["x-api-key"] = token;
        }
        const response = await fetch(new URL("/api/v1/files/upload", opts.baseUrl).toString(), {
          method: "POST",
          credentials: "include",
          headers,
          body: formData,
        });
        const body = (await response.json().catch(() => ({}))) as unknown;
        if (!response.ok) throw new Error(`Stored file upload failed with status ${response.status}`);
        return body;
      }),
    getStoredFile: (fileId: string) => safeGet(`/api/v1/files/${encodeURIComponent(fileId)}`),
    downloadStoredFile: (fileId: string) => safeGet(`/api/v1/files/${encodeURIComponent(fileId)}/download`),
    deleteStoredFile: (fileId: string) => safeDeleteRaw(`/api/v1/files/${encodeURIComponent(fileId)}`),

    listRbacBindings: () => safeGet("/admin/rbac-bindings"),
    createRbacBinding: (payload: JsonRecord) => safePost("/admin/rbac-bindings", payload),
    deleteRbacBinding: (entityType: string, entityId: string, role: string) =>
      safeDelete(
        `/admin/rbac-bindings/${encodeURIComponent(entityType)}/${encodeURIComponent(entityId)}/${encodeURIComponent(role)}`
      ),

    getA2aRoot: () => safeGet("/a2a"),
    getA2aHealth: () => safeGet("/a2a/health"),
    getA2aEvents: () => safeGet("/api/config-events"),

    uploadFile: ({ profile, collection, file, metadata }) =>
      guarded(async () => {
        const token = opts.getAccessToken()?.trim();
        const formData = new FormData();
        formData.append("profile", profile);
        formData.append("collection", collection);
        formData.append("metadata_json", JSON.stringify(metadata ?? {}));
        formData.append("upload", file);
        const headers: Record<string, string> = {};
        if (token) {
          headers["x-api-key"] = token;
        }

        const response = await fetch(new URL("/api/v1/upload", opts.baseUrl).toString(), {
          method: "POST",
          credentials: "include",
          headers,
          body: formData,
        });
        const body = (await response.json().catch(() => ({}))) as unknown;
        if (!response.ok) {
          throw new Error(
            typeof (body as JsonRecord)?.detail === "string"
              ? `${String((body as JsonRecord).detail)} (status ${response.status})`
              : `Upload failed with status ${response.status}`
          );
        }
        return body;
      }),
  };
}
