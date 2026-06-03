import * as React from 'react';
import { useAuth } from '@cloud-dog/auth';
import { Badge, Button, Card, CardContent, CardHeader, Dialog, JsonBlock, Label, Select, StatusBadge, Textarea } from '@cloud-dog/ui';
import { Clock, ExternalLink, Wrench } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useExpertAgentState } from '../state/AppState';
import type { ChannelRecord, ExpertRecord, JobRecord, KnowledgeRecord, SessionMessageRecord, SessionRecord } from '../lib/api';
import { LoadingNote, PageScaffold, renderRelativeTime } from './shared';


function sortByNewest<T extends { created_at?: string | null; updated_at?: string | null; timestamp?: string | null; id?: number }>(items: T[]): T[] {
  return [...items].sort((left, right) => {
    const leftValue = Date.parse(left.updated_at ?? left.created_at ?? left.timestamp ?? '') || 0;
    const rightValue = Date.parse(right.updated_at ?? right.created_at ?? right.timestamp ?? '') || 0;
    if (rightValue !== leftValue) return rightValue - leftValue;
    return Number(right.id ?? 0) - Number(left.id ?? 0);
  });
}

function extractToolCallName(entry: Record<string, unknown>, index: number): string {
  return String(entry.tool_name ?? entry.tool ?? entry.name ?? entry.function_name ?? `Tool call ${index + 1}`);
}

function extractToolCallArgs(entry: Record<string, unknown>): unknown {
  return entry.arguments ?? entry.args ?? entry.parameters ?? entry.input ?? {};
}

function extractToolCallResult(entry: Record<string, unknown>): unknown {
  return entry.result ?? entry.output ?? entry.response ?? entry.data ?? {};
}

function normaliseToolCalls(job: JobRecord | null): Array<Record<string, unknown>> {
  const raw = job?.tool_calls;
  if (Array.isArray(raw)) {
    return raw.filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object' && !Array.isArray(entry));
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];

  const record = raw as Record<string, unknown>;
  const candidates = [record.tool_calls, record.calls, record.tools, record.items];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object' && !Array.isArray(entry));
    }
  }

  return Object.entries(record).map(([name, value]) => (
    value && typeof value === 'object' && !Array.isArray(value)
      ? { name, ...(value as Record<string, unknown>) }
      : { name, value }
  ));
}

function firstMetadataValue(record: Record<string, unknown> | null | undefined, keys: string[]): string | null {
  if (!record) return null;
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null && String(value).trim()) return String(value);
  }
  return null;
}

function readRequestedChatContext(): { sessionId: number | null; expertId: string | null } {
  if (typeof window === 'undefined') return { sessionId: null, expertId: null };
  const params = new URLSearchParams(window.location.search);
  const parsedSessionId = Number(params.get('session_id') ?? '');
  return {
    sessionId: Number.isFinite(parsedSessionId) && parsedSessionId > 0 ? parsedSessionId : null,
    expertId: params.get('expert_id'),
  };
}

