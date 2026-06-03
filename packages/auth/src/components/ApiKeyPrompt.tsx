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

// @cloud-dog/auth — API key login prompt.

import * as React from "react";
import { Button, Input } from "@cloud-dog/ui";
import { useAuth } from "../context/useAuth";

export function ApiKeyPrompt(props: { title?: string }) {
  const auth = useAuth();
  const [apiKey, setApiKey] = React.useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await auth.login({ apiKey });
    setApiKey("");
  };

  return (
    <form onSubmit={submit} className="space-y-3" aria-label="API key sign-in">
      <div className="text-lg font-semibold">{props.title ?? "Sign in"}</div>

      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="api-key">
          API key
        </label>
        <Input
          id="api-key"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="Enter API key"
          autoComplete="off"
        />
      </div>

      <Button type="submit" disabled={!apiKey.trim() || auth.isLoading}>
        Sign in
      </Button>

      {auth.error ? (
        <div role="alert" className="text-sm text-destructive">
          {auth.error}
        </div>
      ) : null}
    </form>
  );
}
