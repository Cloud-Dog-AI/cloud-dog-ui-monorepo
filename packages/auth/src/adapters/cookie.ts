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

// @cloud-dog/auth — Cookie session adapter (Pattern A).

import type { AuthAdapter } from "./types";
import type { AuthConfig, LoginCredentials, User } from "../types/user";
import { TokenStore } from "../session/token-store";

type CookieLoginResponse = {
  user: User;
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
};

export function createCookieAdapter(config: AuthConfig): AuthAdapter {
  if (!config.cookie) {
    throw new Error("Cookie auth config is missing.");
  }

  const tokenStore = new TokenStore();
  let user: User | null = null;

  const login = async (credentials: LoginCredentials): Promise<User> => {
    if (!("username" in credentials) || !("password" in credentials)) {
      throw new Error("Username and password are required.");
    }
    const url = new URL(config.cookie!.loginPath, config.apiBaseUrl).toString();
    const resp = await fetch(url, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(credentials),
    });
    if (!resp.ok) throw new Error("Login failed.");
    const body = (await resp.json()) as CookieLoginResponse;
    user = body.user;
    if (body.access_token) {
      tokenStore.set({
        access: body.access_token,
        refresh: body.refresh_token,
        expiresIn: Number(body.expires_in ?? 3600),
      });
    }
    return user;
  };

  const refresh = async (): Promise<User | null> => {
    const meUrl = new URL(config.cookie!.mePath, config.apiBaseUrl).toString();
    const resp = await fetch(meUrl, { method: "GET", credentials: "include" });
    if (!resp.ok) return null;
    const body = (await resp.json()) as any;
    user = (body && typeof body === "object" && "user" in body ? body.user : body) as User | null;
    return user;
  };

  const logout = async (): Promise<void> => {
    const url = new URL(config.cookie!.logoutPath, config.apiBaseUrl).toString();
    await fetch(url, { method: "POST", credentials: "include" }).catch(() => {});
    tokenStore.clear();
    user = null;
  };

  return {
    login,
    logout,
    refresh,
    getAccessToken: () => tokenStore.getAccess(),
    isAuthenticated: () => !!user,
  };
}
