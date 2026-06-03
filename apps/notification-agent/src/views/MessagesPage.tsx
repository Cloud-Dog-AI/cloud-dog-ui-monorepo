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
import { useAuth } from '@cloud-dog/auth';
import { Badge, Button, Card, CardContent, CardHeader, DataTable, EntityDialog, Input, JsonBlock, Label, RelatedItemsPanel, RelativeTime, Select, StructuredView, Textarea } from '@cloud-dog/ui';
import type { BulkAction, DataColumn, EntityFieldDef, RelatedItem } from '@cloud-dog/ui';
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
  }, [query, channelFilter, senderFilter]);

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
    return matchesQuery && matchesChannel && matchesSender;
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
      cell: (message) => (
        <Button type="button" variant="link" className="font-medium underline-offset-4 hover:underline" onClick={() => void inspectMessage(message)}>
          {message.id}
        </Button>
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
    {
      id: 'actions',
      header: 'Actions',
      cell: (message) => (
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => void inspectMessage(message)}>View</Button>
          <Button variant="secondary" onClick={() => { window.location.href = `/deliveries?message_id=${message.id}`; }}>Deliveries</Button>
          <Button variant="secondary" onClick={() => window.open(`/messages/${message.id}?format=html`, '_blank', 'noopener,noreferrer')}>Open link</Button>
          <Button variant="secondary" onClick={() => void cancelMessages([message])}>Cancel</Button>
          <Button variant="secondary" onClick={() => void deleteMessages([message])}>Delete</Button>
        </div>
      ),
    },
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
  const activeMessageSummary = React.useMemo(() => {
    if (!activeMessage) return null;
    return {
      id: activeMessage.id,
      subject: activeMessage.subject ?? 'Untitled message',
      status: activeMessageDetail?.status ?? activeMessage.status ?? 'unknown',
      sender: activeMessage.created_by ?? 'N/A',
      channel: activeMessage.channel_name ?? activeDeliveries[0]?.channel_name ?? 'N/A',
      recipients: activeMessage.recipients ?? activeDeliveries.map((delivery) => delivery.destination ?? ''),
      created_at: activeMessageDetail?.created_at ?? activeMessage.created_at ?? 'N/A',
      body: activeMessageDetail?.formatted_content ?? activeMessageDetail?.content ?? 'N/A',
      guid: activeMessageDetail?.guid ?? activeMessage.message_guid ?? 'N/A',
      permalink: `/messages/${activeMessage.id}?format=html`,
      format_applied: activeMessageDetail?.format_applied ?? 'N/A',
      language_applied: activeMessageDetail?.language_applied ?? 'N/A',
      delivery_total: activeMessageDetail?.deliveries?.total ?? activeDeliveries.length,
      delivery_states: activeMessageDetail?.deliveries?.by_state ?? {},
    };
  }, [activeDeliveries.length, activeMessage, activeMessageDetail]);
  const deliveryColumns = React.useMemo<DataColumn<DeliveryRecord>[]>(() => [
    {
      id: 'channel_name',
      header: 'Channel',
      sortable: true,
      sortValue: (delivery) => delivery.channel_name ?? '',
      cell: (delivery) => delivery.channel_name ?? '',
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
              <Label htmlFor="messages-channel-filter-adopted">Route filter</Label>
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

          <form className="grid gap-3 md:grid-cols-[12rem_12rem_1fr_auto]" onSubmit={(event) => {
            event.preventDefault();
            void sendMessage();
          }}
          >
            <div className="space-y-2">
              <Label htmlFor="messages-inline-channel">Channel</Label>
              <Select
                id="messages-inline-channel"
                value={composeValues.channel}
                onChange={(event) => setComposeValues((current) => ({ ...current, channel: event.target.value, prompt_id: '' }))}
              >
                {channels.map((channel) => (
                  <option key={channel.id} value={channel.name}>{channel.name}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="messages-inline-created-by">Created by</Label>
              <Input
                id="messages-inline-created-by"
                value={composeValues.created_by}
                onChange={(event) => setComposeValues((current) => ({ ...current, created_by: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="messages-inline-body">Message body</Label>
              <Textarea
                id="messages-inline-body"
                rows={3}
                value={composeBody}
                onChange={(event) => setComposeBody(event.target.value)}
              />
            </div>
            <Button type="submit" className="self-end">Send notification</Button>
          </form>

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
        <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
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

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold">Message detail</h2>
              </CardHeader>
              <CardContent className="space-y-4">
                {activeMessageSummary ? <StructuredView title={`Message ${activeMessage.id}`} value={activeMessageSummary} /> : null}
                {activeMessageDetail?.formatted_content || activeMessageDetail?.content ? (
                  <div className="space-y-2">
                    <Label>Rendered body</Label>
                    <pre className="max-h-64 overflow-auto rounded-md border bg-muted/20 p-3 text-xs whitespace-pre-wrap">
                      {activeMessageDetail?.formatted_content ?? activeMessageDetail?.content ?? ''}
                    </pre>
                  </div>
                ) : null}
                {activeMessageDetail?.content_json ? <JsonBlock title="Content JSON" value={activeMessageDetail.content_json} defaultCollapsed={false} /> : null}
                {activeMessageDetail?.variables_json ? <JsonBlock title="Variables JSON" value={activeMessageDetail.variables_json} defaultCollapsed={false} /> : null}
              </CardContent>
            </Card>

            <RelatedItemsPanel
              title="Related deliveries"
              items={relatedDeliveries}
              emptyMessage="No deliveries recorded for this message."
            />
          </div>
        </div>
        ) : null}
      />
    </div>
  );
}
