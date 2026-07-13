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

import * as React from 'react';
import { useSearchParams } from 'react-router-dom';
import { LogTablePanel as SharedLogTablePanel, type AuditLogEntry as SharedAuditLogEntry, type DataColumn, type LogApiAdapter } from '@cloud-dog/ui';
import type { LogSurfaceId, NotificationAdminApi } from '../lib/api';

function formatChannel(row: SharedAuditLogEntry): string {
  const details = row.details ?? {};
  for (const key of ['channel_name', 'channel', 'channel_id']) {
    const value = details[key];
    if (value !== undefined && value !== null && String(value).trim()) return String(value);
  }
  if (row.target?.type === 'channel') return row.target.name ?? row.target.id ?? 'N/A';
  return 'N/A';
}

const CHANNEL_COLUMN: DataColumn<SharedAuditLogEntry> = {
  id: 'channel',
  header: 'Channel',
  sortable: true,
  sortValue: (row) => formatChannel(row),
  cell: (row) => <span className="font-mono text-xs">{formatChannel(row)}</span>,
};

type LogTablePanelProps = Readonly<{
  api: NotificationAdminApi;
  tableId: string;
  title: string;
  description: string;
  initialSurface?: LogSurfaceId;
  initialQuery?: string;
  limit?: number;
  embedded?: boolean;
  defaultVisibleColumns: string[];
}>;

export function LogTablePanel(props: LogTablePanelProps) {
  const [searchParams] = useSearchParams();
  const actorParam = searchParams.get('actor') ?? searchParams.get('key') ?? '';
  const initialQuery = actorParam || props.initialQuery;

  const adapter = React.useMemo<LogApiAdapter>(() => ({
    async getLogs(params) {
      return props.api.listStructuredLogs({
        surface: params.surface as LogSurfaceId,
        limit: params.limit,
        query: params.query,
      });
    },
  }), [props.api]);

  return (
    <SharedLogTablePanel
      api={adapter}
      tableId={props.tableId}
      title={props.title}
      description={props.description}
      initialSurface={props.initialSurface}
      initialQuery={initialQuery}
      limit={props.limit}
      embedded={props.embedded}
      defaultVisibleColumns={props.defaultVisibleColumns}
      extraColumns={[CHANNEL_COLUMN]}
      extraSearchText={formatChannel}
      exportFilenamePrefix={`notification-${props.tableId}`}
    />
  );
}
