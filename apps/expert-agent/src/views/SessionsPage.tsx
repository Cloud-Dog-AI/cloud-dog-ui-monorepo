import * as React from 'react';
import { Badge, Button, Card, CardContent, CardHeader, Input, JsonBlock, SessionsHistoryPanel } from '@cloud-dog/ui';
import type { SessionsHistoryAction, SessionsHistoryRow } from '@cloud-dog/ui';
import { useExpertAgentState } from '../state/AppState';
import type { ExpertRecord, SessionMessageRecord, SessionRecord } from '../lib/api';
import { renderRelativeTime } from './shared';


export function SessionsPage() {
  const { api, latestFailure, captureFailure, clearFailure } = useExpertAgentState();
  const [sessions, setSessions] = React.useState<SessionRecord[]>([]);
  const [experts, setExperts] = React.useState<ExpertRecord[]>([]);
  const [selectedSession, setSelectedSession] = React.useState<SessionRecord | null>(null);
  const [history, setHistory] = React.useState<SessionMessageRecord[]>([]);
  const [showRaw, setShowRaw] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [status, setStatus] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState('');

  const refresh = React.useCallback(async () => {
    clearFailure();
    setLoading(true);
    try {
      const [sessionRecords, expertRecords] = await Promise.all([api.listSessions(), api.listExperts()]);
      setSessions(sessionRecords);
      setExperts(expertRecords);
      setSelectedSession((current) => sessionRecords.find((session) => session.id === current?.id) ?? current);
    } catch (error) {
      captureFailure(error);
    } finally {
      setLoading(false);
    }
  }, [api, captureFailure, clearFailure]);

  React.useEffect(() => { void refresh(); }, [refresh]);

  const expertNameFor = React.useCallback((session: SessionRecord) => {
    const expertId = session.expert_config_id ?? session.expert_id;
    if (!expertId) return 'N/A';
    return experts.find((expert) => expert.id === expertId)?.name ?? `Expert ${expertId}`;
  }, [experts]);

  /* EXPWEB-060: view full session conversation history */
  const viewSession = React.useCallback(async (session: SessionRecord) => {
    clearFailure();
    try {
      const [detail, messages] = await Promise.all([
        api.getSession(session.id),
        api.listSessionMessages(session.id).catch(() => [] as SessionMessageRecord[]),
      ]);
      setSelectedSession(detail);
      setHistory(messages);
      setShowRaw(false);
      setStatus(`Loaded session ${session.id} — ${messages.length} messages.`);
    } catch (error) {
      captureFailure(error);
    }
  }, [api, captureFailure, clearFailure]);

  const deleteSession = React.useCallback(async (session: SessionRecord) => {
    clearFailure();
    try {
      await api.deleteSession(session.id);
      setSelectedSession((current) => (current?.id === session.id ? null : current));
      setStatus(`Deleted session ${session.id}.`);
      await refresh();
    } catch (error) {
      captureFailure(error);
    }
  }, [api, captureFailure, clearFailure, refresh]);

  /* EXPWEB-067: bulk delete */
  const bulkDeleteSessions = React.useCallback(async (selected: SessionRecord[]) => {
    if (!selected.length) return;
    clearFailure();
    try {
      await Promise.all(selected.map(async (session) => api.deleteSession(session.id)));
      setSelectedSession(null);
      setStatus(`Deleted ${selected.length} sessions.`);
      await refresh();
    } catch (error) {
      captureFailure(error);
    }
  }, [api, captureFailure, clearFailure, refresh]);

  /* EXPWEB-061/064: navigate to Chat with session context */
  const navigateToChat = React.useCallback((session: SessionRecord) => {
    const expertId = session.expert_config_id ?? session.expert_id;
    const params = new URLSearchParams();
    params.set('session_id', String(session.id));
    if (expertId) params.set('expert_id', String(expertId));
    window.location.href = `/chat?${params.toString()}`;
  }, []);

  /* EXPWEB-065: navigate to audit/logs filtered by session */
  const navigateToLogs = React.useCallback((session: SessionRecord) => {
    const params = new URLSearchParams();
    params.set('filter_session', String(session.id));
    window.location.href = `/audit-log?${params.toString()}`;
  }, []);

  const filteredSessions = React.useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return sessions;
    return sessions.filter((session) => [
      String(session.id),
      session.title ?? '',
      session.status ?? '',
      expertNameFor(session),
    ].join(' ').toLowerCase().includes(trimmed));
  }, [expertNameFor, query, sessions]);

  const panelRows = React.useMemo<SessionsHistoryRow[]>(() => filteredSessions.map((session) => ({
    id: String(session.id),
    label: session.title ?? `Session ${session.id}`,
    title: session.title ?? `Session ${session.id}`,
    status: session.status ?? 'not reported',
    actor: session.user_id ? `User ${session.user_id}` : undefined,
    target: expertNameFor(session),
    createdAt: session.created_at ?? undefined,
    updatedAt: session.updated_at ?? undefined,
    summary: `Expert ${expertNameFor(session)}`,
    details: [
      { label: 'ID', value: session.id },
      { label: 'Expert', value: expertNameFor(session) },
      ...(session.user_id ? [{ label: 'User ID', value: session.user_id }] : []),
    ],
    relatedItems: [
      { id: `chat-${session.id}`, label: 'Open in Chat', href: `/chat?session_id=${encodeURIComponent(String(session.id))}` },
      { id: `logs-${session.id}`, label: 'View Logs', href: `/audit-log?filter_session=${encodeURIComponent(String(session.id))}` },
    ],
  })), [expertNameFor, filteredSessions]);

  const rowActions = React.useCallback((row: SessionsHistoryRow): SessionsHistoryAction[] => {
    const session = sessions.find((item) => String(item.id) === row.id);
    if (!session) return [];
    return [
      { id: 'view-history', label: 'View History', onClick: () => void viewSession(session) },
      { id: 'open-chat', label: 'Open in Chat', onClick: () => navigateToChat(session) },
      { id: 'view-logs', label: 'View Logs', onClick: () => navigateToLogs(session) },
      {
        id: 'delete',
        label: 'Delete',
        destructive: true,
        onClick: () => void deleteSession(session),
        confirm: {
          title: 'Delete Session',
          description: 'Delete this expert-agent session and retained conversation history.',
          confirmLabel: 'Delete',
        },
      },
    ];
  }, [deleteSession, navigateToChat, navigateToLogs, sessions, viewSession]);

  const onBulkAction = React.useCallback((action: string, selectedIds: string[]) => {
    if (action !== 'delete') return;
    const selected = sessions.filter((session) => selectedIds.includes(String(session.id)));
    void bulkDeleteSessions(selected);
  }, [bulkDeleteSessions, sessions]);

  return (
    <div className="space-y-6">
      <Input
        aria-label="Search sessions"
        className="max-w-md"
        placeholder="Search sessions"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <SessionsHistoryPanel
        title="Sessions"
        description="Session inventory with sorting, bulk selection, and conversation history."
        rows={panelRows}
        loading={loading}
        error={latestFailure}
        canonicalRoute="/sessions"
        onRefresh={() => void refresh()}
        actionsForRow={rowActions}
        bulkActions={[{ label: 'Delete Selected', action: 'delete' }]}
        onBulkAction={onBulkAction}
        bulkActionConfirm={(action, selectedIds) => action === 'delete' ? {
          title: 'Delete Selected Sessions',
          description: `Delete ${selectedIds.length} selected expert-agent sessions and retained conversation history.`,
          confirmLabel: 'Delete Selected',
        } : undefined}
        selectable
        emptyMessage="No sessions reported by the backend."
        tableId="expert-agent-sessions"
      />
      {status ? <p role="status" className="text-sm text-foreground/80">{status}</p> : null}
      {/* EXPWEB-060: full conversation history in detail pane (removed EXPWEB-064 inline detail; kept as expandable) */}
      {selectedSession ? (
        <div data-testid="session-detail-pane" className="grid gap-4 xl:grid-cols-[1fr_1.4fr]">
          <Card data-testid="session-history-pane">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold">Conversation history</h2>
                  <p className="text-sm text-muted-foreground">Session {selectedSession.id} — {history.length} messages.</p>
                </div>
                <div className="flex gap-2">
                  {/* EXPWEB-061: navigate to Chat with context */}
                  <Button type="button" variant="secondary" size="sm" onClick={() => navigateToChat(selectedSession)} data-testid="session-open-chat">
                    Open in Chat
                  </Button>
                  {/* EXPWEB-065: navigate to logs */}
                  <Button type="button" variant="ghost" size="sm" onClick={() => navigateToLogs(selectedSession)} data-testid="session-view-logs">
                    View Logs
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {history.length === 0 ? (
                <p className="text-sm text-muted-foreground">No messages recorded for this session.</p>
              ) : history.map((entry) => (
                <div key={entry.id} className="rounded-xl border p-3 space-y-2" data-testid={`session-history-entry-${entry.id}`}>
                  <div className="flex items-center justify-between gap-3">
                    <Badge variant={entry.role === 'assistant' ? 'default' : 'secondary'}>{entry.role ?? 'message'}</Badge>
                    {/* EXPWEB-066: RelativeTime with correct timezone */}
                    <span className="text-xs text-muted-foreground">{renderRelativeTime(entry.timestamp)}</span>
                  </div>
                  <p className="whitespace-pre-wrap text-sm">{entry.content ?? ''}</p>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card data-testid="session-structured-detail">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold">Session detail</h2>
                  <p className="text-sm text-muted-foreground">Structured metadata for session {selectedSession.id}.</p>
                </div>
                <Button type="button" variant="secondary" onClick={() => setShowRaw((current) => !current)} data-testid="session-toggle-raw">
                  {showRaw ? 'Hide raw JSON' : 'View raw JSON'}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-sm">
                <dt className="font-medium text-muted-foreground">ID</dt><dd data-testid="session-detail-id">{selectedSession.id}</dd>
                <dt className="font-medium text-muted-foreground">Title</dt><dd data-testid="session-detail-title">{selectedSession.title ?? `Session ${selectedSession.id}`}</dd>
                <dt className="font-medium text-muted-foreground">Status</dt><dd data-testid="session-detail-status">{selectedSession.status ?? 'N/A'}</dd>
                <dt className="font-medium text-muted-foreground">Expert</dt><dd data-testid="session-detail-expert">{expertNameFor(selectedSession)}</dd>
                <dt className="font-medium text-muted-foreground">User ID</dt><dd>{selectedSession.user_id ?? 'N/A'}</dd>
                <dt className="font-medium text-muted-foreground">Created</dt><dd>{renderRelativeTime(selectedSession.created_at)}</dd>
                <dt className="font-medium text-muted-foreground">Updated</dt><dd>{renderRelativeTime(selectedSession.updated_at)}</dd>
              </dl>
              {showRaw ? <JsonBlock title={`session-${selectedSession.id}.json`} value={selectedSession} defaultCollapsed={false} /> : null}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
