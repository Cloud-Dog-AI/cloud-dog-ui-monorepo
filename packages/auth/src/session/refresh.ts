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

// @cloud-dog/auth — Token refresh logic.

import type { AuthConfig, User } from "../types/user";
import { TokenStore } from "./token-store";

export async function refreshUserSession(opts: {
  config: AuthConfig;
  tokenStore: TokenStore;
}): Promise<User | null> {
  if (opts.config.mode !== "cookie") return null;
  const refreshPath = opts.config.cookie?.refreshPath;
  if (!refreshPath) return null;

  const url = new URL(refreshPath, opts.config.apiBaseUrl).toString();
  const resp = await fetch(url, { method: "POST", credentials: "include" });
  if (!resp.ok) return null;

  const body = (await resp.json()) as any;
  if (body?.access_token && typeof body.access_token === "string") {
    opts.tokenStore.set({
      access: body.access_token,
      refresh: body.refresh_token,
      expiresIn: Number(body.expires_in ?? 3600),
    });
  }
  return (body?.user ?? null) as User | null;
}
