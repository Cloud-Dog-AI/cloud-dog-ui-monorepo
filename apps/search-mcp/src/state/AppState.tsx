// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
// Licensed under the Apache License 2.0

import * as React from "react";
import { useAuth } from "@cloud-dog/auth";
import { useConfig } from "@cloud-dog/config";
import { buildApi, type SearchApi } from "../lib/api";

interface AppCfg {
  API_BASE_URL: string;
  APP_VERSION?: string;
}

interface SearchState {
  tenant: string;
  api: SearchApi;
  apiBaseUrl: string;
  appVersion: string;
}

const Ctx = React.createContext<SearchState | null>(null);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const cfg = useConfig<AppCfg>();
  const { logout } = useAuth();
  const logoutRef = React.useRef(logout);
  React.useEffect(() => {
    logoutRef.current = logout;
  }, [logout]);

  const api = React.useMemo(
    () => buildApi(cfg.API_BASE_URL, () => void logoutRef.current()),
    [cfg.API_BASE_URL]
  );

  const value = React.useMemo<SearchState>(
    () => ({
      tenant: "tenant-default",
      api,
      apiBaseUrl: cfg.API_BASE_URL,
      appVersion: cfg.APP_VERSION ?? "0.1.0",
    }),
    [api, cfg.API_BASE_URL, cfg.APP_VERSION]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSearchState(): SearchState {
  const v = React.useContext(Ctx);
  if (!v) throw new Error("useSearchState must be used inside AppStateProvider");
  return v;
}
