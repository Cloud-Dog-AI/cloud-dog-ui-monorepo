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

// @cloud-dog/ui — DataTable: full-featured table with sorting, pagination,
// multi-select, bulk actions, and column picker.

import * as React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./Table";
import { Button } from "../button/Button";
import { Checkbox } from "../input/Checkbox";
import { Input } from "../input/Input";
import { cn } from "../../utils/cn";

/** Column definition for DataTable. */
export type DataColumn<T> = Readonly<{
  id: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  sortable?: boolean;
  sortValue?: (row: T) => string | number;
}>;

/** Bulk action descriptor. */
export type BulkAction = Readonly<{
  label: string;
  action: string;
}>;

/** Props for DataTable. All new features are optional and backward-compatible. */
export type DataTableProps<T> = Readonly<{
  columns: DataColumn<T>[];
  rows: T[];
  emptyMessage?: string;
  ariaLabel?: string;
  totalRows?: number;

  // Row identity (needed for selection). Falls back to array index.
  getRowId?: (row: T) => string;
  /** Accessible label for each row (used as aria-label to control the row's accessible name). */
  getRowName?: (row: T) => string;

  // Pagination
  page?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];

  // Multi-select + bulk actions
  selectable?: boolean;
  bulkActions?: BulkAction[];
  onBulkAction?: (action: string, selectedIds: string[]) => void;
  getSelectionLabel?: (row: T) => string;
  selectionColumnPosition?: "start" | "end";

  // Column picker
  columnPickerEnabled?: boolean;
  tableId?: string;

  className?: string;
}>;

const PAGE_SIZES = [10, 25, 50, 100];

function _defaultSortValue<T>(column: DataColumn<T>, row: T): string | number {
  const value = (row as Record<string, unknown>)[column.id];
  if (typeof value === "number" || typeof value === "string") {
    return value;
  }

  const rendered = column.cell(row);
  if (typeof rendered === "number" || typeof rendered === "string") {
    return rendered;
  }

  return "";
}

function _compareSortValues(a: string | number, b: string | number): number {
  if (typeof a === "number" && typeof b === "number") {
    return a - b;
  }
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
}

function _readVisibleCols(tableId: string, all: string[]): Set<string> {
  try {
    const raw = localStorage.getItem(`dt.cols.${tableId}`);
    if (raw) return new Set(JSON.parse(raw) as string[]);
  } catch { /* ignore */ }
  return new Set(all);
}

function _writeVisibleCols(tableId: string, ids: Set<string>): void {
  try {
    localStorage.setItem(`dt.cols.${tableId}`, JSON.stringify([...ids]));
  } catch { /* ignore */ }
}

