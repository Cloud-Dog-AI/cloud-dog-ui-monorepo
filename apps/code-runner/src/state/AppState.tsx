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

import * as React from "react";
import { useAuth } from "@cloud-dog/auth";
import { useConfig } from "@cloud-dog/config";
import { createCodeRunnerApi, validateApiKey } from "../lib/api";
import type { CodeRunnerApi } from "../lib/api";
import type { ProfileSummary } from "../lib/types";

type RuntimeConfig = Readonly<{
  API_BASE_URL: string;
  MCP_BASE_URL?: string;
  APP_VERSION?: string;
}>;

type AppState = Readonly<{
  api: CodeRunnerApi;
  apiBaseUrl: string;
  apiKey: string;
  authError: string | null;
  signIn: (apiKey: string) => Promise<void>;
  signOut: () => Promise<void>;
  profiles: ProfileSummary[];
  profilesLoading: boolean;
  refreshProfiles: () => Promise<void>;
  selectedProfileId: string;
  setSelectedProfileId: (profileId: string) => void;
  currentProfile: ProfileSummary | null;
  appVersion: string;
}>;

const API_KEY_STORAGE_KEY = "code-runner.api-key";

const AppStateContext = React.createContext<AppState | null>(null);

function browserOrigin(): string {
  return typeof window === "undefined" ? "http://localhost" : window.location.origin;
}

function normaliseBase(value: string | undefined): string {
  if (!value || value === "/" || value === "/api") return browserOrigin();
  try {
    return new URL(value, browserOrigin()).toString().replace(/\/+$/, "");
  } catch {
    return browserOrigin();
  }
}

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
  const { getAccessToken, isAuthenticated, isLoading, login, logout } = useAuth();
  const apiBaseUrl = React.useMemo(() => normaliseBase(cfg.API_BASE_URL), [cfg.API_BASE_URL]);
  const mcpBaseUrl = React.useMemo(() => normaliseBase(cfg.MCP_BASE_URL ?? cfg.API_BASE_URL), [cfg.API_BASE_URL, cfg.MCP_BASE_URL]);
  const [apiKey, setApiKey] = React.useState<string>(() => safeStorageGet(API_KEY_STORAGE_KEY));
  const [authError, setAuthError] = React.useState<string | null>(null);
  const [profiles, setProfiles] = React.useState<ProfileSummary[]>([]);
  const [profilesLoading, setProfilesLoading] = React.useState(false);
  const [selectedProfileIdState, setSelectedProfileIdState] = React.useState<string>("");
  const getAccessTokenRef = React.useRef(getAccessToken);

  React.useEffect(() => {
    getAccessTokenRef.current = getAccessToken;
  }, [getAccessToken]);

  const signOut = React.useCallback(async () => {
    safeStorageRemove(API_KEY_STORAGE_KEY);
    setApiKey("");
    setSelectedProfileIdState("");
    setProfiles([]);
    setAuthError(null);
    await logout();
  }, [logout]);
  const signOutRef = React.useRef(signOut);

  React.useEffect(() => {
    signOutRef.current = signOut;
  }, [signOut]);

  const api = React.useMemo(
    () =>
      createCodeRunnerApi({
        baseUrl: apiBaseUrl,
        mcpBaseUrl,
        getAccessToken: () => getAccessTokenRef.current(),
        onAuthError: () => {
          void signOutRef.current();
        },
      }),
    [apiBaseUrl, mcpBaseUrl]
  );

  const setSelectedProfileId = React.useCallback((profileId: string) => {
    setSelectedProfileIdState(profileId);
  }, []);

  const refreshProfiles = React.useCallback(async () => {
    if (!isAuthenticated) {
      setProfiles([]);
      setProfilesLoading(false);
      return;
    }
    setProfilesLoading(true);
    try {
      const nextProfiles = await api.listProfiles();
      setProfiles(nextProfiles);
      setSelectedProfileIdState((current) => {
        if (current && nextProfiles.some((item) => item.profile_id === current)) {
          return current;
        }
        return "";
      });
    } finally {
      setProfilesLoading(false);
    }
  }, [api, isAuthenticated]);

  const signIn = React.useCallback(
    async (candidate: string) => {
      const key = candidate.trim();
      if (!key) {
        setAuthError("API key is required.");
        throw new Error("API key is required.");
      }

      try {
        await validateApiKey(apiBaseUrl, key);
        await login({ apiKey: key });
        setApiKey(key);
        setSelectedProfileIdState("");
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
    [apiBaseUrl, login]
  );

  React.useEffect(() => {
    const saved = safeStorageGet(API_KEY_STORAGE_KEY);
    if (!saved || isAuthenticated || isLoading) return;
    void signIn(saved).catch(() => {
      // signIn already captured the error.
    });
  }, [isAuthenticated, isLoading, signIn]);

  React.useEffect(() => {
    if (!isAuthenticated) return;
    void refreshProfiles().catch((error) => {
      setAuthError(formatError(error));
    });
  }, [isAuthenticated, refreshProfiles]);

  const currentProfile = profiles.find((item) => item.profile_id === selectedProfileIdState) ?? null;

  const value: AppState = {
    api,
    apiBaseUrl,
    apiKey,
    authError,
    signIn,
    signOut,
    profiles,
    profilesLoading,
    refreshProfiles,
    selectedProfileId: selectedProfileIdState,
    setSelectedProfileId,
    currentProfile,
    appVersion: cfg.APP_VERSION ?? "0.0.0-dev",
  };

  return <AppStateContext.Provider value={value}>{props.children}</AppStateContext.Provider>;
}

export function useCodeRunnerState() {
  const ctx = React.useContext(AppStateContext);
  if (!ctx) {
    throw new Error("AppStateContext is not available. Wrap your app with <AppStateProvider>.");
  }
  return ctx;
}
