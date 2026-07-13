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

import * as React from "react";
import { LogTablePanel as SharedLogTablePanel, type LogApiAdapter } from "@cloud-dog/ui";
import type { ChatApi } from "../lib/api";
import type { LogSurfaceId } from "../lib/types";

export const DEFAULT_LOG_VISIBLE_COLUMNS = [
  "who",
  "from",
  "eventType",
  "action",
  "target",
  "outcome",
  "severity",
  "timestamp",
  "traceId",
  "service",
];

type LogTablePanelProps = Readonly<{
  api: ChatApi;
  tableId: string;
  title: string;
  description: string;
  initialSurface?: LogSurfaceId;
  initialQuery?: string;
  limit?: number;
  embedded?: boolean;
  defaultVisibleColumns?: string[];
}>;

export function LogTablePanel(props: LogTablePanelProps) {
  const adapter = React.useMemo<LogApiAdapter>(() => ({
    async getLogs(params) {
      return props.api.getLogs({
        limit: params.limit,
        surface: params.surface as LogSurfaceId,
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
      initialQuery={props.initialQuery}
      limit={props.limit}
      embedded={props.embedded}
      defaultVisibleColumns={props.defaultVisibleColumns ?? DEFAULT_LOG_VISIBLE_COLUMNS}
      refreshInterval={15_000}
      exportFilenamePrefix={`chat-${props.tableId}`}
    />
  );
}
