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
  DataTable,
  type DataColumn,
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

const COLUMNS: DataColumn<FileRecord>[] = [
  { id: 'id', header: 'ID', cell: (row) => row.id, sortable: true },
  { id: 'filename', header: 'Filename', cell: (row) => row.filename, sortable: true },
  { id: 'content_type', header: 'Type', cell: (row) => row.content_type, sortable: true },
  {
    id: 'size', header: 'Size', sortable: true,
    cell: (row) => {
      const bytes = row.size || 0;
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    },
  },
  {
    id: 'created_at', header: 'Created', sortable: true,
    cell: (row) => row.created_at ? new Date(row.created_at).toLocaleString() : '—',
  },
];

export default function FilesPage() {
  const config = useConfig<AppRuntimeConfig>();
  const apiBase = config?.API_BASE_URL ?? '';
  const { data, error, loading, refresh } = useApiResource<FilesResponse>(
    () => requestJson<FilesResponse>(apiBase, '/api/v1/files'),
    [apiBase],
  );
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleUpload = async () => {
    const input = fileInputRef.current;
    if (!input?.files?.length) return;
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(',')[1];
      try {
        await requestJson(apiBase, '/api/v1/files/upload_base64', {
          method: 'POST',
          body: JSON.stringify({
            filename: file.name,
            data: base64,
            content_type: file.type || 'application/octet-stream',
          }),
        });
        refresh();
        if (input) input.value = '';
      } catch (err) {
        console.error('Upload failed:', err);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDownload = async (fileRecord: FileRecord) => {
    try {
      const resp = await requestJson(apiBase, `/api/v1/files/${fileRecord.id}/download`);
      const blob = await (resp as Response).blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileRecord.filename || fileRecord.id;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      window.open(`${apiBase}/api/v1/files/${fileRecord.id}/download`, '_blank');
    }
  };

  const handleDelete = async (fileRecord: FileRecord) => {
    try {
      await requestJson(apiBase, `/api/v1/files/${fileRecord.id}`, { method: 'DELETE' });
      refresh();
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  if (loading) return <LoadingState message="Loading files..." />;
  if (error) return <ErrorState error={error} />;

  const files = data?.files ?? [];

  const actionColumns: DataColumn<FileRecord>[] = [
    ...COLUMNS,
    {
      id: 'actions',
      header: 'Actions',
      cell: (row) => (
        <span style={{ display: 'flex', gap: '0.5rem' }}>
          <Button size="sm" variant="outline" onClick={() => handleDownload(row)}>
            Download
          </Button>
          <Button size="sm" variant="destructive" onClick={() => handleDelete(row)}>
            Delete
          </Button>
        </span>
      ),
    },
  ];

  return (
    <PageFrame title="Files" description="PS-78 file lifecycle management">
      <Card>
        <CardHeader>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3>Files ({files.length})</h3>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input type="file" ref={fileInputRef} style={{ fontSize: '0.875rem' }} />
              <Button onClick={handleUpload}>Upload</Button>
              <Button variant="outline" onClick={refresh}>Refresh</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable
            rows={files}
            columns={actionColumns}
            getRowId={(row) => row.id}
          />
        </CardContent>
      </Card>
    </PageFrame>
  );
}
