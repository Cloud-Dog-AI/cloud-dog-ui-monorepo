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

// @cloud-dog/app-file-mcp — Backend API adapter.

import type { User } from "@cloud-dog/auth";
import { ApiError, createApiClient } from "@cloud-dog/api-client";
import type {
  AdminApiKey,
  AdminGroup,
  AdminProfile,
  AdminReloadResult,
  AdminUser,
  AuditEntry,
  BackendStatusResponse,
  HealthResponse,
  JobSummary,
  QueueStatus,
  ListDirResponse,
  RuntimeConfigSnapshot,
  EffectiveConfigResponse,
  SearchContentResult,
  SearchPathResult,
  StatusResponse,
  StorageProfile,
  ToolDescriptor,
} from "./types";

const MCP_ACCEPT_HEADER = "application/json, text/event-stream";

type JsonRecord = Record<string, unknown>;

type McpEnvelope = Readonly<{
  jsonrpc?: string;
  id?: string | number;
  result?: unknown;
  error?: Readonly<{
    code?: number;
    message?: string;
    data?: unknown;
  }>;
}>;

export type FileMcpApi = Readonly<{
  getCurrentUser: () => Promise<User>;
  getHealth: () => Promise<HealthResponse>;
  getStatus: () => Promise<StatusResponse>;
  listTools: () => Promise<ToolDescriptor[]>;
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  listDir: (path: string, recursive?: boolean) => Promise<ListDirResponse>;
  readFile: (path: string) => Promise<string>;
  writeFile: (path: string, content: string, overwrite?: boolean) => Promise<void>;
  deleteFile: (path: string, missingOk?: boolean) => Promise<void>;
  copyFile: (src: string, dst: string, overwrite?: boolean) => Promise<void>;
  moveFile: (src: string, dst: string, overwrite?: boolean) => Promise<void>;
  renamePath: (src: string, dst: string, overwrite?: boolean) => Promise<void>;
  createDir: (path: string) => Promise<void>;
  searchPaths: (query: string) => Promise<SearchPathResult[]>;
  searchContent: (query: string, regex?: boolean) => Promise<SearchContentResult[]>;
  backendStatus: () => Promise<BackendStatusResponse>;
  readAuditLog: (path: string) => Promise<AuditEntry[]>;
  loadProfiles: (path: string) => Promise<StorageProfile[]>;
  saveProfiles: (path: string, profiles: StorageProfile[]) => Promise<void>;
  listAdminUsers: () => Promise<AdminUser[]>;
  createAdminUser: (payload: {
    username: string;
    display_name?: string;
    is_active?: boolean;
    groups?: string[];
  }) => Promise<AdminUser>;
  updateAdminUser: (
    userId: string,
    payload: Partial<{
      display_name: string;
      is_active: boolean;
      groups: string[];
    }>
  ) => Promise<AdminUser>;
  deleteAdminUser: (userId: string) => Promise<void>;
  listAdminGroups: () => Promise<AdminGroup[]>;
  createAdminGroup: (payload: {
    name: string;
    description?: string;
    roles?: string[];
    is_active?: boolean;
  }) => Promise<AdminGroup>;
  updateAdminGroup: (
    groupId: string,
    payload: Partial<{
      description: string;
      roles: string[];
      is_active: boolean;
    }>
  ) => Promise<AdminGroup>;
  deleteAdminGroup: (groupId: string) => Promise<void>;
  listAdminApiKeys: (includeInactive?: boolean) => Promise<AdminApiKey[]>;
  createAdminApiKey: (payload: {
    user_id: string;
    label: string;
    scopes?: string[];
    profile_name?: string;
    ttl_days?: number;
  }) => Promise<AdminApiKey>;
  rotateAdminApiKey: (keyId: string) => Promise<AdminApiKey>;
  expireAdminApiKey: (keyId: string) => Promise<AdminApiKey>;
  revokeAdminApiKey: (keyId: string) => Promise<AdminApiKey>;
  listAdminProfiles: () => Promise<AdminProfile[]>;
  createAdminProfile: (payload: {
    name: string;
    display_name?: string;
    backend: string;
    root: string;
    api_keys?: string[];
  }) => Promise<AdminProfile>;
  updateAdminProfile: (
    name: string,
    payload: Partial<{
      display_name: string;
      backend: string;
      root: string;
      api_keys: string[];
    }>
  ) => Promise<AdminProfile>;
  deleteAdminProfile: (name: string) => Promise<void>;
  triggerAdminReload: () => Promise<AdminReloadResult>;
  getAdminRuntimeConfig: () => Promise<RuntimeConfigSnapshot>;
  getEffectiveConfig: (reveal?: boolean) => Promise<EffectiveConfigResponse>;
  listJobs: (opts?: { limit?: number; status?: string }) => Promise<JobSummary[]>;
  getJob: (jobId: string) => Promise<JobSummary | null>;
  cancelJob: (jobId: string) => Promise<boolean>;
  retryJob: (jobId: string) => Promise<boolean>;
  deleteJob: (jobId: string) => Promise<boolean>;
  getQueueStatus: () => Promise<QueueStatus>;
  getA2aHealth: () => Promise<unknown>;
  sendA2aMessage: (topic: string, payload: unknown) => Promise<unknown>;
}>;

