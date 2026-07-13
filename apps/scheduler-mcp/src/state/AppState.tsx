// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
// Licensed under the Apache License, Version 2.0
//
// scheduler-mcp — Minimal AppState (config + API + apiKey).

import * as React from "react";
import { useAuth } from "@cloud-dog/auth";
import { useConfig } from "@cloud-dog/config";
import { createSchedulerApi } from "../lib/api";
import type { SchedulerApi } from "../lib/api";
import { hasScope } from "../lib/rbac";

type RuntimeConfig = Readonly<{
  API_BASE_URL: string;
  MCP_BASE_URL?: string;
  A2A_BASE_URL?: string;
  AUTH_MODE?: "api_key" | "cookie" | "oidc";
  APP_VERSION?: string;
}>;

type AppState = Readonly<{
  api: SchedulerApi;
  apiBaseUrl: string;
  mcpBaseUrl: string;
  a2aBaseUrl: string;
  appVersion: string;
  // W28K-1408 F-1408-3 — the api_key auth adapter does NOT call /v1/auth/me, so
  // the caller's real scopes are unknown to useAuth(). We fetch them here and
  // expose `can(scope)` for scope-aware CTA hide/show. `schedules.admin` is the
  // backend superuser scope (Principal.has_scope returns true for everything).
  scopes: ReadonlyArray<string>;
  scopesLoaded: boolean;
  can: (scope: string) => boolean;
}>;

const Context = React.createContext<AppState | null>(null);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const cfg = useConfig<RuntimeConfig>();
  const auth = useAuth();
  const apiBaseUrl = cfg.API_BASE_URL || "/api";
  const mcpBaseUrl = cfg.MCP_BASE_URL || `${window.location.origin}/mcp`;
  const a2aBaseUrl = cfg.A2A_BASE_URL || `${window.location.origin}/a2a`;
  const appVersion = cfg.APP_VERSION || "0.1.0";

  const api = React.useMemo<SchedulerApi>(() => {
    const apiKey = auth.getAccessToken?.() ?? null;
    return createSchedulerApi({ baseUrl: apiBaseUrl, apiKey });
  }, [apiBaseUrl, auth]);

  const [scopes, setScopes] = React.useState<ReadonlyArray<string>>([]);
  const [scopesLoaded, setScopesLoaded] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    setScopesLoaded(false);
    void api.authMe()
      .then((me) => { if (!cancelled) setScopes(me?.user?.scopes ?? []); })
      .catch(() => { if (!cancelled) setScopes([]); })
      .finally(() => { if (!cancelled) setScopesLoaded(true); });
    return () => { cancelled = true; };
  }, [api]);

  const can = React.useCallback((scope: string) => hasScope(scopes, scope), [scopes]);

  const state = React.useMemo<AppState>(() => ({
    api,
    apiBaseUrl,
    mcpBaseUrl,
    a2aBaseUrl,
    appVersion,
    scopes,
    scopesLoaded,
    can,
  }), [api, apiBaseUrl, mcpBaseUrl, a2aBaseUrl, appVersion, scopes, scopesLoaded, can]);

  return <Context.Provider value={state}>{children}</Context.Provider>;
}

export function useAppState(): AppState {
  const v = React.useContext(Context);
  if (!v) throw new Error("useAppState() outside AppStateProvider");
  return v;
}
