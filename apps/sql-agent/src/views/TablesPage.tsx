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

// @cloud-dog/app-sql-agent — Tables inventory and schema workspace.

// Covers: FR-60
// Covers: FR-98
// Covers: FR-99

import * as React from 'react';
import { useAuth } from '@cloud-dog/auth';
import { useConfig } from '@cloud-dog/config';
import { Button, DataTable, JsonExplorer, type DataColumn } from '@cloud-dog/ui';
import {
  DataList,
  EmptyState,
  ErrorState,
  LoadingState,
  PageFrame,
  PanelCard,
  downloadJsonFile,
  extractContextFields,
  extractSampleRows,
  getTableName,
  normaliseContextTables,
  requestJson,
  safeStringify,
  type ContextFieldRecord,
  type GenericRecord,
  useApiResource,
} from '../lib/sqlAgentApi';

type AppRuntimeConfig = {
  API_BASE_URL: string;
};

type TablesResponse = {
  tables?: Array<Record<string, unknown>>;
  success?: boolean;
};

type ContextResponse = {
  tables?: unknown;
};

type TableRecord = {
  name?: string;
  description?: string;
  title?: string;
  record_count?: number;
  field_count?: number;
  fields?: Array<Record<string, unknown>>;
};

type ActionResult = {
  success?: boolean;
  message?: string;
  error?: string;
};

