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

// @cloud-dog/ui — AdminApiKeysPage pattern (standard API key admin template).

import * as React from "react";
import { cn } from "../utils/cn";
import { Button } from "../components/button/Button";
import { DataTable } from "../components/table/DataTable";
import type { DataColumn } from "../components/table/DataTable";
import { Badge } from "../components/layout/Badge";
import { ConfirmDialog } from "../components/dialog/ConfirmDialog";

export type AdminApiKeysPageProps<T = Record<string, unknown>> = Readonly<{
  apiKeys: T[];
  columns?: DataColumn<T>[];
  onCreateKey: () => void;
  onRevokeKey: (key: T) => void;
  getRowId?: (key: T) => string;
  title?: string;
  className?: string;
  selectable?: boolean;
  bulkActions?: Array<{ label: string; action: string }>;
  onBulkAction?: (action: string, ids: string[]) => void;
  roleOptions?: string[];
  capabilityOptions?: string[];
}>;

const defaultColumns: DataColumn<Record<string, unknown>>[] = [
  { id: "name", header: "Name", sortable: true, sortValue: (r) => String(r.name ?? r.label ?? ""), cell: (r) => String(r.name ?? r.label ?? "") },
  { id: "prefix", header: "Key Prefix", sortable: true, sortValue: (r) => String(r.prefix ?? r.id ?? ""), cell: (r) => String(r.prefix ?? r.id ?? "") },
  { id: "owner", header: "Owner", sortable: true, sortValue: (r) => String(r.owner ?? r.user_id ?? ""), cell: (r) => String(r.owner ?? r.user_id ?? "") },
  { id: "scopes", header: "Scopes", sortable: true, sortValue: (r) => String(Array.isArray(r.scopes) ? r.scopes.join(",") : r.scopes ?? ""), cell: (r) => { const items = Array.isArray(r.scopes) ? r.scopes : String(r.scopes ?? "").split(",").map(s => s.trim()).filter(Boolean); return items.length ? <span className="flex flex-wrap gap-1">{items.map((s, i) => <Badge key={i} variant="secondary">{String(s)}</Badge>)}</span> : ""; } },
  { id: "status", header: "Status", sortable: true, sortValue: (r) => String(r.status ?? "active"), cell: (r) => String(r.status ?? "active") },
  { id: "createdAt", header: "Created", sortable: true, sortValue: (r) => String(r.createdAt ?? r.created_at ?? ""), cell: (r) => String(r.createdAt ?? r.created_at ?? "") },
];

export function AdminApiKeysPage<T extends Record<string, unknown>>(props: AdminApiKeysPageProps<T>) {
  const columns = (props.columns ?? defaultColumns) as DataColumn<T>[];
  const [confirmRevoke, setConfirmRevoke] = React.useState<T | null>(null);

  const actionColumn: DataColumn<T> = {
    id: "__actions",
    header: "Actions",
    cell: (row) => (
      <Button variant="ghost" size="sm" onClick={() => setConfirmRevoke(row)}>
        Revoke
      </Button>
    ),
  };

  return (
    <div className={cn("space-y-4", props.className)}>
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{props.title ?? "API Keys"}</h1>
        <Button size="sm" onClick={props.onCreateKey}>
          Create Key
        </Button>
      </header>

      <div className="rounded-md border bg-background">
        <DataTable
          columns={[...columns, actionColumn]}
          rows={props.apiKeys}
          emptyMessage="No API keys found."
          getRowId={props.getRowId}
          selectable={props.selectable}
          bulkActions={props.bulkActions}
          onBulkAction={props.onBulkAction}
        />
      </div>

      <ConfirmDialog
        open={!!confirmRevoke}
        onOpenChange={(o) => { if (!o) setConfirmRevoke(null); }}
        title="Revoke API Key"
        description="Are you sure you want to revoke this API key?"
        targetName={confirmRevoke ? String((confirmRevoke as Record<string, unknown>).name ?? (confirmRevoke as Record<string, unknown>).id ?? "") : undefined}
        confirmLabel="Revoke"
        onConfirm={() => {
          if (confirmRevoke) props.onRevokeKey(confirmRevoke);
          setConfirmRevoke(null);
        }}
      />
    </div>
  );
}
