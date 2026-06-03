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

// @cloud-dog/app-chat-client — Shared client-side state for pages.

import * as React from "react";
import { useAuth } from "@cloud-dog/auth";
import { useConfig } from "@cloud-dog/config";
import type { ChatApi } from "../lib/api";
import { createChatApi } from "../lib/api";
import { isoNow } from "../lib/moment";
import type {
  ChatProfileRecord,
  McpServer,
  McpServerHealth,
  SessionSummary,
  ToolExecutionResult,
  UiConfig,
  UiConfigTree,
} from "../lib/types";

type RuntimeConfig = {
  API_BASE_URL: string;
  API_KEY_HEADER?: string;
  AUTH_MODE?: "cookie" | "api_key" | "oidc";
};

type AppState = Readonly<{
  api: ChatApi;
  uiConfig: UiConfig | null;
  uiConfigTree: UiConfigTree | null;
  apiKey: string;
  apiKeyHeader: string;
  setApiKey: (value: string) => void;
  sessions: SessionSummary[];
  activeSessionId: string | null;
  setActiveSessionId: (sessionId: string) => void;
  refreshSessions: () => Promise<void>;
  createSession: (title?: string, metadata?: Record<string, unknown>) => Promise<string | null>;
  deleteSession: (sessionId: string) => Promise<void>;
  mcpServers: McpServer[];
  mcpHealth: McpServerHealth[];
  refreshMcpServers: () => Promise<void>;
  profiles: ChatProfileRecord[];
  refreshProfiles: () => Promise<void>;
  selectedServerIndices: number[];
  setSelectedServerIndices: (indices: number[]) => Promise<void>;
  awaitSelectedServerIndicesSync: () => Promise<void>;
  toolResults: ToolExecutionResult[];
  addToolResult: (result: ToolExecutionResult) => void;
  loadConfigTree: () => Promise<void>;
}>;

const API_KEY_STORAGE_KEY = "chat-client.api-key";
const ACTIVE_SESSION_STORAGE_KEY = "chat-client.active-session";

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
    // No-op in restricted browser contexts.
  }
}

function safeStorageRemove(key: string): void {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // No-op in restricted browser contexts.
  }
}

function sameIndices(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}

