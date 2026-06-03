import * as React from 'react';
import { Badge, Button, Card, CardContent, CardHeader, JsonBlock, Label, Textarea, statusColumn, type EntityFieldDef, type EntityFormMode } from '@cloud-dog/ui';
import { useAuthz } from '../lib/authz';
import { useExpertAgentState } from '../state/AppState';
import type { ChannelAccessControl, ChannelConfigRecord, ChannelRecord, ExpertRecord, SessionMessageRecord } from '../lib/api';
import { AppDataTable, CrudEntityDialog } from '../lib/data-table-adapter';
import { LoadingNote, PageScaffold, formatCount, renderRelativeTime } from './shared';


type ChannelForm = {
  name: string;
  expert_config_id: string;
  description: string;
  context_type: string;
  expected_outcomes: string;
  history_scope: string;
  rerank_model: string;
  enabled: boolean;
};

const emptyForm: ChannelForm = {
  name: '',
  expert_config_id: '',
  description: '',
  context_type: 'chat',
  expected_outcomes: '',
  history_scope: 'channel',
  rerank_model: '',
  enabled: true,
};

const emptyAccessControl = { users: [], groups: [], roles: [] } satisfies ChannelAccessControl;

function commaList(value: unknown): string {
  return Array.isArray(value)
    ? value.map((entry) => {
      if (typeof entry === 'string') return entry;
      if (entry && typeof entry === 'object') {
        const record = entry as Record<string, unknown>;
        return String(record.id ?? record.name ?? record.username ?? record.role ?? '');
      }
      return '';
    }).filter(Boolean).join(', ')
    : '';
}

function parseBindingList(value: string): Array<Record<string, unknown>> {
  return value.split(',').map((part) => part.trim()).filter(Boolean).map((id) => ({ id }));
}

function parseRoleList(value: string): string[] {
  return value.split(',').map((part) => part.trim()).filter(Boolean);
}

/* EXPWEB-037: channel type options */
const CHANNEL_TYPES = [
  { value: 'chat', label: 'Chat' },
  { value: 'transactional', label: 'Transactional' },
  { value: 'workflow', label: 'Workflow' },
];