function asRecord(value: unknown): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as JsonRecord;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function parseSseEnvelope(raw: string): McpEnvelope {
  const lines = raw.split(/\r?\n/);
  const envelopes: McpEnvelope[] = [];

  for (const line of lines) {
    if (!line.startsWith("data: ")) continue;
    const payload = line.slice(6).trim();
    if (!payload || payload === "[DONE]") continue;
    try {
      const parsed = JSON.parse(payload) as McpEnvelope;
      envelopes.push(parsed);
    } catch {
      // Ignore malformed SSE chunks and continue scanning.
    }
  }

  if (!envelopes.length) {
    throw new Error("MCP response did not contain a JSON SSE frame.");
  }

  return envelopes[envelopes.length - 1];
}

function parseEnvelope(raw: unknown): McpEnvelope {
  if (typeof raw === "string") return parseSseEnvelope(raw);
  if (raw && typeof raw === "object") return raw as McpEnvelope;
  throw new Error("Unexpected MCP response type.");
}

function parseTextPayload(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function structuredContent(result: unknown): unknown {
  const resultObj = asRecord(result);
  if ("structuredContent" in resultObj) {
    const structured = resultObj.structuredContent;
    if (structured !== null && structured !== undefined) return structured;
  }

  const content = resultObj.content;
  if (Array.isArray(content) && content.length > 0) {
    const first = asRecord(content[0]);
    if (typeof first.text === "string") return parseTextPayload(first.text);
  }

  return result;
}

function isMissingPathError(error: unknown): boolean {
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
  return message.includes("not found") || message.includes("no such file") || message.includes("missing");
}

function parseProfileArray(value: unknown): StorageProfile[] {
  if (!Array.isArray(value)) return [];

  const profiles: StorageProfile[] = [];
  for (const item of value) {
    const obj = asRecord(item);
    const id = String(obj.id ?? "").trim();
    const name = String(obj.name ?? "").trim();
    if (!id || !name) continue;

    const typeRaw = String(obj.type ?? "local").toLowerCase();
    const type: StorageProfile["type"] =
      typeRaw === "s3" ||
      typeRaw === "webdav" ||
      typeRaw === "ftp" ||
      typeRaw === "google-drive"
        ? typeRaw
        : "local";

    profiles.push({
      id,
      name,
      type,
      endpoint: String(obj.endpoint ?? "").trim(),
      username: String(obj.username ?? "").trim(),
      notes: String(obj.notes ?? "").trim(),
      updatedAt: String(obj.updatedAt ?? new Date().toISOString()),
    });
  }

  return profiles;
}

function asAuditEntry(value: unknown): AuditEntry | null {
  const item = asRecord(value);
  const timestamp = typeof item.timestamp === "string" ? item.timestamp.trim() : "";
  const message = typeof item.message === "string" ? item.message.trim() : "";

  if (message.startsWith("{")) {
    try {
      const parsed = asRecord(JSON.parse(message));
      const parsedTimestamp =
        typeof parsed.timestamp === "string" ? parsed.timestamp.trim() : timestamp;
      if (parsedTimestamp) {
        return {
          ...(item as AuditEntry),
          ...(parsed as AuditEntry),
          timestamp: parsedTimestamp,
        };
      }
    } catch {
      // Ignore malformed nested payloads and fall back to the wrapper row.
    }
  }

  if (!timestamp) return null;
  return item as AuditEntry;
}

export async function validateApiKey(baseUrl: string, apiKey: string, mcpPath = "/mcp"): Promise<void> {
  const key = apiKey.trim();
  if (!key) throw new Error("API key is required.");

  const probeClient = createApiClient({ baseUrl });
  let response: unknown;
  try {
    response = await probeClient.post<unknown>(
      mcpPath || "/mcp",
      {
        jsonrpc: "2.0",
        id: "login-probe",
        method: "tools/call",
        params: { name: "backend_status", arguments: {} },
      },
      {
        headers: {
          Accept: MCP_ACCEPT_HEADER,
          Authorization: `Bearer ${key}`,
        },
      }
    );
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.options.status === 401 || error.options.status === 403) {
        throw new Error("Login failed. Invalid or unauthorised API key.");
      }
      throw new Error("Login failed. The API key was rejected.");
    }
    throw error;
  }

  const envelope = parseEnvelope(response);
  if (envelope.error) {
    const message = String(envelope.error.message ?? "").trim();
    if (
      message.toLowerCase().includes("unauthor") ||
      message.toLowerCase().includes("invalid")
    ) {
      throw new Error("Login failed. Invalid or unauthorised API key.");
    }
    throw new Error(message || "API key validation failed.");
  }
}

