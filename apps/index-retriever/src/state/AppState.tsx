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

// @cloud-dog/app-index-retriever — Shared client-side state.

import * as React from "react";
import { useAuth } from "@cloud-dog/auth";
import { useConfig } from "@cloud-dog/config";
import { createIndexRetrieverApi, formatApiFailure, validateApiKey } from "../lib/api";
import type { IndexRetrieverApi } from "../lib/api";
import type { ActivityEvent, ApiFailureInfo, SourceConfig } from "../lib/types";
import { DEFAULT_SOURCE_CONFIG } from "../lib/types";

type RuntimeConfig = Readonly<{
  API_BASE_URL: string;
  AUTH_MODE?: "api_key" | "cookie" | "oidc";
  DEFAULT_PROFILE?: string;
  DEFAULT_COLLECTION?: string;
}>;

type AppState = Readonly<{
  api: IndexRetrieverApi;
  apiKey: string;
  authError: string | null;
  userId: string;
  displayName: string;
  roles: string[];
  sourceConfig: SourceConfig;
  latestFailure: ApiFailureInfo | null;
  activity: ActivityEvent[];
  signIn: (apiKey: string) => Promise<void>;
  signOut: () => Promise<void>;
  setSourceConfig: (updater: (current: SourceConfig) => SourceConfig) => void;
  recordActivity: (action: string, outcome: "ok" | "error", detail?: string) => void;
  captureFailure: (error: unknown) => string;
  clearFailure: () => void;
}>;

const API_KEY_STORAGE_KEY = "index-retriever.api-key";
const SOURCE_CONFIG_STORAGE_KEY = "index-retriever.source-config";

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

function defaultSourceConfig(cfg: RuntimeConfig): SourceConfig {
  return {
    ...DEFAULT_SOURCE_CONFIG,
    profile: cfg.DEFAULT_PROFILE?.trim() || DEFAULT_SOURCE_CONFIG.profile,
    collection: cfg.DEFAULT_COLLECTION?.trim() || DEFAULT_SOURCE_CONFIG.collection,
  };
}

