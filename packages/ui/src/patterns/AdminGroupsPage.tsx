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

// @cloud-dog/ui — AdminGroupsPage pattern (standard group admin template).

import * as React from "react";
import { cn } from "../utils/cn";
import { Button } from "../components/button/Button";
import { DataTable } from "../components/table/DataTable";
import type { DataColumn } from "../components/table/DataTable";
import { Dialog } from "../components/dialog/Dialog";

export type AdminGroupsPageProps<T = Record<string, unknown>> = Readonly<{
  groups: T[];
  columns?: DataColumn<T>[];
  onCreateGroup: () => void;
  onDeleteGroup: (group: T) => void;
  onEditGroup?: (group: T) => void;
  getRowId?: (group: T) => string;
  title?: string;
  className?: string;
  selectable?: boolean;
  bulkActions?: Array<{ label: string; action: string }>;
  onBulkAction?: (action: string, ids: string[]) => void;
}>;

const defaultColumns: DataColumn<Record<string, unknown>>[] = [
  { id: "name", header: "Name", sortable: true, sortValue: (r) => String(r.name ?? ""), cell: (r) => String(r.name ?? "") },
  { id: "description", header: "Description", sortable: true, sortValue: (r) => String(r.description ?? ""), cell: (r) => String(r.description ?? "") },
  { id: "memberCount", header: "Members", sortable: true, sortValue: (r) => Number(r.memberCount ?? r.member_count ?? 0), cell: (r) => String(r.memberCount ?? r.member_count ?? 0) },
  { id: "roles", header: "Roles", sortable: true, sortValue: (r) => String(Array.isArray(r.roles) ? r.roles.join(",") : r.roles ?? ""), cell: (r) => String(Array.isArray(r.roles) ? r.roles.join(", ") : r.roles ?? "") },
  { id: "status", header: "Status", sortable: true, sortValue: (r) => String(r.status ?? "active"), cell: (r) => String(r.status ?? "active") },
];

export function AdminGroupsPage<T extends Record<string, unknown>>(props: AdminGroupsPageProps<T>) {
  const columns = (props.columns ?? defaultColumns) as DataColumn<T>[];
  const [confirmDelete, setConfirmDelete] = React.useState<T | null>(null);

  const actionColumn: DataColumn<T> = {
    id: "__actions",
    header: "Actions",
    cell: (row) => (
      <div className="flex items-center gap-1">
        {props.onEditGroup ? (
          <Button variant="ghost" size="sm" onClick={() => props.onEditGroup!(row)}>
            Edit
          </Button>
        ) : null}
        <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(row)}>
          Delete
        </Button>
      </div>
    ),
  };

  return (
    <div className={cn("space-y-4", props.className)}>
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{props.title ?? "Groups"}</h1>
        <Button size="sm" onClick={props.onCreateGroup}>
          Create Group
        </Button>
      </header>

      <div className="rounded-md border bg-background">
        <DataTable
          columns={[...columns, actionColumn]}
          rows={props.groups}
          emptyMessage="No groups found."
          getRowId={props.getRowId}
          selectable={props.selectable}
          bulkActions={props.bulkActions}
          onBulkAction={props.onBulkAction}
        />
      </div>

      <Dialog open={!!confirmDelete} onOpenChange={(o) => { if (!o) setConfirmDelete(null); }} label="Confirm delete">
        <div className="space-y-4">
          <p className="text-sm">Are you sure you want to delete this group?</p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                if (confirmDelete) props.onDeleteGroup(confirmDelete);
                setConfirmDelete(null);
              }}
            >
              Delete
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
