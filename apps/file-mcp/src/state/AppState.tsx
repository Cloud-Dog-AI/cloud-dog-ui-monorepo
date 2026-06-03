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

// @cloud-dog/app-file-mcp — Shared client-side state.

import * as React from "react";
import { useAuth } from "@cloud-dog/auth";
import type { User } from "@cloud-dog/auth";
import { useConfig } from "@cloud-dog/config";
import { createFileMcpApi, validateApiKey } from "../lib/api";
import type { FileMcpApi } from "../lib/api";
import type { AdminProfile } from "../lib/types";

type RuntimeConfig = Readonly<{
  API_BASE_URL: string;
  AUTH_MODE?: "api_key" | "cookie" | "oidc";
  ADMIN_UI_TOKEN?: string;
  AUDIT_LOG_PATH?: string;
  DEFAULT_BROWSE_PATH?: string;
  PROFILE_STORE_PATH?: string;
  MCP_BASE_URL?: string;
  A2A_BASE_URL?: string;
  SESSION_TIMEOUT_MINUTES?: number;
}>;

type AppState = Readonly<{
  api: FileMcpApi;
  apiBaseUrl: string;
  mcpBaseUrl: string;
  a2aBaseUrl: string;
  authMode: "api_key" | "cookie" | "oidc";
  isRestoringSession: boolean;
  sessionTimeoutMinutes: number;
  apiKey: string;
  adminToken: string;
  authError: string | null;
  currentUser: User | null;
  signIn: (apiKey: string) => Promise<void>;
  signOut: () => Promise<void>;
  setAdminToken: (token: string) => void;
  selectedProfile: string;
  setSelectedProfile: (profile: string) => void;
  availableProfiles: AdminProfile[];
  refreshProfiles: () => Promise<void>;
  auditLogPath: string;
  defaultBrowsePath: string;
  profileStorePath: string;
}>;

const API_KEY_STORAGE_KEY = "file-mcp.api-key";
const ADMIN_TOKEN_STORAGE_KEY = "file-mcp.admin-token";
const SELECTED_PROFILE_STORAGE_KEY = "file-mcp.selected-profile";
const DEFAULT_AUDIT_LOG_PATH = "/data/audit/audit.jsonl";
const DEFAULT_BROWSE_PATH = "/workspace";
const DEFAULT_PROFILE_STORE_PATH = "";
const DEFAULT_SESSION_TIMEOUT_MINUTES = 30;

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

function deriveServiceBase(apiBaseUrl: string): string {
  const cleaned = apiBaseUrl.replace(/\/+$/, "");
  if (cleaned.endsWith("/api")) {
    const base = cleaned.slice(0, -4);
    return base || (typeof window !== "undefined" ? window.location.origin : cleaned);
  }
  return cleaned;
}

