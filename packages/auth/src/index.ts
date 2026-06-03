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

// @cloud-dog/auth — Public exports.

export { AuthProvider } from "./context/AuthProvider";
export { useAuth } from "./context/useAuth";

export { LoginPage } from "./components/LoginPage";
export { RequireAuth } from "./components/RequireAuth";
export { RequirePermission } from "./components/RequirePermission";
export { LogoutButton } from "./components/LogoutButton";
export { SessionExpiredDialog } from "./components/SessionExpiredDialog";
export { SessionTimeoutProvider } from "./components/SessionTimeoutProvider";
export { ApiKeyPrompt } from "./components/ApiKeyPrompt";

export { createCookieAdapter } from "./adapters/cookie";
export { createOidcAdapter } from "./adapters/oidc";
export { createApiKeyAdapter } from "./adapters/api-key";
export type { AuthAdapter } from "./adapters/types";

export { TokenStore } from "./session/token-store";
export { IdleTimer } from "./session/idle-timer";

export type { AuthConfig, AuthMode, LoginCredentials, User } from "./types/user";
export type { LoginPageProps } from "./components/LoginPage";
