import * as React from 'react';
import { Badge, Button, Card, CardContent, CardHeader, JsonBlock, statusColumn } from '@cloud-dog/ui';
import { useExpertAgentState } from '../state/AppState';
import type { ExpertRecord, SessionMessageRecord, SessionRecord } from '../lib/api';
import { AppDataTable } from '../lib/data-table-adapter';
import { LoadingNote, PageScaffold, formatCount, renderRelativeTime } from './shared';


export function SessionsPage() {
  const { api, latestFailure, captureFailure, clearFailure } = useExpertAgentState();
  const [sessions, setSessions] = React.useState<SessionRecord[]>([]);
  const [experts, setExperts] = React.useState<ExpertRecord[]>([]);
  const [selectedSession, setSelectedSession] = React.useState<SessionRecord | null>(null);
  const [history, setHistory] = React.useState<SessionMessageRecord[]>([]);
  const [showRaw, setShowRaw] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [status, setStatus] = React.useState<string | null>(null);

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
    if (!window.confirm(`Delete session ${session.title ?? session.id}?`)) return;
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
    if (!window.confirm(`Delete ${selected.length} selected sessions?`)) return;
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
    window.location.href = `/admin/monitoring?${params.toString()}`;
  }, []);

  return (
    /* EXPWEB-062/063: removed SummaryGrid and contract surface */
    <PageScaffold title="Sessions" description="Session inventory with sorting, bulk selection, and conversation history." alert={latestFailure} status={status}>
      <LoadingNote loading={loading} />
      <AppDataTable
        title="Session inventory"
        rows={sessions}
        getRowId={(session) => String(session.id)}
        emptyMessage="No sessions reported by the backend."
        itemLabel="sessions"
        onRefresh={refresh}
        /* EXPWEB-067: all columns sortable */
        columns={[
          { id: 'id', header: 'ID', sortable: true, sortValue: (session) => session.id, cell: (session) => session.id },
          { id: 'title', header: 'Title', sortable: true, sortValue: (session) => session.title ?? '', cell: (session) => session.title ?? `Session ${session.id}` },
          statusColumn<SessionRecord>({ getValue: (session) => session.status ?? 'not reported' }),
          { id: 'expert', header: 'Expert', sortable: true, sortValue: (session) => expertNameFor(session), cell: (session) => expertNameFor(session) },
          /* EXPWEB-066: RelativeTime handles UTC → local automatically */
          { id: 'started', header: 'Started', sortable: true, sortValue: (session) => session.created_at ?? '', cell: (session) => renderRelativeTime(session.created_at) },
          { id: 'updated', header: 'Updated', sortable: true, sortValue: (session) => session.updated_at ?? '', cell: (session) => renderRelativeTime(session.updated_at) },
        ]}
        /* EXPWEB-067: multi-select with row actions including View, Chat, Logs, Delete */
        rowActions={[
          { label: 'View History', onClick: (session) => void viewSession(session) },
          /* EXPWEB-061/064: View Timeline / View Messages → Chat */
          { label: 'Open in Chat', onClick: navigateToChat },
          /* EXPWEB-065: audit/log link */
          { label: 'View Logs', onClick: navigateToLogs },
          { label: 'Delete', variant: 'destructive', onClick: (session) => void deleteSession(session) },
        ]}
        bulkActions={[
          { label: 'Delete Selected', variant: 'destructive', onClick: (rows) => void bulkDeleteSessions(rows) },
        ]}
        searchText={(session) => [
          String(session.id),
          session.title ?? '',
          session.status ?? '',
          expertNameFor(session),
        ].join(' ')}
      />
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
    </PageScaffold>
  );
}
