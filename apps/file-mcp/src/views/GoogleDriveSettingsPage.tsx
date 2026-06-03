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

// @cloud-dog/app-file-mcp — Google Drive admin setup page.

import * as React from "react";
import { useAuth } from "@cloud-dog/auth";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button, Card, CardContent, CardHeader, Input, Select } from "@cloud-dog/ui";
import { canManageGoogleDriveSettings } from "../lib/rbac";
import type { AdminProfile } from "../lib/types";
import { useFileMcpState } from "../state/AppState";

type GoogleDraft = Readonly<{
  profile: string;
  userEmail: string;
  folderInput: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  tokenUri: string;
  oauthScope: string;
  oauthAuthorizeUri: string;
  apiBaseUri: string;
}>;

const EMPTY_DRAFT: GoogleDraft = {
  profile: "",
  userEmail: "",
  folderInput: "",
  clientId: "",
  clientSecret: "",
  redirectUri: "",
  tokenUri: "",
  oauthScope: "",
  oauthAuthorizeUri: "",
  apiBaseUri: "",
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

export function GoogleDriveSettingsPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { api, apiBaseUrl, authMode, currentUser } = useFileMcpState();

  const initialProfile = searchParams.get("profile")?.trim() || "";
  const callbackStatus = searchParams.get("status")?.trim() || "";
  const callbackFolderName = searchParams.get("folder_name")?.trim() || "";
  const callbackFolderId = searchParams.get("folder_id")?.trim() || "";
  const callbackFolderUrl = searchParams.get("folder_url")?.trim() || "";
  const callbackReloadMessage = searchParams.get("reload_message")?.trim() || "";
  const callbackErrorMessage = searchParams.get("error_message")?.trim() || "";

  const dismissCallback = React.useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.delete("status");
    next.delete("folder_name");
    next.delete("folder_id");
    next.delete("folder_url");
    next.delete("reload_message");
    next.delete("error_message");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const [profiles, setProfiles] = React.useState<AdminProfile[]>([]);
  const [draft, setDraft] = React.useState<GoogleDraft>({ ...EMPTY_DRAFT, profile: initialProfile });
  const [status, setStatus] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [hasGoogleDriveBackend, setHasGoogleDriveBackend] = React.useState<boolean | null>(null);

  const canAdminGoogleDrive = canManageGoogleDriveSettings(currentUser ?? auth.user);

  const applyProfileDefaults = React.useCallback((profileName: string, allProfiles: AdminProfile[]) => {
    const profile = allProfiles.find((item) => item.name === profileName);
    if (!profile) {
      setDraft((curr) => ({ ...EMPTY_DRAFT, profile: profileName }));
      return;
    }

    const profileRoot = asRecord(profile.profile);
    const storage = asRecord(profileRoot.storage);
    const google = asRecord(storage.google_drive);
    const redirectFallback = `${window.location.origin}/admin/google-drive/callback`;
    const folderUrl = String(google.folder_url ?? "").trim();
    const folderId = String(google.folder_id ?? "").trim();

    setDraft({
      profile: profileName,
      userEmail: String(google.user_email ?? "").trim(),
      folderInput: folderUrl || folderId,
      clientId: String(google.client_id ?? "").trim(),
      clientSecret: "",
      redirectUri: String(google.redirect_uri ?? "").trim() || redirectFallback,
      tokenUri: String(google.token_uri ?? "").trim(),
      oauthScope: String(google.oauth_scope ?? "").trim(),
      oauthAuthorizeUri: String(google.oauth_authorize_uri ?? "").trim(),
      apiBaseUri: String(google.api_base_uri ?? "").trim(),
    });
  }, []);

  const loadProfiles = React.useCallback(async () => {
    if (!canAdminGoogleDrive) {
      setProfiles([]);
      setHasGoogleDriveBackend(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const [loaded, backend] = await Promise.all([
        api.listAdminProfiles(),
        api.backendStatus().catch(() => null),
      ]);
      setProfiles(loaded);
      const states = backend?.states ?? {};
      const gdBackend = states.google_drive ?? states["google-drive"];
      setHasGoogleDriveBackend(gdBackend ? gdBackend.status === "healthy" : false);
      const selected = draft.profile || initialProfile || loaded[0]?.name || "";
      applyProfileDefaults(selected, loaded);
      setStatus("Loaded profile defaults.");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load profiles.");
      setHasGoogleDriveBackend(false);
    } finally {
      setIsLoading(false);
    }
  }, [api, applyProfileDefaults, canAdminGoogleDrive, draft.profile]);

  React.useEffect(() => {
    void loadProfiles();
  }, [loadProfiles]);

  // A google_drive profile is "connected" when its persisted config has a
  // resolved (non-template) folder_id AND refresh_token. We compute this from
  // the loaded profile rather than reacting to URL state, so the form
  // disappears immediately after page load if OAuth is already complete.
  const connectedProfile = React.useMemo(() => {
    const profile = profiles.find((p) => p.name === draft.profile);
    if (!profile) return null;
    const profileRoot = asRecord(profile.profile);
    const storage = asRecord(profileRoot.storage);
    const backend = String(storage.backend ?? "").trim();
    if (backend !== "google_drive" && backend !== "google-drive") return null;
    const google = asRecord(storage.google_drive);
    const folderId = String(google.folder_id ?? "").trim();
    const refreshToken = String(google.refresh_token ?? "").trim();
    const hasResolvedValue = (v: string) => v.length > 0 && !v.includes("${");
    if (!hasResolvedValue(folderId) || !hasResolvedValue(refreshToken)) return null;
    return {
      userEmail: String(google.user_email ?? "").trim(),
      folderId,
      folderUrl: String(google.folder_url ?? "").trim(),
      clientId: String(google.client_id ?? "").trim(),
      redirectUri: String(google.redirect_uri ?? "").trim(),
    };
  }, [profiles, draft.profile]);

  const disconnect = async () => {
    if (!draft.profile) return;
    const confirmed = window.confirm(
      `Disconnect Google Drive from profile "${draft.profile}"?\n\n` +
        "This deletes the storage profile from the database. " +
        "The refresh token in /app/logs/ will also be cleared. " +
        "You will need to OAuth again to reconnect."
    );
    if (!confirmed) return;
    setIsLoading(true);
    setError(null);
    try {
      await api.deleteAdminProfile(draft.profile);
      setStatus(`Disconnected profile "${draft.profile}". Re-authorise to reconnect.`);
      setDraft({ ...EMPTY_DRAFT, profile: draft.profile });
      dismissCallback();
      await loadProfiles();
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "Failed to disconnect.");
    } finally {
      setIsLoading(false);
    }
  };

  const selectProfile = (profileName: string) => {
    applyProfileDefaults(profileName, profiles);
  };

  const submitGoogleStart = async () => {
    const profile = draft.profile.trim();
    if (!profile) {
      setError("Profile is required.");
      return;
    }
    if (!draft.clientId.trim()) {
      setError("Client ID is required.");
      return;
    }
    if (!draft.folderInput.trim()) {
      setError("Folder URL or ID is required.");
      return;
    }

    const actionBase = stripTrailingSlash(apiBaseUrl || "/");
    const payload: Record<string, string> = {
      profile,
      user_email: draft.userEmail.trim(),
      folder_input: draft.folderInput.trim(),
      client_id: draft.clientId.trim(),
      client_secret: draft.clientSecret.trim(),
      redirect_uri: draft.redirectUri.trim(),
      token_uri: draft.tokenUri.trim(),
      oauth_scope: draft.oauthScope.trim(),
      oauth_authorize_uri: draft.oauthAuthorizeUri.trim(),
      api_base_uri: draft.apiBaseUri.trim(),
    };
    const body = new URLSearchParams();
    for (const [name, value] of Object.entries(payload)) {
      body.set(name, value);
    }

    const headers: Record<string, string> = {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
      "X-File-MCP-Profile": profile,
    };
    const accessToken = auth.getAccessToken();
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }

    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${actionBase}/admin/google-drive/start`, {
        method: "POST",
        headers,
        body: body.toString(),
        credentials: authMode === "cookie" ? "include" : "same-origin",
      });
      const rawText = await response.text();
      let location = "";
      let message = rawText || "Failed to start Google Drive OAuth.";
      try {
        const parsed = JSON.parse(rawText) as { location?: string; message?: string };
        if (typeof parsed.location === "string") {
          location = parsed.location;
        }
        if (typeof parsed.message === "string" && parsed.message.trim()) {
          message = parsed.message;
        }
      } catch {
        // Non-JSON error body.
      }
      if (!response.ok) {
        throw new Error(message);
      }
      if (!location) {
        throw new Error("Google Drive start endpoint did not return an OAuth redirect URL.");
      }
      window.location.assign(location);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Failed to start Google Drive OAuth."
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (!canAdminGoogleDrive) {
    return (
      <div className="space-y-6">
        <header className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">Google Drive Settings</h1>
        </header>
        <Card>
          <CardContent className="py-6">
            <p role="alert" className="text-sm text-destructive">
              Google Drive configuration requires <code>admin:google_drive</code> or admin access.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold">Google Drive Settings</h1>
        <Button variant="secondary" size="sm" onClick={() => void loadProfiles()} disabled={isLoading}>
          Refresh profiles
        </Button>
      </header>

      {callbackStatus === "success" ? (
        <Card className="border-green-500/40 bg-green-500/5">
          <CardHeader>
            <h2 className="text-lg font-semibold text-green-700 dark:text-green-400">
              ✓ Google Drive linked successfully
            </h2>
            <p className="text-sm text-muted-foreground">
              OAuth consent completed. The refresh token is saved to a durable
              host-mounted path and will survive container restart.
            </p>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>
              <span className="text-muted-foreground">Profile: </span>
              <strong>{initialProfile || "default"}</strong>
            </div>
            {callbackFolderName ? (
              <div>
                <span className="text-muted-foreground">Folder: </span>
                <strong>{callbackFolderName}</strong>
                {callbackFolderId ? (
                  <span className="ml-2 text-muted-foreground">({callbackFolderId})</span>
                ) : null}
              </div>
            ) : null}
            {callbackFolderUrl ? (
              <div>
                <span className="text-muted-foreground">Folder URL: </span>
                <a
                  href={callbackFolderUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 dark:text-blue-400 underline break-all"
                >
                  {callbackFolderUrl}
                </a>
              </div>
            ) : null}
            {callbackReloadMessage ? (
              <div className="text-xs text-muted-foreground italic">
                {callbackReloadMessage}
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2 pt-3">
              <Button onClick={() => navigate("/file-browser")}>
                Continue to File Browser
              </Button>
              <Button variant="secondary" onClick={() => navigate("/storage-profiles")}>
                Back to Storage Profiles
              </Button>
              <Button variant="ghost" onClick={dismissCallback}>
                Dismiss
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {callbackStatus === "error" ? (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardHeader>
            <h2 className="text-lg font-semibold text-destructive">
              ✗ Google Drive OAuth failed
            </h2>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              The OAuth callback returned an error. Check the values below and try again.
            </p>
            {callbackErrorMessage ? (
              <pre className="text-xs bg-muted/40 p-2 rounded border border-input overflow-x-auto whitespace-pre-wrap">
                {callbackErrorMessage}
              </pre>
            ) : null}
            <div>
              <Button variant="secondary" onClick={dismissCallback}>
                Dismiss and retry
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {hasGoogleDriveBackend === false && callbackStatus !== "success" && !connectedProfile ? (
        <Card>
          <CardContent className="py-6">
            <p className="text-sm text-muted-foreground">
              <strong>Google Drive is not configured.</strong> No Google Drive storage backend is currently active.
              To enable Google Drive, configure a storage profile with the <code>google_drive</code> backend
              and provide valid OAuth credentials via Vault.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {connectedProfile ? (
        <Card className="border-green-500/40 bg-green-500/5">
          <CardHeader>
            <h2 className="text-lg font-semibold text-green-700 dark:text-green-400">
              ✓ Connected
            </h2>
            <p className="text-sm text-muted-foreground">
              Profile <strong>{draft.profile}</strong> is authenticated against Google Drive.
              Use this profile via the MCP tools, A2A skills, or File Browser.
            </p>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {connectedProfile.userEmail ? (
              <div><span className="text-muted-foreground">Account: </span>
                <strong>{connectedProfile.userEmail}</strong></div>
            ) : null}
            {connectedProfile.folderId ? (
              <div><span className="text-muted-foreground">Drive folder ID: </span>
                <code>{connectedProfile.folderId}</code></div>
            ) : null}
            {connectedProfile.folderUrl ? (
              <div><span className="text-muted-foreground">Folder URL: </span>
                <a href={connectedProfile.folderUrl} target="_blank" rel="noreferrer"
                  className="text-blue-600 dark:text-blue-400 underline break-all">
                  {connectedProfile.folderUrl}
                </a></div>
            ) : null}
            {connectedProfile.clientId ? (
              <div><span className="text-muted-foreground">OAuth Client: </span>
                <code className="text-xs">{connectedProfile.clientId}</code></div>
            ) : null}
            {connectedProfile.redirectUri ? (
              <div><span className="text-muted-foreground">Redirect URI: </span>
                <code className="text-xs">{connectedProfile.redirectUri}</code></div>
            ) : null}
            <div className="flex flex-wrap gap-2 pt-3">
              <Button onClick={() => navigate("/file-browser")}>Browse files</Button>
              <Button variant="secondary" onClick={() => navigate("/mcp-console")}>Open MCP console</Button>
              <Button variant="destructive" onClick={() => void disconnect()} disabled={isLoading}>
                Disconnect &amp; re-authorise
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {status ? (
        <p role="status" className="text-sm text-foreground/80">
          {status}
        </p>
      ) : null}

      {connectedProfile ? null : (
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">OAuth setup</h2>
          <p className="text-sm text-muted-foreground">
            Configure Google Drive OAuth via backend route
            <code className="mx-1">/admin/google-drive/start</code>.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border border-input bg-muted/40 p-3 text-sm space-y-2">
            <p className="font-medium">Setup steps</p>
            <ol className="list-decimal pl-5 space-y-1 text-muted-foreground">
              <li>
                In Google Cloud Console, register an OAuth 2.0 Web Client and add this redirect URI to its
                "Authorized redirect URIs":
                <code className="mx-1 break-all">
                  {`${window.location.origin}/admin/google-drive/callback`}
                </code>
              </li>
              <li>Fill in the form below using the Client ID and Client Secret from that OAuth client.</li>
              <li>
                Click <strong>Start OAuth</strong>. You will be redirected to Google to grant consent, then
                returned here to complete the profile.
              </li>
            </ol>
            <p className="text-xs text-muted-foreground">
              Fields marked <span className="text-destructive">*</span> are required. URI fields default to
              the standard Google endpoints — leave them as-is unless you know you need different values.
            </p>
          </div>

          <div>
            <label htmlFor="gdrive-profile" className="text-sm font-medium block mb-1">
              Profile <span aria-hidden="true" className="text-destructive">*</span>
            </label>
            <Select
              id="gdrive-profile"
              value={draft.profile}
              onChange={(event) => selectProfile(event.target.value)}
            >
              {profiles.length === 0 ? <option value="">No profiles</option> : null}
              {profiles.map((profile) => (
                <option key={profile.name} value={profile.name}>
                  {profile.name}
                </option>
              ))}
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              Storage profile whose <code>google_drive</code> backend is being configured.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="gdrive-user-email" className="text-sm font-medium block mb-1">
                Google user email <span aria-hidden="true" className="text-destructive">*</span>
              </label>
              <Input
                id="gdrive-user-email"
                aria-label="Google user email"
                value={draft.userEmail}
                onChange={(event) => setDraft((curr) => ({ ...curr, userEmail: event.target.value }))}
                placeholder="user@example.com"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Google account that owns or has access to the target Drive folder.
              </p>
            </div>

            <div>
              <label htmlFor="gdrive-folder" className="text-sm font-medium block mb-1">
                Drive folder URL or ID <span aria-hidden="true" className="text-destructive">*</span>
              </label>
              <Input
                id="gdrive-folder"
                aria-label="Google folder url or id"
                value={draft.folderInput}
                onChange={(event) => setDraft((curr) => ({ ...curr, folderInput: event.target.value }))}
                placeholder="https://drive.google.com/drive/folders/..."
              />
              <p className="text-xs text-muted-foreground mt-1">
                Open the target folder in Drive and paste the full URL, or paste just the folder ID.
              </p>
            </div>

            <div>
              <label htmlFor="gdrive-client-id" className="text-sm font-medium block mb-1">
                OAuth Client ID <span aria-hidden="true" className="text-destructive">*</span>
              </label>
              <Input
                id="gdrive-client-id"
                aria-label="Google client id"
                value={draft.clientId}
                onChange={(event) => setDraft((curr) => ({ ...curr, clientId: event.target.value }))}
                placeholder="123456789-xxxx.apps.googleusercontent.com"
              />
              <p className="text-xs text-muted-foreground mt-1">
                From Google Cloud Console &rarr; APIs &amp; Services &rarr; Credentials &rarr; your OAuth 2.0 Client.
              </p>
            </div>

            <div>
              <label htmlFor="gdrive-client-secret" className="text-sm font-medium block mb-1">
                OAuth Client Secret
              </label>
              <Input
                id="gdrive-client-secret"
                aria-label="Google client secret"
                type="password"
                value={draft.clientSecret}
                onChange={(event) => setDraft((curr) => ({ ...curr, clientSecret: event.target.value }))}
                placeholder="Leave blank if already saved in Vault"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Paired with the Client ID. Stored in Vault on submit. Leave blank to keep the existing value.
              </p>
            </div>

            <div>
              <label htmlFor="gdrive-redirect-uri" className="text-sm font-medium block mb-1">
                Redirect URI <span aria-hidden="true" className="text-destructive">*</span>
              </label>
              <Input
                id="gdrive-redirect-uri"
                aria-label="Google redirect uri"
                value={draft.redirectUri}
                onChange={(event) => setDraft((curr) => ({ ...curr, redirectUri: event.target.value }))}
                placeholder={`${window.location.origin}/admin/google-drive/callback`}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Must exactly match a URI registered on the OAuth client in Google Cloud Console.
              </p>
            </div>

            <div>
              <label htmlFor="gdrive-token-uri" className="text-sm font-medium block mb-1">
                Token URI
              </label>
              <Input
                id="gdrive-token-uri"
                aria-label="Google token uri"
                value={draft.tokenUri}
                onChange={(event) => setDraft((curr) => ({ ...curr, tokenUri: event.target.value }))}
                placeholder="https://oauth2.googleapis.com/token"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Google OAuth token endpoint. Use the default unless using a private endpoint.
              </p>
            </div>

            <div>
              <label htmlFor="gdrive-oauth-scope" className="text-sm font-medium block mb-1">
                OAuth Scope
              </label>
              <Input
                id="gdrive-oauth-scope"
                aria-label="Google oauth scope"
                value={draft.oauthScope}
                onChange={(event) => setDraft((curr) => ({ ...curr, oauthScope: event.target.value }))}
                placeholder="https://www.googleapis.com/auth/drive.file"
              />
              <p className="text-xs text-muted-foreground mt-1">
                <code>drive.file</code> grants access to files this app creates; <code>drive</code> grants full Drive access.
              </p>
            </div>

            <div>
              <label htmlFor="gdrive-authorize-uri" className="text-sm font-medium block mb-1">
                Authorize URI
              </label>
              <Input
                id="gdrive-authorize-uri"
                aria-label="Google authorise uri"
                value={draft.oauthAuthorizeUri}
                onChange={(event) => setDraft((curr) => ({ ...curr, oauthAuthorizeUri: event.target.value }))}
                placeholder="https://accounts.google.com/o/oauth2/v2/auth"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Google OAuth consent endpoint. Use the default unless using a private endpoint.
              </p>
            </div>

            <div>
              <label htmlFor="gdrive-api-base" className="text-sm font-medium block mb-1">
                Drive API base URI
              </label>
              <Input
                id="gdrive-api-base"
                aria-label="Google api base uri"
                value={draft.apiBaseUri}
                onChange={(event) => setDraft((curr) => ({ ...curr, apiBaseUri: event.target.value }))}
                placeholder="https://www.googleapis.com/drive/v3"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Base URL of the Google Drive REST API. Default is v3.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <Button onClick={() => void submitGoogleStart()} disabled={isLoading}>Start OAuth</Button>
            <Button variant="secondary" onClick={() => selectProfile(draft.profile)} disabled={isLoading}>
              Reload profile defaults
            </Button>
          </div>
        </CardContent>
      </Card>
      )}
    </div>
  );
}
