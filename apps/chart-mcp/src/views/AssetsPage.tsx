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
import {
  Button,
  ConfirmDialog,
  DataTable,
  FileBrowser,
  FileDropZone,
  Input,
  RelativeTime,
  createDataTableActionColumn,
  formatBytes,
  type BulkAction,
  type DataColumn,
  type FileItem,
  type FolderNode,
} from "@cloud-dog/ui";
import { useChartState } from "../state/AppState";
import { JsonDetailDialog, PageHeader, StatusLine, downloadTransfer, errMessage, useEntityList } from "../lib/ui";
import type { AssetMeta } from "../lib/types";

function assetSize(asset: AssetMeta): number {
  return asset.size_bytes ?? asset.file_size_bytes ?? 0;
}

function assetMime(asset: AssetMeta): string {
  return asset.content_type ?? asset.mime_type ?? "—";
}

export function AssetsPage() {
  const { api, appVersion } = useChartState();
  const { rows, loading, error, reload } = useEntityList<AssetMeta>(() => api.listAssets(), [api]);
  const [detail, setDetail] = React.useState<AssetMeta | null>(null);
  const [filter, setFilter] = React.useState("");
  const [confirmDelete, setConfirmDelete] = React.useState<AssetMeta | null>(null);
  const [confirmBulk, setConfirmBulk] = React.useState<string[] | null>(null);
  const [status, setStatus] = React.useState<string | null>(null);

  const download = async (asset: AssetMeta) => {
    const transfer = await api.getAssetTransfer(asset.asset_id);
    downloadTransfer(transfer);
    setStatus(`Downloaded asset ${asset.asset_id}.`);
  };

  const remove = async (assetIds: string[]) => {
    for (const assetId of assetIds) {
      await api.deleteAsset(assetId);
    }
    setStatus(`Deleted ${assetIds.length} asset${assetIds.length === 1 ? "" : "s"}.`);
    await reload();
  };

  const visible = React.useMemo(() => {
    const needle = filter.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((asset) =>
      [asset.asset_id, asset.tenant_id, asset.format, assetMime(asset), asset.storage_ref]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(needle))
    );
  }, [rows, filter]);

  const assetPath = React.useCallback((asset: AssetMeta) => `/render-assets/${asset.asset_id}`, []);
  const assetByPath = React.useMemo(() => new Map(rows.map((asset) => [assetPath(asset), asset])), [assetPath, rows]);
  const browserFiles = React.useMemo<FileItem[]>(
    () => visible.map((asset) => ({
      name: asset.asset_id,
      path: assetPath(asset),
      size: formatBytes(assetSize(asset)),
      modified: asset.expires_at ? `expires ${asset.expires_at}` : undefined,
      contentType: assetMime(asset),
      kind: "artifact",
      status: asset.format ?? undefined,
      testId: `chart-asset-file-${asset.asset_id}`,
    })),
    [assetPath, visible]
  );
  const browserFolders = React.useMemo<FolderNode[]>(
    () => [{ name: "Rendered assets", path: "/render-assets", children: [] }],
    []
  );

  const bulkActions: BulkAction[] = [{ label: "Delete Selected", action: "delete" }];

  const columns: DataColumn<AssetMeta>[] = [
    {
      id: "asset_id",
      header: "Asset",
      sortable: true,
      sortValue: (row) => row.asset_id,
      cell: (row) => (
        <button type="button" className="text-left font-mono text-sm text-primary hover:underline" onClick={() => setDetail(row)}>
          {row.asset_id}
        </button>
      ),
    },
    { id: "format", header: "Format", sortable: true, sortValue: (row) => row.format ?? "", cell: (row) => row.format || "—" },
    { id: "mime", header: "Type", sortable: true, sortValue: (row) => assetMime(row), cell: (row) => assetMime(row) },
    {
      id: "size",
      header: "Size",
      sortable: true,
      sortValue: (row) => assetSize(row),
      cell: (row) => formatBytes(assetSize(row)),
    },
    {
      id: "expires",
      header: "Expires",
      sortable: true,
      sortValue: (row) => row.expires_at ?? "",
      cell: (row) => (row.expires_at ? <RelativeTime timestamp={row.expires_at} /> : "—"),
    },
    createDataTableActionColumn<AssetMeta>((row) => [
      { id: "view", label: "View", onClick: () => setDetail(row) },
      { id: "download", label: "Download", onClick: () => void download(row).catch((e) => setStatus(errMessage(e, "Download failed."))) },
      {
        id: "audit",
        label: "Audit Log",
        href: () => `/audit-log?query=asset:${encodeURIComponent(row.asset_id)}`,
        title: () => `View Audit Log for asset ${row.asset_id}`,
      },
      { id: "delete", label: "Delete", destructive: true, onClick: () => setConfirmDelete(row) },
    ]),
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Assets" version={appVersion} description="Rendered binaries (PNG/SVG/PDF/WebP) in managed storage with expiry and audited transfer.">
        <Button variant="secondary" size="sm" onClick={() => void reload()}>
          Refresh
        </Button>
      </PageHeader>

      <StatusLine loading={loading} error={error} status={status} />

      <FileDropZone
        disabled
        label="Upload render asset"
        disabledDescription="Rendered assets are created by chart workflows and cannot be uploaded manually."
        onDrop={() => undefined}
        testId="chart-assets-disabled-drop-zone"
      />

      <div className="max-w-sm">
        <Input
          aria-label="Filter assets"
          placeholder="Filter by id, tenant, profile, render, format…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>

      <FileBrowser
        folders={browserFolders}
        files={browserFiles}
        currentPath="/render-assets"
        rootLabel="assets"
        filesLabel="Rendered assets"
        loading={loading}
        errorMessage={error}
        statusMessage={`${visible.length} assets visible`}
        emptyMessage="No assets."
        readOnly={false}
        onNavigate={() => undefined}
        onRefresh={reload}
        onOpen={(path) => {
          const asset = assetByPath.get(path);
          if (asset) setDetail(asset);
        }}
        onDownload={(path) => {
          const asset = assetByPath.get(path);
          if (asset) void download(asset).catch((e) => setStatus(errMessage(e, "Download failed.")));
        }}
        onDelete={(path) => {
          const asset = assetByPath.get(path);
          if (asset) void remove([asset.asset_id]).catch((e) => setStatus(errMessage(e, "Failed to delete asset.")));
        }}
        deleteConfirmation={{
          enabled: true,
          title: "Delete Asset",
          description: "Permanently delete this asset from storage. This action cannot be undone.",
          confirmLabel: "Delete Asset",
        }}
        testId="chart-assets-file-browser"
      />

      <DataTable
        columns={columns}
        rows={visible}
        getRowId={(row) => row.asset_id}
        emptyMessage="No assets."
        pageSize={10}
        selectable
        bulkActions={bulkActions}
        onBulkAction={(action, ids) => {
          if (action === "delete" && ids.length) setConfirmBulk(ids);
        }}
        columnPickerEnabled
        tableId="chart-mcp-assets"
      />

      <JsonDetailDialog
        open={!!detail}
        onOpenChange={(open) => { if (!open) setDetail(null); }}
        label={`Asset ${detail?.asset_id ?? ""}`}
        data={detail ?? {}}
        extra={
          detail ? (
            <Button size="sm" variant="secondary" onClick={() => void download(detail).catch((e) => setStatus(errMessage(e, "Download failed.")))}>
              Download
            </Button>
          ) : undefined
        }
      />

      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(open) => { if (!open) setConfirmDelete(null); }}
        title="Delete Asset"
        description="Permanently delete this asset from storage. This action cannot be undone."
        targetName={confirmDelete?.asset_id}
        confirmLabel="Delete Asset"
        confirmVariant="destructive"
        onConfirm={() => {
          const target = confirmDelete;
          setConfirmDelete(null);
          if (target) void remove([target.asset_id]).catch((e) => setStatus(errMessage(e, "Failed to delete asset.")));
        }}
      />

      <ConfirmDialog
        open={!!confirmBulk}
        onOpenChange={(open) => { if (!open) setConfirmBulk(null); }}
        title="Delete Selected Assets"
        description="Permanently delete the selected assets from storage. This action cannot be undone."
        targetName={confirmBulk ? `${confirmBulk.length} assets` : undefined}
        confirmLabel="Delete Assets"
        confirmVariant="destructive"
        onConfirm={() => {
          const ids = confirmBulk;
          setConfirmBulk(null);
          if (ids) void remove(ids).catch((e) => setStatus(errMessage(e, "Failed to delete assets.")));
        }}
      />
    </div>
  );
}
