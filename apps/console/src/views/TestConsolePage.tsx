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

// @cloud-dog/app-console — Test Console view.

import * as React from 'react';
import { Button, Card, CardContent, CardHeader, Input, Label, Select, Textarea } from '@cloud-dog/ui';
import { createApiClient } from '@cloud-dog/api-client';
import { useConfig } from '@cloud-dog/config';
import { useAuth } from '@cloud-dog/auth';

type Target = 'api' | 'mcp' | 'a2a';

export function TestConsolePage() {
  const cfg = useConfig<{
    API_BASE_URL: string;
    MCP_BASE_URL?: string;
    A2A_BASE_URL?: string;
  }>();
  const auth = useAuth();
  const [target, setTarget] = React.useState<Target>('api');
  const [path, setPath] = React.useState('/health');
  const [method, setMethod] = React.useState<'GET'|'POST'>('GET');
  const [body, setBody] = React.useState('{"ping":"pong"}');
  const [out, setOut] = React.useState<string>('');
  const [busy, setBusy] = React.useState(false);

  const baseUrl =
    target === 'api'
      ? cfg.API_BASE_URL
      : target === 'mcp'
      ? (cfg.MCP_BASE_URL ?? cfg.API_BASE_URL)
      : (cfg.A2A_BASE_URL ?? cfg.API_BASE_URL);

  const client = React.useMemo(
    () =>
      createApiClient({
        baseUrl,
        getAccessToken: () => auth.getAccessToken(),
        refreshAccessToken: () => auth.refresh(),
      }),
    [baseUrl, auth]
  );

  async function run() {
    setBusy(true);
    setOut('');
    try {
      if (method === 'GET') {
        const data = await client.get<any>(path);
        setOut(JSON.stringify({ ok: true, data }, null, 2));
      } else {
        const parsed = body ? JSON.parse(body) : {};
        const data = await client.post<any>(path, parsed);
        setOut(JSON.stringify({ ok: true, data }, null, 2));
      }
    } catch (e: any) {
      setOut(JSON.stringify({ ok: false, error: e?.message ?? String(e), details: e?.options ?? undefined }, null, 2));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <h1 className="text-lg font-semibold">Test Console</h1>
          <p className="text-sm text-muted-foreground">Build and execute requests against API/MCP/A2A targets.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label htmlFor="tc-target">Target</Label>
              <Select id="tc-target" value={target} onChange={(e) => setTarget(e.target.value as Target)}>
                <option value="api">API</option>
                <option value="mcp">MCP</option>
                <option value="a2a">A2A</option>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="tc-method">Method</Label>
              <Select id="tc-method" value={method} onChange={(e) => setMethod(e.target.value as any)}>
                <option value="GET">GET</option>
                <option value="POST">POST</option>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="tc-path">Path</Label>
              <Input id="tc-path" value={path} onChange={(e) => setPath(e.target.value)} />
            </div>
          </div>

          {method !== 'GET' && (
            <div className="space-y-1">
              <Label htmlFor="tc-body">Body (JSON)</Label>
              <Textarea
                id="tc-body"
                className="h-40 font-mono text-xs"
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
            </div>
          )}

          <div className="flex gap-2">
            <Button onClick={run} loading={busy}>
              Run
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Response</h2>
          <p className="text-sm text-muted-foreground">Status, correlation ID and body.</p>
        </CardHeader>
        <CardContent>
          <pre className="min-h-64 whitespace-pre-wrap rounded-md border border-border bg-muted/30 p-3 text-xs">
            {out || '—'}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