/** PFW-2 Column picker with backdrop, outside-click, and Escape dismissal. */
function ColumnPicker<T>({
  open,
  onOpenChange,
  columns,
  visibleCols,
  onToggle,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  columns: DataColumn<T>[];
  visibleCols: Set<string>;
  onToggle: (id: string) => void;
}) {
  const menuRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onOpenChange(false);
        triggerRef.current?.focus();
      }
    };
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node) &&
          triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
        onOpenChange(false);
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open, onOpenChange]);

  return (
    <div className="relative">
      <Button
        ref={triggerRef}
        variant="secondary"
        size="sm"
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
        aria-haspopup="true"
      >
        Columns
      </Button>
      {open && (
        <div
          ref={menuRef}
          className="absolute right-0 top-full z-50 mt-1 min-w-[10rem] rounded-md border border-border bg-popover p-2 text-popover-foreground shadow-md"
          role="menu"
          aria-label="Visible columns"
        >
          <p className="px-2 py-1 text-xs font-medium text-muted-foreground">Visible columns</p>
          {columns.map((c) => (
            <label key={c.id} className="flex items-center gap-2 rounded px-2 py-1 text-sm text-foreground cursor-pointer hover:bg-muted hover:text-foreground">
              <Checkbox
                checked={visibleCols.has(c.id)}
                onChange={() => onToggle(c.id)}
                aria-label={`Show ${c.header}`}
              />
              {c.header}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export function DataTable<T>(props: DataTableProps<T>) {
  const {
    columns,
    rows,
    emptyMessage = "No results.",
    ariaLabel,
    totalRows,
    getRowId,
    getRowName,
    page: controlledPage,
    pageSize: controlledPageSize,
    onPageChange,
    onPageSizeChange,
    pageSizeOptions = PAGE_SIZES,
    selectable = false,
    bulkActions = [],
    onBulkAction,
    getSelectionLabel,
    selectionColumnPosition = "start",
    columnPickerEnabled = false,
    tableId = "default",
    className,
  } = props;

  // --- Sort state ---
  const [sort, setSort] = React.useState<{ id: string; dir: "asc" | "desc" } | null>(null);

  const toggleSort = (colId: string) => {
    setSort((s) => {
      if (!s || s.id !== colId) return { id: colId, dir: "asc" };
      if (s.dir === "asc") return { id: colId, dir: "desc" };
      return null; // third click clears
    });
  };

  const sorted = React.useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.id === sort.id);
    if (!col?.sortable) return rows;
    const r = [...rows];
    r.sort((a, b) => {
      const av = col.sortValue ? col.sortValue(a) : _defaultSortValue(col, a);
      const bv = col.sortValue ? col.sortValue(b) : _defaultSortValue(col, b);
      const comparison = _compareSortValues(av, bv);
      return sort.dir === "asc" ? comparison : -comparison;
    });
    return r;
  }, [rows, columns, sort]);

  // --- Pagination ---
  const pageSize = controlledPageSize ?? (rows.length || 1);
  const effectiveTotalRows = Math.max(totalRows ?? rows.length, rows.length);
  const totalPages = Math.max(1, Math.ceil(effectiveTotalRows / pageSize));
  const page = Math.min(Math.max(controlledPage ?? 1, 1), totalPages);
  const startIdx = (page - 1) * pageSize;
  const paged = onPageChange ? sorted.slice(startIdx, startIdx + pageSize) : sorted;
  const displayTotalRows = effectiveTotalRows;
  const displayStart = effectiveTotalRows ? startIdx + 1 : 0;
  const displayEnd = effectiveTotalRows ? Math.min(startIdx + paged.length, effectiveTotalRows) : 0;
  const [jumpInput, setJumpInput] = React.useState(String(page));

  React.useEffect(() => { setJumpInput(String(page)); }, [page]);

  const handleJump = (value: string = jumpInput) => {
    const n = parseInt(value, 10);
    if (n >= 1 && onPageChange) onPageChange(n);
  };

  // --- Column picker ---
  const allColIds = React.useMemo(() => columns.map((c) => c.id), [columns]);
  const [visibleCols, setVisibleCols] = React.useState<Set<string>>(
    () => columnPickerEnabled ? _readVisibleCols(tableId, allColIds) : new Set(allColIds),
  );
  const [pickerOpen, setPickerOpen] = React.useState(false);

  React.useEffect(() => {
    setVisibleCols((prev) => {
      if (!columnPickerEnabled) {
        return new Set(allColIds);
      }

      const saved = _readVisibleCols(tableId, allColIds);
      const savedIds = [...saved].filter((id) => allColIds.includes(id));
      if (savedIds.length > 0) {
        const next = new Set(savedIds);
        if (next.size !== saved.size) {
          _writeVisibleCols(tableId, next);
        }
        return next;
      }

      const next = new Set([...prev].filter((id) => allColIds.includes(id)));
      for (const id of allColIds) {
        next.add(id);
      }
      return next;
    });
  }, [allColIds, columnPickerEnabled, tableId]);

  const toggleCol = (id: string) => {
    setVisibleCols((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { if (next.size > 1) next.delete(id); } else next.add(id);
      if (columnPickerEnabled) _writeVisibleCols(tableId, next);
      return next;
    });
  };

  const visibleColumns = columns.filter((c) => visibleCols.has(c.id));

  // --- Multi-select ---
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const getId = (row: T, idx: number) => getRowId?.(row) ?? String(idx);
  const pageIds = paged.map((r, i) => getId(r, startIdx + i));
  const allSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const someSelected = selected.size > 0;

  const toggleAll = (checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of pageIds) { if (checked) next.add(id); else next.delete(id); }
      return next;
    });
  };
  const toggleOne = (id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id); else next.delete(id);
      return next;
    });
  };

  // --- Render ---
  const isEmpty = !rows.length;
  const renderSelectionHeader = () => (
    <TableHead className="w-10">
      <Checkbox checked={allSelected} aria-label="Select all rows on current page"
        onChange={(e) => toggleAll(e.currentTarget.checked)} />
    </TableHead>
  );
  const renderSelectionCell = (row: T, id: string) => (
    <TableCell>
      <Checkbox checked={selected.has(id)} aria-label={getSelectionLabel?.(row) ?? `Select ${id}`}
        onChange={(e) => toggleOne(id, e.currentTarget.checked)} />
    </TableCell>
  );

  return (
    <div className={cn("space-y-2", className)}>
      {/* Toolbar: bulk actions + column picker */}
      <div className="flex flex-wrap items-center gap-2">
        {selectable && someSelected && (
          <div className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-1 text-sm">
            <span>{selected.size} selected</span>
            {bulkActions.map((ba) => (
              <Button key={ba.action} variant="secondary" size="sm"
                onClick={() => onBulkAction?.(ba.action, [...selected])}>
                {ba.label}
              </Button>
            ))}
          </div>
        )}
        <div className="ml-auto flex items-center gap-2">
          {columnPickerEnabled && (
            <ColumnPicker
              open={pickerOpen}
              onOpenChange={setPickerOpen}
              columns={columns}
              visibleCols={visibleCols}
              onToggle={toggleCol}
            />
          )}
        </div>
      </div>

      {/* Table */}
      <Table aria-label={ariaLabel}>
        <TableHeader>
          <TableRow>
            {selectable && selectionColumnPosition === "start" ? renderSelectionHeader() : null}
            {visibleColumns.map((c) => (
              <TableHead key={c.id}>
                {c.sortable ? (
                  <button type="button" className="inline-flex items-center gap-1 text-sm font-medium hover:text-foreground"
                    onClick={() => toggleSort(c.id)}>
                    {c.header}
                    {sort?.id === c.id ? (
                      <span aria-label={sort.dir === "asc" ? "Sorted ascending" : "Sorted descending"}>
                        {sort.dir === "asc" ? "▲" : "▼"}
                      </span>
                    ) : null}
                  </button>
                ) : (
                  c.header
                )}
              </TableHead>
            ))}
            {selectable && selectionColumnPosition === "end" ? renderSelectionHeader() : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {isEmpty && emptyMessage ? (
            <TableRow>
              <TableCell colSpan={visibleColumns.length + (selectable ? 1 : 0)} className="text-center text-sm text-muted-foreground py-6">
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : null}
          {!isEmpty ? paged.map((row, idx) => {
            const id = getId(row, startIdx + idx);
            return (
              <TableRow key={id} aria-label={getRowName ? getRowName(row) : undefined}>
                {selectable && selectionColumnPosition === "start" ? renderSelectionCell(row, id) : null}
                {visibleColumns.map((c) => (
                  <TableCell key={c.id}>{c.cell(row)}</TableCell>
                ))}
                {selectable && selectionColumnPosition === "end" ? renderSelectionCell(row, id) : null}
              </TableRow>
            );
          }) : null}
        </TableBody>
      </Table>

      {/* Pagination */}
      {onPageChange && (
        <div className="flex flex-col gap-3 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
          <span className="whitespace-nowrap">
            Showing {displayStart}–{displayEnd} of {displayTotalRows}
          </span>
          <div className="ml-auto flex flex-nowrap items-center gap-3">
            {onPageSizeChange && (
              <select className="h-9 rounded-md border bg-background px-3 py-1 text-sm whitespace-nowrap" value={pageSize}
                aria-label="Items per page"
                onChange={(e) => { onPageSizeChange(Number(e.target.value)); onPageChange(1); }}>
                {pageSizeOptions.map((s) => <option key={s} value={s}>{s} per page</option>)}
              </select>
            )}
            <Button variant="secondary" size="sm" disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}>Previous</Button>
            <div className="flex flex-nowrap items-center gap-2 whitespace-nowrap">
              <span>Page</span>
              <Input className="h-9 w-16 text-center" value={jumpInput}
                aria-label="Page number"
                onChange={(e) => setJumpInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleJump(e.currentTarget.value); }}
                onBlur={(e) => handleJump(e.currentTarget.value)} />
              <span className="whitespace-nowrap">of {totalPages}</span>
            </div>
            <Button variant="secondary" size="sm" disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}
