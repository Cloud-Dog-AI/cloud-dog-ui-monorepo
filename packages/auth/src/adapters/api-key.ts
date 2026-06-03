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

// @cloud-dog/auth — API-key-only adapter (Pattern C).

import type { AuthAdapter } from "./types";
import type { AuthConfig, LoginCredentials, User } from "../types/user";

function fingerprint(key: string): string {
  // Deterministic, non-secret identifier; not suitable for security.
  let h = 0;
  for (let i = 0; i < key.length; i += 1) {
    h = (h * 31 + key.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(16);
}

export function createApiKeyAdapter(config: AuthConfig): AuthAdapter {
  const defaults = config.apiKey ?? {};
  let apiKey: string | null = null;
  let user: User | null = null;

  const login = async (credentials: LoginCredentials): Promise<User> => {
    if (!("apiKey" in credentials) || !credentials.apiKey) {
      throw new Error("API key is required.");
    }

    apiKey = credentials.apiKey;

    const fp = fingerprint(apiKey);
    const id = defaults.userId ? `${defaults.userId}:${fp}` : `api-key:${fp}`;
    user = {
      id,
      username: defaults.username ?? defaults.userId ?? id,
      displayName: defaults.displayName ?? "API key",
      email: defaults.email,
      roles: defaults.roles ?? [],
      groups: defaults.groups ?? [],
      permissions: defaults.permissions ?? [],
      lastLogin: new Date().toISOString(),
    };
    return user;
  };

  const refresh = async (): Promise<User | null> => {
    return user;
  };

  const logout = async (): Promise<void> => {
    apiKey = null;
    user = null;
  };

  return {
    login,
    logout,
    refresh,
    getAccessToken: () => apiKey,
    isAuthenticated: () => !!apiKey,
  };
}
