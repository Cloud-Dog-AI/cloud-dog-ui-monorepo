import * as React from 'react';
import { useAuth } from '@cloud-dog/auth';
import { Badge, Button, Label, Select, Textarea, type EntityFieldDef, type EntityFormMode, type RelatedItem } from '@cloud-dog/ui';
import { useAuthz } from '../lib/authz';
import { useExpertAgentState } from '../state/AppState';
import type { ExpertRecord, KnowledgeRecord } from '../lib/api';
import { AppDataTable, CrudEntityDialog } from '../lib/data-table-adapter';
import { LoadingNote, PageScaffold, formatBytes, renderRelativeTime } from './shared';


type KnowledgeForm = {
  knowledge_type: 'user' | 'group' | 'session';
  knowledge_id: string;
  title: string;
  content: string;
  expert_id: string;
  // EA-51: editable knowledge/index/ingest/lifecycle parameters (persisted to metadata).
  backend: string;
  collection: string;
  embedding_model: string;
  ttl: string;
};

const emptyForm: KnowledgeForm = { knowledge_type: 'user', knowledge_id: '', title: '', content: '', expert_id: '', backend: '', collection: '', embedding_model: '', ttl: '' };

function entryId(entry: KnowledgeRecord): string {
  return String(entry.entry_id ?? entry.id ?? '');
}

function entryTitle(entry: KnowledgeRecord): string {
  const metadata = entry.metadata;
  const metadataTitle = metadata && typeof metadata === 'object' ? (metadata as Record<string, unknown>).title : null;
  return String(entry.title ?? metadataTitle ?? `Entry ${entryId(entry)}`);
}

