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

// @cloud-dog/app-expert-agent — Shared UI page primitives.
// Covers: FR1.21, FR1.22, FR1.23, FR1.35

import * as React from 'react';
import { Card, CardContent, CardHeader, DataTable, RelativeTime, type DataColumn } from '@cloud-dog/ui';

export type EndpointSpec = Readonly<{
  method: string;
  path: string;
  description: string;
}>;

export type SummaryItem = Readonly<{
  label: string;
  value: React.ReactNode;
}>;

export type Column<Row> = Readonly<{
  header: string;
  render: (row: Row) => React.ReactNode;
}>;

export function formatBoolean(value: boolean | null | undefined): string {
  if (value === true) return 'Yes';
  if (value === false) return 'No';
  return 'N/A';
}

export function formatCount(value: number | null | undefined): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return 'N/A';
  return value.toLocaleString('en-GB');
}

export function formatBytes(value: number | null | undefined): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return 'N/A';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export function renderRelativeTime(value: string | null | undefined): React.ReactNode {
  if (!value) return 'N/A';
  return <RelativeTime timestamp={value} />;
}

export function PageScaffold(props: {
  title: string;
  description: string;
  alert?: string | null;
  status?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold">{props.title}</h1>
        <p className="text-sm text-muted-foreground">{props.description}</p>
      </header>

      {props.alert ? <p role="alert" className="text-sm font-medium text-red-700">{props.alert}</p> : null}
      {props.status ? <p role="status" className="text-sm text-foreground/80">{props.status}</p> : null}

      {props.children}
    </div>
  );
}

export function SummaryGrid(props: { items: ReadonlyArray<SummaryItem> }) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {props.items.map((item) => (
        <Card key={item.label}>
          <CardHeader>
            <p className="text-sm font-medium text-muted-foreground">{item.label}</p>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{item.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function EndpointTable(props: { title: string; endpoints: ReadonlyArray<EndpointSpec> }) {
  const columns = React.useMemo<DataColumn<EndpointSpec>[]>(() => [
    { id: 'method', header: 'Method', sortable: true, sortValue: (endpoint) => endpoint.method, cell: (endpoint) => <span className="font-mono text-xs">{endpoint.method}</span> },
    { id: 'path', header: 'Path', sortable: true, sortValue: (endpoint) => endpoint.path, cell: (endpoint) => <span className="font-mono text-xs">{endpoint.path}</span> },
    { id: 'description', header: 'Purpose', sortable: true, sortValue: (endpoint) => endpoint.description, cell: (endpoint) => endpoint.description },
  ], []);

  return (
    <Card>
      <CardHeader>
        <h2 className="text-lg font-semibold">{props.title}</h2>
      </CardHeader>
      <CardContent>
        <DataTable
          columns={columns}
          rows={[...props.endpoints]}
          getRowId={(endpoint) => `${endpoint.method}:${endpoint.path}`}
          emptyMessage="No contract endpoints documented."
          tableId={`${props.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-endpoints`}
          columnPickerEnabled
        />
      </CardContent>
    </Card>
  );
}

export function SimpleTable<Row>(props: {
  title: string;
  rows: ReadonlyArray<Row>;
  columns: ReadonlyArray<Column<Row>>;
  emptyLabel: string;
}) {
  return (
    <Card>
      <CardHeader>
        <h2 className="text-lg font-semibold">{props.title}</h2>
      </CardHeader>
      <CardContent>
        <DataTable
          columns={props.columns.map((column, index) => ({
            id: `${index}:${column.header}`,
            header: column.header,
            cell: (row: Row) => column.render(row),
          }))}
          rows={[...props.rows]}
          emptyMessage={props.emptyLabel}
          tableId={`${props.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-simple`}
          columnPickerEnabled
        />
      </CardContent>
    </Card>
  );
}

export function LoadingNote(props: { loading: boolean; label?: string }) {
  if (!props.loading) return null;
  return <p className="text-sm text-muted-foreground">{props.label ?? 'Loading live backend snapshot...'}</p>;
}

function deriveLocalServiceOrigin(offset: number): string | null {
  if (typeof window === 'undefined') return null;
  const current = new URL(window.location.origin);
  if (!['127.0.0.1', 'localhost'].includes(current.hostname)) return null;

  const port = Number(current.port || (current.protocol === 'https:' ? 443 : 80));
  const mappedPort =
    port === 8031 ? 8031 + offset :
    port === 28080 ? 28080 + offset :
    null;
  if (!mappedPort) return null;

  current.port = String(mappedPort);
  return current.origin;
}

export function resolveMcpBaseUrl(configuredUrl?: string | null): string {
  if (configuredUrl) {
    const localOverride = deriveLocalServiceOrigin(1);
    if (localOverride && configuredUrl === `${window.location.origin}/mcp`) return `${localOverride}/mcp`;
    return configuredUrl;
  }
  const localOverride = deriveLocalServiceOrigin(1);
  return localOverride ? `${localOverride}/mcp` : `${window.location.origin}/mcp`;
}

export function resolveA2aBaseUrl(configuredUrl?: string | null): string {
  if (configuredUrl) {
    const localOverride = deriveLocalServiceOrigin(2);
    if (localOverride && configuredUrl === `${window.location.origin}/a2a`) return `${localOverride}/a2a`;
    return configuredUrl;
  }
  const localOverride = deriveLocalServiceOrigin(2);
  return localOverride ? `${localOverride}/a2a` : `${window.location.origin}/a2a`;
}
