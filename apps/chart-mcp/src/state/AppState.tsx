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
import { createChartApi } from "../lib/api";
import type { ChartApi } from "../lib/api";

type RuntimeConfig = Readonly<{
  API_BASE_URL: string;
  APP_VERSION?: string;
}>;

type ChartState = Readonly<{
  api: ChartApi;
  apiBaseUrl: string;
  appVersion: string;
}>;

const AppStateContext = React.createContext<ChartState | null>(null);

export function AppStateProvider(props: { children: React.ReactNode }) {
  const cfg = useConfig<RuntimeConfig>();
  const { logout } = useAuth();
  const logoutRef = React.useRef(logout);

  React.useEffect(() => {
    logoutRef.current = logout;
  }, [logout]);

  const api = React.useMemo(
    () =>
      createChartApi({
        baseUrl: cfg.API_BASE_URL,
        onAuthError: () => {
          void logoutRef.current();
        },
      }),
    [cfg.API_BASE_URL]
  );

  const value: ChartState = {
    api,
    apiBaseUrl: cfg.API_BASE_URL,
    appVersion: cfg.APP_VERSION ?? "0.1.0",
  };

  return <AppStateContext.Provider value={value}>{props.children}</AppStateContext.Provider>;
}

export function useChartState() {
  const ctx = React.useContext(AppStateContext);
  if (!ctx) {
    throw new Error("AppStateContext is not available. Wrap your app with <AppStateProvider>.");
  }
  return ctx;
}
