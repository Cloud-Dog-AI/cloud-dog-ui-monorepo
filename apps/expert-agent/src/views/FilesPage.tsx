import * as React from 'react';
import {
  Badge,
  Button,
  ConfirmDialog,
  DocumentViewer,
  FileBrowser,
  FileDropZone,
  JsonBlock,
  Select,
  statusColumn,
  type EntityFieldDef,
  type EntityFormMode,
  type FileItem,
  type FolderNode,
} from '@cloud-dog/ui';
import { useAuthz } from '../lib/authz';
import { useExpertAgentState } from '../state/AppState';
import type { FileRecord, KnowledgeRecord, StorageStats } from '../lib/api';
import { AppDataTable, CrudEntityDialog } from '../lib/data-table-adapter';
import { LoadingNote, PageScaffold, formatBytes, renderRelativeTime } from './shared';

function fileDirectory(path: string | null | undefined): string {
  if (!path) return '/';
  const normalised = path.replace(/\\/g, '/');
  const lastSlash = normalised.lastIndexOf('/');
  if (lastSlash <= 0) return '/';
  return normalised.slice(0, lastSlash);
}

function uniqueDirs(files: FileRecord[]): string[] {
  const dirs = new Set<string>();
  for (const f of files) dirs.add(fileDirectory(f.file_path));
  return Array.from(dirs).sort();
}

