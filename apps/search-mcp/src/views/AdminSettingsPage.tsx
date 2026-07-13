// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
// Licensed under the Apache License 2.0
import * as React from "react";
import { Card, CardContent, CardHeader } from "@cloud-dog/ui";
import { useSearchState } from "../state/AppState";
import { PageHeader } from "../lib/ui";

export function AdminSettingsPage() {
  const { tenant, appVersion } = useSearchState();
  return (
    <div className="space-y-6">
      <PageHeader title="Tenant Settings" version={appVersion} description="Per-tenant search-profile administration (RBAC-gated; admin only)." />
      <Card><CardHeader><h2 className="text-lg font-semibold">Tenant</h2></CardHeader>
        <CardContent className="text-sm text-muted-foreground">Active tenant: <span className="font-mono">{tenant}</span>. Search profiles, per-endpoint config and budgets are tenant-scoped (FR-073).</CardContent></Card>
    </div>
  );
}