export function AppStateProvider(props: { children: React.ReactNode }) {
  const cfg = useConfig<RuntimeConfig>();
  const auth = useAuth();

  const [apiKey, setApiKeyState] = React.useState<string>(() => safeStorageGet(API_KEY_STORAGE_KEY));
  const [apiKeyHeader, setApiKeyHeader] = React.useState<string>(() => cfg.API_KEY_HEADER ?? "X-API-Key");

  const [uiConfig, setUiConfig] = React.useState<UiConfig | null>(null);
  const [uiConfigTree, setUiConfigTree] = React.useState<UiConfigTree | null>(null);

  const [sessions, setSessions] = React.useState<SessionSummary[]>([]);
  const [activeSessionId, setActiveSessionIdState] = React.useState<string | null>(() => {
    const raw = safeStorageGet(ACTIVE_SESSION_STORAGE_KEY);
    return raw || null;
  });

  const [mcpServers, setMcpServers] = React.useState<McpServer[]>([]);
  const [mcpHealth, setMcpHealth] = React.useState<McpServerHealth[]>([]);
  const [profiles, setProfiles] = React.useState<ChatProfileRecord[]>([]);
  const [selectedServerIndices, setSelectedServerIndicesState] = React.useState<number[]>([]);
  const [toolResults, setToolResults] = React.useState<ToolExecutionResult[]>([]);
  const pendingSelectionSyncRef = React.useRef<Promise<void> | null>(null);
  const localSelectionDirtyRef = React.useRef(false);
  const selectionRequestSeqRef = React.useRef(0);
  const autoDefaultedSessionsRef = React.useRef<Set<string>>(new Set());

  const onAuthError = React.useCallback(() => {
    if (cfg.AUTH_MODE === "cookie") {
      return;
    }
    safeStorageRemove(API_KEY_STORAGE_KEY);
    setApiKeyState("");
    void auth.logout();
  }, [auth, cfg.AUTH_MODE]);

  const api = React.useMemo(
    () =>
      createChatApi({
        baseUrl: cfg.API_BASE_URL,
        apiKeyHeader,
        getApiKey: () => apiKey,
        onAuthError,
      }),
    [cfg.API_BASE_URL, apiKeyHeader, apiKey, onAuthError]
  );

  const setApiKey = React.useCallback(
    (value: string) => {
      setApiKeyState(value);
      if (value.trim()) safeStorageSet(API_KEY_STORAGE_KEY, value);
      else safeStorageRemove(API_KEY_STORAGE_KEY);
    },
    []
  );

  React.useEffect(() => {
    if (cfg.AUTH_MODE === "cookie") return;
    const saved = safeStorageGet(API_KEY_STORAGE_KEY);
    if (!saved || auth.isAuthenticated) return;
    void auth.login({ apiKey: saved }).catch(() => {
      safeStorageRemove(API_KEY_STORAGE_KEY);
      setApiKeyState("");
    });
  }, [auth, cfg.AUTH_MODE]);

  const refreshSessions = React.useCallback(async () => {
    if (!auth.isAuthenticated) return;
    const listed = await api.listSessions();
    const sorted = [...listed].sort((a, b) => {
      const av = new Date(a.created_at).getTime();
      const bv = new Date(b.created_at).getTime();
      return bv - av;
    });
    setSessions(sorted);

    if (!sorted.length) {
      setActiveSessionIdState(null);
      safeStorageRemove(ACTIVE_SESSION_STORAGE_KEY);
      return;
    }

    if (activeSessionId && sorted.some((item) => item.id === activeSessionId)) return;
    const restored = safeStorageGet(ACTIVE_SESSION_STORAGE_KEY);
    if (restored && sorted.some((item) => item.id === restored)) {
      setActiveSessionIdState(restored);
      return;
    }

    setActiveSessionIdState(sorted[0].id);
    safeStorageSet(ACTIVE_SESSION_STORAGE_KEY, sorted[0].id);
  }, [activeSessionId, api, auth.isAuthenticated, selectedServerIndices]);

  const refreshMcpServers = React.useCallback(async () => {
    if (!auth.isAuthenticated) return;
    const [servers, health] = await Promise.all([api.listMcpServers(), api.healthMcpServers()]);
    setMcpServers(servers);
    setMcpHealth(health);
  }, [api, auth.isAuthenticated]);

  const refreshProfiles = React.useCallback(async () => {
    if (!auth.isAuthenticated) return;
    const listed = await api.listProfiles();
    setProfiles(listed);
  }, [api, auth.isAuthenticated]);

  const loadConfigTree = React.useCallback(async () => {
    if (!auth.isAuthenticated) return;
    const tree = await api.getUiConfigTree();
    setUiConfigTree(tree);
  }, [api, auth.isAuthenticated]);

  React.useEffect(() => {
    if (!auth.isAuthenticated) return;
    void api
      .getUiConfig()
      .then((config) => {
        setUiConfig(config);
        const header = String(config.client_api?.api_key_header ?? "X-API-Key").trim();
        if (header) setApiKeyHeader(header);
        setMcpServers(config.mcp_servers ?? []);
      })
      .catch(() => {
        // UI remains usable even if config endpoint is unavailable.
      });
  }, [api, auth.isAuthenticated]);

  React.useEffect(() => {
    if (!auth.isAuthenticated) {
      setSessions([]);
      setActiveSessionIdState(null);
      setSelectedServerIndicesState([]);
      setToolResults([]);
      return;
    }

    void refreshSessions();
    void refreshMcpServers();
    void refreshProfiles();
  }, [auth.isAuthenticated, refreshMcpServers, refreshProfiles, refreshSessions]);

  React.useEffect(() => {
    if (!auth.isAuthenticated || !activeSessionId) {
      if (!localSelectionDirtyRef.current) {
        setSelectedServerIndicesState([]);
      }
      return;
    }

    safeStorageSet(ACTIVE_SESSION_STORAGE_KEY, activeSessionId);
    void api
      .getSessionPreferences(activeSessionId)
      .then((indices) => {
        if (localSelectionDirtyRef.current) {
          if (sameIndices(indices, selectedServerIndices)) {
            localSelectionDirtyRef.current = false;
          }
          return;
        }
        setSelectedServerIndicesState(indices);
      })
      .catch(() => {
        if (!localSelectionDirtyRef.current) {
          setSelectedServerIndicesState([]);
        }
      });
  }, [activeSessionId, api, auth.isAuthenticated]);

  React.useEffect(() => {
    if (
      !auth.isAuthenticated ||
      !activeSessionId ||
      selectedServerIndices.length > 0 ||
      mcpServers.length === 0 ||
      localSelectionDirtyRef.current ||
      autoDefaultedSessionsRef.current.has(activeSessionId)
    ) {
      return;
    }
    const fallback = mcpServers.map((server) => server.index);
    autoDefaultedSessionsRef.current.add(activeSessionId);
    setSelectedServerIndicesState(fallback);
    void api.setSessionPreferences(activeSessionId, fallback).catch(() => {
      // Avoid blocking the UI if the persistence call fails.
    });
  }, [activeSessionId, api, auth.isAuthenticated, mcpServers, selectedServerIndices.length]);

  const createSession = React.useCallback(
    async (title?: string, metadata: Record<string, unknown> = {}) => {
      if (!auth.isAuthenticated) return null;
      const metadataSelection = Array.isArray(metadata.selected_mcp_server_indices)
        ? metadata.selected_mcp_server_indices
            .map((item) => Number(item))
            .filter((item, index, all) => Number.isInteger(item) && item >= 0 && all.indexOf(item) === index)
        : [];
      const defaultSelectedIndices =
        metadataSelection.length > 0
          ? metadataSelection
          : selectedServerIndices.length > 0
          ? selectedServerIndices
          : mcpServers.map((server) => server.index);
      const trimmedTitle = title?.trim() ?? "";
      const sessionMetadata: Record<string, unknown> = {
        ...metadata,
        created_by_ui: true,
        created_at: isoNow(),
        selected_mcp_server_indices: defaultSelectedIndices,
      };
      if (trimmedTitle) {
        sessionMetadata.title = trimmedTitle;
        sessionMetadata.title_generated = false;
      }
      const sessionId = await api.createSession(sessionMetadata);
      if (!sessionId) return null;
      localSelectionDirtyRef.current = false;
      setSelectedServerIndicesState(defaultSelectedIndices);
      autoDefaultedSessionsRef.current.delete(sessionId);
      setActiveSessionIdState(sessionId);
      safeStorageSet(ACTIVE_SESSION_STORAGE_KEY, sessionId);
      await refreshSessions();
      return sessionId;
    },
    [api, auth.isAuthenticated, mcpServers, refreshSessions, selectedServerIndices]
  );

  const deleteSession = React.useCallback(
    async (sessionId: string) => {
      await api.deleteSession(sessionId);
      const nextSessions = sessions.filter((item) => item.id !== sessionId);
      setSessions(nextSessions);

      if (activeSessionId !== sessionId) return;

      const next = nextSessions[0]?.id ?? null;
      setActiveSessionIdState(next);
      if (next) safeStorageSet(ACTIVE_SESSION_STORAGE_KEY, next);
      else safeStorageRemove(ACTIVE_SESSION_STORAGE_KEY);
    },
    [activeSessionId, api, sessions]
  );

  const setActiveSessionId = React.useCallback((sessionId: string) => {
    localSelectionDirtyRef.current = false;
    setActiveSessionIdState(sessionId);
    safeStorageSet(ACTIVE_SESSION_STORAGE_KEY, sessionId);
  }, []);

  const setSelectedServerIndices = React.useCallback(
    async (indices: number[]) => {
      localSelectionDirtyRef.current = true;
      setSelectedServerIndicesState(indices);
      if (!activeSessionId) return;
      const requestSeq = selectionRequestSeqRef.current + 1;
      selectionRequestSeqRef.current = requestSeq;

      const syncPromise = api
        .setSessionPreferences(activeSessionId, indices)
        .then((updated) => {
          if (selectionRequestSeqRef.current !== requestSeq) return;
          setSelectedServerIndicesState(updated);
          localSelectionDirtyRef.current = false;
        })
        .catch(async (error) => {
          if (selectionRequestSeqRef.current !== requestSeq) {
            throw error;
          }
          try {
            const restored = await api.getSessionPreferences(activeSessionId);
            setSelectedServerIndicesState(restored);
          } catch {
            setSelectedServerIndicesState([]);
          }
          localSelectionDirtyRef.current = false;
          throw error;
        });

      pendingSelectionSyncRef.current = syncPromise.finally(() => {
        if (pendingSelectionSyncRef.current === syncPromise) {
          pendingSelectionSyncRef.current = null;
        }
      });

      await pendingSelectionSyncRef.current;
    },
    [activeSessionId, api]
  );

  const awaitSelectedServerIndicesSync = React.useCallback(async () => {
    await pendingSelectionSyncRef.current;
  }, []);

  const addToolResult = React.useCallback((result: ToolExecutionResult) => {
    setToolResults((current) => [result, ...current].slice(0, 30));
  }, []);

  const value: AppState = {
    api,
    uiConfig,
    uiConfigTree,
    apiKey,
    apiKeyHeader,
    setApiKey,
    sessions,
    activeSessionId,
    setActiveSessionId,
    refreshSessions,
    createSession,
    deleteSession,
    mcpServers,
    mcpHealth,
    refreshMcpServers,
    profiles,
    refreshProfiles,
    selectedServerIndices,
    setSelectedServerIndices,
    awaitSelectedServerIndicesSync,
    toolResults,
    addToolResult,
    loadConfigTree,
  };

  return <AppStateContext.Provider value={value}>{props.children}</AppStateContext.Provider>;
}

export function useAppState(): AppState {
  const ctx = React.useContext(AppStateContext);
  if (!ctx) throw new Error("AppStateContext not available");
  return ctx;
}
