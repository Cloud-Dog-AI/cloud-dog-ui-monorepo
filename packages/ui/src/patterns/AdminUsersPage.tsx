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

// @cloud-dog/ui — AdminUsersPage pattern (standard user admin template).

import * as React from "react";
import { cn } from "../utils/cn";
import { Button } from "../components/button/Button";
import { DataTable } from "../components/table/DataTable";
import type { DataColumn } from "../components/table/DataTable";
import { Dialog } from "../components/dialog/Dialog";

export type AdminUsersPageProps<T = Record<string, unknown>> = Readonly<{
  users: T[];
  columns?: DataColumn<T>[];
  onCreateUser: () => void;
  onDeleteUser: (user: T) => void;
  onEditUser?: (user: T) => void;
  onToggleStatus?: (user: T) => void;
  onResetPassword?: (user: T) => void;
  getRowId?: (user: T) => string;
  title?: string;
  className?: string;
  selectable?: boolean;
  bulkActions?: Array<{ label: string; action: string }>;
  onBulkAction?: (action: string, ids: string[]) => void;
}>;

const defaultColumns: DataColumn<Record<string, unknown>>[] = [
  { id: "name", header: "Name", sortable: true, sortValue: (r) => String(r.name ?? r.username ?? r.display_name ?? ""), cell: (r) => String(r.name ?? r.username ?? r.display_name ?? "") },
  { id: "email", header: "Email", sortable: true, sortValue: (r) => String(r.email ?? ""), cell: (r) => String(r.email ?? "") },
  { id: "role", header: "Role", sortable: true, sortValue: (r) => String(r.role ?? ""), cell: (r) => String(r.role ?? "") },
  { id: "status", header: "Status", sortable: true, sortValue: (r) => String(r.status ?? (r.is_active ? "active" : "disabled")), cell: (r) => String(r.status ?? (r.is_active ? "active" : "disabled")) },
  { id: "createdAt", header: "Created", sortable: true, sortValue: (r) => String(r.created_at ?? r.createdAt ?? ""), cell: (r) => String(r.created_at ?? r.createdAt ?? "") },
];

export function AdminUsersPage<T extends Record<string, unknown>>(props: AdminUsersPageProps<T>) {
  const columns = (props.columns ?? defaultColumns) as DataColumn<T>[];
  const [confirmDelete, setConfirmDelete] = React.useState<T | null>(null);

  const actionColumn: DataColumn<T> = {
    id: "__actions",
    header: "Actions",
    cell: (row) => (
      <div className="flex items-center gap-1">
        {props.onEditUser ? (
          <Button variant="ghost" size="sm" onClick={() => props.onEditUser!(row)}>
            Edit
          </Button>
        ) : null}
        {props.onToggleStatus ? (
          <Button variant="ghost" size="sm" onClick={() => props.onToggleStatus!(row)}>
            Toggle
          </Button>
        ) : null}
        {props.onResetPassword ? (
          <Button variant="ghost" size="sm" onClick={() => props.onResetPassword!(row)}>
            Reset Password
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
        <h1 className="text-xl font-semibold">{props.title ?? "Users"}</h1>
        <Button size="sm" onClick={props.onCreateUser}>
          Create User
        </Button>
      </header>

      <div className="rounded-md border bg-background">
        <DataTable
          columns={[...columns, actionColumn]}
          rows={props.users}
          emptyMessage="No users found."
          getRowId={props.getRowId}
          selectable={props.selectable}
          bulkActions={props.bulkActions}
          onBulkAction={props.onBulkAction}
        />
      </div>

      <Dialog open={!!confirmDelete} onOpenChange={(o) => { if (!o) setConfirmDelete(null); }} label="Confirm delete">
        <div className="space-y-4">
          <p className="text-sm">Are you sure you want to delete this user?</p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                if (confirmDelete) props.onDeleteUser(confirmDelete);
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
