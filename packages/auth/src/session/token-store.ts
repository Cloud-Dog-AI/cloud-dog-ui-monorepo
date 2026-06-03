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

// @cloud-dog/auth — In-memory token storage (no localStorage/sessionStorage).

export class TokenStore {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private expiresAt: Date | null = null;

  set(tokens: { access: string; refresh?: string; expiresIn: number }): void {
    this.accessToken = tokens.access;
    this.refreshToken = tokens.refresh ?? null;
    this.expiresAt = new Date(Date.now() + tokens.expiresIn * 1000);
  }

  getAccess(): string | null {
    if (this.isExpired()) return null;
    return this.accessToken;
  }

  getRefresh(): string | null {
    return this.refreshToken;
  }

  clear(): void {
    this.accessToken = null;
    this.refreshToken = null;
    this.expiresAt = null;
  }

  isExpired(): boolean {
    if (!this.expiresAt) return false;
    return Date.now() >= this.expiresAt.getTime();
  }
}