export function FilesPage() {
  const authz = useAuthz();
  const { api, latestFailure, captureFailure, clearFailure } = useExpertAgentState();
  const [files, setFiles] = React.useState<FileRecord[]>([]);
  const [stats, setStats] = React.useState<StorageStats | null>(null);
  const [knowledgeEntries, setKnowledgeEntries] = React.useState<KnowledgeRecord[]>([]);
  const [selectedFile, setSelectedFile] = React.useState<FileRecord | null>(null);
  const [fileContent, setFileContent] = React.useState<string | null>(null);
  const [currentDir, setCurrentDir] = React.useState<string>('/');
  const [ownedSessionIds, setOwnedSessionIds] = React.useState<Set<number>>(new Set());
  const [ingestFileTarget, setIngestFileTarget] = React.useState<FileRecord | null>(null);
  const [ingestDialogOpen, setIngestDialogOpen] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<FileRecord | null>(null);
  const [bulkDeleteTargets, setBulkDeleteTargets] = React.useState<FileRecord[]>([]);
  const [ingestForm, setIngestForm] = React.useState<{ knowledge_type: 'user' | 'group' | 'session'; knowledge_id: string; chunk_size: string; chunk_overlap: string; embedding_model: string }>({ knowledge_type: 'user', knowledge_id: String(authz.userId ?? ''), chunk_size: '', chunk_overlap: '', embedding_model: '' });
  const [loading, setLoading] = React.useState(true);
  const [status, setStatus] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    clearFailure();
    setLoading(true);
    try {
      const [fileRecords, storageStats, sessionRecords, knowledgeRecords] = await Promise.all([
        api.listFiles(),
        api.getFileStorageStats(),
        api.listSessions(),
        api.listKnowledge(),
      ]);
      setFiles(fileRecords);
      setStats(storageStats);
      setKnowledgeEntries(knowledgeRecords);
      setOwnedSessionIds(new Set(sessionRecords.map((session) => session.id)));
    } catch (error) {
      captureFailure(error);
    } finally {
      setLoading(false);
    }
  }, [api, captureFailure, clearFailure]);

  React.useEffect(() => { void refresh(); }, [refresh]);

  const viewFile = React.useCallback(async (file: FileRecord) => {
    clearFailure();
    try {
      const detail = await api.getFile(file.id);
      setSelectedFile(detail);
      setFileContent(null);
      setStatus(`Loaded file ${detail.filename ?? detail.id}.`);
    } catch (error) {
      captureFailure(error);
    }
  }, [api, captureFailure, clearFailure]);

  const viewFileContent = React.useCallback(async (file: FileRecord) => {
    clearFailure();
    try {
      const detail = await api.getFile(file.id);
      setSelectedFile(detail);
      const mime = (file.mime_type ?? '').toLowerCase();
      if (mime.startsWith('text/') || mime === 'application/json' || mime === 'application/xml' || mime.includes('markdown')) {
        try {
          const resp = await fetch(api.downloadFileUrl(file.id));
          if (resp.ok) {
            const text = await resp.text();
            setFileContent(text.length > 50000 ? text.slice(0, 50000) + '\n\n... (truncated)' : text);
          } else {
            setFileContent(null);
          }
        } catch {
          setFileContent(null);
        }
      } else {
        setFileContent(null);
      }
    } catch (error) {
      captureFailure(error);
    }
  }, [api, captureFailure, clearFailure]);

  const deleteFileNow = React.useCallback(async (file: FileRecord) => {
    clearFailure();
    try {
      await api.deleteFile(file.id);
      setSelectedFile((current) => (current?.id === file.id ? null : current));
      setStatus(`Deleted file ${file.filename ?? file.id}.`);
      await refresh();
    } catch (error) {
      captureFailure(error);
    }
  }, [api, captureFailure, clearFailure, refresh]);

  const bulkDeleteFilesNow = React.useCallback(async (selected: FileRecord[]) => {
    if (!selected.length) return;
    clearFailure();
    try {
      const result = await api.bulkDeleteFiles(selected.map((file) => file.id));
      setSelectedFile(null);
      setStatus(`Deleted ${result.deleted_count ?? selected.length} files.`);
      await refresh();
    } catch (error) {
      captureFailure(error);
    }
  }, [api, captureFailure, clearFailure, refresh]);

  const deleteFile = React.useCallback((file: FileRecord) => {
    setDeleteTarget(file);
  }, []);

  const bulkDeleteFiles = React.useCallback((selected: FileRecord[]) => {
    setBulkDeleteTargets(selected);
  }, []);

  const downloadFile = React.useCallback((file: FileRecord) => {
    window.open(api.downloadFileUrl(file.id), '_blank', 'noopener');
  }, [api]);

  const openIngestDialog = React.useCallback((file: FileRecord) => {
    setIngestFileTarget(file);
    setIngestForm({ knowledge_type: 'user', knowledge_id: String(authz.userId ?? ''), chunk_size: '', chunk_overlap: '', embedding_model: '' });
    setIngestDialogOpen(true);
  }, [authz.userId]);

  const closeIngestDialog = React.useCallback(() => {
    setIngestDialogOpen(false);
    setIngestFileTarget(null);
  }, []);

  const ingestFile = React.useCallback(async () => {
    if (!ingestFileTarget) return;
    const knowledgeId = Number(ingestForm.knowledge_id);
    if (Number.isNaN(knowledgeId)) {
      setStatus('Knowledge ID must be a number.');
      return;
    }
    clearFailure();
    try {
      const ingestPayload: Parameters<typeof api.ingestFileToKnowledge>[1] = {
        knowledge_type: ingestForm.knowledge_type,
        knowledge_id: knowledgeId,
      };
      if (ingestForm.chunk_size) ingestPayload.chunk_size = Number(ingestForm.chunk_size);
      if (ingestForm.chunk_overlap) ingestPayload.chunk_overlap = Number(ingestForm.chunk_overlap);
      if (ingestForm.embedding_model) ingestPayload.embedding_model = ingestForm.embedding_model;
      await api.ingestFileToKnowledge(ingestFileTarget.id, ingestPayload);
      setStatus(`Ingested ${ingestFileTarget.filename ?? ingestFileTarget.id} into ${ingestForm.knowledge_type}:${knowledgeId}.`);
      closeIngestDialog();
      await refresh();
    } catch (error) {
      captureFailure(error);
    }
  }, [api, captureFailure, clearFailure, closeIngestDialog, ingestFileTarget, ingestForm, refresh]);

  const handleUpload = React.useCallback(async (dropped: File[]) => {
    clearFailure();
    for (const file of dropped) {
      try {
        await api.uploadFile(file);
        setStatus(`Uploaded ${file.name}.`);
      } catch (error) {
        captureFailure(error);
      }
    }
    await refresh();
  }, [api, captureFailure, clearFailure, refresh]);

  const visibleFiles = React.useMemo(() => {
    const scoped = authz.isAdmin
      ? files
      : files.filter((file) => typeof file.session_id === 'number' && ownedSessionIds.has(file.session_id));
    if (currentDir === '/') return scoped;
    return scoped.filter((file) => fileDirectory(file.file_path) === currentDir);
  }, [authz.isAdmin, files, ownedSessionIds, currentDir]);

  const allVisibleFiles = React.useMemo(() => (
    authz.isAdmin ? files : files.filter((file) => typeof file.session_id === 'number' && ownedSessionIds.has(file.session_id))
  ), [authz.isAdmin, files, ownedSessionIds]);

  const dirs = React.useMemo(() => uniqueDirs(allVisibleFiles), [allVisibleFiles]);
  const browserFolders = React.useMemo<FolderNode[]>(
    () => [{ name: 'Files', path: '/', children: dirs.filter((dir) => dir !== '/').map((dir) => ({ name: dir, path: dir })) }],
    [dirs]
  );
  const browserFiles = React.useMemo<FileItem[]>(
    () => visibleFiles.map((file) => ({
      name: file.filename ?? `File ${file.id}`,
      path: file.file_path ?? `/files/${file.id}`,
      size: formatBytes(file.size_bytes ?? file.file_size ?? undefined),
      contentType: file.mime_type ?? undefined,
      status: file.processing_status ?? undefined,
      kind: 'file',
      testId: `expert-agent-file-${file.id}`,
    })),
    [visibleFiles]
  );
  const fileByPath = React.useMemo(
    () => new Map(visibleFiles.map((file) => [file.file_path ?? `/files/${file.id}`, file])),
    [visibleFiles]
  );

  const computedTotalBytes = React.useMemo(() => {
    const fromStats = stats?.total_bytes;
    if (typeof fromStats === 'number' && fromStats > 0) return fromStats;
    return allVisibleFiles.reduce((sum, file) => sum + Number(file.size_bytes ?? file.file_size ?? 0), 0);
  }, [stats, allVisibleFiles]);

  const knowledgeOptions = React.useMemo(() => {
    return knowledgeEntries.map((k) => {
      const meta = (k.metadata as Record<string, unknown> | null) ?? {};
      const title = String(k.title ?? meta.title ?? `Entry ${k.entry_id ?? k.id}`);
      return { value: String(k.knowledge_id ?? ''), label: `${title} (${k.knowledge_type}:${k.knowledge_id})` };
    });
  }, [knowledgeEntries]);

  const ingestFields: EntityFieldDef[] = React.useMemo(() => [
    { name: 'knowledge_type', label: 'Knowledge type', type: 'select', options: authz.isAdmin ? ['user', 'group', 'session'] : ['user'], required: true, readOnly: !authz.isAdmin },
    { name: 'knowledge_id', label: 'Knowledge target', type: 'select', options: ['', ...Array.from(new Set(knowledgeOptions.map((k) => k.value)))], required: true, readOnly: !authz.isAdmin },
    { name: 'chunk_size', label: 'Chunk size (tokens)', type: 'text' },
    { name: 'chunk_overlap', label: 'Chunk overlap (tokens)', type: 'text' },
    { name: 'embedding_model', label: 'Embedding model', type: 'text' },
  ], [authz.isAdmin, knowledgeOptions]);

  return (
    <PageScaffold title="Files" description="File inventory with folder navigation, storage metrics, and knowledge ingest." alert={latestFailure} status={status}>
      <LoadingNote loading={loading} />
      {/* Folder navigation breadcrumb */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Folder:</span>
        <Button variant={currentDir === '/' ? 'default' : 'ghost'} size="sm" onClick={() => setCurrentDir('/')}>/ (All)</Button>
        {dirs.filter((d) => d !== '/').map((dir) => (
          <Button key={dir} variant={currentDir === dir ? 'default' : 'outline'} size="sm" onClick={() => setCurrentDir(dir)}>
            {dir}
          </Button>
        ))}
        <Button variant="outline" size="sm" onClick={async () => {
          const name = window.prompt('New folder name:');
          if (!name?.trim()) return;
          const parent = currentDir === '/' ? '' : currentDir;
          try {
            await api.createDirectory(`${parent}/${name.trim()}`);
            setStatus(`Created folder ${name.trim()}.`);
            await refresh();
          } catch (error) {
            captureFailure(error);
          }
        }}>+ Folder</Button>
      </div>
      {/* Storage info bar */}
      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
        <span>{allVisibleFiles.length} files</span>
        <span>{formatBytes(computedTotalBytes)} total</span>
        {stats?.total_files != null && <span>{stats.total_files} storage objects</span>}
        {stats?.storage_root && <span title="Storage URI">URI: {stats.storage_root}</span>}
      </div>
      <FileDropZone
        onDrop={authz.isAdmin ? handleUpload : () => undefined}
        disabled={!authz.isAdmin}
        label="Upload expert file"
        description="Uploaded files can be viewed, downloaded, or ingested into knowledge."
        disabledDescription="Only administrators can upload files on this page."
        testId="expert-agent-file-drop-zone"
      />
      <FileBrowser
        folders={browserFolders}
        files={browserFiles}
        currentPath={currentDir}
        loading={loading}
        errorMessage={latestFailure}
        statusMessage={`${visibleFiles.length} files visible`}
        emptyMessage={currentDir === '/' ? 'No files uploaded.' : `No files in ${currentDir}.`}
        readOnly={false}
        selectedPath={selectedFile?.file_path ?? (selectedFile ? `/files/${selectedFile.id}` : undefined)}
        onNavigate={setCurrentDir}
        onRefresh={refresh}
        onOpen={(path) => {
          const file = fileByPath.get(path);
          if (file) void viewFileContent(file);
        }}
        onDownload={(path) => {
          const file = fileByPath.get(path);
          if (file) downloadFile(file);
        }}
        onDelete={(path) => {
          const file = fileByPath.get(path);
          if (file) deleteFile(file);
        }}
        deleteConfirmation={{
          enabled: true,
          title: 'Delete file',
          description: 'Permanently delete this file from Expert Agent storage.',
          confirmLabel: 'Delete file',
        }}
        testId="expert-agent-file-browser"
      />
      <AppDataTable
        title="File inventory"
        rows={visibleFiles}
        getRowId={(file) => String(file.id)}
        emptyMessage={currentDir === '/' ? 'No files uploaded.' : `No files in ${currentDir}.`}
        itemLabel="files"
        onRefresh={refresh}
        columns={[
          { id: 'id', header: 'ID', sortable: true, sortValue: (file) => file.id, cell: (file) => <span className="font-mono text-xs">{file.id}</span> },
          { id: 'filename', header: 'Filename', sortable: true, sortValue: (file) => file.filename ?? '', cell: (file) => file.filename ?? `File ${file.id}` },
          { id: 'path', header: 'Directory', sortable: true, sortValue: (file) => file.file_path ?? '', cell: (file) => <button className="text-blue-600 hover:underline text-left" onClick={() => setCurrentDir(fileDirectory(file.file_path))}>{fileDirectory(file.file_path)}</button> },
          statusColumn<FileRecord>({ getValue: (file) => {
            const s = file.processing_status ?? 'not reported';
            if (s === 'processing' || s === 'pending') return 'importing';
            return s;
          } }),
          { id: 'mime_type', header: 'Type', sortable: true, sortValue: (file) => file.mime_type ?? '', cell: (file) => file.mime_type ?? 'N/A' },
          { id: 'size', header: 'Size', sortable: true, sortValue: (file) => file.size_bytes ?? file.file_size ?? 0, cell: (file) => formatBytes(file.size_bytes ?? file.file_size ?? undefined) },
          { id: 'created', header: 'Created', sortable: true, sortValue: (file) => file.created_at ?? '', cell: (file) => renderRelativeTime(file.created_at) },
        ]}
        rowActions={[
          { label: 'View', onClick: (file) => void viewFileContent(file) },
          { label: 'Metadata', onClick: (file) => void viewFile(file) },
          { label: 'Download', onClick: (file) => downloadFile(file) },
          { label: 'Ingest', onClick: (file) => openIngestDialog(file) },
          { label: 'Delete', variant: 'destructive', onClick: (file) => void deleteFile(file) },
        ]}
        bulkActions={[
          { label: 'Delete Selected', variant: 'destructive', onClick: (rows) => void bulkDeleteFiles(rows) },
        ]}
        searchText={(file) => [
          String(file.id),
          file.filename ?? '',
          file.file_path ?? '',
          file.mime_type ?? '',
          file.processing_status ?? '',
          String(file.session_id ?? ''),
          String(file.job_id ?? ''),
        ].join(' ')}
      />
      {/* File detail / viewer panel */}
      {selectedFile && (
        <div className="rounded-lg border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">{selectedFile.filename ?? `File ${selectedFile.id}`}</h3>
            <Button variant="ghost" size="sm" onClick={() => { setSelectedFile(null); setFileContent(null); }}>Close</Button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div><span className="text-muted-foreground">ID:</span> <span className="font-mono">{selectedFile.id}</span></div>
            <div><span className="text-muted-foreground">Type:</span> {selectedFile.mime_type ?? 'N/A'}</div>
            <div><span className="text-muted-foreground">Size:</span> {formatBytes(selectedFile.size_bytes ?? selectedFile.file_size ?? undefined)}</div>
            <div><span className="text-muted-foreground">Status:</span> <Badge variant={selectedFile.processing_status === 'completed' ? 'default' : 'secondary'}>{selectedFile.processing_status ?? 'unknown'}</Badge></div>
            <div><span className="text-muted-foreground">Path:</span> {selectedFile.file_path ?? 'N/A'}</div>
            <div><span className="text-muted-foreground">Session:</span> {selectedFile.session_id ?? 'N/A'}</div>
            <div><span className="text-muted-foreground">Job:</span> {selectedFile.job_id ?? 'N/A'}</div>
            <div><span className="text-muted-foreground">Created:</span> {renderRelativeTime(selectedFile.created_at)}</div>
            {selectedFile.metadata && typeof selectedFile.metadata === 'object' && Object.entries(selectedFile.metadata as Record<string, unknown>).map(([key, value]) => (
              <div key={key}><span className="text-muted-foreground">{key}:</span> {String(value)}</div>
            ))}
          </div>
          {fileContent !== null && (
            <DocumentViewer
              title="Content Preview"
              content={fileContent}
              format="auto"
              maxHeight="320px"
              downloadFilename={selectedFile.filename ?? `file-${selectedFile.id}.txt`}
            />
          )}
          {fileContent === null && selectedFile.mime_type && !selectedFile.mime_type.startsWith('text/') && (
            <p className="text-xs text-muted-foreground">Binary file — use Download to view.</p>
          )}
        </div>
      )}
      <CrudEntityDialog
        open={ingestDialogOpen}
        title={ingestFileTarget ? `Ingest ${ingestFileTarget.filename ?? ingestFileTarget.id}` : 'Ingest file'}
        mode={'edit' as EntityFormMode}
        fields={ingestFields}
        values={ingestForm}
        onChange={(name, value) => setIngestForm((current) => ({ ...current, [name]: value as never }))}
        onSubmit={() => void ingestFile()}
        onCancel={closeIngestDialog}
        relatedPanels={ingestFileTarget ? [{ title: 'Selected file', items: [{ id: String(ingestFileTarget.id), label: `${ingestFileTarget.filename ?? ingestFileTarget.id} • ${formatBytes(ingestFileTarget.size_bytes ?? 0)} • ${ingestFileTarget.processing_status ?? 'unknown status'}` }] }] : []}
      />
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Delete file"
        description="Permanently delete this file from Expert Agent storage."
        targetName={deleteTarget?.filename ?? (deleteTarget ? String(deleteTarget.id) : undefined)}
        confirmLabel="Delete file"
        confirmVariant="destructive"
        onConfirm={() => {
          const target = deleteTarget;
          setDeleteTarget(null);
          if (target) void deleteFileNow(target);
        }}
      />
      <ConfirmDialog
        open={bulkDeleteTargets.length > 0}
        onOpenChange={(open) => {
          if (!open) setBulkDeleteTargets([]);
        }}
        title="Delete selected files"
        description="Permanently delete the selected files from Expert Agent storage."
        targetName={`${bulkDeleteTargets.length} files`}
        confirmLabel="Delete files"
        confirmVariant="destructive"
        onConfirm={() => {
          const targets = bulkDeleteTargets;
          setBulkDeleteTargets([]);
          void bulkDeleteFilesNow(targets);
        }}
      />
    </PageScaffold>
  );
}
