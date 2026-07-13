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

// @cloud-dog/ui - W28E-1847 sessions/history panel composition.

import * as React from "react";
import { Plus, RefreshCw } from "lucide-react";
import { Button } from "../components/button/Button";
import { Card, CardContent, CardHeader } from "../components/card/Card";
import { ConfirmDialog } from "../components/dialog/ConfirmDialog";
import { Alert } from "../components/feedback/Alert";
import { StatusBadge, detectTone } from "../components/layout/StatusBadge";
import type { StatusBadgeTone } from "../components/layout/StatusBadge";
import {
  DataTable,
  createDataTableActionColumn,
} from "../components/table/DataTable";
import type {
  BulkAction,
  DataColumn,
  DataTableAction,
} from "../components/table/DataTable";
import { cn } from "../utils/cn";
import { EntityDialog } from "./EntityDialog";
import type { EntityDialogRelatedPanel } from "./EntityDialog";
import { RelativeTime } from "./RelativeTime";
import type { RelatedItem } from "./RelatedItemsPanel";

export type SessionsHistoryVariant = "sessions" | "history" | "scans";
export type SessionsHistoryTimestamp = string | Date | number;
export type SessionsHistoryStatusTone = StatusBadgeTone;

export type SessionsHistoryDetailItem = Readonly<{
  label: string;
  value: React.ReactNode;
}>;

export type SessionsHistoryRow = Readonly<{
  id: string;
  label: string;
  title?: React.ReactNode;
  status?: string;
  statusTone?: SessionsHistoryStatusTone;
  actor?: React.ReactNode;
  target?: React.ReactNode;
  createdAt?: SessionsHistoryTimestamp;
  updatedAt?: SessionsHistoryTimestamp;
  lastActivityAt?: SessionsHistoryTimestamp;
  expiresAt?: SessionsHistoryTimestamp;
  retention?: React.ReactNode;
  summary?: React.ReactNode;
  details?: readonly SessionsHistoryDetailItem[];
  relatedItems?: readonly RelatedItem[];
}>;

export type SessionsHistoryAction = Readonly<{
  id: string;
  label: string;
  icon?: React.ReactNode;
  href?: string | ((row: SessionsHistoryRow) => string);
  onClick?: (row: SessionsHistoryRow) => void;
  destructive?: boolean;
  disabled?: (row: SessionsHistoryRow) => boolean;
  title?: (row: SessionsHistoryRow) => string;
  confirm?: Readonly<{
    title: string;
    description: string;
    confirmLabel?: string;
    irreversible?: boolean;
  }>;
}>;

export type SessionsHistoryConfirmConfig = Readonly<{
  title: string;
  description: string;
  confirmLabel?: string;
  irreversible?: boolean;
}>;

export type SessionsHistoryPanelProps = Readonly<{
  title: string;
  description?: React.ReactNode;
  headingLevel?: 1 | 2;
  headingId?: string;
  variant?: SessionsHistoryVariant;
  rows: readonly SessionsHistoryRow[];
  emptyMessage?: string;
  loading?: boolean;
  error?: React.ReactNode;
  className?: string;
  tableId?: string;
  ariaLabel?: string;
  canonicalRoute?: string;
  legacyAliases?: readonly string[];
  onRefresh?: () => void;
  refreshing?: boolean;
  onCreate?: () => void;
  createLabel?: string;
  actions?: readonly SessionsHistoryAction[];
  actionsForRow?: (row: SessionsHistoryRow) => readonly SessionsHistoryAction[];
  bulkActions?: readonly BulkAction[];
  onBulkAction?: (action: string, selectedIds: string[]) => void;
  bulkActionConfirm?: (action: string, selectedIds: string[]) => SessionsHistoryConfirmConfig | undefined;
  domainColumns?: readonly DataColumn<SessionsHistoryRow>[];
  page?: number;
  pageSize?: number;
  totalRows?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  selectable?: boolean;
  columnPickerEnabled?: boolean;
  detailsEnabled?: boolean;
  detailTitle?: (row: SessionsHistoryRow) => string;
  renderDetail?: (row: SessionsHistoryRow) => React.ReactNode;
  relatedPanelsForRow?: (row: SessionsHistoryRow) => readonly EntityDialogRelatedPanel[];
}>;

type PendingConfirm = Readonly<{
  row: SessionsHistoryRow;
  action: SessionsHistoryAction;
}>;

type PendingBulkConfirm = Readonly<{
  action: string;
  selectedIds: string[];
  confirm: SessionsHistoryConfirmConfig;
}>;

