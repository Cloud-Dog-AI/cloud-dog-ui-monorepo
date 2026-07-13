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

// @cloud-dog/app-git-mcp — client session id (W28J-1302 §3.5).
//
// `session_id` is a request-correlation parameter, NOT an entity. The user
// never sees or types it. We auto-generate a UUID per BROWSER SESSION and keep
// it in sessionStorage (not localStorage, not a cookie) so it resets when the
// tab session ends. Backend calls that historically needed `session_id` use this.

const SESSION_KEY = "cd-session-id";

function newId(): string {
  const cryptoObj = typeof globalThis !== "undefined" ? globalThis.crypto : undefined;
  if (cryptoObj && typeof cryptoObj.randomUUID === "function") {
    return cryptoObj.randomUUID();
  }
  // Deterministic-enough fallback for environments without crypto.randomUUID.
  return `sid-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;
}

/** Read (or lazily initialise) the per-browser-session id from sessionStorage. */
export function getSessionId(): string {
  if (typeof window === "undefined") return "ssr-session";
  try {
    const existing = window.sessionStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const id = newId();
    window.sessionStorage.setItem(SESSION_KEY, id);
    return id;
  } catch {
    return "fallback-session";
  }
}

/** Clear the session id (used on sign-out). */
export function clearSessionId(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}
