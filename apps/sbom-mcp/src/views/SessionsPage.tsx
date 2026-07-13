// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
// Licensed under the Apache License 2.0

import * as React from "react";
import { Card, CardContent, CardHeader, JsonExplorer } from "@cloud-dog/ui";
import { useAuth } from "@cloud-dog/auth";
import { useSbomState } from "../state/AppState";
import { PageHeader, StatusLine } from "../lib/ui";

export function SessionsPage() {
  const auth = useAuth();
  const { api, appVersion } = useSbomState();
  const [me, setMe] = React.useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const session = await api.currentSession();
        if (!cancelled) setMe(session);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Session"
        version={appVersion}
        description="Current authenticated session (cookie mode)."
      />
      <StatusLine loading={loading} error={error} />
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Identity</h2>
        </CardHeader>
        <CardContent className="text-sm">
          <ul>
            <li>
              <span className="text-muted-foreground">Authenticated:</span>{" "}
              {auth.isAuthenticated ? "yes" : "no"}
            </li>
            <li>
              <span className="text-muted-foreground">Display name:</span>{" "}
              {auth.user?.displayName ?? "—"}
            </li>
            <li>
              <span className="text-muted-foreground">Email:</span> {auth.user?.email ?? "—"}
            </li>
          </ul>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">/auth/me</h2>
        </CardHeader>
        <CardContent>
          {me ? (
            <JsonExplorer data={me} />
          ) : (
            <div className="text-sm text-muted-foreground">No session payload.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