function defaultPrimaryHeader(variant: SessionsHistoryVariant): string {
  if (variant === "scans") return "Scan";
  if (variant === "history") return "Item";
  return "Session";
}

function defaultEmptyMessage(variant: SessionsHistoryVariant): string {
  if (variant === "sessions") return "No sessions found.";
  return "No history items found.";
}

function timestampSortValue(value: SessionsHistoryTimestamp | undefined): number {
  if (value === undefined) return 0;
  const date = value instanceof Date ? value : new Date(value);
  const time = date.getTime();
  return Number.isFinite(time) ? time : 0;
}

function TimestampCell(props: Readonly<{ value?: SessionsHistoryTimestamp }>) {
  if (props.value === undefined) {
    return <span className="text-sm text-muted-foreground">Not recorded</span>;
  }
  return <RelativeTime timestamp={props.value} />;
}

export function sessionsHistoryStatusTone(status: string): SessionsHistoryStatusTone {
  const normalized = status.trim().toLowerCase();
  if (["active", "running", "ready", "current", "open"].includes(normalized)) {
    return "ok";
  }
  if (["idle", "expiring", "warning", "queued", "pending", "partial", "delayed"].includes(normalized)) {
    return "warning";
  }
  if (["revoked", "expired", "failed", "denied", "purged", "error", "blocked"].includes(normalized)) {
    return "error";
  }
  if (["completed", "archived", "retained", "closed"].includes(normalized)) {
    return "neutral";
  }
  return detectTone(status);
}

function hasValue(rows: readonly SessionsHistoryRow[], key: keyof SessionsHistoryRow): boolean {
  return rows.some((row) => row[key] !== undefined && row[key] !== null && row[key] !== "");
}