export function AppStateProvider(props: { children: React.ReactNode }) {
  const cfg = useConfig<RuntimeConfig>();
  const auth = useAuth();

  const [apiKey, setApiKey] = React.useState<string>(() => safeStorageGet(API_KEY_STORAGE_KEY));
  const [adminToken, setAdminTokenState] = React.useState<string>(
    () => safeStorageGet(ADMIN_TOKEN_STORAGE_KEY) || String(cfg.ADMIN_UI_TOKEN ?? "")
  );
  const [selectedProfile, setSelectedProfileState] = React.useState<string>(
    () => safeStorageGet(SELECTED_PROFILE_STORAGE_KEY) || "default"
  );
  const [availableProfiles, setAvailableProfiles] = React.useState<AdminProfile[]>([]);
  const [authError, setAuthError] = React.useState<string | null>(null);
  const [currentUser, setCurrentUser] = React.useState<User | null>(null);
  const [isRestoringSession, setIsRestoringSession] = React.useState<boolean>(() => Boolean(safeStorageGet(API_KEY_STORAGE_KEY)));

  const setAdminToken = React.useCallback((value: string) => {
    const token = value.trim();
    setAdminTokenState(token);
    if (token) {
      safeStorageSet(ADMIN_TOKEN_STORAGE_KEY, token);
    } else {
      safeStorageRemove(ADMIN_TOKEN_STORAGE_KEY);
    }
  }, []);

  const setSelectedProfile = React.useCallback((value: string) => {
    const next = value.trim() || "default";
    setSelectedProfileState(next);
    safeStorageSet(SELECTED_PROFILE_STORAGE_KEY, next);
  }, []);

  const signOut = React.useCallback(async () => {
    safeStorageRemove(API_KEY_STORAGE_KEY);
    setApiKey("");
    setAuthError(null);
    setCurrentUser(null);
    setIsRestoringSession(false);
    await auth.logout();
  }, [auth]);

  const serviceBase = deriveServiceBase(cfg.API_BASE_URL);
  const authMode = cfg.AUTH_MODE ?? "api_key";

  // Derive the MCP endpoint path for API calls.
  // In cookie auth mode the backend exposes /webmcp (session-cookie auth).
  // In api_key mode the standard /mcp endpoint (Bearer auth) is used.
  const mcpPath = React.useMemo(() => {
    const configured = (cfg.MCP_BASE_URL ?? "").replace(/\/+$/, "");
    if (configured && configured.startsWith("/")) return configured;
    return authMode === "cookie" ? "/webmcp" : "/mcp";
  }, [authMode, cfg.MCP_BASE_URL]);

  const api = React.useMemo(
    () =>
      createFileMcpApi({
        baseUrl: cfg.API_BASE_URL,
        mcpPath,
        authMode,
        getAccessToken: () => auth.getAccessToken(),
        getAdminToken: () => adminToken,
        getSelectedProfile: () => selectedProfile,
      }),
    [adminToken, auth, authMode, cfg.API_BASE_URL, mcpPath, selectedProfile]
  );

  const mcpBaseUrl = (cfg.MCP_BASE_URL || `${serviceBase}/mcp`).replace(/\/+$/, "");
  const a2aBaseUrl = (cfg.A2A_BASE_URL || `${serviceBase}/a2a`).replace(/\/+$/, "");
  const sessionTimeoutMinutes = Number.isFinite(cfg.SESSION_TIMEOUT_MINUTES)
    ? Math.max(5, Number(cfg.SESSION_TIMEOUT_MINUTES))
    : DEFAULT_SESSION_TIMEOUT_MINUTES;

  const signIn = React.useCallback(
    async (candidate: string) => {
      const key = candidate.trim();
      if (!key) {
        setAuthError("API key is required.");
        throw new Error("API key is required.");
      }

      try {
        setIsRestoringSession(true);
        await validateApiKey(cfg.API_BASE_URL, key, mcpPath);
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
      } finally {
        setIsRestoringSession(false);
      }
    },
    [auth, cfg.API_BASE_URL, mcpPath]
  );

  const restoreSavedSession = React.useCallback(
    async (savedKey: string) => {
      const key = savedKey.trim();
      if (!key) {
        setIsRestoringSession(false);
        return;
      }

      try {
        setIsRestoringSession(true);
        await auth.login({ apiKey: key });
        setApiKey(key);
        setAuthError(null);
        safeStorageSet(API_KEY_STORAGE_KEY, key);
      } catch {
        safeStorageRemove(API_KEY_STORAGE_KEY);
        setApiKey("");
        setAuthError("Saved session expired. Please sign in again.");
      } finally {
        setIsRestoringSession(false);
      }
    },
    [auth]
  );

  React.useEffect(() => {
    const saved = safeStorageGet(API_KEY_STORAGE_KEY);
    if (!saved) {
      setIsRestoringSession(false);
      return;
    }
    if (auth.isAuthenticated) {
      setIsRestoringSession(false);
      return;
    }
    if (auth.isLoading) return;

    setIsRestoringSession(true);
    void restoreSavedSession(saved);
  }, [auth.isAuthenticated, auth.isLoading, restoreSavedSession]);

  const refreshProfiles = React.useCallback(async () => {
    try {
      const profiles = await api.listAdminProfiles();
      setAvailableProfiles(profiles);
      const profileNames = new Set(profiles.map((profile) => profile.name));
      if (profiles.length && !profileNames.has(selectedProfile)) {
        const fallback = profiles[0]?.name || "default";
        setSelectedProfileState(fallback);
        safeStorageSet(SELECTED_PROFILE_STORAGE_KEY, fallback);
      }
    } catch {
      // Keep the application functional even if profile discovery fails.
    }
  }, [api, selectedProfile]);

  React.useEffect(() => {
    if (!auth.isAuthenticated) return;
    void refreshProfiles();
  }, [auth.isAuthenticated, refreshProfiles]);

  React.useEffect(() => {
    if (!auth.isAuthenticated) {
      setCurrentUser(null);
      return;
    }
    void api
      .getCurrentUser()
      .then((user) => {
        setCurrentUser(user);
      })
      .catch(() => {
        setCurrentUser(null);
      });
  }, [api, auth.isAuthenticated, selectedProfile]);

  const value: AppState = {
    api,
    apiBaseUrl: cfg.API_BASE_URL,
    mcpBaseUrl,
    a2aBaseUrl,
    authMode,
    isRestoringSession,
    sessionTimeoutMinutes,
    apiKey,
    adminToken,
    authError,
    currentUser,
    signIn,
    signOut,
    setAdminToken,
    selectedProfile,
    setSelectedProfile,
    availableProfiles,
    refreshProfiles,
    auditLogPath: cfg.AUDIT_LOG_PATH ?? DEFAULT_AUDIT_LOG_PATH,
    defaultBrowsePath: cfg.DEFAULT_BROWSE_PATH ?? DEFAULT_BROWSE_PATH,
    profileStorePath: cfg.PROFILE_STORE_PATH ?? DEFAULT_PROFILE_STORE_PATH,
  };

  return <AppStateContext.Provider value={value}>{props.children}</AppStateContext.Provider>;
}

export function useFileMcpState() {
  const ctx = React.useContext(AppStateContext);
  if (!ctx) {
    throw new Error("AppStateContext is not available. Wrap your app with <AppStateProvider>.");
  }
  return ctx;
}
