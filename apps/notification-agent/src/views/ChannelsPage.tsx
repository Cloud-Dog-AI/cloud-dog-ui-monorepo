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

// @cloud-dog/app-notification-agent — Channels page adopted onto shared CRUD components.
// Covers: UI-R1, UI-R2

import * as React from 'react';
import { Link } from 'react-router-dom';
import { Badge, Button, Card, CardContent, CardHeader, DataTable, EntityDialog, Input, JsonBlock, Label, RelativeTime, Select, Textarea, createDataTableActionColumn } from '@cloud-dog/ui';
import type { BulkAction, DataColumn, EntityFormMode } from '@cloud-dog/ui';
import { Activity, MessageSquare, Pencil, Play, Power, Send, Trash2, X, Briefcase } from 'lucide-react';
import { useNotificationAgentState } from '../state/AppState';
import type { ChannelRecord } from '../lib/api';

type ChannelFormValues = Readonly<{
  name: string;
  type: string;
  enabled: boolean;
  description: string;
  testDestination: string;
}>;

const channelTypeOptions = ['loopback', 'smtp', 'chat_rest', 'file'];

const defaultConfigByType: Record<string, string> = {
  loopback: '{\n  "base_url": "http://127.0.0.1:8020"\n}',
  smtp: '{\n  "host": "smtp.example.com",\n  "port": 25,\n  "tls": false,\n  "username": "",\n  "password": "",\n  "from_address": "notify@example.com"\n}',
  chat_rest: '{\n  "endpoint": "https://example.invalid/webhook",\n  "method": "POST",\n  "headers": {}\n}',
  file: '{\n  "base_path": "/tmp/notify-files"\n}',
};

const emptyForm: ChannelFormValues = {
  name: '',
  type: 'loopback',
  enabled: true,
  description: '',
  testDestination: 'loopback://notification-ui',
};

function parseConfigJson(input: string): Record<string, unknown> {
  if (!input.trim()) return {};
  return JSON.parse(input) as Record<string, unknown>;
}

function validate(values: ChannelFormValues, configJson: string, mode: EntityFormMode): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!values.name.trim()) errors.name = 'Channel name is required.';
  if (mode === 'add' && !values.type.trim()) errors.type = 'Channel type is required.';
  try {
    parseConfigJson(configJson);
  } catch {
    errors.testDestination = 'Channel configuration is invalid.';
  }
  return errors;
}

