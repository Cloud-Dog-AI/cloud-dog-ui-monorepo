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

// @cloud-dog/auth — React context provider for auth adapters.

import * as React from "react";
import type { AuthConfig, LoginCredentials, User } from "../types/user";
import type { AuthState } from "./AuthContext";
import type { AuthAdapter } from "../adapters/types";
import { createCookieAdapter } from "../adapters/cookie";
import { createOidcAdapter } from "../adapters/oidc";
import { createApiKeyAdapter } from "../adapters/api-key";
import { IdleTimer } from "../session/idle-timer";

export const AuthContext = React.createContext<AuthState | null>(null);

function createAdapter(config: AuthConfig): AuthAdapter {
  if (config.mode === "cookie") return createCookieAdapter(config);
  if (config.mode === "api_key") return createApiKeyAdapter(config);
  return createOidcAdapter(config);
}

export function AuthProvider(props: { config: AuthConfig; children: React.ReactNode }) {
  const adapterRef = React.useRef<AuthAdapter | null>(null);
  if (!adapterRef.current) adapterRef.current = createAdapter(props.config);
  const adapter = adapterRef.current;
  const opRef = React.useRef(0);

  const [isLoading, setIsLoading] = React.useState(true);
  const [user, setUser] = React.useState<User | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;
    const opId = ++opRef.current;
    setIsLoading(true);
    void adapter
      .refresh()
      .then((u) => {
        if (!alive || opId != opRef.current) return;
        setUser(u);
        setError(null);
      })
      .catch((e) => {
        if (!alive || opId != opRef.current) return;
        setError(e instanceof Error ? e.message : "Failed to refresh session.");
      })
      .finally(() => {
        if (!alive || opId != opRef.current) return;
        setIsLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [adapter]);

  React.useEffect(() => {
    const idleTimeoutMs = props.config.idleTimeoutMs ?? 15 * 60 * 1000;
    if (idleTimeoutMs <= 0) return;

    const timer = new IdleTimer(idleTimeoutMs, () => {
      void adapter.logout().finally(() => setUser(null));
    });
    timer.start();
    return () => timer.stop();
  }, [adapter, props.config.idleTimeoutMs]);

  const login = async (credentials: LoginCredentials) => {
    const opId = ++opRef.current;
    setIsLoading(true);
    setError(null);
    try {
      const u = await adapter.login(credentials);
      if (opId != opRef.current) return;
      setUser(u);
    } catch (e) {
      if (opId != opRef.current) return;
      setError(e instanceof Error ? e.message : "Login failed.");
      throw e;
    } finally {
      if (opId != opRef.current) return;
      setIsLoading(false);
    }
  };

  const logout = async () => {
    const opId = ++opRef.current;
    setIsLoading(true);
    setError(null);
    try {
      await adapter.logout();
      if (opId != opRef.current) return;
      setUser(null);
    } finally {
      if (opId != opRef.current) return;
      setIsLoading(false);
    }
  };

  const refresh = async () => {
    const opId = ++opRef.current;
    setIsLoading(true);
    try {
      const u = await adapter.refresh();
      if (opId != opRef.current) return;
      setUser(u);
    } finally {
      if (opId != opRef.current) return;
      setIsLoading(false);
    }
  };

  const state: AuthState = {
    isLoading,
    user,
    error,
    config: props.config,
    login,
    logout,
    refresh,
    getAccessToken: () => adapter.getAccessToken(),
    isAuthenticated: Boolean(user) || adapter.isAuthenticated(),
    hasPermission: (permission: string) => {
      const perms = user?.permissions ?? [];
      return perms.includes(permission);
    },
  };

  return <AuthContext.Provider value={state}>{props.children}</AuthContext.Provider>;
}