export function createFileMcpApi(opts: {
  baseUrl: string;
  mcpPath: string;
  authMode?: "api_key" | "cookie" | "oidc";
  getAccessToken: () => string | null;
  getAdminToken: () => string | null;
  getSelectedProfile: () => string | null;
}): FileMcpApi {
  const client = createApiClient({
    baseUrl: opts.baseUrl,
    credentials: opts.authMode === "cookie" ? "include" : undefined,
    getAccessToken: opts.getAccessToken,
  });
  // W28A-258: MCP paths (/webmcp, /mcp) are at the origin root, not under
  // the API base path (/api). Use a separate client with origin-only base
  // so buildUrl produces /webmcp, not /api/webmcp.
  const mcpBaseUrl = (() => {
    try {
      return new URL(opts.baseUrl).origin;
    } catch {
      return opts.baseUrl.replace(/\/api\/?$/, "");
    }
  })();
  const mcpClient = createApiClient({
    baseUrl: mcpBaseUrl,
    credentials: opts.authMode === "cookie" ? "include" : undefined,
    getAccessToken: opts.getAccessToken,
  });
  const mcpEndpoint = opts.mcpPath || "/mcp";

  const guarded = async <T>(fn: () => Promise<T>): Promise<T> => {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof ApiError && (error.options.status === 401 || error.options.status === 403)) {
        throw error;
      }
      throw error;
    }
  };

  const callMcp = async (method: string, params: Record<string, unknown>): Promise<unknown> => {
    const selectedProfile = String(opts.getSelectedProfile() ?? "").trim();
    return guarded(async () => {
      const response = await mcpClient.post<unknown>(
        mcpEndpoint,
        {
          jsonrpc: "2.0",
          id: `${method}-${Date.now()}`,
          method,
          params,
        },
        {
          headers: {
            Accept: MCP_ACCEPT_HEADER,
            ...(selectedProfile ? { "X-File-MCP-Profile": selectedProfile } : {}),
          },
        }
      );

      const proxied = asRecord(response);
      if (
        Object.prototype.hasOwnProperty.call(proxied, "data") &&
        Object.prototype.hasOwnProperty.call(proxied, "ok")
      ) {
        return proxied.data;
      }

      if (typeof response === "string") {
        if (!response.trim().startsWith("data:")) return response;
      } else if (
        response &&
        typeof response === "object" &&
        !Array.isArray(response) &&
        !Object.prototype.hasOwnProperty.call(proxied, "jsonrpc") &&
        !Object.prototype.hasOwnProperty.call(proxied, "result") &&
        !Object.prototype.hasOwnProperty.call(proxied, "error")
      ) {
        return response;
      }

      const envelope = parseEnvelope(response);
      if (envelope.error) {
        throw new Error(envelope.error.message ?? `MCP method failed: ${method}`);
      }
      return envelope.result;
    });
  };

  const callTool = async <T>(name: string, args: Record<string, unknown>): Promise<T> => {
    const result = await callMcp("tools/call", { name, arguments: args });
    return structuredContent(result) as T;
  };

  const adminHeaders = (): Record<string, string> => {
    const token = String(opts.getAdminToken() ?? "").trim();
    const selectedProfile = String(opts.getSelectedProfile() ?? "").trim();
    return {
      ...(token ? { "X-Admin-Token": token } : {}),
      ...(selectedProfile ? { "X-File-MCP-Profile": selectedProfile } : {}),
    };
  };

  const listPayload = <T>(value: unknown, key: string): T[] => {
    const items = asRecord(value)[key];
    return Array.isArray(items) ? (items as T[]) : [];
  };

  const objectPayload = <T>(value: unknown, key: string): T => {
    const payload = asRecord(value)[key];
    return (payload as T) ?? ({} as T);
  };

  return {
    getCurrentUser: () =>
      guarded(async () => {
        const selectedProfile = String(opts.getSelectedProfile() ?? "").trim();
        const payload = await client.get<unknown>("/auth/me", {
          headers: selectedProfile
            ? { "X-File-MCP-Profile": selectedProfile }
            : undefined,
        });
        const user = asRecord(asRecord(payload).user);
        return {
          id: String(user.id ?? "api-key-user"),
          displayName: String(user.displayName ?? user.username ?? user.id ?? "API key"),
          email: typeof user.email === "string" && user.email.trim() ? user.email : undefined,
          roles: asStringArray(user.roles),
          permissions: asStringArray(user.permissions),
        } satisfies User;
      }),

    getHealth: () => guarded(async () => client.get<HealthResponse>("/health")),
    getStatus: () => guarded(async () => client.get<StatusResponse>("/status")),

    listTools: () =>
      guarded(async () => {
        const result = await callMcp("tools/list", {});
        const tools = asRecord(result).tools;
        if (!Array.isArray(tools)) return [];

        const mapped: ToolDescriptor[] = [];
        for (const item of tools) {
          const tool = asRecord(item);
          const name = String(tool.name ?? "").trim();
          if (!name) continue;
          mapped.push({
            name,
            description: typeof tool.description === "string" ? tool.description : "",
            input_schema: asRecord(tool.inputSchema || tool.input_schema),
          });
        }
        return mapped;
      }),

    callTool: (name, args) => callTool<unknown>(name, args),

    listDir: (path: string, recursive = false) =>
      callTool<ListDirResponse>("list_dir", {
        path,
        recursive,
      }).then((result) => ({
        path: typeof result.path === "string" ? result.path : path,
        entries: asStringArray(result.entries),
        entry_details: Array.isArray(asRecord(result).entry_details)
          ? (asRecord(result).entry_details as ListDirResponse["entry_details"])
          : undefined,
      })),

    readFile: (path: string) =>
      callTool<unknown>("read_file", { path }).then((result) => {
        if (typeof result === "string") return result;
        const obj = asRecord(result);
        if (typeof obj.result === "string") return obj.result;
        if (typeof obj.value === "string") return obj.value;
        if (typeof obj.content === "string") return obj.content;
        return JSON.stringify(result, null, 2);
      }),

    writeFile: (path: string, content: string, overwrite = true) =>
      callTool("write_file", { path, content, overwrite }).then(() => undefined),

    deleteFile: (path: string, missingOk = true) =>
      callTool("delete_file", { path, missing_ok: missingOk }).then(() => undefined),

    copyFile: (src: string, dst: string, overwrite = true) =>
      callTool("copy_file", { src, dst, overwrite }).then(() => undefined),

    moveFile: (src: string, dst: string, overwrite = true) =>
      callTool("move_file", { src, dst, overwrite }).then(() => undefined),

    renamePath: (src: string, dst: string, overwrite = true) =>
      callTool("rename_path", { src, dst, overwrite }).then(() => undefined),

    createDir: (path: string) =>
      callTool("create_dir", { path, parents: true, exist_ok: true }).then(() => undefined),

    searchPaths: (query: string) =>
      callTool<unknown>("search_paths", {
        query,
        max_results: 250,
        max_depth: 6,
      }).then((result) => {
        const matches = asRecord(result).matches;
        if (!Array.isArray(matches)) return [];

        return matches
          .map((item) => {
            if (typeof item === "string") {
              const path = item.trim();
              return path ? ({ path } satisfies SearchPathResult) : null;
            }
            const row = asRecord(item);
            const path = String(row.path ?? "").trim();
            return path ? ({ path } satisfies SearchPathResult) : null;
          })
          .filter((item): item is SearchPathResult => item !== null);
      }),

    searchContent: (query: string, regex = false) =>
      callTool<unknown>("search_content", { query, regex }).then((result) => {
        const matches = asRecord(result).matches;
        if (!Array.isArray(matches)) return [];

        return matches
          .map((item) => {
            const row = asRecord(item);
            const path = String(row.path ?? "").trim();
            if (!path) return null;
            return {
              path,
              line_no: Number(row.line_no ?? 0),
              line: String(row.line ?? ""),
            } satisfies SearchContentResult;
          })
          .filter((item): item is SearchContentResult => item !== null);
      }),

    backendStatus: () => callTool<BackendStatusResponse>("backend_status", {}),

    readAuditLog: async (path: string) => {
      // Prefer the dedicated logs API so audit reads keep working when the
      // audit file sits outside the scoped workspace roots.
      try {
        const payload = await client.get<unknown>("/v1/logs", {
          query: { type: "audit", limit: 500 },
        });
        const items = asRecord(payload).items;
        if (Array.isArray(items)) {
          return items
            .map((item) => asAuditEntry(item))
            .filter((entry): entry is AuditEntry => Boolean(entry))
            .sort((left, right) => right.timestamp.localeCompare(left.timestamp));
        }
      } catch {
        // Fall back to the older direct-file path for runtimes that do not
        // yet expose the normalised logs API.
      }

      // Bypass guarded() — audit log reads should NOT trigger sign-out
      // on 401/403. The audit file may not exist or may require different
      // permissions; a failure here must be shown in-page, not as a logout.
      let content: unknown;
      try {
        content = await callTool<unknown>("read_file", { path });
      } catch {
        content = { result: "" };
      }

      const text =
        typeof content === "string"
          ? content
          : typeof asRecord(content).result === "string"
            ? String(asRecord(content).result)
            : "";

      if (!text.trim()) return [];

      const rows: AuditEntry[] = [];
      for (const line of text.split(/\r?\n/)) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line) as AuditEntry;
          if (!parsed.timestamp) continue;
          rows.push(parsed);
        } catch {
          // Ignore malformed lines.
        }
      }

      rows.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      return rows;
    },

    loadProfiles: async (_path: string) => {
      // Load profiles from the admin API (database-backed, not flat JSON file).
      return guarded(async () => {
        const payload = await client.get<unknown>("/admin/profiles", {
          headers: adminHeaders(),
        });
        const items = listPayload<Record<string, unknown>>(payload, "profiles");
        return items.map((item): StorageProfile => ({
          id: String(item.id ?? item.name ?? ""),
          name: String(item.name ?? ""),
          type: (String(item.backend ?? item.type ?? "local") as StorageProfile["type"]),
          endpoint: String(item.root ?? item.endpoint ?? ""),
          username: String(item.username ?? ""),
          notes: String(item.display_name ?? item.notes ?? ""),
          updatedAt: String(item.updated_at ?? item.updatedAt ?? new Date().toISOString()),
        }));
      });
    },

    saveProfiles: async (_path: string, _profiles: StorageProfile[]) => {
      // Profiles are now saved individually via create/update/delete API calls.
      // This method is kept for interface compat but is a no-op — the UI
      // should call createProfile/updateProfile/deleteProfile directly.
    },

    listAdminUsers: () =>
      guarded(async () => {
        const payload = await client.get<unknown>("/admin/users", {
          headers: adminHeaders(),
        });
        return listPayload<AdminUser>(payload, "users");
      }),

    createAdminUser: (payload) =>
      guarded(async () => {
        const response = await client.post<unknown>("/admin/users", payload, {
          headers: adminHeaders(),
        });
        return objectPayload<AdminUser>(response, "user");
      }),

    updateAdminUser: (userId, payload) =>
      guarded(async () => {
        const response = await client.patch<unknown>(`/admin/users/${userId}`, payload, {
          headers: adminHeaders(),
        });
        return objectPayload<AdminUser>(response, "user");
      }),

    deleteAdminUser: (userId) =>
      guarded(async () => {
        await client.delete<unknown>(`/admin/users/${userId}`, {
          headers: adminHeaders(),
        });
      }),

    listAdminGroups: () =>
      guarded(async () => {
        const payload = await client.get<unknown>("/admin/groups", {
          headers: adminHeaders(),
        });
        return listPayload<AdminGroup>(payload, "groups");
      }),

    createAdminGroup: (payload) =>
      guarded(async () => {
        const response = await client.post<unknown>("/admin/groups", payload, {
          headers: adminHeaders(),
        });
        return objectPayload<AdminGroup>(response, "group");
      }),

    updateAdminGroup: (groupId, payload) =>
      guarded(async () => {
        const response = await client.patch<unknown>(`/admin/groups/${groupId}`, payload, {
          headers: adminHeaders(),
        });
        return objectPayload<AdminGroup>(response, "group");
      }),

    deleteAdminGroup: (groupId) =>
      guarded(async () => {
        await client.delete<unknown>(`/admin/groups/${groupId}`, {
          headers: adminHeaders(),
        });
      }),

    listAdminApiKeys: (includeInactive = true) =>
      guarded(async () => {
        const payload = await client.get<unknown>("/admin/api-keys", {
          headers: adminHeaders(),
          query: { include_inactive: includeInactive ? "true" : "false" },
        });
        return listPayload<AdminApiKey>(payload, "api_keys");
      }),

    createAdminApiKey: (payload) =>
      guarded(async () => {
        const response = await client.post<unknown>("/admin/api-keys", payload, {
          headers: adminHeaders(),
        });
        return objectPayload<AdminApiKey>(response, "api_key");
      }),

    rotateAdminApiKey: (keyId) =>
      guarded(async () => {
        const response = await client.post<unknown>(`/admin/api-keys/${keyId}/rotate`, {}, {
          headers: adminHeaders(),
        });
        return objectPayload<AdminApiKey>(response, "api_key");
      }),

    expireAdminApiKey: (keyId) =>
      guarded(async () => {
        const response = await client.post<unknown>(`/admin/api-keys/${keyId}/expire`, {}, {
          headers: adminHeaders(),
        });
        return objectPayload<AdminApiKey>(response, "api_key");
      }),

    revokeAdminApiKey: (keyId) =>
      guarded(async () => {
        const response = await client.post<unknown>(`/admin/api-keys/${keyId}/revoke`, {}, {
          headers: adminHeaders(),
        });
        return objectPayload<AdminApiKey>(response, "api_key");
      }),

    listAdminProfiles: () =>
      guarded(async () => {
        const payload = await client.get<unknown>("/admin/profiles", {
          headers: adminHeaders(),
        });
        return listPayload<Record<string, unknown>>(payload, "profiles").map((item) => {
          const profile = item as Record<string, unknown>;
          return {
            name: String(profile.name ?? ""),
            display_name: String(profile.display_name ?? profile.name ?? ""),
            backend: String(profile.backend ?? "local"),
            roots: Array.isArray(profile.roots) ? profile.roots.map((value) => String(value)) : [],
            api_keys_count: Number(profile.api_keys_count ?? 0),
            status: typeof profile.status === "string" ? profile.status : undefined,
            reason: typeof profile.reason === "string" ? profile.reason : undefined,
            profile: asRecord(profile.profile),
          } satisfies AdminProfile;
        });
      }),

    createAdminProfile: (payload) =>
      guarded(async () => {
        const response = await client.post<unknown>(
          "/admin/profiles",
          {
            name: payload.name,
            display_name: payload.display_name,
            backend: payload.backend,
            root: payload.root,
            api_keys: payload.api_keys ?? [],
          },
          { headers: adminHeaders() }
        );
        return objectPayload<AdminProfile>(response, "profile");
      }),

    updateAdminProfile: (name, payload) =>
      guarded(async () => {
        const response = await client.patch<unknown>(
          `/admin/profiles/${encodeURIComponent(name)}`,
          payload,
          { headers: adminHeaders() }
        );
        return objectPayload<AdminProfile>(response, "profile");
      }),

    deleteAdminProfile: (name) =>
      guarded(async () => {
        await client.delete<unknown>(`/admin/profiles/${encodeURIComponent(name)}`, {
          headers: adminHeaders(),
        });
      }),

    triggerAdminReload: () =>
      guarded(async () => {
        const payload = await client.post<unknown>("/admin/reload", {}, {
          headers: adminHeaders(),
        });
        return objectPayload<AdminReloadResult>(payload, "result");
      }),

    getAdminRuntimeConfig: () =>
      guarded(async () =>
        client.get<RuntimeConfigSnapshot>("/admin/runtime-config", {
          headers: adminHeaders(),
        })
      ),

    getEffectiveConfig: (reveal?: boolean) =>
      guarded(async () =>
        client.get<EffectiveConfigResponse>(
          reveal ? "/admin/effective-config?reveal=1" : "/admin/effective-config",
          { headers: adminHeaders() }
        )
      ),

    listJobs: ({ limit = 200, status } = {}) =>
      guarded(async () => {
        const payload = await client.get<unknown>("/v1/jobs", {
          query: {
            limit: String(limit),
            ...(status ? { status } : {}),
          },
          headers: adminHeaders(),
        });
        const jobs = listPayload<Record<string, unknown>>(payload, "jobs");
        return jobs.map((job) => ({
          job_id: String(job.job_id ?? ""),
          job_type: String(job.job_type ?? ""),
          queue_name: job.queue_name ? String(job.queue_name) : undefined,
          status: String(job.status ?? "queued"),
          priority: typeof job.priority === "number" ? job.priority : 0,
          progress:
            typeof job.progress === "number"
              ? job.progress
              : Number.isFinite(Number(job.progress))
                ? Number(job.progress)
                : null,
          created_at: job.created_at ? String(job.created_at) : null,
          started_at: job.started_at ? String(job.started_at) : null,
          updated_at: job.updated_at ? String(job.updated_at) : null,
          completed_at: job.completed_at ? String(job.completed_at) : null,
          finished_at: job.finished_at ? String(job.finished_at) : null,
          duration_s:
            typeof job.duration_s === "number"
              ? job.duration_s
              : Number.isFinite(Number(job.duration_s))
                ? Number(job.duration_s)
                : null,
          duration_seconds:
            typeof job.duration_seconds === "number"
              ? job.duration_seconds
              : null,
          attempt: typeof job.attempt === "number" ? job.attempt : undefined,
          max_attempts: typeof job.max_attempts === "number" ? job.max_attempts : undefined,
          outcome: job.outcome ? String(job.outcome) : null,
          last_error: (job.last_error as Record<string, unknown>) ?? null,
          correlation_id: job.correlation_id ? String(job.correlation_id) : null,
          user_id: job.user_id ? String(job.user_id) : null,
          request_source: job.request_source ? String(job.request_source) : null,
          request_auth_identity: job.request_auth_identity ? String(job.request_auth_identity) : null,
          server_id: job.server_id ? String(job.server_id) : null,
          worker_id: job.worker_id ? String(job.worker_id) : null,
          session_id: job.session_id ? String(job.session_id) : null,
          payload: (job.payload as Record<string, unknown>) ?? undefined,
        }));
      }),

    getJob: (jobId) =>
      guarded(async () => {
        const payload = await client.get<unknown>(`/v1/jobs/${jobId}`, { headers: adminHeaders() });
        const rec = asRecord(asRecord(payload).job ?? payload);
        return String(rec.job_id ?? "").trim() ? (rec as unknown as JobSummary) : null;
      }),

    cancelJob: (jobId) =>
      guarded(async () => {
        const payload = await client.post<unknown>(`/v1/jobs/${jobId}/cancel`, {});
        return Boolean(asRecord(payload).cancelled ?? true);
      }),

    retryJob: (jobId) =>
      guarded(async () => {
        const payload = await client.post<unknown>(`/v1/jobs/${jobId}/retry`, {});
        return Boolean(asRecord(payload).retried ?? true);
      }),

    deleteJob: (jobId) =>
      guarded(async () => {
        const payload = await client.post<unknown>(`/v1/jobs/${jobId}/delete`, {});
        return Boolean(asRecord(payload).deleted ?? true);
      }),

    getQueueStatus: () =>
      guarded(async () => {
        try {
          const payload = await client.get<unknown>("/v1/jobs/queue/status", { headers: adminHeaders() });
          return asRecord(payload) as QueueStatus;
        } catch {
          return {} as QueueStatus;
        }
      }),

    getA2aHealth: () => guarded(async () => client.get<unknown>("/a2a/health")),

    sendA2aMessage: (topic, payload) =>
      guarded(async () => {
        const health = await client.get<unknown>("/a2a/health");
        return {
          topic,
          payload,
          transport: "a2a-health-probe",
          health,
        };
      }),
  };
}