function renderDefaultDetail(row: SessionsHistoryRow) {
  const detailItems: SessionsHistoryDetailItem[] = [
    { label: "ID", value: row.id },
    ...(row.status ? [{ label: "Status", value: <StatusBadge value={row.status} tone={row.statusTone ?? sessionsHistoryStatusTone(row.status)} /> }] : []),
    ...(row.actor ? [{ label: "Actor", value: row.actor }] : []),
    ...(row.target ? [{ label: "Target", value: row.target }] : []),
    ...(row.createdAt ? [{ label: "Created", value: <TimestampCell value={row.createdAt} /> }] : []),
    ...(row.updatedAt ? [{ label: "Updated", value: <TimestampCell value={row.updatedAt} /> }] : []),
    ...(row.lastActivityAt ? [{ label: "Last Activity", value: <TimestampCell value={row.lastActivityAt} /> }] : []),
    ...(row.expiresAt ? [{ label: "Expires", value: <TimestampCell value={row.expiresAt} /> }] : []),
    ...(row.retention ? [{ label: "Retention", value: row.retention }] : []),
    ...(row.details ?? []),
  ];

  return (
    <div className="space-y-4">
      {row.summary ? <div className="text-sm text-muted-foreground">{row.summary}</div> : null}
      <dl className="grid gap-3 sm:grid-cols-2">
        {detailItems.map((item) => (
          <div key={item.label} className="min-w-0 rounded-md border border-border p-3">
            <dt className="text-xs font-medium uppercase text-muted-foreground">{item.label}</dt>
            <dd className="mt-1 break-words text-sm text-foreground">{item.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function resolveHref(action: SessionsHistoryAction, row: SessionsHistoryRow): ((row: SessionsHistoryRow) => string) | undefined {
  if (!action.href) return undefined;
  if (typeof action.href === "function") return action.href;
  return () => action.href as string;
}

export function SessionsHistoryPanel(props: SessionsHistoryPanelProps) {
  const {
    variant = "sessions",
    rows,
    emptyMessage = defaultEmptyMessage(variant),
    detailsEnabled = true,
    selectable = Boolean(props.bulkActions?.length),
    columnPickerEnabled = true,
  } = props;
  const [detailRow, setDetailRow] = React.useState<SessionsHistoryRow | null>(null);
  const [pendingConfirm, setPendingConfirm] = React.useState<PendingConfirm | null>(null);
  const [pendingBulkConfirm, setPendingBulkConfirm] = React.useState<PendingBulkConfirm | null>(null);
  const headingId = props.headingId ?? `${props.tableId ?? "sessions-history-panel"}-title`;
  const HeadingTag = (props.headingLevel === 2 ? "h2" : "h1") as "h1" | "h2";

  const columns = React.useMemo<DataColumn<SessionsHistoryRow>[]>(() => {
    const next: DataColumn<SessionsHistoryRow>[] = [
      {
        id: "label",
        header: defaultPrimaryHeader(variant),
        cell: (row) => (
          <div className="min-w-0">
            <div className="break-words text-sm font-medium text-foreground">
              {row.title ?? row.label}
            </div>
            {row.summary ? (
              <div className="mt-1 break-words text-xs text-muted-foreground">{row.summary}</div>
            ) : null}
          </div>
        ),
        sortable: true,
        sortValue: (row) => row.label,
      },
    ];

    if (hasValue(rows, "status")) {
      next.push({
        id: "status",
        header: "Status",
        cell: (row) => row.status ? (
          <StatusBadge value={row.status} tone={row.statusTone ?? sessionsHistoryStatusTone(row.status)} />
        ) : (
          <span className="text-sm text-muted-foreground">Not recorded</span>
        ),
        sortable: true,
        sortValue: (row) => row.status ?? "",
      });
    }

    if (hasValue(rows, "actor")) {
      next.push({
        id: "actor",
        header: "Actor",
        cell: (row) => row.actor ?? <span className="text-sm text-muted-foreground">Not recorded</span>,
        sortable: true,
        sortValue: (row) => String(row.actor ?? ""),
      });
    }

    if (hasValue(rows, "target")) {
      next.push({
        id: "target",
        header: "Target",
        cell: (row) => row.target ?? <span className="text-sm text-muted-foreground">Not recorded</span>,
        sortable: true,
        sortValue: (row) => String(row.target ?? ""),
      });
    }

    if (hasValue(rows, "createdAt")) {
      next.push({
        id: "createdAt",
        header: "Created",
        cell: (row) => <TimestampCell value={row.createdAt} />,
        sortable: true,
        sortValue: (row) => timestampSortValue(row.createdAt),
      });
    }

    if (hasValue(rows, "lastActivityAt")) {
      next.push({
        id: "lastActivityAt",
        header: "Last Activity",
        cell: (row) => <TimestampCell value={row.lastActivityAt} />,
        sortable: true,
        sortValue: (row) => timestampSortValue(row.lastActivityAt),
      });
    }

    if (hasValue(rows, "updatedAt")) {
      next.push({
        id: "updatedAt",
        header: "Updated",
        cell: (row) => <TimestampCell value={row.updatedAt} />,
        sortable: true,
        sortValue: (row) => timestampSortValue(row.updatedAt),
      });
    }

    if (hasValue(rows, "expiresAt")) {
      next.push({
        id: "expiresAt",
        header: "Expires",
        cell: (row) => <TimestampCell value={row.expiresAt} />,
        sortable: true,
        sortValue: (row) => timestampSortValue(row.expiresAt),
      });
    }

    if (hasValue(rows, "retention")) {
      next.push({
        id: "retention",
        header: "Retention",
        cell: (row) => row.retention ?? <span className="text-sm text-muted-foreground">Not recorded</span>,
        sortable: true,
        sortValue: (row) => String(row.retention ?? ""),
      });
    }

    next.push(...(props.domainColumns ?? []));

    const actionColumn = createDataTableActionColumn<SessionsHistoryRow>((row) => {
      const suppliedActions = [
        ...(props.actions ?? []),
        ...(props.actionsForRow?.(row) ?? []),
      ];
      const detailAction: SessionsHistoryAction[] = detailsEnabled ? [{
        id: "view",
        label: "View",
        onClick: () => setDetailRow(row),
      }] : [];
      return [...detailAction, ...suppliedActions].map<DataTableAction<SessionsHistoryRow>>((action) => ({
        id: action.id,
        label: action.label,
        icon: action.icon,
        destructive: action.destructive,
        disabled: action.disabled,
        title: action.title,
        href: action.confirm ? undefined : resolveHref(action, row),
        onClick: action.confirm
          ? () => setPendingConfirm({ row, action })
          : () => action.onClick?.(row),
      }));
    });

    next.push(actionColumn);
    return next;
  }, [detailsEnabled, props.actions, props.actionsForRow, props.domainColumns, rows, variant]);

  const relatedPanels: EntityDialogRelatedPanel[] | undefined = detailRow ? (() => {
    const supplied = props.relatedPanelsForRow?.(detailRow);
    if (supplied) return [...supplied];
    if (!detailRow.relatedItems?.length) return undefined;
    return [{
      title: "Related Items",
      items: [...detailRow.relatedItems],
      emptyMessage: "No related items.",
    }];
  })() : undefined;
  const pendingConfirmConfig = pendingConfirm?.action.confirm;

  const handleBulkAction = React.useCallback((action: string, selectedIds: string[]) => {
    const confirm = props.bulkActionConfirm?.(action, selectedIds);
    if (confirm) {
      setPendingBulkConfirm({ action, selectedIds, confirm });
      return;
    }
    props.onBulkAction?.(action, selectedIds);
  }, [props]);

  return (
    <section
      className={cn("space-y-4", props.className)}
      aria-labelledby={headingId}
      data-testid="sessions-history-panel"
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 space-y-1">
          <HeadingTag id={headingId} className={props.headingLevel === 2 ? "text-xl font-semibold tracking-normal" : "text-2xl font-semibold tracking-normal"}>
            {props.title}
          </HeadingTag>
          {props.description ? (
            <div className="max-w-3xl text-sm text-muted-foreground">{props.description}</div>
          ) : null}
          {(props.canonicalRoute || props.legacyAliases?.length) ? (
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground" data-testid="sessions-history-route-proof">
              {props.canonicalRoute ? <span>Canonical: {props.canonicalRoute}</span> : null}
              {props.legacyAliases?.length ? <span>Aliases: {props.legacyAliases.join(", ")}</span> : null}
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {props.onRefresh ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              loading={props.refreshing}
              onClick={props.onRefresh}
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Refresh
            </Button>
          ) : null}
          {props.onCreate ? (
            <Button type="button" size="sm" onClick={props.onCreate}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              {props.createLabel ?? "New Session"}
            </Button>
          ) : null}
        </div>
      </div>

      {props.error ? (
        <Alert variant="destructive">{props.error}</Alert>
      ) : null}

      {props.loading ? (
        <Card className="rounded-lg">
          <CardContent className="py-8">
            <div role="status" aria-live="polite" className="text-sm text-muted-foreground">
              Loading {variant === "sessions" ? "sessions" : "history"}...
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="rounded-lg">
          <CardHeader className="pb-4">
            <div className="text-sm font-medium text-muted-foreground">
              {rows.length} {rows.length === 1 ? "item" : "items"}
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <DataTable<SessionsHistoryRow>
              ariaLabel={props.ariaLabel ?? props.title}
              columns={columns}
              rows={[...rows]}
              emptyMessage={emptyMessage}
              getRowId={(row) => row.id}
              getRowName={(row) => row.label}
              getRowTestId={(row) => `sessions-history-row-${row.id}`}
              tableId={props.tableId ?? `sessions-history-${variant}`}
              selectable={selectable}
              bulkActions={props.bulkActions ? [...props.bulkActions] : undefined}
              onBulkAction={handleBulkAction}
              columnPickerEnabled={columnPickerEnabled}
              page={props.page}
              pageSize={props.pageSize}
              totalRows={props.totalRows}
              onPageChange={props.onPageChange}
              onPageSizeChange={props.onPageSizeChange}
            />
          </CardContent>
        </Card>
      )}

      {detailRow ? (
        <EntityDialog
          open={Boolean(detailRow)}
          onOpenChange={(open) => {
            if (!open) setDetailRow(null);
          }}
          title={props.detailTitle?.(detailRow) ?? `View ${detailRow.label}`}
          body={props.renderDetail?.(detailRow) ?? renderDefaultDetail(detailRow)}
          relatedPanels={relatedPanels}
        />
      ) : null}

      {pendingConfirm && pendingConfirmConfig ? (
        <ConfirmDialog
          open={Boolean(pendingConfirm)}
          onOpenChange={(open) => {
            if (!open) setPendingConfirm(null);
          }}
          title={pendingConfirmConfig.title}
          description={pendingConfirmConfig.description}
          targetName={pendingConfirm.row.label}
          confirmLabel={pendingConfirmConfig.confirmLabel ?? pendingConfirm.action.label}
          irreversible={pendingConfirmConfig.irreversible ?? true}
          onConfirm={() => {
            pendingConfirm.action.onClick?.(pendingConfirm.row);
            setPendingConfirm(null);
          }}
        />
      ) : null}

      {pendingBulkConfirm ? (
        <ConfirmDialog
          open={Boolean(pendingBulkConfirm)}
          onOpenChange={(open) => {
            if (!open) setPendingBulkConfirm(null);
          }}
          title={pendingBulkConfirm.confirm.title}
          description={pendingBulkConfirm.confirm.description}
          targetName={`${pendingBulkConfirm.selectedIds.length} selected`}
          confirmLabel={pendingBulkConfirm.confirm.confirmLabel ?? "Confirm"}
          irreversible={pendingBulkConfirm.confirm.irreversible ?? true}
          onConfirm={() => {
            props.onBulkAction?.(pendingBulkConfirm.action, pendingBulkConfirm.selectedIds);
            setPendingBulkConfirm(null);
          }}
        />
      ) : null}
    </section>
  );
}
