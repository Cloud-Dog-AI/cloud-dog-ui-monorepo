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

// @cloud-dog/ui — CrudPage pattern (DataTable + shared CRUD detail dialog).

import * as React from "react";
import { cn } from "../utils/cn";
import { Input } from "../components/input/Input";
import {
  DataTable,
  createDataTableActionColumn,
} from "../components/table/DataTable";
import type { BulkAction, DataColumn } from "../components/table/DataTable";
import { EntityDialog } from "./EntityDialog";
import {
  CRUD_ACTION_LABELS,
  CRUD_EXTENSION_SLOT_TEST_ID,
  CRUD_TABLE_MESSAGES,
  crudDialogTitle,
  singularizeEntityName,
} from "./CrudVocabulary";

export type CrudColumn<T> = Readonly<{
  id: string;
  header: string;
  cell: (row: T) => React.ReactNode;
}>;

export type CrudBulkAction = Readonly<{
  label: string;
  onRun: (selectedIds: string[]) => void;
}>;

export type CrudPageProps<T> = Readonly<{
  title: string;
  rows: T[];
  columns: CrudColumn<T>[];
  getRowId: (row: T) => string;
  bulkActions?: CrudBulkAction[];
  renderDetail?: (row: T) => React.ReactNode;
  detailTitle?: (row: T) => string;
  entityName?: string;
  emptyMessage?: string;
  searchPlaceholder?: string;
  tableId?: string;
  pageSize?: number;
  columnPickerEnabled?: boolean;
  extensionSlot?: React.ReactNode;
  className?: string;
}>;

export function CrudPage<T>(props: CrudPageProps<T>) {
  const {
    title,
    rows,
    columns,
    getRowId,
    bulkActions = [],
    renderDetail,
    detailTitle,
    entityName = singularizeEntityName(title),
    emptyMessage = CRUD_TABLE_MESSAGES.empty,
    searchPlaceholder = "Search",
    tableId = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-crud`,
    pageSize = 25,
    columnPickerEnabled = true,
    extensionSlot,
    className,
  } = props;
  const [query, setQuery] = React.useState("");
  const [detailId, setDetailId] = React.useState<string | null>(null);
  const [page, setPage] = React.useState(1);
  const [currentPageSize, setCurrentPageSize] = React.useState(pageSize);

  React.useEffect(() => {
    setPage(1);
  }, [query, rows]);

  const filteredRows = React.useMemo(() => {
    if (!query.trim()) return rows;
    const q = query.toLowerCase();
    return rows.filter((row) => {
      const text = columns
        .map((c) => {
          const rendered = c.cell(row);
          return typeof rendered === "string" ? rendered : "";
        })
        .join(" ")
        .toLowerCase();
      return text.includes(q);
    });
  }, [rows, columns, query]);

  const openDetail = React.useCallback((id: string) => {
    if (!renderDetail) return;
    setDetailId(id);
  }, [renderDetail]);

  const detailRow = React.useMemo(() => {
    if (!detailId) return null;
    return rows.find((row) => getRowId(row) === detailId) ?? null;
  }, [detailId, rows, getRowId]);

  const tableColumns = React.useMemo((): DataColumn<T>[] => {
    const baseColumns: DataColumn<T>[] = columns.map((column) => ({
      ...column,
      cell: renderDetail
        ? (row) => (
            <button
              type="button"
              className="w-full text-left text-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => openDetail(getRowId(row))}
            >
              {column.cell(row)}
            </button>
          )
        : column.cell,
      sortable: true,
    }));
    if (!renderDetail) return baseColumns;
    return [
      ...baseColumns,
      createDataTableActionColumn<T>((row) => [
        {
          id: "view",
          label: CRUD_ACTION_LABELS.view,
          onClick: () => openDetail(getRowId(row)),
        },
      ]),
    ];
  }, [columns, getRowId, openDetail, renderDetail]);

  const tableBulkActions = React.useMemo(
    (): BulkAction[] => bulkActions.map((action) => ({ label: action.label, action: action.label })),
    [bulkActions],
  );

  const runBulkAction = (actionLabel: string, selectedIds: string[]) => {
    bulkActions.find((action) => action.label === actionLabel)?.onRun(selectedIds);
  };

  return (
    <div className={cn("space-y-4", className)}>
      <header className="flex items-center gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold truncate">{title}</h1>
          <div className="text-sm text-muted-foreground">{filteredRows.length} items</div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            aria-label={`Search ${title}`}
            className="w-64"
          />
        </div>
      </header>

      <DataTable
        rows={filteredRows}
        columns={tableColumns}
        getRowId={getRowId}
        getSelectionLabel={(row) => `Select ${getRowId(row)}`}
        emptyMessage={query.trim() ? CRUD_TABLE_MESSAGES.noSearchResults : emptyMessage}
        selectable={bulkActions.length > 0}
        bulkActions={tableBulkActions}
        onBulkAction={runBulkAction}
        tableId={tableId}
        page={page}
        pageSize={currentPageSize}
        onPageChange={setPage}
        onPageSizeChange={setCurrentPageSize}
        columnPickerEnabled={columnPickerEnabled}
      />

      {extensionSlot ? (
        <div data-testid={CRUD_EXTENSION_SLOT_TEST_ID}>{extensionSlot}</div>
      ) : null}

      {renderDetail ? (
        <EntityDialog
          open={!!detailId}
          onOpenChange={(open) => setDetailId(open ? detailId : null)}
          title={detailRow && detailTitle ? detailTitle(detailRow) : crudDialogTitle(entityName, "view")}
          body={detailRow ? renderDetail(detailRow) : <div className="text-sm">Not found.</div>}
        />
      ) : null}
    </div>
  );
}
