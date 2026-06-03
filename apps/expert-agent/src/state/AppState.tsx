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

// @cloud-dog/app-expert-agent — Shared UI state and authenticated API access.
// Covers: FR1.21, FR1.22, FR1.23, FR1.35

import * as React from 'react';
import { useAuth } from '@cloud-dog/auth';
import { useConfig } from '@cloud-dog/config';
import { createExpertAgentApi, type ExpertAgentApi } from '../lib/api';

type RuntimeConfig = Readonly<{
  API_BASE_URL: string;
  WEB_API_BASE_URL: string;
}>;

type AppState = Readonly<{
  api: ExpertAgentApi;
  latestFailure: string | null;
  captureFailure: (error: unknown) => string;
  clearFailure: () => void;
}>;

const AppStateContext = React.createContext<AppState | null>(null);

function formatError(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (typeof error === 'string' && error.trim()) return error;
  return 'Request failed.';
}

export function AppStateProvider(props: { children: React.ReactNode }) {
  const cfg = useConfig<RuntimeConfig>();
  const auth = useAuth();
  const [latestFailure, setLatestFailure] = React.useState<string | null>(null);

  const clearFailure = React.useCallback(() => {
    setLatestFailure(null);
  }, []);

  const captureFailure = React.useCallback((error: unknown) => {
    const message = formatError(error);
    setLatestFailure(message);
    if (/401|unauthori[sz]ed|not authenticated/i.test(message)) {
      void auth.logout();
    }
    return message;
  }, [auth]);

  const api = React.useMemo(
    () => createExpertAgentApi(cfg.WEB_API_BASE_URL),
    [cfg.WEB_API_BASE_URL]
  );

  return (
    <AppStateContext.Provider value={{ api, latestFailure, captureFailure, clearFailure }}>
      {props.children}
    </AppStateContext.Provider>
  );
}

export function useExpertAgentState() {
  const ctx = React.useContext(AppStateContext);
  if (!ctx) throw new Error('AppStateContext is not available. Wrap your app with <AppStateProvider>.');
  return ctx;
}