export function ChannelsPage() {
  const authz = useAuthz();
  const { api, latestFailure, captureFailure, clearFailure } = useExpertAgentState();
  const [channels, setChannels] = React.useState<ChannelRecord[]>([]);
  const [experts, setExperts] = React.useState<ExpertRecord[]>([]);
  const [messageCounts, setMessageCounts] = React.useState<Record<number, number>>({});
  const [form, setForm] = React.useState<ChannelForm>(emptyForm);
  const [editingId, setEditingId] = React.useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [status, setStatus] = React.useState<string | null>(null);
  /* EXPWEB-034/035/040: channel detail + history state */
  const [selectedChannel, setSelectedChannel] = React.useState<ChannelRecord | null>(null);
  const [channelHistory, setChannelHistory] = React.useState<SessionMessageRecord[]>([]);
  const [channelConfig, setChannelConfig] = React.useState<ChannelConfigRecord | null>(null);
  const [channelPermissions, setChannelPermissions] = React.useState<ChannelAccessControl>(emptyAccessControl);
  const [permissionDraft, setPermissionDraft] = React.useState({ users: '', groups: '', roles: '' });
  /* EXPWEB-041: test channel state */
  const [testMessage, setTestMessage] = React.useState('');
  const [testResponse, setTestResponse] = React.useState<string | null>(null);
  const [testing, setTesting] = React.useState(false);
  const [savingPermissions, setSavingPermissions] = React.useState(false);
  const [exportResult, setExportResult] = React.useState<Record<string, unknown> | null>(null);
  const [exporting, setExporting] = React.useState(false);

  const refresh = React.useCallback(async () => {
    clearFailure();
    setLoading(true);
    try {
      const [channelRecords, expertRecords] = await Promise.all([api.listChannels(), api.listExperts()]);
      setChannels(channelRecords);
      setExperts(expertRecords);
      const counts = await Promise.all(
        channelRecords.map(async (channel) => {
          try {
            const summary = await api.getChannelHistorySummary(channel.id);
            return [channel.id, summary.count] as const;
          } catch {
            return [channel.id, 0] as const;
          }
        })
      );
      setMessageCounts(Object.fromEntries(counts));
    } catch (error) {
      captureFailure(error);
    } finally {
      setLoading(false);
    }
  }, [api, captureFailure, clearFailure]);

  React.useEffect(() => { void refresh(); }, [refresh]);

  /* EXPWEB-036: expert selection uses proper select with names */
  const fields: EntityFieldDef[] = React.useMemo(() => [
    { name: 'name', label: 'Name', type: 'text', required: true },
    { name: 'expert_config_id', label: 'Expert', type: 'select', options: experts.map((expert) => expert.name || `Expert ${expert.id}`) },
    { name: 'enabled', label: 'Enabled', type: 'boolean' },
  ], [experts]);

  const openCreate = React.useCallback(() => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }, []);

  const openEdit = React.useCallback((channel: ChannelRecord) => {
    const expertLabel =
      experts.find((expert) => expert.id === (channel.expert_config_id ?? channel.expert_id))?.name ?? '';
    setEditingId(channel.id);
    setForm({
      name: channel.name,
      expert_config_id: expertLabel,
      description: channel.description ?? '',
      context_type: (channel as Record<string, unknown>).context_type as string ?? 'chat',
      expected_outcomes: channel.expected_outcomes ?? '',
      history_scope: channel.history_scope ?? 'channel',
      rerank_model: channel.rerank_model ?? '',
      enabled: channel.enabled !== false,
    });
    setDialogOpen(true);
  }, [experts]);

  const closeDialog = React.useCallback(() => {
    setDialogOpen(false);
    setEditingId(null);
    setForm(emptyForm);
  }, []);

  const saveChannel = React.useCallback(async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    clearFailure();
    try {
      const selectedExpertId = experts.find((expert) => (expert.name || `Expert ${expert.id}`) === form.expert_config_id)?.id;
      const payload = {
        name: form.name,
        expert_config_id: selectedExpertId,
        description: form.description,
        context_type: form.context_type,
        expected_outcomes: form.expected_outcomes,
        history_scope: form.history_scope,
        rerank_model: form.rerank_model,
        enabled: form.enabled,
      };
      if (editingId === null) {
        await api.createChannel(payload);
        setStatus(`Created channel ${form.name}.`);
      } else {
        await api.updateChannel(editingId, payload);
        setStatus(`Updated channel ${form.name}.`);
      }
      closeDialog();
      await refresh();
    } catch (error) {
      captureFailure(error);
    } finally {
      setSaving(false);
    }
  }, [api, captureFailure, clearFailure, closeDialog, editingId, experts, form, refresh]);

  const deleteChannel = React.useCallback(async (channel: ChannelRecord) => {
    if (!window.confirm(`Delete channel ${channel.name}?`)) return;
    clearFailure();
    try {
      await api.deleteChannel(channel.id);
      setSelectedChannel((c) => (c?.id === channel.id ? null : c));
      setStatus(`Deleted channel ${channel.name}.`);
      await refresh();
    } catch (error) {
      captureFailure(error);
    }
  }, [api, captureFailure, clearFailure, refresh]);

  const bulkDeleteChannels = React.useCallback(async (selected: ChannelRecord[]) => {
    if (!selected.length) return;
    if (!window.confirm(`Delete ${selected.length} selected channels?`)) return;
    clearFailure();
    try {
      await Promise.all(selected.map(async (channel) => api.deleteChannel(channel.id)));
      setSelectedChannel(null);
      setStatus(`Deleted ${selected.length} channels.`);
      await refresh();
    } catch (error) {
      captureFailure(error);
    }
  }, [api, captureFailure, clearFailure, refresh]);

  /* EXPWEB-034/035/040: view channel detail + message history */
  const viewChannel = React.useCallback(async (channel: ChannelRecord) => {
    clearFailure();
    try {
      setSelectedChannel(channel);
      setChannelConfig(null);
      setChannelPermissions(emptyAccessControl);
      setPermissionDraft({ users: '', groups: '', roles: '' });
      setExportResult(null);
      setTestResponse(null);
      setTestMessage('');
      /* EXPWEB-035/040: fetch channel message history */
      const [historyResult, permissionsResult, configResult] = await Promise.all([
        api.getChannelHistory?.(channel.id).catch(() => ({ messages: [] })),
        api.getChannelPermissions(channel.id).catch(() => emptyAccessControl),
        api.getChannelConfig(channel.id).catch(() => null),
      ]);
      const messages: SessionMessageRecord[] = (historyResult as Record<string, unknown>)?.messages as SessionMessageRecord[] ?? [];
      setChannelHistory(messages);
      setChannelPermissions(permissionsResult);
      setPermissionDraft({
        users: commaList(permissionsResult.users),
        groups: commaList(permissionsResult.groups),
        roles: commaList(permissionsResult.roles),
      });
      setChannelConfig(configResult);
      setStatus(`Viewing channel ${channel.name} — ${messages.length} messages.`);
    } catch (error) {
      captureFailure(error);
    }
  }, [api, captureFailure, clearFailure]);

  /* EXPWEB-041: test channel with a probe message */
  const testChannel = React.useCallback(async (channel: ChannelRecord) => {
    if (!testMessage.trim()) return;
    setTesting(true);
    clearFailure();
    try {
      const result = await api.sendChannelMessage(channel.id, {
        message: testMessage,
        user_id: 1,
        max_tokens: 64,
      });
      setTestResponse(result?.response ?? result?.content ?? JSON.stringify(result));
      setStatus(`Test message sent to channel ${channel.name}.`);
    } catch (error) {
      captureFailure(error);
      setTestResponse(`Error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setTesting(false);
    }
  }, [api, captureFailure, clearFailure, testMessage]);

  /* EXPWEB-043: navigate to audit/logs with channel filter */
  const navigateToLogs = React.useCallback((channel: ChannelRecord) => {
    const params = new URLSearchParams();
    params.set('filter_channel', String(channel.id));
    window.location.href = `/admin/monitoring?${params.toString()}`;
  }, []);

  const savePermissions = React.useCallback(async (channel: ChannelRecord) => {
    setSavingPermissions(true);
    clearFailure();
    try {
      const saved = await api.updateChannelPermissions(channel.id, {
        users: parseBindingList(permissionDraft.users),
        groups: parseBindingList(permissionDraft.groups),
        roles: parseRoleList(permissionDraft.roles),
      });
      setChannelPermissions(saved);
      setStatus(`Updated access control for channel ${channel.name}.`);
    } catch (error) {
      captureFailure(error);
    } finally {
      setSavingPermissions(false);
    }
  }, [api, captureFailure, clearFailure, permissionDraft]);

  const exportHistory = React.useCallback(async (channel: ChannelRecord) => {
    setExporting(true);
    clearFailure();
    try {
      const exported = await api.exportChannelHistory(channel.id);
      setExportResult(exported);
      setStatus(`Exported ${exported.exported_count} channel messages.`);
    } catch (error) {
      captureFailure(error);
    } finally {
      setExporting(false);
    }
  }, [api, captureFailure, clearFailure]);

  return (
    /* EXPWEB-039: removed SummaryGrid (contract surface) */
    <PageScaffold title="Channels" description="Channel registry with message history, testing, and configuration." alert={latestFailure} status={status}>
      <LoadingNote loading={loading} />
      {authz.isAdmin ? (
        <div className="flex justify-end">
          <Button type="button" onClick={openCreate}>Create Channel</Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Restricted users have view-only access to channels.</p>
      )}
      <AppDataTable
        title="Channel inventory"
        rows={channels}
        getRowId={(channel) => String(channel.id)}
        emptyMessage="No channels reported by the backend."
        itemLabel="channels"
        onRefresh={refresh}
        columns={[
          { id: 'name', header: 'Name', sortable: true, sortValue: (channel) => channel.name, cell: (channel) => channel.name },
          { id: 'description', header: 'Description', sortable: true, sortValue: (channel) => channel.description ?? '', cell: (channel) => channel.description ?? 'N/A' },
          /* EXPWEB-037: show actual channel type from data */
          { id: 'type', header: 'Type', sortable: true, sortValue: (channel) => (channel as Record<string, unknown>).context_type as string ?? 'chat', cell: (channel) => (channel as Record<string, unknown>).context_type as string ?? 'chat' },
          { id: 'expert', header: 'Expert', sortable: true, sortValue: (channel) => String(channel.expert_config_id ?? channel.expert_id ?? ''), cell: (channel) => experts.find((expert) => expert.id === (channel.expert_config_id ?? channel.expert_id))?.name ?? 'N/A' },
          statusColumn<ChannelRecord>({ getValue: (channel) => channel.enabled !== false ? 'active' : 'disabled' }),
          { id: 'messages', header: 'Messages', sortable: true, sortValue: (channel) => messageCounts[channel.id] ?? 0, cell: (channel) => formatCount(messageCounts[channel.id] ?? 0) },
        ]}
        rowActions={[
          /* EXPWEB-034: View action opening channel detail */
          { label: 'View', onClick: (channel) => void viewChannel(channel) },
          ...(authz.isAdmin ? [
            { label: 'Edit', onClick: openEdit },
            /* EXPWEB-043: audit/log link */
            { label: 'Logs', onClick: navigateToLogs },
            { label: 'Delete', variant: 'destructive' as const, onClick: (channel: ChannelRecord) => void deleteChannel(channel) },
          ] : []),
        ]}
        bulkActions={authz.isAdmin ? [
          { label: 'Delete Selected', variant: 'destructive', onClick: (rows) => void bulkDeleteChannels(rows) },
        ] : undefined}
        searchText={(channel) => [
          channel.name,
          channel.description ?? '',
          experts.find((expert) => expert.id === (channel.expert_config_id ?? channel.expert_id))?.name ?? '',
          channel.enabled !== false ? 'enabled' : 'disabled',
        ].join(' ')}
      />

      {/* EXPWEB-034/035/040: Channel detail pane with history, test, and metadata */}
      {selectedChannel ? (
        <div data-testid="channel-detail-pane" className="grid gap-4 xl:grid-cols-[1fr_1fr]">
          {/* EXPWEB-035/040: message history with export/timings */}
          <Card data-testid="channel-history-pane">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold">Channel Messages</h2>
                  <p className="text-sm text-muted-foreground">{selectedChannel.name} — {channelHistory.length} messages.</p>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="secondary" size="sm" onClick={() => void exportHistory(selectedChannel)} data-testid="channel-export-history" disabled={exporting}>
                    {exporting ? 'Exporting...' : 'Export JSON'}
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => navigateToLogs(selectedChannel)} data-testid="channel-view-logs">
                    View Logs
                  </Button>
                  <Button type="button" variant="secondary" size="sm" onClick={() => setSelectedChannel(null)}>
                    Close
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {channelHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground">No messages recorded for this channel.</p>
              ) : channelHistory.map((entry, idx) => (
                <div key={entry.id ?? idx} className="rounded-xl border p-3 space-y-2" data-testid={`channel-history-entry-${entry.id ?? idx}`}>
                  <div className="flex items-center justify-between gap-3">
                    <Badge variant={entry.role === 'assistant' ? 'default' : 'secondary'}>{entry.role ?? 'message'}</Badge>
                    <span className="text-xs text-muted-foreground">{renderRelativeTime(entry.timestamp)}</span>
                  </div>
                  <p className="whitespace-pre-wrap text-sm">{entry.content ?? ''}</p>
                </div>
              ))}
              {exportResult ? (
                <JsonBlock title={`channel-${selectedChannel.id}-history-export.json`} value={exportResult} defaultCollapsed={false} />
              ) : null}
            </CardContent>
          </Card>

          {/* EXPWEB-041: Test channel + EXPWEB-042: channel config overview */}
          <Card data-testid="channel-detail-card">
            <CardHeader>
              <h2 className="text-lg font-semibold">Channel Detail</h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-sm">
                <dt className="font-medium text-muted-foreground">ID</dt><dd data-testid="channel-detail-id">{selectedChannel.id}</dd>
                <dt className="font-medium text-muted-foreground">Name</dt><dd data-testid="channel-detail-name">{selectedChannel.name}</dd>
                <dt className="font-medium text-muted-foreground">Type</dt><dd>{(selectedChannel as Record<string, unknown>).context_type as string ?? 'chat'}</dd>
                <dt className="font-medium text-muted-foreground">Expert</dt><dd>{experts.find((e) => e.id === (selectedChannel.expert_config_id ?? selectedChannel.expert_id))?.name ?? 'N/A'}</dd>
                <dt className="font-medium text-muted-foreground">Status</dt><dd>{selectedChannel.enabled !== false ? 'Active' : 'Disabled'}</dd>
                <dt className="font-medium text-muted-foreground">Messages</dt><dd>{formatCount(messageCounts[selectedChannel.id] ?? 0)}</dd>
                {/* EXPWEB-042: override settings display */}
                <dt className="font-medium text-muted-foreground">Description</dt><dd>{selectedChannel.description ?? 'N/A'}</dd>
                <dt className="font-medium text-muted-foreground">History Scope</dt><dd>{channelConfig?.history_scope ?? selectedChannel.history_scope ?? 'channel'}</dd>
                <dt className="font-medium text-muted-foreground">Rerank Model</dt><dd>{channelConfig?.rerank_model ?? selectedChannel.rerank_model ?? 'N/A'}</dd>
                <dt className="font-medium text-muted-foreground">Expected Outcomes</dt><dd>{channelConfig?.expected_outcomes ?? selectedChannel.expected_outcomes ?? 'N/A'}</dd>
              </dl>

              {/* EXPWEB-041: Test Channel */}
              {authz.isAdmin ? (
                <div className="space-y-2 border-t pt-4" data-testid="channel-test-section">
                  <Label htmlFor="test-message">Test Channel</Label>
                  <div className="flex gap-2">
                    <input
                      id="test-message"
                      type="text"
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                      placeholder="Type a test message..."
                      value={testMessage}
                      onChange={(e) => setTestMessage(e.target.value)}
                      data-testid="channel-test-input"
                    />
                    <Button type="button" size="sm" disabled={testing || !testMessage.trim()} onClick={() => void testChannel(selectedChannel)} data-testid="channel-test-send">
                      {testing ? 'Sending...' : 'Test'}
                    </Button>
                  </div>
                  {testResponse ? (
                    <div className="rounded-md border p-3 bg-muted/50 text-sm whitespace-pre-wrap" data-testid="channel-test-response">
                      {testResponse}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {/* EXPWEB-038: RBAC/users/groups/roles relationship management */}
              <div className="border-t pt-4 space-y-3" data-testid="channel-permissions-section">
                <h3 className="text-sm font-medium text-muted-foreground">Access Control</h3>
                <div className="grid gap-3 md:grid-cols-3">
                  <label className="space-y-1">
                    <Label htmlFor="channel-permission-users">Users</Label>
                    <input
                      id="channel-permission-users"
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                      value={permissionDraft.users}
                      onChange={(event) => setPermissionDraft((current) => ({ ...current, users: event.target.value }))}
                      data-testid="channel-permission-users"
                    />
                  </label>
                  <label className="space-y-1">
                    <Label htmlFor="channel-permission-groups">Groups</Label>
                    <input
                      id="channel-permission-groups"
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                      value={permissionDraft.groups}
                      onChange={(event) => setPermissionDraft((current) => ({ ...current, groups: event.target.value }))}
                      data-testid="channel-permission-groups"
                    />
                  </label>
                  <label className="space-y-1">
                    <Label htmlFor="channel-permission-roles">Roles</Label>
                    <input
                      id="channel-permission-roles"
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                      value={permissionDraft.roles}
                      onChange={(event) => setPermissionDraft((current) => ({ ...current, roles: event.target.value }))}
                      data-testid="channel-permission-roles"
                    />
                  </label>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground" data-testid="channel-permissions-summary">
                    Users {channelPermissions.users?.length ?? 0} · Groups {channelPermissions.groups?.length ?? 0} · Roles {channelPermissions.roles?.length ?? 0}
                  </p>
                  {authz.isAdmin ? (
                    <Button type="button" size="sm" onClick={() => void savePermissions(selectedChannel)} disabled={savingPermissions} data-testid="channel-permission-save">
                      {savingPermissions ? 'Saving...' : 'Save Access'}
                    </Button>
                  ) : null}
                </div>
              </div>

              <JsonBlock title={`channel-${selectedChannel.id}.json`} value={{ ...selectedChannel, config: channelConfig, permissions: channelPermissions }} defaultCollapsed={true} />
            </CardContent>
          </Card>
        </div>
      ) : null}

      {authz.isAdmin ? (
        <CrudEntityDialog
          open={dialogOpen}
          title={editingId === null ? 'Create Channel' : 'Edit Channel'}
          mode={(editingId === null ? 'add' : 'edit') as EntityFormMode}
          fields={fields}
          values={form}
          onChange={(name, value) => setForm((current) => ({ ...current, [name]: value as never }))}
          onSubmit={() => void saveChannel()}
          onCancel={closeDialog}
          relatedPanels={[
            { title: 'Experts', items: experts.map((expert) => ({ id: String(expert.id), label: `${expert.name} • ${expert.title ?? expert.llm_model ?? 'no title'}` })), emptyMessage: 'No experts are available.' },
          ]}
          extra={
            <div className="space-y-3">
              <label className="space-y-2 block">
                <Label htmlFor="channel-description">Description</Label>
                <Textarea id="channel-description" rows={3} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
              </label>
              {/* EXPWEB-037: channel type picker */}
              <label className="space-y-2 block">
                <Label htmlFor="channel-type">Channel Type</Label>
                <select
                  id="channel-type"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                  value={form.context_type}
                  onChange={(e) => setForm((current) => ({ ...current, context_type: e.target.value }))}
                  data-testid="channel-type-select"
                >
                  {CHANNEL_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </label>
              {/* EXPWEB-042: channel override settings */}
              <label className="space-y-2 block">
                <Label htmlFor="channel-history-scope">History Scope</Label>
                <select
                  id="channel-history-scope"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                  value={form.history_scope}
                  onChange={(event) => setForm((current) => ({ ...current, history_scope: event.target.value }))}
                  data-testid="channel-history-scope-select"
                >
                  <option value="channel">Channel</option>
                  <option value="user">User</option>
                  <option value="session">Session</option>
                </select>
              </label>
              <label className="space-y-2 block">
                <Label htmlFor="channel-rerank-model">Rerank Model</Label>
                <input
                  id="channel-rerank-model"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                  value={form.rerank_model}
                  onChange={(event) => setForm((current) => ({ ...current, rerank_model: event.target.value }))}
                  data-testid="channel-rerank-model"
                />
              </label>
              <label className="space-y-2 block">
                <Label htmlFor="channel-expected-outcomes">Expected Outcomes</Label>
                <Textarea
                  id="channel-expected-outcomes"
                  rows={3}
                  value={form.expected_outcomes}
                  onChange={(event) => setForm((current) => ({ ...current, expected_outcomes: event.target.value }))}
                  data-testid="channel-expected-outcomes"
                />
              </label>
              {saving ? <p className="text-sm text-muted-foreground">Saving channel changes...</p> : null}
            </div>
          }
        />
      ) : null}
    </PageScaffold>
  );
}
