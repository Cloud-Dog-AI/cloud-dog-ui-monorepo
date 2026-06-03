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

// @cloud-dog/auth — Auth adapter protocol.

import type { AuthConfig, LoginCredentials, User } from "../types/user";

export interface AuthAdapter {
  login(credentials: LoginCredentials): Promise<User>;
  logout(): Promise<void>;
  refresh(): Promise<User | null>;
  getAccessToken(): string | null;
  isAuthenticated(): boolean;
}

export type AdapterFactory = (config: AuthConfig) => AuthAdapter;
