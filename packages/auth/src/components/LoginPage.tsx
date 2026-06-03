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

// @cloud-dog/auth — Canonical cross-app login page.

import * as React from "react";
import { brand, BRAND_NAME, BRAND_TAGLINE } from "@cloud-dog/tokens";
import { Button, Card, CardContent, CardHeader, Input, Label } from "@cloud-dog/ui";
import type { AuthMode } from "../types/user";
import { useAuth } from "../context/useAuth";

type SecondaryField = Readonly<{
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoComplete?: string;
}>;

export type LoginPageProps = Readonly<{
  appName?: string;
  mode?: AuthMode;
  title?: string;
  description?: string;
  apiKeyValue?: string;
  onApiKeyChange?: (value: string) => void;
  onApiKeySubmit?: (payload: { apiKey: string; secondaryValue?: string }) => Promise<void>;
  oidcButtonLabel?: string;
  secondaryField?: SecondaryField;
  error?: string | null;
}>;

export function LoginPage(props: LoginPageProps) {
  const auth = useAuth();
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [formError, setFormError] = React.useState<string | null>(null);
  const mode = props.mode ?? "cookie";
  const apiKeyValue = props.apiKeyValue ?? "";
  const description =
    props.description ??
    (mode === "oidc"
      ? "Continue with your organisation single sign-on."
      : mode === "api_key"
        ? "Use your service API key to access the platform."
        : "Use your organisation account.");

  const onCookieSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    try {
      await auth.login({ username, password });
    } catch {
      setFormError(auth.error ?? "Login failed.");
    }
  };

  const onApiKeySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const apiKey = apiKeyValue.trim();
    if (!apiKey) {
      setFormError("API key is required.");
      return;
    }
    try {
      if (props.onApiKeySubmit) {
        await props.onApiKeySubmit({ apiKey, secondaryValue: props.secondaryField?.value.trim() });
      } else {
        await auth.login({ apiKey });
      }
    } catch {
      setFormError(props.error ?? auth.error ?? "Login failed.");
    }
  };

  const onOidcStart = () => {
    setFormError(null);
    void auth.login({ oidc: true }).catch((e) => {
      setFormError(e instanceof Error ? e.message : "Failed to start sign-in.");
    });
  };

  const errorText = formError ?? props.error ?? auth.error ?? null;

  return (
    <div className="min-h-screen bg-muted/10">
      <header className="border-b border-border/70 bg-background/95 px-6 py-4 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-3">
          <img src={brand.logoPath} alt={BRAND_NAME} className="h-8 w-8" />
          <div>
            <div className="text-sm font-semibold tracking-tight text-foreground">
              {props.appName ?? BRAND_NAME}
            </div>
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              {BRAND_TAGLINE}
            </div>
          </div>
        </div>
      </header>
      <div className="grid min-h-[calc(100vh-4.5rem)] place-items-center p-4">
        <Card className="w-full max-w-md border-border/80 shadow-sm">
          <CardHeader className="space-y-4 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-border/70 bg-background shadow-sm">
              <img src={brand.logoPath} alt={BRAND_NAME} className="h-8 w-8" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">{BRAND_TAGLINE}</p>
              <h1 className="text-2xl font-semibold tracking-tight">{props.title ?? "Sign in"}</h1>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
          </CardHeader>
          <CardContent>
            {mode === "cookie" ? (
              <form onSubmit={onCookieSubmit} className="space-y-4" aria-describedby="login-errors">
                <div className="space-y-2">
                  <Label htmlFor="loginUsername">Username</Label>
                  <Input
                    id="loginUsername" name="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="loginPassword">Password</Label>
                  <Input
                    id="loginPassword" name="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                  />
                </div>
                <div id="login-errors" aria-live="polite" className="min-h-5 text-sm text-destructive">
                  {errorText}
                </div>
                <Button type="submit" loading={auth.isLoading} className="w-full">
                  Sign in
                </Button>
              </form>
            ) : null}

            {mode === "api_key" ? (
              <form onSubmit={onApiKeySubmit} className="space-y-4" aria-describedby="login-errors">
                <div className="space-y-2">
                  <Label htmlFor="api-key">API key</Label>
                  <Input
                    id="api-key"
                    value={apiKeyValue}
                    onChange={(e) => props.onApiKeyChange?.(e.target.value)}
                    placeholder="Enter API key"
                    autoComplete="off"
                    required
                  />
                </div>
                {props.secondaryField ? (
                  <div className="space-y-2">
                    <Label htmlFor={props.secondaryField.id}>{props.secondaryField.label}</Label>
                    <Input
                      id={props.secondaryField.id}
                      value={props.secondaryField.value}
                      onChange={(e) => props.secondaryField?.onChange(e.target.value)}
                      placeholder={props.secondaryField.placeholder}
                      autoComplete={props.secondaryField.autoComplete ?? "off"}
                    />
                  </div>
                ) : null}
                <div id="login-errors" aria-live="polite" className="min-h-5 text-sm text-destructive">
                  {errorText}
                </div>
                <Button type="submit" loading={auth.isLoading} className="w-full" disabled={!apiKeyValue.trim()}>
                  Sign in
                </Button>
              </form>
            ) : null}

            {mode === "oidc" ? (
              <div className="space-y-4">
                <Button type="button" onClick={onOidcStart} loading={auth.isLoading} className="w-full">
                  {props.oidcButtonLabel ?? "Continue with SSO"}
                </Button>
                <div id="login-errors" aria-live="polite" className="min-h-5 text-sm text-destructive">
                  {errorText}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
