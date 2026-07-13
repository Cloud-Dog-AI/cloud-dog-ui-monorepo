// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
// Licensed under the Apache License 2.0

import * as React from "react";
import {
  Button,
  DataTable,
  FileBrowser,
  FileDropZone,
  Input,
  Select,
  StatusBadge,
  type DataColumn,
  type FileItem,
  type FolderNode,
} from "@cloud-dog/ui";
import { useSbomState } from "../state/AppState";
import { PageHeader, StatusLine, errMessage } from "../lib/ui";
import type { ReportFileRow } from "../lib/types";

function fileSearchText(row: ReportFileRow): string {
  return [row.name, row.scan_id, row.boundary, row.target_type, row.target, row.classification, row.sha256]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function reportFilePath(row: ReportFileRow): string {
  return `/report-files/${row.scan_id}/${row.name}`;
}

export function ReportFilesPage() {
  const { api, appVersion } = useSbomState();
  const [rows, setRows] = React.useState<ReportFileRow[]>([]);
  const [query, setQuery] = React.useState("");
  const [classification, setClassification] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.listReportFiles(100);
      setRows(result.items);
    } catch (e) {
      setError(errMessage(e, "Failed to load report files."));
    } finally {
      setLoading(false);
    }
  }, [api]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (classification && row.classification !== classification) return false;
      return !q || fileSearchText(row).includes(q);
    });
  }, [classification, query, rows]);

  const fileByPath = React.useMemo(() => new Map(filtered.map((row) => [reportFilePath(row), row])), [filtered]);
  const browserFiles = React.useMemo<FileItem[]>(
    () => filtered.map((row) => ({
      name: row.name,
      path: reportFilePath(row),
      size: row.size_bytes == null ? undefined : `${row.size_bytes} B`,
      kind: "artifact",
      status: row.classification,
      contentType: row.target_type,
      testId: `sbom-report-file-${row.scan_id}-${row.name}`,
    })),
    [filtered]
  );
  const browserFolders = React.useMemo<FolderNode[]>(
    () => [{ name: "Report files", path: "/report-files", children: [] }],
    []
  );

  const downloadReportFile = React.useCallback((row: ReportFileRow) => {
    window.open(row.uri ?? api.scanFileUrl(row.scan_id, row.name), "_blank", "noopener");
  }, [api]);

  const columns: DataColumn<ReportFileRow>[] = [
    { id: "name", header: "File", sortable: true, sortValue: (r) => r.name, cell: (r) => <span className="font-mono text-xs">{r.name}</span> },
    { id: "classification", header: "Class", sortable: true, sortValue: (r) => r.classification, cell: (r) => <StatusBadge value={r.classification} /> },
    { id: "scan_id", header: "Scan", sortable: true, sortValue: (r) => r.scan_id, cell: (r) => <span className="font-mono text-xs">{r.scan_id}</span> },
    { id: "target", header: "Target", sortable: true, sortValue: (r) => r.target, cell: (r) => <span className="font-mono text-xs">{r.target}</span> },
    { id: "size_bytes", header: "Bytes", sortable: true, sortValue: (r) => r.size_bytes ?? 0, cell: (r) => r.size_bytes ?? "—" },
    { id: "sha256", header: "SHA256", sortable: true, sortValue: (r) => r.sha256 ?? "", cell: (r) => <span className="font-mono text-xs">{r.sha256 ?? "—"}</span> },
    {
      id: "download",
      header: "Download",
      cell: (r) => (
        <a
          className="text-sm text-primary underline"
          href={r.uri ?? api.scanFileUrl(r.scan_id, r.name)}
          data-testid={`download-${r.scan_id}-${r.name}`}
        >
          download
        </a>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Report Files"
        version={appVersion}
        description="Cross-scan artefact listing from real scan result file indexes."
      >
        <Button variant="secondary" size="sm" onClick={() => void load()}>Refresh</Button>
      </PageHeader>
      <div className="grid gap-3 md:grid-cols-[1fr_12rem]">
        <Input
          aria-label="Search report files"
          placeholder="Search file, scan, target, hash..."
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
        />
        <Select aria-label="Filter report file classification" value={classification} onChange={(event) => setClassification(event.currentTarget.value)}>
          <option value="">Any class</option>
          <option value="public">public</option>
          <option value="sensitive">sensitive</option>
        </Select>
      </div>
      <StatusLine loading={loading} error={error} status={`${filtered.length} files visible`} />
      <FileDropZone
        disabled
        label="Upload report file"
        disabledDescription="Report files are produced by scans and cannot be uploaded manually."
        onDrop={() => undefined}
        testId="sbom-report-files-disabled-drop-zone"
      />
      <FileBrowser
        folders={browserFolders}
        files={browserFiles}
        currentPath="/report-files"
        rootLabel="reports"
        filesLabel="Report files"
        loading={loading}
        errorMessage={error}
        statusMessage={`${filtered.length} files visible`}
        emptyMessage="No report files match the current filters."
        readOnly
        onNavigate={() => undefined}
        onRefresh={load}
        onDownload={(path) => {
          const row = fileByPath.get(path);
          if (row) downloadReportFile(row);
        }}
        testId="sbom-report-files-file-browser"
      />
      <DataTable
        columns={columns}
        rows={filtered}
        getRowId={(r) => `${r.scan_id}:${r.name}`}
        getRowTestId={(r) => `report-file-row-${r.scan_id}-${r.name}`}
        emptyMessage="No report files match the current filters."
        pageSize={25}
        columnPickerEnabled
        tableId="sbom-mcp-report-files"
      />
    </div>
  );
}
