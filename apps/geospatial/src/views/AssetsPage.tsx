// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
//
// Licensed under the Apache License, Version 2.0.

import * as React from "react";
import {
  Button,
  DataTable,
  FileBrowser,
  FileDropZone,
  RelativeTime,
  createDataTableActionColumn,
  type DataColumn,
  type FileItem,
  type FolderNode,
} from "@cloud-dog/ui";
import { useGeoState } from "../state/AppState";
import { JsonDetailDialog, PageHeader, StatusLine, errMessage, useEntityList } from "../lib/ui";
import type { GeoAsset } from "../lib/api";

export function AssetsPage() {
  const { api, appVersion } = useGeoState();
  const { rows, loading, error, reload } = useEntityList<GeoAsset>(() => api.listAssets(), [api]);
  const [detail, setDetail] = React.useState<Record<string, unknown> | null>(null);
  const [status, setStatus] = React.useState<string | null>(null);

  const showMeta = async (a: GeoAsset) => {
    try {
      setDetail(await api.assetMetadata({ asset_id: a.asset_id }));
    } catch (e) {
      setStatus(errMessage(e, "Failed to load asset metadata."));
    }
  };

  const columns: DataColumn<GeoAsset>[] = [
    {
      id: "asset_id",
      header: "Asset",
      sortable: true,
      sortValue: (r) => r.asset_id ?? "",
      cell: (r) => (
        <button type="button" aria-label={`Open asset ${String(r.asset_id ?? "details")}`} className="text-left font-medium text-primary underline-offset-2 hover:underline" onClick={() => void showMeta(r)}>
          {r.asset_id || "(unnamed)"}
        </button>
      ),
    },
    { id: "type", header: "Type", sortable: true, sortValue: (r) => String(r.asset_type ?? ""), cell: (r) => String(r.asset_type ?? "—") },
    {
      id: "created",
      header: "Created",
      sortable: true,
      sortValue: (r) => String(r.created_at ?? ""),
      cell: (r) => (r.created_at ? <RelativeTime timestamp={r.created_at as string} /> : "—"),
    },
    createDataTableActionColumn<GeoAsset>((r) => [{ id: "meta", label: "Metadata", onClick: () => void showMeta(r) }]),
  ];

  const assetPath = React.useCallback((asset: GeoAsset) => `/assets/${String(asset.asset_id ?? "")}`, []);
  const assetByPath = React.useMemo(() => new Map(rows.map((asset) => [assetPath(asset), asset])), [assetPath, rows]);
  const browserFiles = React.useMemo<FileItem[]>(
    () => rows.map((asset) => ({
      name: String(asset.asset_id ?? "(unnamed)"),
      path: assetPath(asset),
      kind: "artifact",
      status: String(asset.asset_type ?? "asset"),
      modified: asset.created_at ? String(asset.created_at) : undefined,
      testId: `geospatial-asset-file-${String(asset.asset_id ?? "unnamed")}`,
    })),
    [assetPath, rows]
  );
  const browserFolders = React.useMemo<FolderNode[]>(
    () => [{ name: "Assets", path: "/assets", children: [] }],
    []
  );

  return (
    <div className="space-y-6" data-testid="page-assets">
      <PageHeader title="Assets" version={appVersion} description="Stored geospatial assets (renders, exports, bundles) — tenant-scoped, lifecycle-managed.">
        <Button variant="secondary" size="sm" onClick={() => void reload()}>
          Refresh
        </Button>
      </PageHeader>
      <StatusLine loading={loading} error={error} status={status} />
      <FileDropZone
        disabled
        label="Upload geospatial asset"
        disabledDescription="Geospatial assets are created by service workflows and cannot be uploaded from this page."
        onDrop={() => undefined}
        testId="geospatial-assets-disabled-drop-zone"
      />
      <FileBrowser
        folders={browserFolders}
        files={browserFiles}
        currentPath="/assets"
        rootLabel="assets"
        filesLabel="Geospatial assets"
        loading={loading}
        errorMessage={error}
        statusMessage={`${rows.length} assets visible`}
        emptyMessage="No assets."
        readOnly
        onNavigate={() => undefined}
        onRefresh={reload}
        onOpen={(path) => {
          const asset = assetByPath.get(path);
          if (asset) void showMeta(asset);
        }}
        testId="geospatial-assets-file-browser"
      />
      <DataTable columns={columns} rows={rows} getRowId={(r) => r.asset_id ?? ""} emptyMessage="No assets." pageSize={10} columnPickerEnabled tableId="geospatial-assets" />
      <JsonDetailDialog open={!!detail} onOpenChange={(o) => { if (!o) setDetail(null); }} label="Asset metadata" data={detail ?? {}} />
    </div>
  );
}
