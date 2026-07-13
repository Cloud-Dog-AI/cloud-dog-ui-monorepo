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

// @cloud-dog/app-notification-agent — Messages page adopted onto shared table/dialog patterns.
// Covers: UI-R1, UI-R2

import * as React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@cloud-dog/auth';
import { Badge, Button, Card, CardContent, CardHeader, DataTable, EntityDialog, Input, JsonExplorer, Label, RelatedItemsPanel, RelativeTime, Select, Textarea, createDataTableActionColumn } from '@cloud-dog/ui';
import type { BulkAction, DataColumn, EntityFieldDef, RelatedItem } from '@cloud-dog/ui';
import { Eye, ExternalLink, FileText, Trash2, XCircle } from 'lucide-react';
import { useNotificationAgentState } from '../state/AppState';
import type { ChannelRecord, DeliveryRecord, MessageDetailRecord, MessageRecord, PromptRecord } from '../lib/api';

type ComposeValues = Readonly<{
  prompt_id: string;
  channel: string;
  destination: string;
  created_by: string;
  subject: string;
}>;

const composeFields: EntityFieldDef[] = [
  { name: 'prompt_id', label: 'Template', type: 'select' },
  { name: 'channel', label: 'Channel', type: 'select', required: true },
  { name: 'destination', label: 'Recipient', type: 'text', required: true },
  { name: 'created_by', label: 'Created by', type: 'text', required: true },
  { name: 'subject', label: 'Subject', type: 'text' },
];

const emptyComposeValues: ComposeValues = {
  prompt_id: '',
  channel: '',
  destination: 'loopback://notification-ui',
  created_by: 'notification-ui',
  subject: 'Notification UI message',
};

function downloadJson(filename: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function validate(values: ComposeValues, body: string): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!values.channel.trim()) errors.channel = 'Channel is required.';
  if (!values.destination.trim()) errors.destination = 'Recipient is required.';
  if (!values.created_by.trim()) errors.created_by = 'Created by is required.';
  if (!body.trim()) errors.subject = 'Message body is required.';
  return errors;
}

function messageStatusVariant(status: string | null | undefined): 'default' | 'secondary' | 'destructive' {
  const value = String(status ?? '').toLowerCase();
  if (['sent', 'delivered', 'accepted', 'complete'].includes(value)) return 'default';
  if (['failed', 'cancelled', 'aborted', 'dead_lettered'].includes(value)) return 'destructive';
  return 'secondary';
}