function loadPersistedSourceConfig(cfg: RuntimeConfig): SourceConfig {
  const fallback = defaultSourceConfig(cfg);
  try {
    const raw = sessionStorage.getItem(SOURCE_CONFIG_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<SourceConfig>;
    return {
      ...fallback,
      profile: typeof parsed.profile === "string" && parsed.profile.trim() ? parsed.profile : fallback.profile,
      collection: typeof parsed.collection === "string" && parsed.collection.trim() ? parsed.collection : fallback.collection,
      sourceUri: typeof parsed.sourceUri === "string" && parsed.sourceUri.trim() ? parsed.sourceUri : fallback.sourceUri,
      dedupePolicy: typeof parsed.dedupePolicy === "string" && parsed.dedupePolicy.trim() ? parsed.dedupePolicy : fallback.dedupePolicy,
      indexingSignature:
        typeof parsed.indexingSignature === "string" && parsed.indexingSignature.trim()
          ? parsed.indexingSignature
          : fallback.indexingSignature,
      staleAfterDays:
        typeof parsed.staleAfterDays === "number" && Number.isFinite(parsed.staleAfterDays)
          ? parsed.staleAfterDays
          : fallback.staleAfterDays,
      metadataJson:
        typeof parsed.metadataJson === "string" && parsed.metadataJson.trim() ? parsed.metadataJson : fallback.metadataJson,
    };
  } catch {
    return fallback;
  }
}

function failureLabel(info: ApiFailureInfo): string {
  const parts = [`${info.message} (status ${info.status})`];
  if (info.code) parts.push(`code=${info.code}`);
  if (info.requestId) parts.push(`request=${info.requestId}`);
  if (info.correlationId) parts.push(`correlation=${info.correlationId}`);
  return parts.join(" | ");
}

function parseRoles(payload: unknown): string[] {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return [];
  const user = (payload as { user?: unknown }).user;
  if (!user || typeof user !== "object" || Array.isArray(user)) return [];
  const roles = (user as { roles?: unknown }).roles;
  if (!Array.isArray(roles)) return [];
  return roles
    .filter((role): role is string => typeof role === "string")
    .map((role) => role.trim())
    .filter(Boolean);
}

function parseUserId(payload: unknown): string {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return "";
  const user = (payload as { user?: unknown }).user;
  if (!user || typeof user !== "object" || Array.isArray(user)) return "";
  const id = (user as { id?: unknown; user_id?: unknown }).id ?? (user as { user_id?: unknown }).user_id;
  return typeof id === "string" ? id.trim() : "";
}

function parseDisplayName(payload: unknown): string {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return "";
  const user = (payload as { user?: unknown }).user;
  if (!user || typeof user !== "object" || Array.isArray(user)) return "";
  const displayName = (user as { displayName?: unknown; display_name?: unknown }).displayName ?? (user as { display_name?: unknown }).display_name;
  return typeof displayName === "string" ? displayName.trim() : "";
}

export function AppStateProvider(props: { children: React.ReactNode }) {
  const cfg = useConfig<RuntimeConfig>();
  const auth = useAuth();
  const authMode = cfg.AUTH_MODE ?? "api_key";

  const [apiKey, setApiKey] = React.useState<string>(() => safeStorageGet(API_KEY_STORAGE_KEY));
  const [authError, setAuthError] = React.useState<string | null>(null);
  const [userId, setUserId] = React.useState("");
  const [displayName, setDisplayName] = React.useState("");
  const [roles, setRoles] = React.useState<string[]>([]);
  const [latestFailure, setLatestFailure] = React.useState<ApiFailureInfo | null>(null);
  const [activity, setActivity] = React.useState<ActivityEvent[]>([]);
  const [sourceConfig, setSourceConfigState] = React.useState<SourceConfig>(() => loadPersistedSourceConfig(cfg));

  const recordActivity = React.useCallback((action: string, outcome: "ok" | "error", detail?: string) => {
    const event: ActivityEvent = {
      timestamp: new Date().toISOString(),
      action,
      outcome,
      detail,
    };
    setActivity((current) => [event, ...current].slice(0, 120));
  }, []);

  const clearFailure = React.useCallback(() => {
    setLatestFailure(null);
  }, []);

  const captureFailure = React.useCallback(
    (error: unknown) => {
      const info = formatApiFailure(error);
      setLatestFailure(info);
      const label = failureLabel(info);
      recordActivity("api.failure", "error", label);
      return label;
    },
    [recordActivity]
  );

  const signOut = React.useCallback(async () => {
    safeStorageRemove(API_KEY_STORAGE_KEY);
    setApiKey("");
    setAuthError(null);
    await auth.logout();
  }, [auth]);

  const handleAuthError = React.useCallback(() => {
    if (authMode === "api_key") {
      void signOut();
      return;
    }
    setAuthError("Authentication required. Sign in again if the session has expired.");
  }, [authMode, signOut]);

  const api = React.useMemo(
    () =>
      createIndexRetrieverApi({
        baseUrl: cfg.API_BASE_URL,
        getAccessToken: () => auth.getAccessToken(),
        onAuthError: handleAuthError,
      }),
    [auth, cfg.API_BASE_URL, handleAuthError]
  );

  const refreshIdentity = React.useCallback(async () => {
    const payload = await api.getCurrentUser();
    const nextRoles = parseRoles(payload);
    setUserId(parseUserId(payload));
    setDisplayName(parseDisplayName(payload));
    setRoles(nextRoles);
    return nextRoles;
  }, [api]);

  const signIn = React.useCallback(
    async (candidate: string) => {
      const key = candidate.trim();
      if (!key) {
        setAuthError("API key is required.");
        throw new Error("API key is required.");
      }

      try {
        await validateApiKey(cfg.API_BASE_URL, key);
        await auth.login({ apiKey: key });
        await refreshIdentity();
        setApiKey(key);
        safeStorageSet(API_KEY_STORAGE_KEY, key);
        setAuthError(null);
        recordActivity("auth.sign_in", "ok");
      } catch (error) {
        const failure = formatApiFailure(error);
        setLatestFailure(failure);
        const label = failureLabel(failure);
        setAuthError(label);
        safeStorageRemove(API_KEY_STORAGE_KEY);
        setApiKey("");
        recordActivity("auth.sign_in", "error", label);
        throw new Error(label);
      }
    },
    [auth, cfg.API_BASE_URL, recordActivity, refreshIdentity]
  );

  React.useEffect(() => {
    if (authMode !== "api_key") {
      safeStorageRemove(API_KEY_STORAGE_KEY);
      setApiKey((current) => (current ? "" : current));
      return;
    }

    const saved = safeStorageGet(API_KEY_STORAGE_KEY);
    if (!saved || auth.isAuthenticated || auth.isLoading) return;

    void signIn(saved).catch(() => {
      // Error state is captured by signIn.
    });
  }, [auth.isAuthenticated, auth.isLoading, authMode, signIn]);

  React.useEffect(() => {
    if (auth.isLoading) return;
    if (!auth.isAuthenticated) {
      if (roles.length > 0) setRoles([]);
      if (userId) setUserId("");
      if (displayName) setDisplayName("");
      return;
    }
    void refreshIdentity().catch(() => {
      setRoles([]);
      setUserId("");
      setDisplayName("");
    });
  }, [auth.isAuthenticated, auth.isLoading, displayName, refreshIdentity, roles.length, userId]);

  React.useEffect(() => {
    safeStorageSet(SOURCE_CONFIG_STORAGE_KEY, JSON.stringify(sourceConfig));
  }, [sourceConfig]);

  const setSourceConfig = React.useCallback((updater: (current: SourceConfig) => SourceConfig) => {
    setSourceConfigState((current) => updater(current));
  }, []);

  const value: AppState = {
    api,
    apiKey,
    authError,
    userId,
    displayName,
    roles,
    sourceConfig,
    latestFailure,
    activity,
    signIn,
    signOut,
    setSourceConfig,
    recordActivity,
    captureFailure,
    clearFailure,
  };

  return <AppStateContext.Provider value={value}>{props.children}</AppStateContext.Provider>;
}

export function useIndexRetrieverState() {
  const ctx = React.useContext(AppStateContext);
  if (!ctx) {
    throw new Error("AppStateContext is not available. Wrap your app with <AppStateProvider>.");
  }
  return ctx;
}