export function ChatPage() {
  const auth = useAuth();
  const { api, latestFailure, captureFailure, clearFailure } = useExpertAgentState();
  const [sessions, setSessions] = React.useState<SessionRecord[]>([]);
  const [channels, setChannels] = React.useState<ChannelRecord[]>([]);
  const [experts, setExperts] = React.useState<ExpertRecord[]>([]);
  const [jobs, setJobs] = React.useState<JobRecord[]>([]);
  const [timeline, setTimeline] = React.useState<SessionMessageRecord[]>([]);
  const [activeJob, setActiveJob] = React.useState<JobRecord | null>(null);
  const [selectedExpertId, setSelectedExpertId] = React.useState('');
  const [knowledgeOptions, setKnowledgeOptions] = React.useState<KnowledgeRecord[]>([]);
  const [selectedKnowledgeId, setSelectedKnowledgeId] = React.useState('');
  const [activeSessionId, setActiveSessionId] = React.useState<number | null>(null);
  const [message, setMessage] = React.useState('What is cloud computing?');
  const [response, setResponse] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [sending, setSending] = React.useState(false);
  const [toolDialogOpen, setToolDialogOpen] = React.useState(false);
  const [status, setStatus] = React.useState<string | null>(null);

  const loadConversation = React.useCallback(async (sessionId: number, availableJobs?: JobRecord[]) => {
    const [messageRecords, jobRecords] = await Promise.all([
      api.listSessionMessages(sessionId),
      availableJobs ? Promise.resolve(availableJobs) : api.listJobs(),
    ]);
    setTimeline(sortByNewest(messageRecords).reverse());

    const sessionJobs = sortByNewest(jobRecords.filter((job) => job.session_id === sessionId));
    if (sessionJobs[0]?.id) {
      const latestJob = await api.getJob(sessionJobs[0].id);
      setActiveJob(latestJob);
      if (latestJob.response_received) setResponse(latestJob.response_received);
    } else {
      setActiveJob(null);
    }
  }, [api]);

  const refresh = React.useCallback(async () => {
    if (!auth.isAuthenticated) {
      setSessions([]);
      setChannels([]);
      setExperts([]);
      setJobs([]);
      setTimeline([]);
      setActiveJob(null);
      setLoading(false);
      return;
    }
    clearFailure();
    setLoading(true);
    try {
      const [sessionRecords, channelRecords, expertRecords, jobRecords, knowledgeRecords] = await Promise.all([
        api.listSessions(),
        api.listChannels(),
        api.listExperts(),
        api.listJobs(),
        api.listKnowledge().catch(() => [] as KnowledgeRecord[]),
      ]);
      setKnowledgeOptions(knowledgeRecords);
      const orderedSessions = sortByNewest(sessionRecords);
      setSessions(orderedSessions);
      setChannels(channelRecords);
      setExperts(expertRecords);
      setJobs(jobRecords);
      const requestedContext = readRequestedChatContext();
      const requestedExpertId = requestedContext.expertId && expertRecords.some((expert) => String(expert.id) === requestedContext.expertId)
        ? requestedContext.expertId
        : null;
      if (requestedExpertId) {
        setSelectedExpertId(requestedExpertId);
      } else if (!selectedExpertId && expertRecords[0]) {
        setSelectedExpertId(String(expertRecords[0].id));
      }

      const resolvedSessionId =
        (requestedContext.sessionId ? orderedSessions.find((session) => session.id === requestedContext.sessionId)?.id : null) ??
        orderedSessions.find((session) => session.id === activeSessionId)?.id ??
        orderedSessions[0]?.id ??
        null;
      setActiveSessionId(resolvedSessionId);
      if (resolvedSessionId) {
        await loadConversation(resolvedSessionId, jobRecords);
        if (requestedContext.sessionId === resolvedSessionId) {
          setStatus(`Loaded requested timeline for session ${resolvedSessionId}.`);
        }
      } else {
        setTimeline([]);
        setActiveJob(null);
      }
    } catch (error) {
      captureFailure(error);
    } finally {
      setLoading(false);
    }
  }, [activeSessionId, api, auth.isAuthenticated, captureFailure, clearFailure, loadConversation, selectedExpertId]);

  React.useEffect(() => { void refresh(); }, [refresh]);

  const selectedExpert = React.useMemo(
    () => experts.find((expert) => String(expert.id) === selectedExpertId) ?? null,
    [experts, selectedExpertId]
  );

  const selectedKnowledge = React.useMemo(
    () => knowledgeOptions.find((entry) => String(entry.entry_id ?? entry.id) === selectedKnowledgeId) ?? null,
    [knowledgeOptions, selectedKnowledgeId]
  );

  const userLabel = auth.user?.displayName || auth.user?.username || auth.user?.email || auth.user?.id || 'You';

  const expertNameFor = React.useCallback((session: SessionRecord) => {
    const expertId = session.expert_config_id ?? session.expert_id;
    if (!expertId) return 'N/A';
    return experts.find((expert) => expert.id === expertId)?.name ?? `Expert ${expertId}`;
  }, [experts]);

  const selectSession = React.useCallback(async (session: SessionRecord) => {
    clearFailure();
    try {
      setActiveSessionId(session.id);
      await loadConversation(session.id, jobs);
      setStatus(`Loaded timeline for session ${session.id}.`);
    } catch (error) {
      captureFailure(error);
    }
  }, [captureFailure, clearFailure, jobs, loadConversation]);

  const sendMessage = React.useCallback(async () => {
    const parsedUserId = Number(auth.user?.id ?? 0);
    const userId = Number.isFinite(parsedUserId) && parsedUserId > 0 ? parsedUserId : 1;
    const expertId = Number(selectedExpertId);
    if (!userId || !expertId || !message.trim()) return;
    setSending(true);
    clearFailure();
    try {
      let channel = channels.find((item) => item.expert_config_id === expertId && item.enabled !== false);
      if (!channel) {
        channel = await api.createChannel({ name: `webui-chat-${expertId}-${Date.now()}`, expert_config_id: expertId, description: 'Shared chat workbench channel', enabled: true });
        setChannels((current) => [channel as ChannelRecord, ...current]);
      }

      const result = await api.sendChannelMessage(channel.id, {
        message,
        user_id: userId,
        session_id: activeSessionId ?? undefined,
        async_mode: true,
        max_tokens: 256,
      });
      const nextSessionId = result.session_id ?? activeSessionId;
      if (nextSessionId) setActiveSessionId(nextSessionId);

      let finalJob: JobRecord | null = null;
      if (result.job_id) {
        setStatus(`Job ${result.job_id} queued for session ${nextSessionId ?? 'pending'}.`);
        for (let attempt = 0; attempt < 60; attempt += 1) {
          const polledJob = await api.getJob(result.job_id);
          finalJob = polledJob;
          setActiveJob(polledJob);
          const jobStatus = String(polledJob.status ?? '').toLowerCase();
          if (['completed', 'failed', 'cancelled'].includes(jobStatus)) break;
          await new Promise((resolve) => window.setTimeout(resolve, 1000));
        }
      }

      const resolvedSessionId = nextSessionId ?? finalJob?.session_id ?? null;
      const finalResponse = finalJob?.response_received ?? result.response ?? result.content ?? result.message ?? result.answer ?? '';
      setResponse(finalResponse);
      if (resolvedSessionId) {
        setActiveSessionId(resolvedSessionId);
        await loadConversation(resolvedSessionId);
      }
      setMessage('');
      setStatus(`Conversation sent via channel ${channel.name}${finalJob?.id ? `, job ${finalJob.id}` : ''}.`);
      await refresh();
    } catch (error) {
      captureFailure(error);
    } finally {
      setSending(false);
    }
  }, [activeSessionId, api, auth.user?.id, captureFailure, channels, clearFailure, loadConversation, message, refresh, selectedExpertId]);

  const toolCalls = React.useMemo(() => normaliseToolCalls(activeJob), [activeJob]);
  const latestAssistantId = [...timeline].reverse().find((entry) => entry.role === 'assistant')?.id ?? null;
  const selectedKnowledgeMetadata = selectedKnowledge?.metadata as Record<string, unknown> | null | undefined;

  return (
    <PageScaffold title="Chat" description="Interactive expert conversation surface backed by live channel chat execution." alert={latestFailure} status={status}>
      <LoadingNote loading={loading} />
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">Conversation workbench</h2>
              <p className="text-sm text-muted-foreground">Send messages through a live channel and continue from any selected session.</p>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <label className="space-y-2 block">
                <Label htmlFor="chat-expert">Expert</Label>
                <Select id="chat-expert" data-testid="chat-expert-select" value={selectedExpertId} onChange={(event) => {
                  const nextId = event.target.value;
                  setSelectedExpertId(nextId);
                  setSelectedKnowledgeId('');
                  setStatus(`Selected expert ${experts.find((e) => String(e.id) === nextId)?.name ?? nextId}.`);
                }}>
                  <option value="">Select an expert</option>
                  {experts.map((expert) => <option key={expert.id} value={String(expert.id)}>{expert.name}</option>)}
                </Select>
              </label>
              <label className="space-y-2 block">
                <Label htmlFor="chat-knowledge">Knowledge</Label>
                <Select id="chat-knowledge" data-testid="chat-knowledge-select" value={selectedKnowledgeId} onChange={(event) => setSelectedKnowledgeId(event.target.value)}>
                  <option value="">No knowledge selected</option>
                  {knowledgeOptions
                    .filter((entry) => {
                      if (!selectedExpertId) return true;
                      const expertId = (entry.metadata as Record<string, unknown> | null)?.expert_id;
                      return expertId === undefined || expertId === null || String(expertId) === selectedExpertId;
                    })
                    .map((entry) => (
                      <option key={String(entry.entry_id ?? entry.id)} value={String(entry.entry_id ?? entry.id)}>
                        {entry.title ?? `Entry ${entry.entry_id ?? entry.id}`} ({entry.knowledge_type ?? 'user'})
                      </option>
                    ))}
                </Select>
              </label>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold">Expert</h3>
                  {selectedExpert ? (
                    <Link className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline" to={`/experts?expert=${selectedExpert.id}`}>
                      Open <ExternalLink className="h-3 w-3" aria-hidden="true" />
                    </Link>
                  ) : null}
                </div>
                {selectedExpert ? (
                  <dl className="mt-3 grid gap-2 text-sm">
                    <div><dt className="text-xs text-muted-foreground">Name</dt><dd>{selectedExpert.name}</dd></div>
                    <div><dt className="text-xs text-muted-foreground">Title</dt><dd>{selectedExpert.title ?? 'N/A'}</dd></div>
                    <div><dt className="text-xs text-muted-foreground">Model</dt><dd>{[selectedExpert.llm_provider, selectedExpert.llm_model].filter(Boolean).join(' / ') || 'N/A'}</dd></div>
                  </dl>
                ) : <p className="mt-3 text-sm text-muted-foreground">Select an expert to bind the conversation.</p>}
              </div>
              <div className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold">Knowledge</h3>
                  {selectedKnowledge ? (
                    <Link className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline" to={`/knowledge?entry=${selectedKnowledge.entry_id ?? selectedKnowledge.id}`}>
                      Open <ExternalLink className="h-3 w-3" aria-hidden="true" />
                    </Link>
                  ) : null}
                </div>
                {selectedKnowledge ? (
                  <dl className="mt-3 grid gap-2 text-sm">
                    <div><dt className="text-xs text-muted-foreground">Title</dt><dd>{selectedKnowledge.title ?? `Entry ${selectedKnowledge.entry_id ?? selectedKnowledge.id}`}</dd></div>
                    <div><dt className="text-xs text-muted-foreground">Description</dt><dd>{selectedKnowledge.description ?? 'N/A'}</dd></div>
                    <div><dt className="text-xs text-muted-foreground">Type</dt><dd>{selectedKnowledge.knowledge_type ?? 'N/A'}</dd></div>
                    <div><dt className="text-xs text-muted-foreground">Source</dt><dd>{firstMetadataValue(selectedKnowledgeMetadata, ['source', 'filename', 'url']) ?? 'N/A'}</dd></div>
                  </dl>
                ) : <p className="mt-3 text-sm text-muted-foreground">Select knowledge to show its summary attributes.</p>}
              </div>
            </div>

            <label className="space-y-2 block">
              <Label htmlFor="chat-message">Message</Label>
              <Textarea id="chat-message" rows={6} value={message} onChange={(event) => setMessage(event.target.value)} />
            </label>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-muted-foreground">
                Session {activeSessionId ?? 'new'}{activeJob?.id ? ` · job ${activeJob.id}` : ''}
              </div>
              <Button type="button" onClick={() => void sendMessage()} loading={sending} disabled={!selectedExpertId || !message.trim()}>Send</Button>
            </div>
            <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold">Latest response</h3>
                {activeJob?.status ? <StatusBadge value={activeJob.status} /> : null}
              </div>
              {sending ? (
                <div className="inline-flex items-center gap-2 text-sm text-muted-foreground" data-testid="chat-in-progress">
                  <Clock className="h-4 w-4" aria-hidden="true" /> Generating response{activeJob?.id ? ` for job ${activeJob.id}` : ''}
                </div>
              ) : null}
              <p className="whitespace-pre-wrap text-sm">{response ?? 'No response yet.'}</p>
              <div className="grid gap-2 text-xs text-muted-foreground md:grid-cols-4">
                <p>Session: {activeSessionId ?? 'N/A'}</p>
                <p>Job: {activeJob?.id ?? 'N/A'}</p>
                <p>Model: {activeJob?.metadata && typeof activeJob.metadata === 'object' ? String((activeJob.metadata as Record<string, unknown>).model ?? 'N/A') : 'N/A'}</p>
                <p>Tool calls: {toolCalls.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold">History</h2>
                <p className="text-sm text-muted-foreground">Timeline for session {activeSessionId ?? 'N/A'}.</p>
              </div>
              <Select value={activeSessionId ? String(activeSessionId) : ''} onChange={(event) => {
                const session = sessions.find((item) => String(item.id) === event.target.value);
                if (session) void selectSession(session);
              }} className="w-full sm:w-72" aria-label="Select session">
                <option value="">Select a session</option>
                {sessions.map((session) => (
                  <option key={session.id} value={String(session.id)}>
                    {session.title ?? `Session ${session.id}`} · {expertNameFor(session)}
                  </option>
                ))}
              </Select>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {timeline.length === 0 ? <p className="text-sm text-muted-foreground">No messages loaded yet.</p> : timeline.map((entry) => {
              const isUser = entry.role === 'user';
              const label = isUser ? userLabel : selectedExpert?.name ?? 'Assistant';
              return (
                <div key={entry.id} data-testid={isUser ? 'chat-message-user' : 'chat-message-assistant'} className={`max-w-[82%] rounded-lg border p-3 space-y-2 ${isUser ? 'ml-auto bg-primary text-primary-foreground' : 'mr-auto bg-muted/30'}`}>
                  <div className="flex items-center justify-between gap-3">
                    <Badge variant={isUser ? 'secondary' : 'default'}>{label}</Badge>
                    <span className={`text-xs ${isUser ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>{renderRelativeTime(entry.timestamp)}</span>
                  </div>
                  <p className="whitespace-pre-wrap text-sm">{entry.content ?? ''}</p>
                  {!isUser && entry.id === latestAssistantId && toolCalls.length > 0 ? (
                    <Button type="button" size="sm" variant="secondary" onClick={() => setToolDialogOpen(true)}>
                      <Wrench className="mr-2 h-4 w-4" aria-hidden="true" /> Tool calls {toolCalls.length}
                    </Button>
                  ) : null}
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <Dialog open={toolDialogOpen} onOpenChange={setToolDialogOpen} label="Tool call details">
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Tool call details</h2>
            <p className="text-sm text-muted-foreground">Recorded for job {activeJob?.id ?? 'N/A'}.</p>
          </div>
          {toolCalls.map((entry, index) => (
            <div key={`${extractToolCallName(entry, index)}-${index}`} className="space-y-3 rounded-lg border p-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold">{extractToolCallName(entry, index)}</h3>
                <Badge variant="secondary">#{index + 1}</Badge>
              </div>
              <JsonBlock title="arguments.json" value={extractToolCallArgs(entry)} defaultCollapsed />
              <JsonBlock title="result.json" value={extractToolCallResult(entry)} defaultCollapsed />
            </div>
          ))}
          {toolCalls.length === 0 ? <p className="text-sm text-muted-foreground">No tool calls were recorded for this job.</p> : null}
          <div className="flex justify-end">
            <Button type="button" variant="secondary" onClick={() => setToolDialogOpen(false)}>Close</Button>
          </div>
        </div>
      </Dialog>
    </PageScaffold>
  );
}
