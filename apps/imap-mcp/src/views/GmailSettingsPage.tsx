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

// @cloud-dog/app-imap-mcp — Gmail OAuth admin setup page (W28C-434B).
// Ports file-mcp's GoogleDriveSettingsPage.tsx pattern, adapted for Gmail/IMAP.

import * as React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button, Card, CardContent, CardHeader } from "@cloud-dog/ui";
import { useImapMcpState } from "../state/AppState";

type GmailStatusResult = {
  gmail_oauth_ready: boolean;
  has_client_id: boolean;
  has_client_secret: boolean;
  has_redirect_uri: boolean;
  has_refresh_token: boolean;
  connected_account_email: string;
  token_obtained_at: string;
  missing_fields: string[];
  profiles: string[];
};

type GmailStatusEnvelope = {
  ok: boolean;
  result?: GmailStatusResult;
};

function isStatusEnvelope(value: unknown): value is GmailStatusEnvelope {
  return value !== null && typeof value === "object" && "ok" in value;
}

export function GmailSettingsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  // Note: apiBaseUrl deliberately not used — gmail-setup routes live on the
  // web server (same origin as the SPA), so we issue relative requests.
  useImapMcpState();

  const callbackStatus = (searchParams.get("status") ?? "").trim();
  const callbackAccount = (searchParams.get("account") ?? "").trim();
  const callbackProfile = (searchParams.get("profile") ?? "").trim();
  const callbackErrorMessage = (searchParams.get("error_message") ?? "").trim();

  const dismissCallback = React.useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.delete("status");
    next.delete("account");
    next.delete("profile");
    next.delete("error_message");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const [status, setStatus] = React.useState<GmailStatusResult | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [startingOAuth, setStartingOAuth] = React.useState(false);
  // W28E-1853: the optional gmail-setup admin capability is not registered on
  // every backend; a 404 status probe must render a role-correct "not enabled"
  // state, never a raw HTTP error banner (PS-WEBUI-URL-CANONICAL §2).
  const [setupUnavailable, setSetupUnavailable] = React.useState(false);

  // IMAP-540: profile selector — operator chooses which Gmail profile to manage.
  const [selectedProfile, setSelectedProfile] = React.useState<string>(callbackProfile || "gmail_personal");

  const loadStatus = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    setSetupUnavailable(false);
    try {
      // IMAP-542: pass ?profile=<id> so backend returns per-profile state.
      const response = await fetch(`/admin/gmail-setup/status?profile=${encodeURIComponent(selectedProfile)}`, {
        method: "GET",
        headers: { Accept: "application/json" },
        credentials: "include",
      });
      if (response.status === 404) {
        // The optional gmail-setup admin capability is not registered on this
        // deployment. Render a non-leaking, role-correct "not enabled" state
        // (PS-WEBUI-URL-CANONICAL §2) instead of surfacing a raw HTTP 404 error.
        setStatus(null);
        setSetupUnavailable(true);
        return;
      }
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} from /admin/gmail-setup/status`);
      }
      const raw = (await response.json()) as unknown;
      if (!isStatusEnvelope(raw) || !raw.result) {
        throw new Error("Unexpected response shape from /admin/gmail-setup/status");
      }
      setStatus(raw.result);
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "Failed to load Gmail status.");
    } finally {
      setLoading(false);
    }
  }, [selectedProfile]);

  React.useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const isConnected = Boolean(status?.has_refresh_token);
  const accountEmail = status?.connected_account_email || callbackAccount;
  // IMAP-540: profile drives status fetch; status.profiles is the union of known Gmail profiles.
  const profile = selectedProfile;
  const availableProfiles = React.useMemo(() => {
    const set = new Set<string>(status?.profiles ?? []);
    set.add(selectedProfile);
    if (callbackProfile) set.add(callbackProfile);
    return Array.from(set).sort();
  }, [status?.profiles, selectedProfile, callbackProfile]);

  // Gmail-specific defaults rendered in the setup-steps card so the operator
  // can copy them into the OAuth client configuration.
  const redirectUri = `${window.location.origin}/auth/google/callback`;
  const oauthScope = "https://mail.google.com/";
  const imapHost = "imap.gmail.com";
  const imapPort = 993;
  const imapFolder = "INBOX";

  const startOAuth = React.useCallback(async () => {
    setStartingOAuth(true);
    setError(null);
    try {
      const response = await fetch(`/admin/gmail-setup/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        credentials: "include",
        body: JSON.stringify({
          profile,
          redirect_uri: redirectUri,
          oauth_scope: oauthScope,
        }),
      });
      const body = (await response.json().catch(() => null)) as
        | { ok?: boolean; location?: string; error?: string }
        | null;
      if (!response.ok || !body?.ok || !body.location) {
        throw new Error(body?.error ?? `HTTP ${response.status} from /admin/gmail-setup/start`);
      }
      window.location.assign(body.location);
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "Failed to start Google OAuth.");
      setStartingOAuth(false);
    }
  }, [profile, redirectUri, oauthScope]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">Gmail Settings</h1>
        {/* IMAP-540 / IMAP-541: profile selector — multiple Gmail accounts supported.
            Operator can switch between gmail_personal, gmail_work, etc.;
            new profile names can be typed via the "new profile" option. */}
        <div className="flex items-center gap-2">
          <label htmlFor="gmail-profile-select" className="text-sm text-muted-foreground">Profile:</label>
          <select
            id="gmail-profile-select"
            className="rounded-md border bg-background px-2 py-1 text-sm font-mono"
            value={selectedProfile}
            onChange={(e) => {
              if (e.target.value === "__new__") {
                const next = window.prompt("New Gmail profile name (e.g. gmail_work):", "gmail_work");
                if (next && next.trim()) setSelectedProfile(next.trim());
                return;
              }
              setSelectedProfile(e.target.value);
            }}
          >
            {availableProfiles.map((p) => <option key={p} value={p}>{p}</option>)}
            <option value="__new__">+ new Gmail profile…</option>
          </select>
        </div>
        <Button variant="secondary" size="sm" onClick={() => void loadStatus()} disabled={loading}>
          Refresh status
        </Button>
      </header>

      {callbackStatus === "success" ? (
        <Card className="border-green-500/40 bg-green-500/5">
          <CardHeader>
            <h2 className="text-lg font-semibold text-green-700 dark:text-green-400">
              ✓ Gmail linked successfully
            </h2>
            <p className="text-sm text-muted-foreground">
              OAuth consent completed. The refresh token is saved to a durable
              host-mounted path (/app/logs/gmail_oauth_state-&lt;profile&gt;.json) and
              survives container restart.
            </p>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>
              <span className="text-muted-foreground">Profile: </span>
              <strong>{callbackProfile || profile}</strong>
            </div>
            {callbackAccount ? (
              <div>
                <span className="text-muted-foreground">Account: </span>
                <strong>{callbackAccount}</strong>
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2 pt-3">
              <Button onClick={() => navigate("/mailbox-workspace")}>Continue to Mailbox Workspace</Button>
              <Button variant="secondary" onClick={() => navigate("/search-retrieve")}>
                Search emails
              </Button>
              <Button variant="ghost" onClick={dismissCallback}>Dismiss</Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {callbackStatus === "error" ? (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardHeader>
            <h2 className="text-lg font-semibold text-destructive">
              ✗ Gmail OAuth failed
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
              <Button variant="secondary" onClick={dismissCallback}>Dismiss and retry</Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {setupUnavailable ? (
        <Card className="border-input bg-muted/30">
          <CardHeader>
            <h2 className="text-lg font-semibold">Gmail self-service setup not enabled</h2>
            <p className="text-sm text-muted-foreground">
              The Gmail OAuth self-service setup capability is not enabled on this
              deployment. Existing Gmail/IMAP profiles continue to work through the
              Channels page, MCP tools, A2A skills, and the Mailbox Workspace.
            </p>
          </CardHeader>
        </Card>
      ) : isConnected ? (
        <Card className="border-green-500/40 bg-green-500/5">
          <CardHeader>
            <h2 className="text-lg font-semibold text-green-700 dark:text-green-400">
              ✓ Connected
            </h2>
            <p className="text-sm text-muted-foreground">
              Profile <strong>{profile}</strong> is authenticated against Gmail.
              Use this profile via the MCP tools, A2A skills, or Mailbox Workspace.
            </p>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {accountEmail ? (
              <div>
                <span className="text-muted-foreground">Account: </span>
                <strong>{accountEmail}</strong>
              </div>
            ) : null}
            <div>
              <span className="text-muted-foreground">IMAP host: </span>
              <code>{imapHost}</code>
            </div>
            <div>
              <span className="text-muted-foreground">IMAP port: </span>
              <code>{imapPort}</code>
            </div>
            <div>
              <span className="text-muted-foreground">Folder: </span>
              <code>{imapFolder}</code>
            </div>
            <div>
              <span className="text-muted-foreground">OAuth scope: </span>
              <code className="text-xs">{oauthScope}</code>
            </div>
            <div>
              <span className="text-muted-foreground">Redirect URI: </span>
              <code className="text-xs">{redirectUri}</code>
            </div>
            {status?.token_obtained_at ? (
              <div>
                <span className="text-muted-foreground">Token obtained at: </span>
                <code className="text-xs">{status.token_obtained_at}</code>
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2 pt-3">
              <Button onClick={() => navigate("/mailbox-workspace")}>Open Mailbox</Button>
              <Button variant="secondary" onClick={() => navigate("/mcp-console")}>Open MCP console</Button>
              <Button
                variant="destructive"
                onClick={() => {
                  // Disconnect = navigate to the existing server-rendered admin
                  // form which already handles re-authorisation.
                  window.location.assign("/admin/gmail-setup");
                }}
              >
                Disconnect &amp; re-authorise
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">OAuth setup</h2>
            <p className="text-sm text-muted-foreground">
              Configure Gmail OAuth via backend route
              <code className="mx-1">/admin/gmail-setup</code>.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border border-input bg-muted/40 p-3 text-sm space-y-2">
              <p className="font-medium">Setup steps</p>
              <ol className="list-decimal pl-5 space-y-1 text-muted-foreground">
                <li>
                  In Google Cloud Console, register an OAuth 2.0 Web Client and add this redirect URI
                  to its <em>Authorised redirect URIs</em>:
                  <code className="mx-1 break-all">{redirectUri}</code>
                </li>
                <li>
                  Enable the Gmail IMAP API on the OAuth consent screen with scope
                  <code className="mx-1">{oauthScope}</code>.
                </li>
                <li>
                  Use the admin form at <code>/admin/gmail-setup</code> to enter your client ID,
                  client secret, redirect URI, and start the OAuth flow.
                </li>
                <li>
                  After Google consent, you will be redirected back here with status=success and
                  the Connected card above will appear.
                </li>
              </ol>
              <p className="text-xs text-muted-foreground">
                The refresh token is stored under
                <code className="mx-1">/app/logs/gmail_oauth_state-&lt;profile&gt;.json</code>
                (host-mounted; survives container restart). Client secret is also stored there.
                Permissions are 0600.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-muted-foreground">OAuth scope</div>
                <code className="break-all">{oauthScope}</code>
              </div>
              <div>
                <div className="text-muted-foreground">IMAP host</div>
                <code>{imapHost}</code>
              </div>
              <div>
                <div className="text-muted-foreground">IMAP port</div>
                <code>{imapPort}</code>
              </div>
              <div>
                <div className="text-muted-foreground">Folder</div>
                <code>{imapFolder}</code>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <Button onClick={() => void startOAuth()} disabled={startingOAuth}>
                {startingOAuth ? "Redirecting to Google…" : "Authenticate with Google"}
              </Button>
              <Button
                variant="secondary"
                onClick={() => window.location.assign("/admin/gmail-setup")}
              >
                Edit OAuth client (advanced)
              </Button>
              <Button variant="secondary" onClick={() => void loadStatus()} disabled={loading}>
                Reload status
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
