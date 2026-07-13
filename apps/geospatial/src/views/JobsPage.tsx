// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
//
// Licensed under the Apache License, Version 2.0.

import * as React from "react";
import { useAuth } from "@cloud-dog/auth";
import {
  Badge,
  Button,
  ConfirmDialog,
  DataTable,
  RelativeTime,
  createDataTableActionColumn,
  type DataColumn,
} from "@cloud-dog/ui";
import { useGeoState } from "../state/AppState";
import { JsonDetailDialog, PageHeader, StatusLine, errMessage, useEntityList } from "../lib/ui";
import type { GeoJob } from "../lib/api";

const WRITE_ROLES = new Set(["geo.operator", "geo.analyst", "geo.admin", "admin", "read-write"]);

export function JobsPage() {
  const { api, appVersion } = useGeoState();
  const auth = useAuth();
  const canCancel = (auth.user?.roles ?? []).some((r) => WRITE_ROLES.has(r));
  const { rows, loading, error, reload } = useEntityList<GeoJob>(() => api.listJobs(), [api]);
  const [detail, setDetail] = React.useState<GeoJob | null>(null);
  const [confirmCancel, setConfirmCancel] = React.useState<GeoJob | null>(null);
  const [status, setStatus] = React.useState<string | null>(null);

  const cancel = async (j: GeoJob) => {
    await api.cancelJob(j.job_id ?? "");
    setStatus(`Cancelled job ${j.job_id}.`);
    await reload();
  };

  const columns: DataColumn<GeoJob>[] = [
    {
      id: "job_id",
      header: "Job",
      sortable: true,
      sortValue: (r) => r.job_id ?? "",
      cell: (r) => (
        <button type="button" className="text-left font-medium text-primary underline-offset-2 hover:underline" onClick={() => setDetail(r)}>
          {r.job_id}
        </button>
      ),
    },
    {
      id: "status",
      header: "Status",
      sortable: true,
      sortValue: (r) => r.status ?? "",
      cell: (r) => <Badge variant={r.status === "failed" ? "destructive" : r.status === "completed" ? "default" : "secondary"}>{r.status ?? "—"}</Badge>,
    },
    {
      id: "created",
      header: "Created",
      sortable: true,
      sortValue: (r) => String(r.created_at ?? ""),
      cell: (r) => (r.created_at ? <RelativeTime timestamp={r.created_at as string} /> : "—"),
    },
    createDataTableActionColumn<GeoJob>((r) => [
      { id: "view", label: "View", onClick: () => setDetail(r) },
      ...(canCancel ? [{ id: "cancel", label: "Cancel", destructive: true, onClick: () => setConfirmCancel(r) }] : []),
    ]),
  ];

  return (
    <div className="space-y-6" data-testid="page-jobs">
      <PageHeader title="Jobs" version={appVersion} description="Asynchronous geospatial jobs (imports, conversions, renders).">
        <Button variant="secondary" size="sm" onClick={() => void reload()}>
          Refresh
        </Button>
      </PageHeader>
      <StatusLine loading={loading} error={error} status={status} />
      <DataTable columns={columns} rows={rows} getRowId={(r) => r.job_id ?? ""} emptyMessage="No jobs." pageSize={10} columnPickerEnabled tableId="geospatial-jobs" />
      <JsonDetailDialog open={!!detail} onOpenChange={(o) => { if (!o) setDetail(null); }} label={`Job ${detail?.job_id ?? ""}`} data={detail ?? {}} />
      <ConfirmDialog
        open={!!confirmCancel}
        onOpenChange={(o) => { if (!o) setConfirmCancel(null); }}
        title="Cancel Job"
        description="Cancel this running job."
        targetName={confirmCancel?.job_id}
        confirmLabel="Cancel Job"
        confirmVariant="destructive"
        onConfirm={() => {
          const t = confirmCancel;
          setConfirmCancel(null);
          if (t) void cancel(t).catch((e) => setStatus(errMessage(e, "Failed to cancel job (you may lack permission).")));
        }}
      />
    </div>
  );
}
