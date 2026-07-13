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
import { useConfig } from '@cloud-dog/config';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  ConfirmDialog,
  DataTable,
  FileBrowser,
  FileDropZone,
  type DataColumn,
  type FileItem,
  type FolderNode,
} from '@cloud-dog/ui';
import { ErrorState, LoadingState, PageFrame, requestJson, useApiResource } from '../lib/sqlAgentApi';

type AppRuntimeConfig = {
  API_BASE_URL: string;
};

type FileRecord = {
  id: string;
  filename: string;
  content_type: string;
  size: number;
  created_at: string;
};

type FilesResponse = {
  success: boolean;
  files: FileRecord[];
};

function filePath(row: FileRecord): string {
  return `/files/${row.id}/${row.filename || row.id}`;
}

function formatFileSize(bytes: number): string {
  const value = bytes || 0;
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

const COLUMNS: DataColumn<FileRecord>[] = [
  { id: 'id', header: 'ID', cell: (row) => row.id, sortable: true },
  { id: 'filename', header: 'Filename', cell: (row) => row.filename, sortable: true },
  { id: 'content_type', header: 'Type', cell: (row) => row.content_type, sortable: true },
  {
    id: 'size', header: 'Size', sortable: true,
    cell: (row) => formatFileSize(row.size),
  },
  {
    id: 'created_at', header: 'Created', sortable: true,
    cell: (row) => row.created_at ? new Date(row.created_at).toLocaleString() : '—',
  },
];

export default function FilesPage() {
  const config = useConfig<AppRuntimeConfig>();
  const apiBase = config?.API_BASE_URL ?? '';
  const { data, error: resourceError, loading, refresh } = useApiResource<FilesResponse>(
    () => requestJson<FilesResponse>(apiBase, '/api/v1/files'),
    [apiBase],
  );
  const [operationError, setOperationError] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<string | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<FileRecord | null>(null);

  const readFileAsBase64 = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? '').split(',')[1] ?? '');
      reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
      reader.readAsDataURL(file);
    });

  const handleUpload = async (selectedFiles: File[]) => {
    if (!selectedFiles.length) return;
    setUploading(true);
    setOperationError(null);
    setStatus(null);
    try {
      for (const file of selectedFiles) {
        const base64 = await readFileAsBase64(file);
        await requestJson(apiBase, '/api/v1/files/upload_base64', {
          method: 'POST',
          body: JSON.stringify({
            filename: file.name,
            data: base64,
            content_type: file.type || 'application/octet-stream',
          }),
        });
      }
      setStatus(`Uploaded ${selectedFiles.length} file${selectedFiles.length === 1 ? '' : 's'}.`);
      refresh();
    } catch (err) {
      setOperationError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (fileRecord: FileRecord) => {
    setOperationError(null);
    try {
      const resp = await requestJson(apiBase, `/api/v1/files/${fileRecord.id}/download`);
      const blob = await (resp as Response).blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileRecord.filename || fileRecord.id;
      a.click();
      URL.revokeObjectURL(url);
      setStatus(`Downloaded ${fileRecord.filename || fileRecord.id}.`);
    } catch {
      window.open(`${apiBase}/api/v1/files/${fileRecord.id}/download`, '_blank');
    }
  };

  const handleDelete = async (fileRecord: FileRecord) => {
    setOperationError(null);
    try {
      await requestJson(apiBase, `/api/v1/files/${fileRecord.id}`, { method: 'DELETE' });
      setStatus(`Deleted ${fileRecord.filename || fileRecord.id}.`);
      refresh();
    } catch (err) {
      setOperationError(err instanceof Error ? err.message : 'Delete failed.');
    }
  };

  if (loading && !data) return <LoadingState label="files" />;
  const files = data?.files ?? [];
  const fileByPath = new Map(files.map((row) => [filePath(row), row]));
  const browserFiles: FileItem[] = files.map((row) => ({
    name: row.filename || row.id,
    path: filePath(row),
    size: formatFileSize(row.size),
    modified: row.created_at ? new Date(row.created_at).toLocaleString() : undefined,
    contentType: row.content_type,
    kind: 'file',
    testId: `sql-agent-file-${row.id}`,
  }));
  const folders: FolderNode[] = [{ name: 'Files', path: '/', children: [] }];

  const actionColumns: DataColumn<FileRecord>[] = [
    ...COLUMNS,
    {
      id: 'actions',
      header: 'Actions',
      cell: (row) => (
        <span className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => handleDownload(row)}>
            Download
          </Button>
          <Button size="sm" variant="destructive" onClick={() => setDeleteTarget(row)}>
            Delete
          </Button>
        </span>
      ),
    },
  ];

  return (
    <PageFrame eyebrow="SQL Agent" title="Files" description="PS-78 file lifecycle management">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-semibold">Files ({files.length})</h3>
            <Button variant="outline" onClick={refresh}>Refresh</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <FileDropZone
            accept=".csv,.json,.txt,.sql,.md,.log,application/json,text/*"
            disabled={uploading}
            label="Upload SQL Agent file"
            description="Files are uploaded through the SQL Agent file API."
            disabledDescription="Upload is currently in progress."
            onDrop={(selectedFiles) => void handleUpload(selectedFiles)}
            testId="sql-agent-file-drop-zone"
          />
          <FileBrowser
            folders={folders}
            files={browserFiles}
            currentPath="/"
            loading={loading}
            errorMessage={operationError ?? resourceError}
            statusMessage={status}
            emptyMessage="No files uploaded."
            onNavigate={() => undefined}
            onRefresh={refresh}
            onDownload={(path) => {
              const row = fileByPath.get(path);
              if (row) void handleDownload(row);
            }}
            onDelete={(path) => {
              const row = fileByPath.get(path);
              if (row) void handleDelete(row);
            }}
            deleteConfirmation={{
              enabled: true,
              title: 'Delete SQL Agent file',
              description: 'Permanently delete this uploaded file from SQL Agent storage.',
              confirmLabel: 'Delete file',
            }}
            testId="sql-agent-file-browser"
          />
          {resourceError && !operationError ? <ErrorState message={resourceError} /> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">File metadata</h3>
        </CardHeader>
        <CardContent>
          <DataTable
            tableId="sql-agent-files"
            rows={files}
            columns={actionColumns}
            getRowId={(row) => row.id}
            emptyMessage="No files uploaded."
            columnPickerEnabled
          />
        </CardContent>
      </Card>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Delete SQL Agent file"
        description="Permanently delete this uploaded file from SQL Agent storage."
        targetName={deleteTarget?.filename ?? deleteTarget?.id}
        confirmLabel="Delete file"
        confirmVariant="destructive"
        onConfirm={() => {
          const target = deleteTarget;
          setDeleteTarget(null);
          if (target) void handleDelete(target);
        }}
      />
    </PageFrame>
  );
}
