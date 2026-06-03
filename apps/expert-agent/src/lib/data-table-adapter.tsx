import * as React from 'react';
import {
  Button,
  Card, CardContent, CardHeader,
  DataTable,
  EntityDialog,
  FileBrowser, FileDropZone,
  Input,
  type DataColumn,
  type EntityDialogFormProps,
  type FileItem, type FolderNode,
} from '@cloud-dog/ui';

// Re-export shared types under the names the view files expect.
export type { DataColumn };
export type AdoptionColumn<T> = DataColumn<T> & Readonly<{ hiddenByDefault?: boolean }>;
export type RowAction<T> = Readonly<{ label: string; onClick: (row: T) => void | Promise<void>; variant?: 'default' | 'secondary' | 'destructive' | 'ghost' }>;
export type BulkAction<T> = Readonly<{ label: string; onClick: (rows: T[]) => void | Promise<void>; variant?: 'default' | 'secondary' | 'destructive' | 'ghost' }>;

// --- Utility helpers (same signatures as adopted.tsx) ---

export function formatDate(value: string | null | undefined): string {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('en-GB');
}

export function formatDuration(ms: number | null | undefined): string {
  if (typeof ms !== 'number' || Number.isNaN(ms)) return 'N/A';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

export function exportRows(filename: string, rows: unknown[]) {
  const blob = new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' });
  const href = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(href);
}

// --- Thin AppDataTable wrapper (title + refresh + row-actions column) ---

export function AppDataTable<T>(props: {
  title: string;
  rows: T[];
  getRowId: (row: T) => string;
  columns: AdoptionColumn<T>[];
  rowActions?: RowAction<T>[];
  bulkActions?: BulkAction<T>[];
  emptyMessage: string;
  onRefresh?: () => void | Promise<void>;
  itemLabel?: string;
  storageKey?: string;
  defaultSort?: Readonly<{ columnId: string; direction: 'asc' | 'desc' }>;
  searchText?: (row: T) => string;
}) {
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(25);
  const [search, setSearch] = React.useState('');

  // Map AdoptionColumns to DataColumns, appending an actions column when needed.
  const columns: DataColumn<T>[] = React.useMemo(() => {
    const base: DataColumn<T>[] = props.columns.map((c) => ({ id: c.id, header: c.header, cell: c.cell, sortable: c.sortable, sortValue: c.sortValue }));
    if (props.rowActions?.length) {
      base.push({
        id: '__actions',
        header: 'Actions',
        cell: (row) => (
          <div className="flex flex-wrap gap-2">
            {props.rowActions!.map((a) => (
              <Button key={a.label} type="button" size="sm" variant={a.variant ?? 'secondary'} className={a.variant === 'destructive' ? 'text-white' : ''} onClick={() => void a.onClick(row)}>{a.label}</Button>
            ))}
          </div>
        ),
      });
    }
    return base;
  }, [props.columns, props.rowActions]);

  const filteredRows = React.useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return props.rows;
    return props.rows.filter((row) =>
      (props.searchText?.(row) ?? '').toLowerCase().includes(query)
    );
  }, [props.rows, props.searchText, search]);

  const bulkActions = React.useMemo(
    () => [
      ...(props.bulkActions ?? []).map((action, index) => ({
        label: action.label,
        action: `bulk-${index}`,
      })),
      { label: 'Export selected', action: 'export-selected' },
    ],
    [props.bulkActions]
  );

  const rowMap = React.useMemo(
    () => new Map(props.rows.map((row) => [props.getRowId(row), row])),
    [props.getRowId, props.rows]
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{props.title}</h2>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              className="h-9 w-64"
              aria-label={`Search ${props.itemLabel ?? 'rows'}`}
              placeholder={`Search ${props.itemLabel ?? 'rows'}`}
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
            {props.onRefresh ? <Button type="button" variant="secondary" onClick={() => void props.onRefresh?.()}>Refresh</Button> : null}
            <Button type="button" variant="secondary" onClick={() => exportRows(`${props.title.toLowerCase().replace(/\s+/g, '-')}.json`, props.rows)}>Export</Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <DataTable
          columns={columns}
          rows={filteredRows}
          totalRows={props.rows.length}
          getRowId={props.getRowId}
          emptyMessage={props.emptyMessage}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          selectable={bulkActions.length > 0}
          bulkActions={bulkActions}
          onBulkAction={(action, selectedIds) => {
            const selectedRows = selectedIds
              .map((id) => rowMap.get(id))
              .filter((row): row is T => Boolean(row));
            if (action === 'export-selected') {
              exportRows(
                `${props.title.toLowerCase().replace(/\s+/g, '-')}-selected.json`,
                selectedRows
              );
              return;
            }
            const bulkActionIndex = Number(action.replace('bulk-', ''));
            if (Number.isNaN(bulkActionIndex)) return;
            void props.bulkActions?.[bulkActionIndex]?.onClick(selectedRows);
          }}
          columnPickerEnabled
          tableId={props.storageKey ?? `expert-agent:${props.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
        />
      </CardContent>
    </Card>
  );
}

// --- CrudEntityDialog: thin delegate to shared EntityDialog ---

export function CrudEntityDialog(props: Omit<EntityDialogFormProps, 'onOpenChange'> & { onCancel: () => void }) {
  return <EntityDialog {...props} onOpenChange={(open) => { if (!open) props.onCancel(); }} />;
}

// --- FileBrowserSection: same shape as adopted.tsx ---

export function FileBrowserSection(props: {
  title: string;
  files: Array<{ name: string; path: string; size?: string; modified?: string }>;
  onUpload?: (files: File[]) => void;
}) {
  const [currentPath, setCurrentPath] = React.useState('/');
  const browserFiles = React.useMemo<FileItem[]>(() => props.files.filter((f) => f.path.startsWith(currentPath)).map((f) => ({ name: f.name, path: f.path, size: f.size, modified: f.modified })), [currentPath, props.files]);
  const folders = React.useMemo<FolderNode[]>(() => {
    const root: FolderNode = { name: 'root', path: '/', children: [] };
    const map = new Map<string, FolderNode>([['/', root]]);
    for (const file of props.files) {
      const segs = file.path.split('/').filter(Boolean);
      let cur = '/';
      for (let i = 0; i < Math.max(segs.length - 1, 0); i++) {
        const next = `${cur === '/' ? '' : cur}/${segs[i]}`;
        if (!map.has(next)) { const n: FolderNode = { name: segs[i], path: next, children: [] }; map.set(next, n); map.get(cur)?.children?.push(n); }
        cur = next;
      }
    }
    return [root];
  }, [props.files]);

  return (
    <Card>
      <CardHeader><h2 className="text-lg font-semibold">{props.title}</h2></CardHeader>
      <CardContent className="space-y-4">
        {props.onUpload ? <FileDropZone onDrop={props.onUpload} /> : null}
        <FileBrowser folders={folders} files={browserFiles} currentPath={currentPath} onNavigate={setCurrentPath} />
      </CardContent>
    </Card>
  );
}

// --- SearchBar (kept for backward compatibility) ---

export function SearchBar(props: { value: string; onChange: (value: string) => void; label: string }) {
  return (
    <label className="flex items-center gap-2 text-sm text-muted-foreground">
      <span>{props.label}</span>
      <Input className="rounded border bg-background px-2 py-1 text-sm" value={props.value} onChange={(e) => props.onChange(e.target.value)} />
    </label>
  );
}