export function TablesPage() {
  const auth = useAuth();
  const cfg = useConfig<AppRuntimeConfig>();
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);
  const [fieldPage, setFieldPage] = React.useState(1);
  const [fieldPageSize, setFieldPageSize] = React.useState(10);
  const [selectedTableName, setSelectedTableName] = React.useState('');
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [actionMessage, setActionMessage] = React.useState<string | null>(null);

  const tables = useApiResource<TablesResponse>(
    () => requestJson(cfg.API_BASE_URL, '/api/v1/tables'),
    [cfg.API_BASE_URL],
  );
  const context = useApiResource<ContextResponse>(
    () => requestJson(cfg.API_BASE_URL, '/api/v1/context/full'),
    [cfg.API_BASE_URL],
  );

  const rows = (tables.data?.tables ?? []) as TableRecord[];
  const contextTables = React.useMemo(() => normaliseContextTables(context.data?.tables), [context.data?.tables]);

  const selectedRow = React.useMemo(
    () => rows.find((row) => `${row.name ?? ''}` === selectedTableName) ?? null,
    [rows, selectedTableName],
  );
  const selectedContextTable = React.useMemo(
    () => contextTables.find((row) => getTableName(row) === selectedTableName) ?? null,
    [contextTables, selectedTableName],
  );
  const fieldRows = React.useMemo<ContextFieldRecord[]>(
    () =>
      selectedContextTable
        ? extractContextFields(selectedContextTable)
        : Array.isArray(selectedRow?.fields)
          ? selectedRow.fields.map((field) => ({
              name: String(field.name ?? field.column_name ?? 'field'),
              type: String(field.type ?? field.data_type ?? 'unknown'),
              nullable: typeof field.nullable === 'boolean' ? field.nullable : undefined,
              description: field.description ? String(field.description) : undefined,
            }))
          : [],
    [selectedContextTable, selectedRow?.fields],
  );
  const sampleRows = React.useMemo(
    () => (selectedContextTable ? extractSampleRows(selectedContextTable) : []),
    [selectedContextTable],
  );
  const roles = auth.user?.roles ?? [];
  const viewerOnly = roles.includes('viewer') && !roles.includes('admin') && !auth.hasPermission('admin:full');

  React.useEffect(() => {
    if (rows.length === 0) {
      setSelectedTableName('');
      return;
    }

    if (!rows.some((row) => `${row.name ?? ''}` === selectedTableName)) {
      setSelectedTableName(`${rows[0].name ?? ''}`);
    }
  }, [rows, selectedTableName]);

  React.useEffect(() => {
    setFieldPage(1);
  }, [selectedTableName]);

  const refreshAll = React.useCallback(() => {
    tables.refresh();
    context.refresh();
  }, [context, tables]);

  const runAction = React.useCallback(
    async (runner: () => Promise<ActionResult>, successMessage: string) => {
      setActionError(null);
      setActionMessage(null);
      try {
        const payload = await runner();
        if (payload.success === false) {
          throw new Error(payload.error || payload.message || 'Request failed');
        }
        setActionMessage(payload.message || successMessage);
        refreshAll();
      } catch (error) {
        setActionError(error instanceof Error ? error.message : String(error));
      }
    },
    [refreshAll],
  );

  const columns: DataColumn<TableRecord>[] = [
    {
      id: 'name',
      header: 'Table',
      cell: (row) => (
        <Button onClick={() => setSelectedTableName(`${row.name ?? ''}`)} type="button" variant="link">
          {row.name ?? 'unnamed_table'}
        </Button>
      ),
      sortable: true,
      sortValue: (row) => row.name ?? '',
    },
    {
      id: 'rows',
      header: 'Rows',
      cell: (row) => `${row.record_count ?? '—'}`,
      sortable: true,
      sortValue: (row) => row.record_count ?? 0,
    },
    {
      id: 'columns',
      header: 'Columns',
      cell: (row) => `${row.field_count ?? row.fields?.length ?? '—'}`,
      sortable: true,
      sortValue: (row) => row.field_count ?? row.fields?.length ?? 0,
    },
    {
      id: 'description',
      header: 'Description',
      cell: (row) => row.description ?? row.title ?? 'No description provided',
    },
  ];

  const fieldColumns: DataColumn<ContextFieldRecord>[] = [
    {
      id: 'name',
      header: 'Field',
      cell: (row) => row.name,
      sortable: true,
      sortValue: (row) => row.name,
    },
    {
      id: 'type',
      header: 'Type',
      cell: (row) => row.type,
      sortable: true,
      sortValue: (row) => row.type,
    },
    {
      id: 'nullable',
      header: 'Nullable',
      cell: (row) => (row.nullable == null ? '—' : row.nullable ? 'yes' : 'no'),
    },
    {
      id: 'indexed',
      header: 'Indexed',
      cell: (row) => (row.indexed == null ? '—' : row.indexed ? 'yes' : 'no'),
    },
    {
      id: 'description',
      header: 'Description',
      cell: (row) => row.description ?? '—',
    },
  ];

  const sampleColumns = React.useMemo<DataColumn<GenericRecord>[]>(() => {
    const keys = new Set<string>();
    sampleRows.slice(0, 5).forEach((row) => {
      Object.keys(row).forEach((key) => keys.add(key));
    });
    return Array.from(keys).map((key) => ({
      id: key,
      header: key,
      cell: (row) => `${row[key] ?? ''}`,
    }));
  }, [sampleRows]);

  return (
    <PageFrame
      eyebrow="FR-60 / FR-98 / FR-99"
      title="Tables"
      description="Inspect the live table inventory, drill into schema detail and sample rows from the context, and run the available table lifecycle actions through the authenticated web proxy."
      actions={
        <Button onClick={refreshAll} type="button" variant="outline">
          Refresh tables
        </Button>
      }
    >
      {actionMessage ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{actionMessage}</div> : null}
      {actionError ? <ErrorState message={actionError} /> : null}

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <PanelCard id="panelTables" title="Table inventory" subtitle="Resolved from `/api/v1/tables` with row counts and field counts.">
          {tables.loading ? <LoadingState label="tables" /> : null}
          {tables.error ? <ErrorState message={tables.error} /> : null}
          {!tables.loading && !tables.error && rows.length === 0 ? (
            <EmptyState title="No tables returned" body="The backend did not provide an active table inventory." />
          ) : null}
          {!tables.loading && !tables.error ? (
            <DataTable
              columns={columns}
              rows={rows}
              emptyMessage="No tables returned by the backend."
              getRowId={(row) => `${row.name ?? row.title ?? ''}`}
              page={page}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              columnPickerEnabled
              tableId="sql-agent-tables"
            />
          ) : null}
        </PanelCard>

        <PanelCard title="Selected table detail" subtitle="Schema, sample data, raw context, and table lifecycle actions.">
          {!selectedTableName ? (
            <EmptyState title="No table selected" body="Select a table from the inventory to inspect fields and context." />
          ) : (
            <div className="space-y-5">
              <DataList
                items={[
                  { label: 'Table', value: selectedTableName },
                  { label: 'Rows', value: selectedRow?.record_count ?? '—' },
                  { label: 'Fields', value: fieldRows.length || selectedRow?.field_count || 0 },
                  { label: 'Sample rows', value: sampleRows.length },
                ]}
              />

              <div className="flex flex-wrap gap-2">
                {viewerOnly ? (
                  <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-800">
                    Viewer role: browse-only access. Mutation actions are hidden.
                  </div>
                ) : (
                  <>
                    <Button
                      onClick={() => {
                        if (!selectedTableName) return;
                        void runAction(
                          () =>
                            requestJson<ActionResult>(cfg.API_BASE_URL, `/api/v1/context/rebuild/${encodeURIComponent(selectedTableName)}`, {
                              method: 'POST',
                            }),
                          `Rebuilt '${selectedTableName}'.`,
                        );
                      }}
                      type="button"
                    >
                      Rebuild table
                    </Button>
                    <Button
                      onClick={() => {
                        if (!selectedTableName) return;
                        void runAction(
                          () =>
                            requestJson<ActionResult>(cfg.API_BASE_URL, `/api/v1/context/mark_stale/${encodeURIComponent(selectedTableName)}`, {
                              method: 'POST',
                            }),
                          `Marked '${selectedTableName}' stale.`,
                        );
                      }}
                      type="button"
                      variant="outline"
                    >
                      Mark stale
                    </Button>
                    <Button
                      onClick={() => {
                        if (!selectedTableName) return;
                        void runAction(
                          () =>
                            requestJson<ActionResult>(cfg.API_BASE_URL, `/api/v1/tables/${encodeURIComponent(selectedTableName)}/records`, {
                              method: 'DELETE',
                            }),
                          `Removed records from '${selectedTableName}'.`,
                        );
                      }}
                      type="button"
                      variant="destructive"
                    >
                      Remove records
                    </Button>
                  </>
                )}
                <Button
                  onClick={() => {
                    if (selectedContextTable) {
                      downloadJsonFile(`${selectedTableName}-context.json`, selectedContextTable);
                    } else if (selectedRow) {
                      downloadJsonFile(`${selectedTableName}.json`, selectedRow);
                    }
                  }}
                  type="button"
                  variant="outline"
                >
                  Download JSON
                </Button>
              </div>

              <DataTable
                columns={fieldColumns}
                rows={fieldRows}
                emptyMessage="No field-level schema available for the selected table."
                getRowId={(row) => row.name}
                page={fieldPage}
                pageSize={fieldPageSize}
                onPageChange={setFieldPage}
                onPageSizeChange={setFieldPageSize}
                columnPickerEnabled
                tableId="sql-agent-table-fields"
              />

              {sampleRows.length > 0 && sampleColumns.length > 0 ? (
                <DataTable
                  columns={sampleColumns}
                  rows={sampleRows.slice(0, 5)}
                  emptyMessage="No sample rows available."
                  getRowId={(row) => `${selectedTableName}-${safeStringify(row)}`}
                  tableId="sql-agent-table-samples"
                />
              ) : (
                <EmptyState title="No sample rows" body="The current context does not expose sample rows for this table." />
              )}

              {selectedContextTable ? (
                <JsonExplorer data={selectedContextTable} title="Context detail" defaultExpanded />
              ) : selectedRow ? (
                <JsonExplorer data={selectedRow} title="Inventory detail" defaultExpanded />
              ) : null}
            </div>
          )}
        </PanelCard>
      </div>
    </PageFrame>
  );
}