export function KnowledgePage() {
  const auth = useAuth();
  const authz = useAuthz();
  const { api, latestFailure, captureFailure, clearFailure } = useExpertAgentState();
  const [entries, setEntries] = React.useState<KnowledgeRecord[]>([]);
  const [experts, setExperts] = React.useState<ExpertRecord[]>([]);
  const [form, setForm] = React.useState<KnowledgeForm>(emptyForm);
  const [typeFilter, setTypeFilter] = React.useState<'all' | KnowledgeForm['knowledge_type']>('all');
  const [editingEntryId, setEditingEntryId] = React.useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [detailEntry, setDetailEntry] = React.useState<KnowledgeRecord | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [status, setStatus] = React.useState<string | null>(null);
  // EA-52: import / reuse an existing knowledge entry as the basis for a new one.
  const [importOpen, setImportOpen] = React.useState(false);
  const [importSourceId, setImportSourceId] = React.useState('');

  React.useEffect(() => {
    if (!form.knowledge_id && auth.user?.id) {
      setForm((current) => ({ ...current, knowledge_id: String(auth.user?.id ?? '') }));
    }
  }, [auth.user?.id, form.knowledge_id]);

  const refresh = React.useCallback(async () => {
    clearFailure();
    setLoading(true);
    try {
      const [entryRecords, expertRecords] = await Promise.all([api.listKnowledge(), api.listExperts()]);
      setEntries(entryRecords);
      setExperts(expertRecords);
    } catch (error) {
      captureFailure(error);
    } finally {
      setLoading(false);
    }
  }, [api, captureFailure, clearFailure]);

  React.useEffect(() => { void refresh(); }, [refresh]);

  const fields: EntityFieldDef[] = React.useMemo(() => [
    { name: 'knowledge_type', label: 'Knowledge type', type: 'select', options: authz.isAdmin ? ['user', 'group', 'session'] : ['user'], required: true, readOnly: !authz.isAdmin },
    { name: 'knowledge_id', label: 'Knowledge ID', type: 'text', required: true, readOnly: !authz.isAdmin },
    { name: 'title', label: 'Title', type: 'text', required: true },
    { name: 'expert_id', label: 'Linked expert', type: 'select', options: ['', ...experts.map((expert) => expert.name || `Expert ${expert.id}`)] },
    // EA-51: knowledge / index / ingest / lifecycle parameters (persist to metadata).
    { name: 'backend', label: 'Backend (vector store)', type: 'select', options: ['', 'chroma', 'qdrant', 'history-store'] },
    { name: 'collection', label: 'Collection / index', type: 'text' },
    { name: 'embedding_model', label: 'Embedding model', type: 'text' },
    { name: 'ttl', label: 'Lifecycle TTL', type: 'text' },
  ], [authz.isAdmin, experts]);

  const openCreate = React.useCallback(() => {
    setEditingEntryId(null);
    setForm({ ...emptyForm, knowledge_id: String(auth.user?.id ?? '') });
    setDialogOpen(true);
  }, [auth.user?.id]);

  const openEdit = React.useCallback((entry: KnowledgeRecord) => {
    const metadata = entry.metadata as Record<string, unknown> | null | undefined;
    const expertName = experts.find((expert) => String(expert.id) === String(metadata?.expert_id ?? ''))?.name ?? '';
    setEditingEntryId(entryId(entry));
    setForm({
      knowledge_type: (entry.knowledge_type as KnowledgeForm['knowledge_type']) ?? 'user',
      knowledge_id: String(entry.knowledge_id ?? auth.user?.id ?? ''),
      title: String(entry.title ?? metadata?.title ?? ''),
      content: entry.content ?? entry.description ?? '',
      expert_id: expertName,
      backend: String(metadata?.backend ?? metadata?.vector_store_type ?? ''),
      collection: String(metadata?.collection ?? ''),
      embedding_model: String(metadata?.embedding_model ?? ''),
      ttl: String(metadata?.ttl ?? ''),
    });
    setDialogOpen(true);
  }, [auth.user?.id, experts]);

  const reuseExisting = React.useCallback(() => {
    const source = entries.find((entry) => entryId(entry) === importSourceId);
    if (!source) return;
    const metadata = source.metadata as Record<string, unknown> | null | undefined;
    const expertName = experts.find((expert) => String(expert.id) === String(metadata?.expert_id ?? ''))?.name ?? '';
    setEditingEntryId(null);
    setForm({
      knowledge_type: (source.knowledge_type as KnowledgeForm['knowledge_type']) ?? 'user',
      knowledge_id: String(auth.user?.id ?? source.knowledge_id ?? ''),
      title: `${String(source.title ?? metadata?.title ?? entryTitle(source))} (imported)`,
      content: source.content ?? source.description ?? '',
      expert_id: expertName,
      backend: String(metadata?.backend ?? metadata?.vector_store_type ?? ''),
      collection: String(metadata?.collection ?? ''),
      embedding_model: String(metadata?.embedding_model ?? ''),
      ttl: String(metadata?.ttl ?? ''),
    });
    setImportOpen(false);
    setDialogOpen(true);
  }, [entries, experts, importSourceId, auth.user?.id]);

  const closeDialog = React.useCallback(() => {
    setDialogOpen(false);
    setEditingEntryId(null);
    setForm({ ...emptyForm, knowledge_id: String(auth.user?.id ?? '') });
  }, [auth.user?.id]);

  const saveEntry = React.useCallback(async () => {
    if (!form.knowledge_id.trim() || !form.content.trim() || !form.title.trim()) return;
    setSaving(true);
    clearFailure();
    try {
      const metadata: Record<string, unknown> = { title: form.title };
      if (form.expert_id) {
        const selectedExpert = experts.find((e) => (e.name || `Expert ${e.id}`) === form.expert_id);
        if (selectedExpert) metadata.expert_id = Number(selectedExpert.id);
      }
      // EA-51: persist editable knowledge/index/ingest/lifecycle params into metadata.
      if (form.backend) metadata.backend = form.backend;
      if (form.collection) metadata.collection = form.collection;
      if (form.embedding_model) metadata.embedding_model = form.embedding_model;
      if (form.ttl) metadata.ttl = form.ttl;
      if (editingEntryId === null) {
        await api.createKnowledge({ knowledge_type: form.knowledge_type, knowledge_id: Number(form.knowledge_id), content: form.content, metadata });
        setStatus('Knowledge entry created.');
      } else {
        await api.updateKnowledge({ knowledge_type: form.knowledge_type, knowledge_id: Number(form.knowledge_id), entry_id: editingEntryId, content: form.content, metadata });
        setStatus('Knowledge entry updated.');
      }
      closeDialog();
      await refresh();
    } catch (error) {
      captureFailure(error);
    } finally {
      setSaving(false);
    }
  }, [api, captureFailure, clearFailure, closeDialog, editingEntryId, form, refresh]);

  const deleteEntry = React.useCallback(async (entry: KnowledgeRecord) => {
    clearFailure();
    try {
      await api.deleteKnowledge({ knowledge_type: String(entry.knowledge_type ?? 'user'), knowledge_id: Number(entry.knowledge_id ?? auth.user?.id ?? 0), entry_id: entryId(entry) });
      setStatus('Knowledge entry deleted.');
      await refresh();
    } catch (error) {
      captureFailure(error);
    }
  }, [api, auth.user?.id, captureFailure, clearFailure, refresh]);

  const bulkDeleteEntries = React.useCallback(async (selected: KnowledgeRecord[]) => {
    if (!selected.length) return;
    clearFailure();
    try {
      await Promise.all(selected.map(async (entry) => api.deleteKnowledge({
        knowledge_type: String(entry.knowledge_type ?? 'user'),
        knowledge_id: Number(entry.knowledge_id ?? auth.user?.id ?? 0),
        entry_id: entryId(entry),
      })));
      setStatus(`Deleted ${selected.length} knowledge entries.`);
      await refresh();
    } catch (error) {
      captureFailure(error);
    }
  }, [api, auth.user?.id, captureFailure, clearFailure, refresh]);

  const activeExpert = experts.find((expert) => expert.name === form.expert_id) ?? null;
  const visibleEntries = React.useMemo(() => {
    const scopedEntries = authz.isAdmin || !authz.userId
      ? entries
      : entries.filter((entry) => entry.knowledge_type === 'user' && Number(entry.knowledge_id ?? 0) === authz.userId);
    if (typeFilter === 'all') return scopedEntries;
    return scopedEntries.filter((entry) => entry.knowledge_type === typeFilter);
  }, [authz.isAdmin, authz.userId, entries, typeFilter]);
  const relatedExperts: RelatedItem[] = activeExpert ? [{ id: String(activeExpert.id), label: activeExpert.name }] : experts.map((expert) => ({ id: String(expert.id), label: expert.name }));

  const contentSize = React.useCallback((entry: KnowledgeRecord) => {
    const text = entry.content ?? entry.description ?? '';
    return new Blob([text]).size;
  }, []);

  return (
    <PageScaffold title="Knowledge" description="Manage knowledge entries, vector collections, and ingest configuration." alert={latestFailure} status={status}>
      <LoadingNote loading={loading} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="space-y-2">
          <span className="text-sm font-medium">Filter by type</span>
          <Select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as 'all' | KnowledgeForm['knowledge_type'])}>
            <option value="all">All types</option>
            <option value="user">User</option>
            <option value="group">Group</option>
            <option value="session">Session</option>
          </Select>
        </label>
        <div className="flex items-center gap-2">
          <Button type="button" variant="secondary" onClick={() => setImportOpen((v) => !v)}>Import / Reuse</Button>
          <Button type="button" onClick={openCreate}>Add Knowledge</Button>
        </div>
      </div>
      {importOpen && (
        <div className="rounded-lg border p-4 space-y-3" data-testid="knowledge-import-panel">
          <h3 className="font-semibold text-sm">Import / reuse an existing knowledge entry</h3>
          <p className="text-sm text-muted-foreground">Select an existing entry to import its content + parameters as the basis for a new entry.</p>
          <div className="flex flex-wrap items-end gap-3">
            <label className="space-y-2">
              <span className="text-sm font-medium">Source entry</span>
              <Select value={importSourceId} onChange={(event) => setImportSourceId(event.target.value)} aria-label="Import source entry">
                <option value="">Select an entry…</option>
                {entries.map((entry) => (
                  <option key={entryId(entry)} value={entryId(entry)}>{entryTitle(entry)} (#{entryId(entry)})</option>
                ))}
              </Select>
            </label>
            <Button type="button" disabled={!importSourceId} onClick={reuseExisting}>Import selected</Button>
            <Button type="button" variant="ghost" onClick={() => setImportOpen(false)}>Cancel</Button>
          </div>
        </div>
      )}
      <AppDataTable
        title="Knowledge inventory"
        rows={visibleEntries}
        getRowId={(entry) => entryId(entry)}
        emptyMessage="No knowledge entries reported by the backend."
        itemLabel="knowledge entries"
        onRefresh={refresh}
        columns={[
          { id: 'entry_id', header: 'ID', sortable: true, sortValue: (entry) => Number(entry.entry_id ?? entry.id ?? 0), cell: (entry) => <span className="font-mono text-xs">{entryId(entry)}</span> },
          { id: 'title', header: 'Title', sortable: true, sortValue: (entry) => entryTitle(entry), cell: (entry) => entryTitle(entry) },
          { id: 'type', header: 'Type', sortable: true, sortValue: (entry) => entry.knowledge_type ?? '', cell: (entry) => entry.knowledge_type ?? 'N/A' },
          { id: 'target', header: 'Target', sortable: true, sortValue: (entry) => String(entry.knowledge_id ?? ''), cell: (entry) => entry.knowledge_id ?? 'N/A' },
          { id: 'expert', header: 'Expert', sortable: true, sortValue: (entry) => String(((entry.metadata as Record<string, unknown> | null)?.expert_id) ?? ''), cell: (entry) => experts.find((expert) => String(expert.id) === String((entry.metadata as Record<string, unknown> | null)?.expert_id ?? ''))?.name ?? 'N/A' },
          { id: 'backend', header: 'Backend', sortable: true, sortValue: (entry) => String((entry.metadata as Record<string, unknown> | null)?.backend ?? (entry.metadata as Record<string, unknown> | null)?.vector_store_type ?? ''), cell: (entry) => {
            const meta = (entry.metadata as Record<string, unknown> | null) ?? {};
            const backend = String(meta.backend ?? meta.vector_store_type ?? '').toLowerCase();
            if (backend === 'chroma') return <Badge variant="default" data-testid={`knowledge-backend-${entry.entry_id ?? entry.id}`}>Chroma</Badge>;
            if (backend === 'qdrant') return <Badge variant="secondary" data-testid={`knowledge-backend-${entry.entry_id ?? entry.id}`}>Qdrant</Badge>;
            return <span className="text-xs text-muted-foreground" data-testid={`knowledge-backend-${entry.entry_id ?? entry.id}`}>history-store</span>;
          } },
          { id: 'size', header: 'Size', sortable: true, sortValue: (entry) => contentSize(entry), cell: (entry) => formatBytes(contentSize(entry)) },
          { id: 'updated', header: 'Updated', sortable: true, sortValue: (entry) => entry.created_at ?? '', cell: (entry) => renderRelativeTime(entry.created_at) },
          { id: 'content', header: 'Content', cell: (entry) => (entry.content ?? entry.description ?? '').slice(0, 80) || 'N/A' },
        ]}
        rowActions={[
          { label: 'View', onClick: (entry) => setDetailEntry(entry) },
          { label: 'Edit', onClick: openEdit },
          { label: 'History', onClick: (entry) => { window.location.hash = `/monitoring?filter=knowledge&id=${entryId(entry)}`; } },
          { label: 'Delete', variant: 'destructive', onClick: (entry) => void deleteEntry(entry) },
        ]}
        bulkActions={[
          { label: 'Delete Selected', variant: 'destructive', onClick: (rows) => void bulkDeleteEntries(rows) },
        ]}
        searchText={(entry) => [
          entryId(entry),
          entryTitle(entry),
          entry.knowledge_type ?? '',
          String(entry.knowledge_id ?? ''),
          experts.find((expert) => String(expert.id) === String((entry.metadata as Record<string, unknown> | null)?.expert_id ?? ''))?.name ?? '',
          entry.content ?? entry.description ?? '',
        ].join(' ')}
      />
      {detailEntry && (
        <div className="rounded-lg border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Knowledge Detail — {entryTitle(detailEntry)}</h3>
            <Button variant="ghost" size="sm" onClick={() => setDetailEntry(null)}>Close</Button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div><span className="text-muted-foreground">Entry ID:</span> <span className="font-mono">{entryId(detailEntry)}</span></div>
            <div><span className="text-muted-foreground">Type:</span> {detailEntry.knowledge_type ?? 'N/A'}</div>
            <div><span className="text-muted-foreground">Knowledge ID:</span> {detailEntry.knowledge_id ?? 'N/A'}</div>
            <div><span className="text-muted-foreground">Size:</span> {formatBytes(contentSize(detailEntry))}</div>
            {(() => {
              const meta = (detailEntry.metadata as Record<string, unknown> | null) ?? {};
              const backend = String(meta.backend ?? meta.vector_store_type ?? '').toLowerCase();
              const params: Array<[string, string]> = [];
              if (backend) params.push(['Backend', backend]);
              if (meta.collection) params.push(['Collection', String(meta.collection)]);
              if (meta.dimensions) params.push(['Dimensions', String(meta.dimensions)]);
              if (meta.distance_metric) params.push(['Distance Metric', String(meta.distance_metric)]);
              if (meta.chunk_size) params.push(['Chunk Size', String(meta.chunk_size)]);
              if (meta.chunk_overlap) params.push(['Chunk Overlap', String(meta.chunk_overlap)]);
              if (meta.embedding_model) params.push(['Embedding Model', String(meta.embedding_model)]);
              if (meta.ttl) params.push(['TTL', String(meta.ttl)]);
              if (meta.retention) params.push(['Retention', String(meta.retention)]);
              if (meta.max_age) params.push(['Max Age', String(meta.max_age)]);
              if (meta.source_file_id) params.push(['Source File', String(meta.source_file_id)]);
              if (meta.ingested_via) params.push(['Ingested Via', String(meta.ingested_via)]);
              return params.map(([label, value]) => (
                <div key={label}><span className="text-muted-foreground">{label}:</span> {value}</div>
              ));
            })()}
          </div>
          <div><span className="text-muted-foreground text-sm">Updated:</span> {renderRelativeTime(detailEntry.created_at)}</div>
          {detailEntry.content && (
            <pre className="text-xs bg-muted p-3 rounded max-h-48 overflow-auto whitespace-pre-wrap">{detailEntry.content}</pre>
          )}
        </div>
      )}
      <CrudEntityDialog
        open={dialogOpen}
        title={editingEntryId === null ? 'Add Knowledge' : 'Edit Knowledge'}
        mode={(editingEntryId === null ? 'add' : 'edit') as EntityFormMode}
        fields={fields}
        values={form}
        onChange={(name, value) => setForm((current) => ({ ...current, [name]: value as never }))}
        onSubmit={() => void saveEntry()}
        onCancel={closeDialog}
        relatedPanels={[{ title: 'Linked experts', items: relatedExperts, emptyMessage: 'No experts are linked to this knowledge item yet.' }]}
        extra={
          <label className="space-y-2 block">
            <Label htmlFor="knowledge-content">Content</Label>
            <Textarea id="knowledge-content" rows={8} value={form.content} onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))} />
          </label>
        }
      />
    </PageScaffold>
  );
}
