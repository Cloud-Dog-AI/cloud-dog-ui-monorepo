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

// @cloud-dog/app-git-mcp — Shared client-side state.

import * as React from "react";
import { useAuth } from "@cloud-dog/auth";
import { useConfig } from "@cloud-dog/config";
import { createGitMcpApi } from "../lib/api";
import type { GitMcpApi } from "../lib/api";
import type {
  GroupRecord,
  JobRecord,
  ManagedApiKeyRecord,
  OperationRecord,
  ProfileRecord,
  ToolCallOutcome,
  ToolTarget,
  UserRecord,
} from "../lib/types";

type RuntimeConfig = Readonly<{
  API_BASE_URL: string;
  MCP_BASE_URL: string;
  A2A_BASE_URL?: string;
  AUTH_MODE?: "api_key" | "cookie" | "oidc";
  DEFAULT_PROFILE?: string;
  REMOTE_REPO_URL?: string;
  SESSION_TIMEOUT_MINUTES?: number;
}>;

type AppState = Readonly<{
  api: GitMcpApi;
  apiKey: string;
  authError: string | null;
  signIn: (apiKey: string) => Promise<void>;
  signOut: () => Promise<void>;
  defaultProfile: string;
  remoteRepoUrl: string;
  workspaceId: string;
  setWorkspaceId: (workspaceId: string) => void;
  operationHistory: OperationRecord[];
  clearHistory: () => void;
  runApiTool: (toolName: string, args: Record<string, unknown>) => Promise<ToolCallOutcome>;
  runMcpTool: (toolName: string, args: Record<string, unknown>) => Promise<ToolCallOutcome>;
  loadProfiles: () => Promise<ProfileRecord[]>;
  createProfile: (name: string, profile: Record<string, unknown>) => Promise<ToolCallOutcome>;
  updateProfile: (name: string, profile: Record<string, unknown>) => Promise<ToolCallOutcome>;
  deleteProfile: (name: string) => Promise<ToolCallOutcome>;
  loadUsers: () => Promise<UserRecord[]>;
  createUser: (userId: string, payload: Record<string, unknown>) => Promise<ToolCallOutcome>;
  updateUser: (userId: string, payload: Record<string, unknown>) => Promise<ToolCallOutcome>;
  deleteUser: (userId: string) => Promise<ToolCallOutcome>;
  loadGroups: () => Promise<GroupRecord[]>;
  createGroup: (groupId: string, payload: Record<string, unknown>) => Promise<ToolCallOutcome>;
  updateGroup: (groupId: string, payload: Record<string, unknown>) => Promise<ToolCallOutcome>;
  deleteGroup: (groupId: string) => Promise<ToolCallOutcome>;
  loadApiKeys: () => Promise<ManagedApiKeyRecord[]>;
  createApiKey: (payload: Record<string, unknown>) => Promise<ToolCallOutcome>;
  updateApiKey: (keyId: string, payload: Record<string, unknown>) => Promise<ToolCallOutcome>;
  revokeApiKey: (keyId: string) => Promise<ToolCallOutcome>;
  loadJobs: () => Promise<JobRecord[]>;
  loadJob: (jobId: string) => Promise<JobRecord | null>;
  cancelJob: (jobId: string) => Promise<void>;
  retryJob: (jobId: string) => Promise<string | null>;
  deleteJob: (jobId: string) => Promise<void>;
  getJobQueueStatus: () => Promise<Record<string, number>>;
}>;

const API_KEY_STORAGE_KEY = "git-mcp.api-key";
const WORKSPACE_STORAGE_KEY = "git-mcp.workspace-id";

const AppStateContext = React.createContext<AppState | null>(null);

function safeStorageGet(key: string): string {
  try {
    return sessionStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function safeStorageSet(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // Ignore storage failures in restricted contexts.
  }
}

function safeStorageRemove(key: string): void {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // Ignore storage failures in restricted contexts.
  }
}

function formatError(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return "The server rejected the API key.";
}

function profileTemplate(source: string, defaultBranch: string): Record<string, unknown> {
  return {
    repo: {
      source,
      default_branch: defaultBranch,
      remotes: {},
    },
    workspace: {
      mode: "ephemeral",
      ttl_seconds: 900,
    },
    policy: {
      protected_branches: ["main"],
      ff_only_targets: ["main"],
      force_push: "never",
      file_scope: {
        deny_globs: ["**/.git/**"],
        allowed_types: ["*"],
      },
      validation: {
        json_mode: "strict",
        yaml_mode: "warn",
        xml_mode: "warn",
        html_mode: "ignore",
        markdown_mode: "ignore",
      },
    },
    auth: {
      credential_mode: "session",
    },
    recovery: {
      mode: "stash",
    },
  };
}