export function MessagesPage() {
  const auth = useAuth();
  const { api, latestFailure, captureFailure, clearFailure } = useNotificationAgentState();
  const [channels, setChannels] = React.useState<ChannelRecord[]>([]);
  const [prompts, setPrompts] = React.useState<PromptRecord[]>([]);
  const [messages, setMessages] = React.useState<MessageRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [deliveryMap, setDeliveryMap] = React.useState<Record<number, DeliveryRecord[]>>({});
  const [status, setStatus] = React.useState('');
  const [query, setQuery] = React.useState('');
  const [channelFilter, setChannelFilter] = React.useState(() => new URLSearchParams(window.location.search).get('channel') ?? '');
  const [senderFilter, setSenderFilter] = React.useState(() => new URLSearchParams(window.location.search).get('sender') ?? '');
  // NA-P-07: prompt deep-link from PromptsPage row action.
  const [promptFilter, setPromptFilter] = React.useState(() => new URLSearchParams(window.location.search).get('prompt') ?? '');
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [composeValues, setComposeValues] = React.useState<ComposeValues>(emptyComposeValues);
  const [composeBody, setComposeBody] = React.useState('Notification UI message created via the real backend.');
  const [formErrors, setFormErrors] = React.useState<Record<string, string>>({});
  const [activeMessage, setActiveMessage] = React.useState<MessageRecord | null>(null);
  const [activeMessageDetail, setActiveMessageDetail] = React.useState<MessageDetailRecord | null>(null);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);
  const [deliveryPage, setDeliveryPage] = React.useState(1);
  const [deliveryPageSize, setDeliveryPageSize] = React.useState(10);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    clearFailure();
    try {
      const [channelList, promptList, messageList] = await Promise.all([api.listChannels(), api.listPrompts(), api.listMessages()]);
      setChannels(channelList);
      setPrompts(promptList.filter((prompt) => prompt.enabled !== false && prompt.enabled !== 0));
      setMessages([...messageList].sort((left, right) => right.id - left.id));
      setComposeValues((current) => ({
        ...current,
        channel: current.channel || channelList[0]?.name || '',
      }));
    } catch (error) {
      captureFailure(error);
    } finally {
      setLoading(false);
    }
  }, [api, captureFailure, clearFailure]);

  React.useEffect(() => {
    void loadData();
  }, [loadData]);

  React.useEffect(() => {
    setPage(1);
  }, [query, channelFilter, senderFilter, promptFilter]);

  React.useEffect(() => {
    setDeliveryPage(1);
  }, [activeMessage]);

  const selectedChannel = React.useMemo(
    () => channels.find((channel) => channel.name === composeValues.channel) ?? null,
    [channels, composeValues.channel],
  );

  const availablePrompts = React.useMemo(() => {
    const selectedChannelType = selectedChannel?.type?.trim().toLowerCase();
    return prompts.filter((prompt) => {
      const promptChannelType = prompt.channel_type?.trim().toLowerCase();
      return !selectedChannelType || !promptChannelType || promptChannelType === selectedChannelType;
    });
  }, [prompts, selectedChannel?.type]);

  React.useEffect(() => {
    if (!composeValues.prompt_id) return;
    if (availablePrompts.some((prompt) => String(prompt.id) === composeValues.prompt_id)) return;
    setComposeValues((current) => ({ ...current, prompt_id: '' }));
  }, [availablePrompts, composeValues.prompt_id]);

  const filteredMessages = messages.filter((message) => {
    const matchesQuery = !query.trim() || `${message.id} ${message.subject ?? ''} ${message.created_by ?? ''} ${message.status ?? ''} ${message.message_guid ?? ''} ${message.channel_name ?? ''}`.toLowerCase().includes(query.trim().toLowerCase());
    const matchesChannel = !channelFilter || String(message.channel_name ?? '').toLowerCase() === channelFilter.toLowerCase();
    const matchesSender = !senderFilter.trim() || String(message.created_by ?? '').toLowerCase().includes(senderFilter.trim().toLowerCase());
    // NA-P-07: prompt filter matches either prompt_id (numeric) or prompt name in template/subject.
    const matchesPrompt = !promptFilter.trim() || (() => {
      const needle = promptFilter.trim().toLowerCase();
      const promptIdRaw = (message as unknown as { prompt_id?: number | string }).prompt_id;
      const promptId = promptIdRaw == null ? '' : String(promptIdRaw).toLowerCase();
      const subject = String(message.subject ?? '').toLowerCase();
      return promptId === needle || subject.includes(needle);
    })();
    return matchesQuery && matchesChannel && matchesSender && matchesPrompt;
  });

  const openCompose = () => {
    const currentUser = auth.user as (Record<string, unknown> | undefined);
    const actor = String(currentUser?.username ?? currentUser?.email ?? currentUser?.id ?? 'notification-ui');
    setFormErrors({});
    setComposeValues((current) => ({
      ...emptyComposeValues,
      prompt_id: current.prompt_id,
      channel: current.channel || channels[0]?.name || '',
      created_by: actor,
    }));
    setComposeBody('Notification UI message created via the real backend.');
    setDialogOpen(true);
  };

  const sendMessage = async () => {
    const errors = validate(composeValues, composeBody);
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    clearFailure();
    setStatus('');
    try {
      const result = await api.createMessage({
        audience_type: 'personalised',
        destinations: [{ channel: composeValues.channel, address: composeValues.destination }],
        content: [{ type: 'text', body: composeBody }],
        options: {
          subject: composeValues.subject.trim() || undefined,
          ttl_hours: 1,
        },
        created_by: composeValues.created_by,
      });
      setStatus(`Created message ${String(result.id ?? result.message_id ?? 'unknown')}.`);
      await loadData();
      setDialogOpen(false);
    } catch (error) {
      captureFailure(error);
    }
  };

  const deleteMessages = async (items: MessageRecord[]) => {
    clearFailure();
    setStatus('');
    try {
      for (const item of items) {
        await api.deleteMessage(item.id);
      }
      setStatus(`Deleted ${items.length} message${items.length === 1 ? '' : 's'}.`);
      if (activeMessage && items.some((item) => item.id === activeMessage.id)) {
        setActiveMessage(null);
        setActiveMessageDetail(null);
      }
      await loadData();
    } catch (error) {
      captureFailure(error);
    }
  };

  const cancelMessages = async (items: MessageRecord[]) => {
    clearFailure();
    setStatus('');
    try {
      for (const item of items) {
        await api.cancelMessage(item.id);
      }
      setStatus(`Cancelled ${items.length} message${items.length === 1 ? '' : 's'}.`);
      await loadData();
    } catch (error) {
      captureFailure(error);
    }
  };

  const inspectMessage = async (message: MessageRecord) => {
    clearFailure();
    setStatus('');
    try {
      const [detail, deliveries] = await Promise.all([
        api.getMessage(message.id),
        api.listMessageDeliveries(message.id),
      ]);
      setDeliveryMap((current) => ({ ...current, [message.id]: deliveries }));
      setActiveMessage(message);
      setActiveMessageDetail(detail);
    } catch (error) {
      captureFailure(error);
    }
  };

  const relatedDeliveries: RelatedItem[] = (activeMessage ? deliveryMap[activeMessage.id] ?? [] : []).map((delivery) => ({
    id: String(delivery.id),
    label: `${delivery.channel_name ?? 'channel'} → ${delivery.destination ?? 'recipient'} (${delivery.state ?? 'unknown'})`,
    href: `/deliveries?message_id=${activeMessage?.id ?? ''}`,
  }));

  const messageColumns = React.useMemo<DataColumn<MessageRecord>[]>(() => [
    {
      id: 'id',
      header: 'ID',
      sortable: true,
      sortValue: (message) => message.id,
      // CX-103: first identifier column — Link opens the detail dialog.
      cell: (message) => (
        <Link
          to={`/messages/${message.id}`}
          className="text-primary underline-offset-4 hover:underline"
          aria-label={`View message ${message.id}`}
          onClick={(event) => { event.preventDefault(); void inspectMessage(message); }}
        >
          {message.id}
        </Link>
      ),
    },
    {
      id: 'subject',
      header: 'Subject',
      sortable: true,
      sortValue: (message) => message.subject ?? '',
      cell: (message) => message.subject ?? '',
    },
    {
      id: 'created_by',
      header: 'Sender',
      sortable: true,
      sortValue: (message) => message.created_by ?? '',
      cell: (message) => message.created_by ?? '',
    },
    {
      id: 'channel_name',
      header: 'Channel',
      sortable: true,
      sortValue: (message) => message.channel_name ?? '',
      cell: (message) => message.channel_name ?? 'N/A',
    },
    {
      id: 'recipients',
      header: 'Recipients',
      cell: (message) => String(message.recipients?.length ?? deliveryMap[message.id]?.length ?? 0),
    },
    {
      id: 'status',
      header: 'Status',
      sortable: true,
      sortValue: (message) => message.status ?? '',
      cell: (message) => <Badge variant={messageStatusVariant(message.status)}>{message.status ?? 'unknown'}</Badge>,
    },
    {
      id: 'created_at',
      header: 'Sent At',
      sortable: true,
      sortValue: (message) => message.created_at ?? '',
      cell: (message) => message.created_at ? <RelativeTime timestamp={message.created_at} /> : 'N/A',
    },
    // CX-102 / CX-104: shared action-cell helper (View, Deliveries, Open link, Log, Cancel, Delete).
    createDataTableActionColumn<MessageRecord>((message) => [
      {
        id: 'view',
        label: 'View',
        icon: <Eye className="h-4 w-4" />,
        onClick: () => void inspectMessage(message),
      },
      {
        id: 'deliveries',
        label: 'Deliveries',
        icon: <FileText className="h-4 w-4" />,
        href: () => `/deliveries?message_id=${message.id}`,
        title: () => `View deliveries for message ${message.id}`,
      },
      {
        // NA-M-05: rename "Open link" -> "Open Message".
        id: 'open-message',
        label: 'Open Message',
        icon: <ExternalLink className="h-4 w-4" />,
        href: () => `/messages/${message.id}?format=html`,
        title: () => `Open rendered message ${message.id}`,
      },
      {
        id: 'log',
        label: 'Log',
        icon: <FileText className="h-4 w-4" />,
        href: () => `/diagnostics-audit?actor=${encodeURIComponent(String(message.id))}`,
        title: () => `View audit log for message ${message.id}`,
      },
      {
        id: 'cancel',
        label: 'Cancel',
        icon: <XCircle className="h-4 w-4" />,
        onClick: () => void cancelMessages([message]),
      },
      {
        id: 'delete',
        label: 'Delete',
        icon: <Trash2 className="h-4 w-4" />,
        destructive: true,
        onClick: () => void deleteMessages([message]),
      },
    ]),
  ], [cancelMessages, deleteMessages, deliveryMap, inspectMessage]);

  const messageBulkActions = React.useMemo<BulkAction[]>(() => [
    { label: 'Cancel selected', action: 'cancel' },
    { label: 'Delete selected', action: 'delete' },
    { label: 'Export', action: 'export' },
  ], []);

  const onMessageBulkAction = React.useCallback((action: string, selectedIds: string[]) => {
    const items = filteredMessages.filter((message) => selectedIds.includes(String(message.id)));
    if (action === 'cancel') {
      void cancelMessages(items);
      return;
    }
    if (action === 'delete') {
      void deleteMessages(items);
      return;
    }
    if (action === 'export') {
      downloadJson('notification-messages.json', items);
    }
  }, [cancelMessages, deleteMessages, filteredMessages]);

  const activeDeliveries = activeMessage ? deliveryMap[activeMessage.id] ?? [] : [];
  const selectedPrompt = React.useMemo(
    () => availablePrompts.find((item) => String(item.id) === composeValues.prompt_id) ?? null,
    [availablePrompts, composeValues.prompt_id],
  );
  // NA-M-07: collapse delivered_at across delivery records (latest non-null value)
  // — falls back to undefined so the dialog can hide the field rather than show "N/A".
  const collapsedDeliveredAt = React.useMemo(() => {
    if (!activeDeliveries.length) return null;
    const stamps = activeDeliveries
      .map((d) => d.delivered_at)
      .filter((x): x is string => Boolean(x))
      .sort();
    return stamps.length ? stamps[stamps.length - 1] : null;
  }, [activeDeliveries]);
  const deliveryColumns = React.useMemo<DataColumn<DeliveryRecord>[]>(() => [
    {
      id: 'channel_name',
      header: 'Channel',
      sortable: true,
      sortValue: (delivery) => delivery.channel_name ?? '',
      // CX-103: first identifier column — Link to the deliveries page filtered by message.
      cell: (delivery) => (
        <Link
          to={`/deliveries?message_id=${delivery.message_id ?? ''}`}
          className="text-primary underline-offset-4 hover:underline"
          aria-label={`View deliveries for channel ${delivery.channel_name ?? delivery.id}`}
        >
          {delivery.channel_name ?? delivery.id}
        </Link>
      ),
    },
    {
      id: 'destination',
      header: 'Recipient',
      sortable: true,
      sortValue: (delivery) => delivery.destination ?? '',
      cell: (delivery) => delivery.destination ?? '',
    },
    {
      id: 'state',
      header: 'Status',
      sortable: true,
      sortValue: (delivery) => delivery.state ?? '',
      cell: (delivery) => delivery.state ?? 'unknown',
    },
    {
      id: 'error',
      header: 'Error',
      cell: (delivery) => delivery.error ?? '',
    },
    // CX-102 / CX-104: shared action-cell helper (Log).
    createDataTableActionColumn<DeliveryRecord>((delivery) => [
      {
        id: 'log',
        label: 'Log',
        icon: <FileText className="h-4 w-4" />,
        href: () => `/diagnostics-audit?actor=${encodeURIComponent(String(delivery.id))}`,
        title: () => `View audit log for delivery ${delivery.id}`,
      },
    ]),
  ], []);

  const deliveryBulkActions = React.useMemo<BulkAction[]>(() => [{ label: 'Export', action: 'export' }], []);

  const onDeliveryBulkAction = React.useCallback((action: string, selectedIds: string[]) => {
    if (action !== 'export' || !activeMessage) return;
    const items = activeDeliveries.filter((delivery) => selectedIds.includes(String(delivery.id)));
    downloadJson(`message-${activeMessage.id}-deliveries.json`, items);
  }, [activeDeliveries, activeMessage]);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Messages</h1>
        <p className="text-xs text-muted-foreground">
          Delivered At is shown from delivery records when present and hidden until populated. Delivery and prompt preferences are applied through message metadata and runtime formatting.
        </p>
      </header>

      {latestFailure ? <p role="alert" className="text-sm text-destructive">{latestFailure}</p> : null}
      {status ? <p role="status" className="text-sm text-foreground/80">{status}</p> : null}

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Messages</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="flex-1">
              <Label htmlFor="messages-search-adopted">Search messages</Label>
              <Input
                id="messages-search-adopted"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by id, subject, GUID, status or creator"
              />
            </div>
            <div className="min-w-48">
              <Label htmlFor="messages-channel-filter-adopted">Channel</Label>
              <Select id="messages-channel-filter-adopted" value={channelFilter} onChange={(event) => setChannelFilter(event.target.value)}>
                <option value="">All channels</option>
                {channels.map((channel) => (
                  <option key={channel.id} value={channel.name}>{channel.name}</option>
                ))}
              </Select>
            </div>
            <div className="min-w-48">
              <Label htmlFor="messages-sender-filter-adopted">Sender</Label>
              <Input id="messages-sender-filter-adopted" value={senderFilter} onChange={(event) => setSenderFilter(event.target.value)} placeholder="Filter by sender" />
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => void loadData()}>Refresh</Button>
              <Button onClick={openCompose}>Compose message</Button>
            </div>
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground">Loading messages...</p>
          ) : (
            <DataTable
              tableId="notification-messages"
              columns={messageColumns}
              rows={filteredMessages}
              totalRows={messages.length}
              getRowId={(message) => String(message.id)}
              getRowName={(message) => `${message.id} ${message.subject ?? ''} ${message.created_by ?? ''} ${message.status ?? ''} message`}
              page={page}
              onPageChange={setPage}
              pageSize={pageSize}
              onPageSizeChange={setPageSize}
              selectable={true}
              bulkActions={messageBulkActions}
              onBulkAction={onMessageBulkAction}
              columnPickerEnabled={true}
            />
          )}
        </CardContent>
      </Card>

      <EntityDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title="Compose message"
        mode="add"
        fields={composeFields.map((field) => (
          field.name === 'prompt_id'
            ? { ...field, options: [''].concat(availablePrompts.map((prompt) => String(prompt.id))) }
            : field.name === 'channel'
              ? { ...field, options: channels.map((channel) => channel.name) }
              : field
        ))}
        values={composeValues}
        errors={formErrors}
        onChange={(name, value) => {
          const nextValue = String(value ?? '');
          if (name === 'channel') {
            setComposeValues((current) => ({ ...current, channel: nextValue, prompt_id: '' }));
            return;
          }
          if (name === 'prompt_id') {
            const prompt = availablePrompts.find((item) => String(item.id) === nextValue);
            if (prompt) {
              setComposeBody(prompt.prompt_text);
              setComposeValues((current) => ({
                ...current,
                prompt_id: nextValue,
                subject: current.subject || prompt.name,
              }));
              return;
            }
          }
          setComposeValues((current) => ({ ...current, [name]: nextValue }));
        }}
        onSubmit={() => void sendMessage()}
        onCancel={() => setDialogOpen(false)}
        extra={(
          <div className="space-y-4 border-t pt-4">
            {composeValues.prompt_id ? (
              <div className="rounded-md border bg-muted/20 p-3 text-sm">
                <p className="font-medium">Template: {selectedPrompt?.name ?? composeValues.prompt_id}</p>
                <p className="text-muted-foreground">
                  {selectedChannel
                    ? `Filtered to ${selectedChannel?.type ?? 'selected channel'} templates. Selecting one copies its prompt text into the compose body for live editing before send.`
                    : 'Select a channel first to narrow templates to the matching delivery type.'}
                </p>
              </div>
            ) : null}
            <Label htmlFor="messages-compose-body-adopted">Body</Label>
            <Textarea
              id="messages-compose-body-adopted"
              rows={10}
              value={composeBody}
              onChange={(event) => setComposeBody(event.target.value)}
            />
          </div>
        )}
      />

      {/* NA-M-01 / NA-M-02 / NA-M-03: readable single-column form layout for
          the View Message dialog (replaces the cramped two-column StructuredView
          table). Same dialog is opened from Message rows AND from the
          per-message Deliveries column. Settings/Destination/Content/Variables
          render with the shared JsonExplorer (NA-M-06). Delivered At is sourced
          from delivery records and hidden when no delivery has timestamped yet
          (NA-M-07). */}
      <EntityDialog
        open={Boolean(activeMessage)}
        onOpenChange={(open) => {
          if (!open) {
            setActiveMessage(null);
            setActiveMessageDetail(null);
          }
        }}
        title={activeMessage ? `Message ${activeMessage.id}` : 'Message detail'}
        body={activeMessage ? (
          <div className="space-y-4">
            <div className="flex items-start justify-end -mt-2">
              <Button type="button" variant="secondary" size="sm" aria-label="Close" onClick={() => { setActiveMessage(null); setActiveMessageDetail(null); }}>
                Close
              </Button>
            </div>

            {/* Single-column readable summary (NA-M-01, NA-M-02). */}
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold">Message {activeMessage.id}</h2>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-sm md:grid-cols-[180px_1fr]">
                  <dt className="font-medium text-muted-foreground">Subject</dt>
                  <dd>{activeMessage.subject ?? 'Untitled message'}</dd>
                  <dt className="font-medium text-muted-foreground">Status</dt>
                  <dd><Badge variant={messageStatusVariant(activeMessageDetail?.status ?? activeMessage.status)}>{activeMessageDetail?.status ?? activeMessage.status ?? 'unknown'}</Badge></dd>
                  <dt className="font-medium text-muted-foreground">Sender</dt>
                  <dd>{activeMessage.created_by ?? 'N/A'}</dd>
                  <dt className="font-medium text-muted-foreground">Channel</dt>
                  <dd>{activeMessage.channel_name ?? activeDeliveries[0]?.channel_name ?? 'N/A'}</dd>
                  <dt className="font-medium text-muted-foreground">Recipients</dt>
                  <dd>{(activeMessage.recipients ?? activeDeliveries.map((d) => d.destination ?? '')).filter(Boolean).join(', ') || 'N/A'}</dd>
                  <dt className="font-medium text-muted-foreground">Created at</dt>
                  <dd>{(activeMessageDetail?.created_at ?? activeMessage.created_at) ? <RelativeTime timestamp={String(activeMessageDetail?.created_at ?? activeMessage.created_at)} /> : 'N/A'}</dd>
                  {/* NA-M-07: only render Delivered At when at least one delivery has timestamped. */}
                  {collapsedDeliveredAt ? (
                    <>
                      <dt className="font-medium text-muted-foreground">Delivered at</dt>
                      <dd><RelativeTime timestamp={collapsedDeliveredAt} /></dd>
                    </>
                  ) : null}
                  <dt className="font-medium text-muted-foreground">GUID</dt>
                  <dd className="font-mono break-all text-xs">{activeMessageDetail?.guid ?? activeMessage.message_guid ?? 'N/A'}</dd>
                  <dt className="font-medium text-muted-foreground">Format applied</dt>
                  <dd>{activeMessageDetail?.format_applied ?? 'N/A'}</dd>
                  <dt className="font-medium text-muted-foreground">Language applied</dt>
                  <dd>{activeMessageDetail?.language_applied ?? 'N/A'}</dd>
                  <dt className="font-medium text-muted-foreground">Delivery count</dt>
                  <dd>{String(activeMessageDetail?.deliveries?.total ?? activeDeliveries.length)}</dd>
                </dl>
              </CardContent>
            </Card>

            {/* Rendered body — full width single column. */}
            {activeMessageDetail?.formatted_content || activeMessageDetail?.content ? (
              <Card>
                <CardHeader>
                  <h2 className="text-lg font-semibold">Rendered body</h2>
                </CardHeader>
                <CardContent>
                  <pre className="max-h-80 overflow-auto rounded-md border bg-muted/20 p-3 text-xs whitespace-pre-wrap break-words">
                    {activeMessageDetail?.formatted_content ?? activeMessageDetail?.content ?? ''}
                  </pre>
                </CardContent>
              </Card>
            ) : null}

            {/* NA-M-06: Settings (variables) / Destination (content) blocks via
                the shared JsonExplorer pattern (searchable, expandable tree). */}
            {activeMessageDetail?.content_json ? (
              <Card>
                <CardHeader>
                  <h2 className="text-lg font-semibold">Content / Destination</h2>
                </CardHeader>
                <CardContent>
                  <JsonExplorer data={activeMessageDetail.content_json} defaultExpanded={true} />
                </CardContent>
              </Card>
            ) : null}
            {activeMessageDetail?.variables_json ? (
              <Card>
                <CardHeader>
                  <h2 className="text-lg font-semibold">Settings / Variables</h2>
                </CardHeader>
                <CardContent>
                  <JsonExplorer data={activeMessageDetail.variables_json} defaultExpanded={true} />
                </CardContent>
              </Card>
            ) : null}

            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold">Deliveries for message {activeMessage.id}</h2>
              </CardHeader>
              <CardContent>
                <DataTable
                  tableId="notification-message-deliveries"
                  columns={deliveryColumns}
                  rows={activeDeliveries}
                  getRowId={(delivery) => String(delivery.id)}
                  page={deliveryPage}
                  onPageChange={setDeliveryPage}
                  pageSize={deliveryPageSize}
                  onPageSizeChange={setDeliveryPageSize}
                  selectable={true}
                  bulkActions={deliveryBulkActions}
                  onBulkAction={onDeliveryBulkAction}
                  columnPickerEnabled={true}
                />
              </CardContent>
            </Card>

            <RelatedItemsPanel
              title="Related deliveries"
              items={relatedDeliveries}
              emptyMessage="No deliveries recorded for this message."
            />
          </div>
        ) : null}
      />
    </div>
  );
}