function downloadJson(filename: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function safeParseConfigJson(configJson: string): Record<string, unknown> {
  try {
    return parseConfigJson(configJson);
  } catch {
    return {};
  }
}

function updateConfigField(configJson: string, key: string, value: unknown): string {
  const config = safeParseConfigJson(configJson);
  config[key] = value;
  return JSON.stringify(config, null, 2);
}

function readStringField(configJson: string, key: string, fallback = ''): string {
  const value = safeParseConfigJson(configJson)[key];
  return typeof value === 'string' ? value : fallback;
}

function readNumberField(configJson: string, key: string, fallback = 0): number {
  const value = safeParseConfigJson(configJson)[key];
  return typeof value === 'number' ? value : fallback;
}

function readBooleanField(configJson: string, key: string, fallback = false): boolean {
  const value = safeParseConfigJson(configJson)[key];
  return typeof value === 'boolean' ? value : fallback;
}

function channelStatusVariant(enabled: boolean | undefined): 'default' | 'secondary' {
  return enabled === false ? 'secondary' : 'default';
}

export function ChannelsPage() {
  const { api, latestFailure, captureFailure, clearFailure } = useNotificationAgentState();
  const [channels, setChannels] = React.useState<ChannelRecord[]>([]);
  const [status, setStatus] = React.useState('');
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [dialogMode, setDialogMode] = React.useState<EntityFormMode>('add');
  const [activeChannel, setActiveChannel] = React.useState<ChannelRecord | null>(null);
  const [formValues, setFormValues] = React.useState<ChannelFormValues>(emptyForm);
  const [configJson, setConfigJson] = React.useState(defaultConfigByType.loopback);
  const [formErrors, setFormErrors] = React.useState<Record<string, string>>({});
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);
  // NA-C-03 / NA-C-09: a separate Test dialog (kept independent of the
  // view/edit EntityDialog) — opened from the Test row action.
  const [testDialogOpen, setTestDialogOpen] = React.useState(false);
  const [testChannelTarget, setTestChannelTarget] = React.useState<ChannelRecord | null>(null);
  const [testDialogDestination, setTestDialogDestination] = React.useState('loopback://notification-ui');
  const [testDialogPayload, setTestDialogPayload] = React.useState('{\n  "subject": "Channel test",\n  "body": "Notification agent test message."\n}');
  const [testDialogResult, setTestDialogResult] = React.useState<Record<string, unknown> | null>(null);
  const [testDialogError, setTestDialogError] = React.useState<string | null>(null);
  const [testDialogRunning, setTestDialogRunning] = React.useState(false);

  const loadChannels = React.useCallback(async () => {
    clearFailure();
    try {
      const channelList = await api.listChannels();
      setChannels([...channelList].sort((left, right) => right.id - left.id));
    } catch (error) {
      captureFailure(error);
    }
  }, [api, captureFailure, clearFailure]);

  React.useEffect(() => {
    void loadChannels();
  }, [loadChannels]);

  const openDialog = (mode: EntityFormMode, channel?: ChannelRecord) => {
    setDialogMode(mode);
    setActiveChannel(channel ?? null);
    setFormErrors({});
    if (!channel) {
      setFormValues(emptyForm);
      setConfigJson(defaultConfigByType.loopback);
    } else {
      setFormValues({
        name: channel.name,
        type: channel.type,
        enabled: channel.enabled !== false,
        description: channel.description ?? '',
        testDestination: 'loopback://notification-ui',
      });
      setConfigJson(JSON.stringify(channel.config ?? {}, null, 2));
    }
    setDialogOpen(true);
  };

  const saveChannel = async () => {
    const errors = validate(formValues, configJson, dialogMode);
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    clearFailure();
    setStatus('');
    try {
      let statusMsg = '';
      if (dialogMode === 'add') {
        const created = await api.createChannel({
          name: formValues.name.trim(),
          type: formValues.type,
          enabled: formValues.enabled,
          description: formValues.description.trim() || null,
          config: parseConfigJson(configJson),
        });
        setChannels((current) => {
          const createdChannel: ChannelRecord = {
            id: Number(created.id ?? 0),
            name: created.name ?? formValues.name.trim(),
            type: created.type ?? formValues.type,
            enabled: created.enabled ?? formValues.enabled,
            description: created.description ?? (formValues.description.trim() || null),
            config: created.config ?? parseConfigJson(configJson),
            created_at: created.created_at ?? null,
            message_count: created.message_count ?? 0,
          };
          return [createdChannel, ...current.filter((channel) => channel.id !== createdChannel.id)];
        });
        setPage(1);
        statusMsg = `Created channel ${formValues.name.trim()}.`;
      } else if (activeChannel) {
        await api.updateChannel(activeChannel.id, {
          name: formValues.name.trim(),
          enabled: formValues.enabled,
          description: formValues.description.trim() || null,
          config_json: parseConfigJson(configJson),
        });
        statusMsg = `Updated channel ${activeChannel.name}.`;
      }
      if (dialogMode === 'add') {
        setStatus(statusMsg);
        setDialogOpen(false);
        void loadChannels();
      } else {
        await loadChannels();
        setStatus(statusMsg);
        setDialogOpen(false);
      }
    } catch (error) {
      captureFailure(error);
    }
  };

  const deleteChannels = async (items: ChannelRecord[]) => {
    clearFailure();
    setStatus('');
    try {
      for (const item of items) {
        await api.deleteChannel(item.id);
      }
      setStatus(items.length === 1 ? `Deleted channel ${items[0].name}.` : `Deleted ${items.length} channels.`);
      if (activeChannel && items.some((item) => item.id === activeChannel.id)) {
        setDialogOpen(false);
        setActiveChannel(null);
      }
      await loadChannels();
    } catch (error) {
      captureFailure(error);
    }
  };

  const toggleChannel = async (channel: ChannelRecord, enabled: boolean) => {
    clearFailure();
    setStatus('');
    try {
      if (enabled) {
        await api.enableChannel(channel.id);
      } else {
        await api.disableChannel(channel.id);
      }
      setStatus(`${enabled ? 'Enabled' : 'Disabled'} channel ${channel.name}.`);
      await loadChannels();
    } catch (error) {
      captureFailure(error);
    }
  };

  // NA-C-03 / NA-C-09: open the dedicated Test dialog (separate from view/edit).
  const openTestDialog = (channel: ChannelRecord) => {
    setTestChannelTarget(channel);
    setTestDialogResult(null);
    setTestDialogError(null);
    setTestDialogPayload('{\n  "subject": "Channel test",\n  "body": "Notification agent test message."\n}');
    setTestDialogDestination('loopback://notification-ui');
    setTestDialogOpen(true);
  };

  const runTestDialog = async () => {
    if (!testChannelTarget) return;
    setTestDialogError(null);
    setTestDialogResult(null);
    setTestDialogRunning(true);
    try {
      let payload: Record<string, unknown> = {};
      try {
        payload = JSON.parse(testDialogPayload) as Record<string, unknown>;
      } catch (parseErr) {
        setTestDialogError('Test payload is not valid JSON.');
        setTestDialogRunning(false);
        return;
      }
      const result = await api.testChannel(testChannelTarget.id, {
        destination: testDialogDestination,
        test_message: payload,
      });
      setTestDialogResult(result);
      setStatus(`Ran test for ${testChannelTarget.name}.`);
    } catch (error) {
      setTestDialogError(error instanceof Error ? error.message : String(error));
    } finally {
      setTestDialogRunning(false);
    }
  };

  // NA-C-05 / NA-C-07: horizontal iconized button row across the bottom of the
  // channel View/Edit dialogs (replaces the left-side related-items list).
  // NA-C-11 / NA-C-14: audit row routes to /diagnostics-audit (the canonical
  // Audit & Log page) with a channel-filter query.
  const channelToolbarLinks = activeChannel
    ? [
        { id: 'deliveries', label: 'Deliveries', icon: <Send className="h-4 w-4" />, href: `/deliveries?channel=${encodeURIComponent(activeChannel.name)}` },
        { id: 'messages', label: `Messages (${activeChannel.message_count ?? 0})`, icon: <MessageSquare className="h-4 w-4" />, href: `/messages?channel=${encodeURIComponent(activeChannel.name)}` },
        { id: 'audit', label: 'Audit & Log', icon: <Activity className="h-4 w-4" />, href: `/diagnostics-audit?query=channel:${encodeURIComponent(activeChannel.name)}` },
        { id: 'jobs', label: 'Jobs', icon: <Briefcase className="h-4 w-4" />, href: `/jobs?channel=${encodeURIComponent(activeChannel.name)}` },
      ]
    : [];
  const ChannelToolbar = () => (
    <div className="flex flex-wrap items-center gap-2 border-t pt-3">
      {channelToolbarLinks.map((link) => (
        <Button
          key={link.id}
          type="button"
          variant="secondary"
          onClick={() => { window.location.href = link.href; }}
          aria-label={link.label}
        >
          <span className="mr-2 inline-flex">{link.icon}</span>
          {link.label}
        </Button>
      ))}
    </div>
  );

  const columns = React.useMemo<DataColumn<ChannelRecord>[]>(() => [
    {
      id: 'name',
      header: 'Name',
      sortable: true,
      sortValue: (channel) => channel.name,
      // CX-103: first identifier column renders a Link that opens the view/edit dialog.
      cell: (channel) => (
        <Link
          to={`/channels?channelId=${encodeURIComponent(String(channel.id))}`}
          className="text-primary underline-offset-4 hover:underline"
          aria-label={`View channel ${channel.name}`}
          onClick={(e) => { e.preventDefault(); openDialog('view', channel); }}
        >
          {channel.name}
        </Link>
      ),
    },
    {
      id: 'type',
      header: 'Type',
      sortable: true,
      sortValue: (channel) => channel.type,
      cell: (channel) => channel.type,
    },
    {
      id: 'preference_token',
      header: 'Preference Token',
      sortable: true,
      sortValue: (channel) => channel.name,
      cell: (channel) => channel.name,
    },
    {
      id: 'enabled',
      header: 'Status',
      sortable: true,
      sortValue: (channel) => (channel.enabled === false ? 0 : 1),
      cell: (channel) => (
        <Badge variant={channelStatusVariant(channel.enabled)}>
          {channel.enabled === false ? 'Disabled' : 'Enabled'}
        </Badge>
      ),
    },
    {
      id: 'created_at',
      header: 'Created',
      sortable: true,
      sortValue: (channel) => channel.created_at ?? '',
      cell: (channel) => channel.created_at ? <RelativeTime timestamp={channel.created_at} /> : 'N/A',
    },
    {
      id: 'message_count',
      header: 'Messages Sent',
      sortable: true,
      sortValue: (channel) => channel.message_count ?? 0,
      cell: (channel) => String(channel.message_count ?? 0),
    },
    {
      id: 'last_used',
      header: 'Last Used',
      sortable: true,
      sortValue: (channel) => channel.last_used ?? '',
      cell: (channel) => channel.last_used ? <RelativeTime timestamp={channel.last_used} /> : 'Never',
    },
    // CX-102 / CX-104: shared action-cell helper; preserves all existing actions + Log -> /diagnostics-audit.
    createDataTableActionColumn<ChannelRecord>((channel) => [
      {
        id: 'edit',
        label: 'Edit',
        icon: <Pencil className="h-4 w-4" />,
        onClick: () => openDialog('edit', channel),
      },
      {
        id: 'toggle',
        label: channel.enabled === false ? 'Enable' : 'Disable',
        icon: <Power className="h-4 w-4" />,
        onClick: () => void toggleChannel(channel, channel.enabled === false),
        title: () => `${channel.enabled === false ? 'Enable' : 'Disable'} channel ${channel.name}`,
      },
      // NA-C-03 / NA-C-09: Test opens a dedicated Test dialog rather than running inline.
      {
        id: 'test',
        label: 'Test',
        icon: <Play className="h-4 w-4" />,
        onClick: () => openTestDialog(channel),
        title: () => `Run test for channel ${channel.name}`,
      },
      {
        id: 'messages',
        label: 'Messages',
        icon: <MessageSquare className="h-4 w-4" />,
        href: () => `/messages?channel=${encodeURIComponent(channel.name)}`,
        title: () => `View messages for channel ${channel.name}`,
      },
      // NA-C-11 / NA-C-13 / NA-C-14: collapse duplicate "Log" / "Logs" actions
      // to a single platform-standard "Audit & Log" row that routes to
      // /diagnostics-audit with a channel-filter query (LogTablePanel reads
      // ?query=channel:<name> and pre-filters the audit feed).
      {
        id: 'audit-log',
        label: 'Audit & Log',
        icon: <Activity className="h-4 w-4" />,
        href: () => `/diagnostics-audit?query=channel:${encodeURIComponent(channel.name)}`,
        title: () => `View Audit & Log entries for channel ${channel.name}`,
      },
      {
        id: 'delete',
        label: 'Delete',
        icon: <Trash2 className="h-4 w-4" />,
        destructive: true,
        onClick: () => void deleteChannels([channel]),
      },
    ]),
  ], [deleteChannels, toggleChannel]);

  const bulkActions = React.useMemo<BulkAction[]>(() => [
    { label: 'Disable selected', action: 'disable' },
    { label: 'Delete selected', action: 'delete' },
    { label: 'Export', action: 'export' },
  ], []);

  const onBulkAction = React.useCallback((action: string, selectedIds: string[]) => {
    const items = channels.filter((channel) => selectedIds.includes(String(channel.id)));
    if (action === 'disable') {
      void Promise.all(items.map((item) => toggleChannel(item, false)));
      return;
    }
    if (action === 'delete') {
      void deleteChannels(items);
      return;
    }
    if (action === 'export') {
      downloadJson('notification-channels.json', items);
    }
  }, [channels, deleteChannels, toggleChannel]);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Channels</h1>
        <p className="text-xs text-muted-foreground">
          View Channel shows Method, Headers, and Payload fields with a top-right Close control. Edit Channel is separate from the dedicated Test dialog.
        </p>
      </header>

      {latestFailure ? <p role="alert" className="text-sm text-destructive">{latestFailure}</p> : null}
      {status ? <p role="status" className="text-sm text-foreground/80">{status}</p> : null}

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Channel</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-end">
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => void loadChannels()}>Refresh</Button>
              <Button onClick={() => openDialog('add')}>Add channel</Button>
            </div>
          </div>

          <DataTable
            tableId="notification-channels"
            columns={columns}
            rows={channels}
            getRowId={(channel) => String(channel.id)}
            getRowName={(channel) => `${channel.name} ${channel.type} channel`}
            page={page}
            onPageChange={setPage}
            pageSize={pageSize}
            onPageSizeChange={setPageSize}
            selectable={true}
            bulkActions={bulkActions}
            onBulkAction={onBulkAction}
            columnPickerEnabled={true}
          />
        </CardContent>
      </Card>

      {/* NA-C-01..NA-C-07: channel view/edit/add dialog. View mode renders the
          channel as a readable structured form (no embedded test feature).
          Edit/add render the form. A top-right close affordance is provided in
          the dialog header (NA-C-04). Related links sit as a horizontal
          iconized button row across the bottom (NA-C-05 / NA-C-07). The
          embedded "Test" feature from previous dialog versions is removed
          (NA-C-02 / NA-C-06) — Test now opens a dedicated Test dialog from
          the row action (NA-C-03 / NA-C-09). */}
      <EntityDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={
          dialogMode === 'add'
            ? 'Add channel'
            : dialogMode === 'edit'
              ? `Edit channel ${activeChannel?.name ?? ''}`
              : `View channel ${activeChannel?.name ?? ''}`
        }
        body={(
          <div className="space-y-4">
            {/* NA-C-04: top-right close affordance (in addition to Esc / outside-click). */}
            <div className="flex items-start justify-end -mt-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                aria-label="Close"
                onClick={() => setDialogOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {dialogMode === 'view' && activeChannel ? (
              // NA-C-01: readable structured field layout (no raw JSON table).
              <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-sm md:grid-cols-[160px_1fr]">
                <dt className="font-medium text-muted-foreground">Name</dt>
                <dd>{activeChannel.name}</dd>
                <dt className="font-medium text-muted-foreground">Type</dt>
                <dd>{activeChannel.type}</dd>
                <dt className="font-medium text-muted-foreground">Status</dt>
                <dd>{activeChannel.enabled === false ? 'Disabled' : 'Enabled'}</dd>
                <dt className="font-medium text-muted-foreground">Description</dt>
                <dd>{activeChannel.description?.trim() ? activeChannel.description : 'N/A'}</dd>
                {activeChannel.type === 'chat_rest' ? (
                  <>
                    <dt className="font-medium text-muted-foreground">Method</dt>
                    <dd className="font-mono">{readStringField(JSON.stringify(activeChannel.config ?? {}), 'method', 'POST')}</dd>
                    <dt className="font-medium text-muted-foreground">Endpoint</dt>
                    <dd className="font-mono break-all">{readStringField(JSON.stringify(activeChannel.config ?? {}), 'endpoint')}</dd>
                    <dt className="font-medium text-muted-foreground">Headers</dt>
                    <dd>
                      <JsonBlock title="" value={(activeChannel.config as Record<string, unknown> | undefined)?.headers ?? {}} defaultCollapsed={false} />
                    </dd>
                  </>
                ) : null}
                {activeChannel.type === 'smtp' ? (
                  <>
                    <dt className="font-medium text-muted-foreground">SMTP host</dt>
                    <dd className="font-mono">{readStringField(JSON.stringify(activeChannel.config ?? {}), 'host')}</dd>
                    <dt className="font-medium text-muted-foreground">Port</dt>
                    <dd className="font-mono">{String(readNumberField(JSON.stringify(activeChannel.config ?? {}), 'port', 25))}</dd>
                    <dt className="font-medium text-muted-foreground">From address</dt>
                    <dd className="font-mono">{readStringField(JSON.stringify(activeChannel.config ?? {}), 'from_address')}</dd>
                    <dt className="font-medium text-muted-foreground">TLS</dt>
                    <dd>{readBooleanField(JSON.stringify(activeChannel.config ?? {}), 'tls', false) ? 'Enabled' : 'Disabled'}</dd>
                  </>
                ) : null}
                {activeChannel.type === 'loopback' ? (
                  <>
                    <dt className="font-medium text-muted-foreground">Base URL</dt>
                    <dd className="font-mono">{readStringField(JSON.stringify(activeChannel.config ?? {}), 'base_url')}</dd>
                  </>
                ) : null}
                {activeChannel.type === 'file' ? (
                  <>
                    <dt className="font-medium text-muted-foreground">Base path</dt>
                    <dd className="font-mono">{readStringField(JSON.stringify(activeChannel.config ?? {}), 'base_path')}</dd>
                  </>
                ) : null}
                <dt className="font-medium text-muted-foreground">Created</dt>
                <dd>{activeChannel.created_at ? <RelativeTime timestamp={activeChannel.created_at} /> : 'N/A'}</dd>
                <dt className="font-medium text-muted-foreground">Messages sent</dt>
                <dd>{String(activeChannel.message_count ?? 0)}</dd>
              </dl>
            ) : (
              // Edit / add mode: keep the existing structured form.
              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  void saveChannel();
                }}
              >
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="channels-form-name">Name</Label>
                    <Input id="channels-form-name" value={formValues.name} onChange={(event) => setFormValues((current) => ({ ...current, name: event.target.value }))} disabled={dialogMode !== 'add'} />
                    {formErrors.name ? <p className="text-sm text-destructive">{formErrors.name}</p> : null}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="channels-form-type">Type</Label>
                    <Select id="channels-form-type" value={formValues.type} onChange={(event) => { const next = event.target.value; setFormValues((current) => ({ ...current, type: next })); setConfigJson(defaultConfigByType[next] ?? '{}'); }} disabled={dialogMode !== 'add'}>
                      {channelTypeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="channels-form-enabled">Enabled</Label>
                    <Select id="channels-form-enabled" value={String(formValues.enabled)} onChange={(event) => setFormValues((current) => ({ ...current, enabled: event.target.value === 'true' }))}>
                      <option value="true">Enabled</option>
                      <option value="false">Disabled</option>
                    </Select>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="channels-form-description">Description</Label>
                    <Textarea id="channels-form-description" rows={2} placeholder="Human-readable description of what this channel is for" value={formValues.description} onChange={(event) => setFormValues((current) => ({ ...current, description: event.target.value }))} />
                  </div>
                </div>

                <div className="space-y-2 border-t pt-3">
                  <h3 className="text-sm font-semibold">Type-specific configuration</h3>
                  {formValues.type === 'loopback' ? (
                    <div className="space-y-2">
                      <Label htmlFor="channels-loopback-base-url-adopted">Base URL</Label>
                      <Input id="channels-loopback-base-url-adopted" value={readStringField(configJson, 'base_url', 'http://127.0.0.1:8020')} onChange={(event) => setConfigJson(updateConfigField(configJson, 'base_url', event.target.value))} />
                    </div>
                  ) : null}
                  {formValues.type === 'smtp' ? (
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-2"><Label htmlFor="channels-smtp-host-adopted">SMTP host</Label><Input id="channels-smtp-host-adopted" value={readStringField(configJson, 'host', 'smtp.example.com')} onChange={(event) => setConfigJson(updateConfigField(configJson, 'host', event.target.value))} /></div>
                      <div className="space-y-2"><Label htmlFor="channels-smtp-port-adopted">Port</Label><Input id="channels-smtp-port-adopted" type="number" value={String(readNumberField(configJson, 'port', 25))} onChange={(event) => setConfigJson(updateConfigField(configJson, 'port', Number(event.target.value || 25)))} /></div>
                      <div className="space-y-2"><Label htmlFor="channels-smtp-username-adopted">Username</Label><Input id="channels-smtp-username-adopted" value={readStringField(configJson, 'username')} onChange={(event) => setConfigJson(updateConfigField(configJson, 'username', event.target.value))} /></div>
                      <div className="space-y-2"><Label htmlFor="channels-smtp-password-adopted">Password</Label><Input id="channels-smtp-password-adopted" type="password" value={readStringField(configJson, 'password')} onChange={(event) => setConfigJson(updateConfigField(configJson, 'password', event.target.value))} /></div>
                      <div className="space-y-2"><Label htmlFor="channels-smtp-from-address-adopted">From address</Label><Input id="channels-smtp-from-address-adopted" value={readStringField(configJson, 'from_address', 'notify@example.com')} onChange={(event) => setConfigJson(updateConfigField(configJson, 'from_address', event.target.value))} /></div>
                      <div className="space-y-2"><Label htmlFor="channels-smtp-tls-adopted">TLS</Label><Select id="channels-smtp-tls-adopted" value={String(readBooleanField(configJson, 'tls', false))} onChange={(event) => setConfigJson(updateConfigField(configJson, 'tls', event.target.value === 'true'))}><option value="false">Disabled</option><option value="true">Enabled</option></Select></div>
                    </div>
                  ) : null}
                  {formValues.type === 'chat_rest' ? (
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-2 md:col-span-2"><Label htmlFor="channels-chat-endpoint-adopted">Webhook endpoint</Label><Input id="channels-chat-endpoint-adopted" value={readStringField(configJson, 'endpoint')} onChange={(event) => setConfigJson(updateConfigField(configJson, 'endpoint', event.target.value))} /></div>
                      <div className="space-y-2"><Label htmlFor="channels-chat-method-adopted">Method</Label><Select id="channels-chat-method-adopted" value={readStringField(configJson, 'method', 'POST')} onChange={(event) => setConfigJson(updateConfigField(configJson, 'method', event.target.value))}><option value="POST">POST</option><option value="GET">GET</option></Select></div>
                      <div className="space-y-2"><Label htmlFor="channels-chat-headers-adopted">Headers</Label><Textarea id="channels-chat-headers-adopted" rows={4} value={JSON.stringify(safeParseConfigJson(configJson).headers ?? {}, null, 2)} onChange={(event) => { try { setConfigJson(updateConfigField(configJson, 'headers', JSON.parse(event.target.value))); } catch { setConfigJson(updateConfigField(configJson, 'headers', {})); } }} /></div>
                    </div>
                  ) : null}
                  {formValues.type === 'file' ? (
                    <div className="space-y-2">
                      <Label htmlFor="channels-file-base-path-adopted">Base path</Label>
                      <Input id="channels-file-base-path-adopted" value={readStringField(configJson, 'base_path', '/tmp/notify-files')} onChange={(event) => setConfigJson(updateConfigField(configJson, 'base_path', event.target.value))} />
                    </div>
                  ) : null}
                </div>

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="secondary" onClick={() => setDialogOpen(false)}>Cancel</Button>
                  <Button type="submit">Save changes</Button>
                </div>
              </form>
            )}

            {activeChannel ? <ChannelToolbar /> : null}
          </div>
        )}
      />

      {/* NA-C-03 / NA-C-09: dedicated Test dialog, opened from the row action. */}
      <EntityDialog
        open={testDialogOpen}
        onOpenChange={setTestDialogOpen}
        title={testChannelTarget ? `Test channel ${testChannelTarget.name}` : 'Test channel'}
        body={(
          <div className="space-y-4">
            <div className="flex items-start justify-end -mt-2">
              <Button type="button" variant="secondary" size="sm" aria-label="Close" onClick={() => setTestDialogOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-2">
              <Label htmlFor="channels-test-dialog-destination">Test recipient or endpoint</Label>
              <Select id="channels-test-dialog-destination" value={testDialogDestination} onChange={(event) => setTestDialogDestination(event.target.value)}>
                <option value="loopback://notification-ui">loopback://notification-ui</option>
                <option value="ops@example.com">ops@example.com</option>
                <option value="+15550001111">+15550001111</option>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="channels-test-dialog-payload">Test payload (JSON)</Label>
              <Textarea id="channels-test-dialog-payload" rows={6} value={testDialogPayload} onChange={(event) => setTestDialogPayload(event.target.value)} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setTestDialogOpen(false)}>Cancel</Button>
              <Button type="button" disabled={testDialogRunning} onClick={() => void runTestDialog()}>
                {testDialogRunning ? 'Running test…' : 'Run live test'}
              </Button>
            </div>
            {testDialogError ? <p role="alert" className="text-sm text-destructive">{testDialogError}</p> : null}
            {testDialogResult ? <JsonBlock title="Test result" value={testDialogResult} defaultCollapsed={false} /> : null}
          </div>
        )}
      />

    </div>
  );
}