export function AppStateProvider(props: { children: React.ReactNode }) {
  const cfg = useConfig<RuntimeConfig>();
  const auth = useAuth();

  const [apiKey, setApiKey] = React.useState<string>(() => safeStorageGet(API_KEY_STORAGE_KEY));
  const [workspaceId, setWorkspaceIdState] = React.useState<string>(() => safeStorageGet(WORKSPACE_STORAGE_KEY));
  const [authError, setAuthError] = React.useState<string | null>(null);
  const [operationHistory, setOperationHistory] = React.useState<OperationRecord[]>([]);

  const api = React.useMemo(
    () => createGitMcpApi(
      cfg.API_BASE_URL,
      cfg.MCP_BASE_URL,
      "/api/v1",
      cfg.A2A_BASE_URL ?? ""
    ),
    [cfg.API_BASE_URL, cfg.MCP_BASE_URL, cfg.A2A_BASE_URL]
  );

  const setWorkspaceId = React.useCallback((nextWorkspaceId: string) => {
    setWorkspaceIdState(nextWorkspaceId);
    if (nextWorkspaceId.trim()) {
      safeStorageSet(WORKSPACE_STORAGE_KEY, nextWorkspaceId.trim());
    } else {
      safeStorageRemove(WORKSPACE_STORAGE_KEY);
    }
  }, []);

  const appendHistory = React.useCallback(
    (target: ToolTarget, toolName: string, args: Record<string, unknown>, outcome: ToolCallOutcome) => {
      const record: OperationRecord = {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        timestamp: new Date().toISOString(),
        target,
        toolName,
        args,
        outcome,
      };
      setOperationHistory((current) => [record, ...current].slice(0, 150));

      const data = outcome.data as Record<string, unknown> | null;
      if (outcome.ok && data && typeof data === "object") {
        const candidate = data.workspace_id;
        if (typeof candidate === "string" && candidate.trim()) {
          setWorkspaceId(candidate.trim());
        }
      }
    },
    [setWorkspaceId]
  );

  const signOut = React.useCallback(async () => {
    safeStorageRemove(API_KEY_STORAGE_KEY);
    setApiKey("");
    setAuthError(null);
    await auth.logout();
  }, [auth]);

  const signIn = React.useCallback(
    async (candidate: string) => {
      const key = candidate.trim();
      if (!key) {
        setAuthError("API key is required.");
        throw new Error("API key is required.");
      }

      try {
        await api.probeApiKey(key);
        await auth.login({ apiKey: key });
        setApiKey(key);
        safeStorageSet(API_KEY_STORAGE_KEY, key);
        setAuthError(null);
      } catch (error) {
        const message = formatError(error);
        setAuthError(message);
        safeStorageRemove(API_KEY_STORAGE_KEY);
        setApiKey("");
        throw new Error(message);
      }
    },
    [api, auth]
  );

  React.useEffect(() => {
    const saved = safeStorageGet(API_KEY_STORAGE_KEY);
    if (!saved || auth.isAuthenticated || auth.isLoading) return;

    void signIn(saved).catch(() => {
      // Error state is already captured by signIn.
    });
  }, [auth.isAuthenticated, auth.isLoading, signIn]);

  const runApiTool = React.useCallback(
    async (toolName: string, args: Record<string, unknown>) => {
      const outcome = await api.callApiTool(apiKey, toolName, args);
      appendHistory("api", toolName, args, outcome);
      return outcome;
    },
    [api, apiKey, appendHistory]
  );

  const runMcpTool = React.useCallback(
    async (toolName: string, args: Record<string, unknown>) => {
      const outcome = await api.callMcpTool(apiKey, toolName, args);
      appendHistory("mcp", toolName, args, outcome);
      return outcome;
    },
    [api, apiKey, appendHistory]
  );

  const value: AppState = {
    api,
    apiKey,
    authError,
    signIn,
    signOut,
    defaultProfile: cfg.DEFAULT_PROFILE ?? "remote_cloud_dog",
    remoteRepoUrl: cfg.REMOTE_REPO_URL ?? "https://git.example.com/your-org/your-repo.git",
    workspaceId,
    setWorkspaceId,
    operationHistory,
    clearHistory: () => setOperationHistory([]),
    runApiTool,
    runMcpTool,
    loadProfiles: () => api.listProfiles(apiKey),
    createProfile: (name, profile) => api.createProfile(apiKey, name, profile),
    updateProfile: (name, profile) => api.updateProfile(apiKey, name, profile),
    deleteProfile: (name) => api.deleteProfile(apiKey, name),
    loadUsers: () => api.listUsers(apiKey),
    createUser: (userId, payload) => api.createUser(apiKey, userId, payload),
    updateUser: (userId, payload) => api.updateUser(apiKey, userId, payload),
    deleteUser: (userId) => api.deleteUser(apiKey, userId),
    loadGroups: () => api.listGroups(apiKey),
    createGroup: (groupId, payload) => api.createGroup(apiKey, groupId, payload),
    updateGroup: (groupId, payload) => api.updateGroup(apiKey, groupId, payload),
    deleteGroup: (groupId) => api.deleteGroup(apiKey, groupId),
    loadApiKeys: () => api.listApiKeys(apiKey),
    createApiKey: (payload) => api.createApiKey(apiKey, payload),
    updateApiKey: (keyId, payload) => api.updateApiKey(apiKey, keyId, payload),
    revokeApiKey: (keyId) => api.revokeApiKey(apiKey, keyId),
    loadJobs: () => api.listJobs(apiKey),
    loadJob: (jobId) => api.getJob(apiKey, jobId),
    cancelJob: (jobId) => api.cancelJob(apiKey, jobId),
    retryJob: (jobId) => api.retryJob(apiKey, jobId),
    deleteJob: (jobId) => api.deleteJob(apiKey, jobId),
    getJobQueueStatus: () => api.getJobQueueStatus(apiKey),
  };

  return <AppStateContext.Provider value={value}>{props.children}</AppStateContext.Provider>;
}

export function useGitMcpState() {
  const ctx = React.useContext(AppStateContext);
  if (!ctx) {
    throw new Error("AppStateContext is not available. Wrap your app with <AppStateProvider>.");
  }
  return ctx;
}

export { profileTemplate };
