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

// @cloud-dog/auth — OIDC Authorization Code + PKCE adapter (Pattern B).

import type { AuthAdapter } from "./types";
import type { AuthConfig, LoginCredentials, User } from "../types/user";
import { TokenStore } from "../session/token-store";

function base64UrlEncode(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  const b64 = btoa(str);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function sha256(input: string): Promise<ArrayBuffer> {
  const enc = new TextEncoder().encode(input);
  return await crypto.subtle.digest("SHA-256", enc);
}

function randomString(len: number): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._~";
  let out = "";
  for (let i = 0; i < len; i += 1) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export function createOidcAdapter(config: AuthConfig): AuthAdapter {
  if (!config.oidc) throw new Error("OIDC auth config is missing.");
  if (!crypto?.subtle) throw new Error("PKCE requires WebCrypto subtle API.");

  const tokenStore = new TokenStore();
  let user: User | null = null;
  let pkceVerifier: string | null = null;

  const login = async (credentials: LoginCredentials): Promise<User> => {
    // OIDC does not use username/password directly here; it redirects.
    if (!("oidc" in credentials)) {
      throw new Error("OIDC login requires { oidc: true } credentials.");
    }
    const verifier = randomString(64);
    const challenge = base64UrlEncode(await sha256(verifier));
    // Do not use localStorage/sessionStorage for secrets. The verifier is kept in memory only.
    pkceVerifier = verifier;

    const authUrl = new URL("/authorize", config.oidc!.issuer);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("client_id", config.oidc!.clientId);
    authUrl.searchParams.set("redirect_uri", config.oidc!.redirectUri);
    authUrl.searchParams.set("scope", config.oidc!.scope);
    authUrl.searchParams.set("code_challenge_method", "S256");
    authUrl.searchParams.set("code_challenge", challenge);

    window.location.assign(authUrl.toString());
    throw new Error("Redirecting to identity provider.");
  };

  const refresh = async (): Promise<User | null> => {
    // Implementation is adapter-specific and requires token endpoint; not executed by default.
    void pkceVerifier;
    return user;
  };

  const logout = async (): Promise<void> => {
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
