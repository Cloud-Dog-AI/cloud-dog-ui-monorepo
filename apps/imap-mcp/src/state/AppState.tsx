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

// @cloud-dog/app-imap-mcp — Shared client-side state.

import * as React from "react";
import { useAuth } from "@cloud-dog/auth";
import { useConfig } from "@cloud-dog/config";
import { createImapMcpApi, validateApiKey } from "../lib/api";
import type { ImapMcpApi } from "../lib/api";
import type { TraceEvent } from "../lib/types";

type RuntimeConfig = Readonly<{
  API_BASE_URL: string;
  MCP_BASE_URL?: string;
  A2A_BASE_URL?: string;
  AUTH_MODE?: "api_key" | "cookie" | "oidc";
}>;

type AppState = Readonly<{
  api: ImapMcpApi;
  apiKey: string;
  role: string;
  authError: string | null;
  traces: TraceEvent[];
  signIn: (apiKey: string, role: string) => Promise<void>;
  signOut: () => Promise<void>;
  clearTraces: () => void;
  setRole: (role: string) => void;
  apiBaseUrl: string;
  mcpBaseUrl: string;
  a2aBaseUrl: string;
}>;

const API_KEY_STORAGE_KEY = "imap-mcp.api-key";
const ROLE_STORAGE_KEY = "imap-mcp.role";
const TRACE_LIMIT = 200;

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
    // Ignore storage failures.
  }
}

function safeStorageRemove(key: string): void {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // Ignore storage failures.
  }
}

function formatError(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return "The server rejected the API key.";
}

export function AppStateProvider(props: { children: React.ReactNode }) {
  const cfg = useConfig<RuntimeConfig>();
  const auth = useAuth();
  const authMode = cfg.AUTH_MODE ?? "cookie";

  const [apiKey, setApiKey] = React.useState<string>(() => safeStorageGet(API_KEY_STORAGE_KEY));
  const [role, setRoleState] = React.useState<string>(() => safeStorageGet(ROLE_STORAGE_KEY) || "admin");
  const [authError, setAuthError] = React.useState<string | null>(null);
  const [traces, setTraces] = React.useState<TraceEvent[]>([]);

  const setRole = React.useCallback((value: string) => {
    const next = value.trim() || "admin";
    setRoleState(next);
    safeStorageSet(ROLE_STORAGE_KEY, next);
  }, []);

  const signOut = React.useCallback(async () => {
    safeStorageRemove(API_KEY_STORAGE_KEY);
    setApiKey("");
    setAuthError(null);
    await auth.logout();
  }, [auth]);

  const apiBaseUrl = cfg.API_BASE_URL;
  const mcpBaseUrl = cfg.MCP_BASE_URL ?? cfg.API_BASE_URL;
  const a2aBaseUrl = cfg.A2A_BASE_URL ?? cfg.API_BASE_URL;

  const api = React.useMemo(
    () =>
      createImapMcpApi({
        apiBaseUrl,
        mcpBaseUrl,
        a2aBaseUrl,
        authMode,
        getApiKey: () => auth.getAccessToken() ?? apiKey,
        getRole: () => role,
        onAuthError: () => {
          void signOut();
        },
        onTrace: (event) => {
          setTraces((curr) => [event, ...curr].slice(0, TRACE_LIMIT));
        },
      }),
    [a2aBaseUrl, apiBaseUrl, apiKey, auth, authMode, mcpBaseUrl, role, signOut]
  );

  const signIn = React.useCallback(
    async (candidate: string, selectedRole: string) => {
      const nextRole = selectedRole.trim() || "admin";
      if (authMode === "cookie") {
        setRole(nextRole);
        setAuthError(null);
        return;
      }

      const key = candidate.trim();
      if (!key) {
        setAuthError("API key is required.");
        throw new Error("API key is required.");
      }

      try {
        await validateApiKey(apiBaseUrl, key, authMode);
        await auth.login({ apiKey: key });
        setApiKey(key);
        safeStorageSet(API_KEY_STORAGE_KEY, key);
        setRole(nextRole);
        setAuthError(null);
      } catch (error) {
        const message = formatError(error);
        setAuthError(message);
        safeStorageRemove(API_KEY_STORAGE_KEY);
        setApiKey("");
        throw new Error(message);
      }
    },
    [apiBaseUrl, auth, authMode, setRole]
  );

  React.useEffect(() => {
    if (authMode === "cookie") return;
    const saved = safeStorageGet(API_KEY_STORAGE_KEY);
    if (!saved || auth.isAuthenticated || auth.isLoading) return;

    void signIn(saved, role).catch(() => {
      // Error is captured by signIn.
    });
  }, [auth.isAuthenticated, auth.isLoading, authMode, role, signIn]);

  React.useEffect(() => {
    if (authMode !== "cookie" || !auth.user?.roles?.length) return;
    const nextRole = auth.user.roles[0]?.trim() || "admin";
    if (nextRole && nextRole !== role) {
      setRole(nextRole);
    }
  }, [auth.user, authMode, role, setRole]);

  const value: AppState = {
    api,
    apiKey,
    role,
    authError,
    traces,
    signIn,
    signOut,
    clearTraces: () => setTraces([]),
    setRole,
    apiBaseUrl,
    mcpBaseUrl,
    a2aBaseUrl,
  };

  return <AppStateContext.Provider value={value}>{props.children}</AppStateContext.Provider>;
}

export function useImapMcpState() {
  const ctx = React.useContext(AppStateContext);
  if (!ctx) {
    throw new Error("AppStateContext is not available. Wrap your app with <AppStateProvider>.");
  }
  return ctx;
}
