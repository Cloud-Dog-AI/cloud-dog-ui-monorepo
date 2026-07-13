// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
//
// Licensed under the Apache License, Version 2.0.

import * as React from "react";
import { useAuth } from "@cloud-dog/auth";
import { useConfig } from "@cloud-dog/config";
import { createGeoApi } from "../lib/api";
import type { GeoApi } from "../lib/api";

type RuntimeConfig = Readonly<{
  API_BASE_URL: string;
  APP_VERSION?: string;
}>;

type GeoState = Readonly<{
  api: GeoApi;
  apiBaseUrl: string;
  appVersion: string;
}>;

const AppStateContext = React.createContext<GeoState | null>(null);

export function AppStateProvider(props: { children: React.ReactNode }) {
  const cfg = useConfig<RuntimeConfig>();
  const { logout } = useAuth();
  const logoutRef = React.useRef(logout);

  React.useEffect(() => {
    logoutRef.current = logout;
  }, [logout]);

  const api = React.useMemo(
    () =>
      createGeoApi({
        baseUrl: cfg.API_BASE_URL,
        onAuthError: () => {
          void logoutRef.current();
        },
      }),
    [cfg.API_BASE_URL]
  );

  const value: GeoState = {
    api,
    apiBaseUrl: cfg.API_BASE_URL,
    appVersion: cfg.APP_VERSION ?? "0.1.0",
  };

  return <AppStateContext.Provider value={value}>{props.children}</AppStateContext.Provider>;
}

export function useGeoState() {
  const ctx = React.useContext(AppStateContext);
  if (!ctx) {
    throw new Error("AppStateContext is not available. Wrap your app with <AppStateProvider>.");
  }
  return ctx;
}
