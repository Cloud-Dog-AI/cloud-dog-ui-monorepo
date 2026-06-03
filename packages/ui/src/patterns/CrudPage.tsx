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

// @cloud-dog/ui — CrudPage pattern (table + toolbar + detail drawer).

import * as React from "react";
import { cn } from "../utils/cn";
import { Button } from "../components/button/Button";
import { Input } from "../components/input/Input";
import { Checkbox } from "../components/input/Checkbox";
import { Sheet } from "../components/dialog/Sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/table/Table";

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
  className?: string;
}>;

export function CrudPage<T>(props: CrudPageProps<T>) {
  const [query, setQuery] = React.useState("");
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [detailId, setDetailId] = React.useState<string | null>(null);
  const selectAllRef = React.useRef<HTMLInputElement>(null);

  const rows = React.useMemo(() => {
    if (!query.trim()) return props.rows;
    const q = query.toLowerCase();
    return props.rows.filter((row) => {
      const text = props.columns
        .map((c) => {
          const rendered = c.cell(row);
          return typeof rendered === "string" ? rendered : "";
        })
        .join(" ")
        .toLowerCase();
      return text.includes(q);
    });
  }, [props.rows, props.columns, query]);

  const allIds = React.useMemo(() => rows.map((r) => props.getRowId(r)), [rows, props]);
  const selectedIds = React.useMemo(() => Array.from(selected), [selected]);
  const hasAny = selected.size > 0;
  const isAll = allIds.length > 0 && selected.size === allIds.length;
  const isIndeterminate = hasAny && !isAll;

  const toggleAll = (checked: boolean) => {
    setSelected(() => (checked ? new Set(allIds) : new Set()));
  };

  const toggleOne = (id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const openDetail = (id: string) => {
    if (!props.renderDetail) return;
    setDetailId(id);
  };

  const detailRow = React.useMemo(() => {
    if (!detailId) return null;
    return props.rows.find((r) => props.getRowId(r) === detailId) ?? null;
  }, [detailId, props.rows, props]);

  React.useEffect(() => {
    if (!selectAllRef.current) return;
    // HTMLInputElement.indeterminate is a runtime-only flag.
    selectAllRef.current.indeterminate = isIndeterminate;
  }, [isIndeterminate]);

  return (
    <div className={cn("space-y-4", props.className)}>
      <header className="flex items-center gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold truncate">{props.title}</h1>
          <div className="text-sm text-muted-foreground">{rows.length} items</div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            aria-label="Search"
            className="w-64"
          />
          {(props.bulkActions ?? []).map((a) => (
            <Button
              key={a.label}
              variant="secondary"
              size="sm"
              onClick={() => a.onRun(selectedIds)}
              disabled={selectedIds.length === 0}
            >
              {a.label}
            </Button>
          ))}
        </div>
      </header>

      <div className="rounded-md border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  ref={selectAllRef}
                  aria-label="Select all"
                  checked={isAll}
                  onChange={(e) => toggleAll(e.currentTarget.checked)}
                />
              </TableHead>
              {props.columns.map((c) => (
                <TableHead key={c.id}>{c.header}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const id = props.getRowId(row);
              return (
                <TableRow
                  key={id}
                  className={cn(props.renderDetail ? "cursor-pointer" : "")}
                  onClick={() => openDetail(id)}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      aria-label={`Select ${id}`}
                      checked={selected.has(id)}
                      onChange={(e) => toggleOne(id, e.currentTarget.checked)}
                    />
                  </TableCell>
                  {props.columns.map((c) => (
                    <TableCell key={c.id}>{c.cell(row)}</TableCell>
                  ))}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {props.renderDetail ? (
        <Sheet
          open={!!detailId}
          onOpenChange={(o) => setDetailId(o ? detailId : null)}
          side="right"
        >
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="text-sm font-semibold">Detail</div>
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto"
                onClick={() => setDetailId(null)}
              >
                Close
              </Button>
            </div>
            {detailRow ? (
              props.renderDetail(detailRow)
            ) : (
              <div className="text-sm">Not found.</div>
            )}
          </div>
        </Sheet>
      ) : null}
    </div>
  );
}
