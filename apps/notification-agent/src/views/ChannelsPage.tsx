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
import { Badge, Button, Card, CardContent, CardHeader, DataTable, EntityDialog, Input, JsonBlock, Label, RelativeTime, Select, Switch, Textarea } from '@cloud-dog/ui';
import type { BulkAction, DataColumn, EntityFieldDef, EntityFormMode, RelatedItem } from '@cloud-dog/ui';
import { useNotificationAgentState } from '../state/AppState';
import type { ChannelRecord } from '../lib/api';

type ChannelFormValues = Readonly<{
  name: string;
  type: string;
  enabled: boolean;
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

function channelFields(mode: EntityFormMode): EntityFieldDef[] {
  return [
    { name: 'name', label: 'Name', type: 'text', required: true, readOnly: mode === 'view' },
    { name: 'type', label: 'Type', type: 'select', options: channelTypeOptions, required: true, readOnly: mode !== 'add' },
    { name: 'enabled', label: 'Enabled', type: 'select', options: ['true', 'false'], readOnly: mode === 'view' },
    { name: 'testDestination', label: 'Test recipient or endpoint', type: 'select', options: ['loopback://notification-ui', 'ops@example.com', '+15550001111'], readOnly: mode === 'view' },
  ];
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

function navigateTo(path: string) {
  window.location.href = path;
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
  const [testPayload, setTestPayload] = React.useState('{\n  "subject": "Channel test",\n  "body": "Notification agent test message."\n}');
  const [formErrors, setFormErrors] = React.useState<Record<string, string>>({});
  const [lastTestResult, setLastTestResult] = React.useState<Record<string, unknown> | null>(null);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);

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
    setLastTestResult(null);
    setFormErrors({});
    if (!channel) {
      setFormValues(emptyForm);
      setConfigJson(defaultConfigByType.loopback);
      setTestPayload('{\n  "subject": "Channel test",\n  "body": "Notification agent test message."\n}');
    } else {
      setFormValues({
        name: channel.name,
        type: channel.type,
        enabled: channel.enabled !== false,
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
          config: parseConfigJson(configJson),
        });
        setChannels((current) => {
          const createdChannel: ChannelRecord = {
            id: Number(created.id ?? 0),
            name: created.name ?? formValues.name.trim(),
            type: created.type ?? formValues.type,
            enabled: created.enabled ?? formValues.enabled,
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

  const testChannel = async (channel: ChannelRecord) => {
    clearFailure();
    setStatus('');
    try {
      const payload = JSON.parse(testPayload) as Record<string, unknown>;
      const result = await api.testChannel(channel.id, {
        destination: formValues.testDestination,
        test_message: payload,
      });
      setLastTestResult(result);
      setActiveChannel(channel);
      setStatus(`Ran test for ${channel.name}.`);
    } catch (error) {
      captureFailure(error);
    }
  };

  const createQuickChannel = async (event: React.FormEvent) => {
    event.preventDefault();
    const errors = validate(formValues, configJson, 'add');
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    clearFailure();
    setStatus('');
    try {
      const created = await api.createChannel({
        name: formValues.name.trim(),
        type: formValues.type,
        enabled: formValues.enabled,
        config: parseConfigJson(configJson),
      });
      const createdChannel: ChannelRecord = {
        id: Number(created.id ?? 0),
        name: created.name ?? formValues.name.trim(),
        type: created.type ?? formValues.type,
        enabled: created.enabled ?? formValues.enabled,
        config: created.config ?? parseConfigJson(configJson),
        created_at: created.created_at ?? null,
        message_count: created.message_count ?? 0,
      };
      setChannels((current) => [createdChannel, ...current.filter((channel) => channel.id !== createdChannel.id)]);
      setFormValues(emptyForm);
      setConfigJson(defaultConfigByType.loopback);
      setPage(1);
      setStatus(`Created channel ${createdChannel.name}.`);
    } catch (error) {
      captureFailure(error);
    }
  };

  const relatedItems: RelatedItem[] = activeChannel
    ? [
        { id: `${activeChannel.id}-deliveries`, label: 'Deliveries', href: `/deliveries?channel=${encodeURIComponent(activeChannel.name)}` },
        { id: `${activeChannel.id}-messages`, label: `Messages (${activeChannel.message_count ?? 0})`, href: `/messages?channel=${encodeURIComponent(activeChannel.name)}` },
        { id: `${activeChannel.id}-logs`, label: 'Audit log', href: `/monitoring?query=channel:${encodeURIComponent(activeChannel.name)}` },
        { id: `${activeChannel.id}-jobs`, label: 'Jobs', href: `/jobs?channel=${encodeURIComponent(activeChannel.name)}` },
      ]
    : [];

  const columns = React.useMemo<DataColumn<ChannelRecord>[]>(() => [
    {
      id: 'name',
      header: 'Name',
      sortable: true,
      sortValue: (channel) => channel.name,
      cell: (channel) => (
        <span className="cursor-pointer font-medium underline-offset-4 hover:underline" onClick={() => openDialog('view', channel)}>
          {channel.name}
        </span>
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
    {
      id: 'actions',
      header: 'Actions',
      cell: (channel) => (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" aria-label={`Edit channel ${channel.name}`} onClick={() => openDialog('edit', channel)}>Edit</Button>
          <Switch
            aria-label={`${channel.enabled === false ? 'Enable' : 'Disable'} ${channel.name}`}
            checked={channel.enabled !== false}
            onCheckedChange={(checked) => void toggleChannel(channel, checked)}
          />
          <Button variant="secondary" onClick={() => void testChannel(channel)}>Test</Button>
          <Button variant="secondary" onClick={() => navigateTo(`/messages?channel=${encodeURIComponent(channel.name)}`)}>Messages</Button>
          <Button variant="secondary" onClick={() => navigateTo(`/monitoring?query=channel:${encodeURIComponent(channel.name)}`)}>Logs</Button>
          <Button variant="secondary" aria-label={`Delete channel ${channel.name}`} onClick={() => void deleteChannels([channel])}>Delete</Button>
        </div>
      ),
    },
  ], [deleteChannels, testChannel, toggleChannel]);

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
      </header>

      {latestFailure ? <p role="alert" className="text-sm text-destructive">{latestFailure}</p> : null}
      {status ? <p role="status" className="text-sm text-foreground/80">{status}</p> : null}

      {!dialogOpen ? (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Create channel</h2>
          </CardHeader>
          <CardContent>
            <form className="grid gap-3 md:grid-cols-[1fr_12rem_1fr_auto]" onSubmit={createQuickChannel}>
              <div className="space-y-2">
                <Label htmlFor="channels-quick-name">Name</Label>
                <Input
                  id="channels-quick-name"
                  value={formValues.name}
                  onChange={(event) => setFormValues((current) => ({ ...current, name: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="channels-quick-type">Type</Label>
                <Select
                  id="channels-quick-type"
                  value={formValues.type}
                  onChange={(event) => {
                    setFormValues((current) => ({ ...current, type: event.target.value }));
                    setConfigJson(defaultConfigByType[event.target.value] ?? '{}');
                  }}
                >
                  {channelTypeOptions.map((type) => <option key={type} value={type}>{type}</option>)}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="channels-quick-config">Config JSON</Label>
                <Textarea
                  id="channels-quick-config"
                  rows={3}
                  value={configJson}
                  onChange={(event) => setConfigJson(event.target.value)}
                />
                {formErrors.testDestination ? <p className="text-sm text-destructive">{formErrors.testDestination}</p> : null}
              </div>
              <Button type="submit" className="self-end">Create channel</Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Channel directory</h2>
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
        mode={dialogMode}
        idPrefix="channels-edit"
        fields={channelFields(dialogMode)}
        values={formValues}
        errors={formErrors}
        onChange={(name, value) => {
          setFormValues((current) => ({
            ...current,
            [name]: name === 'enabled' ? (value === true || value === 'true') : String(value ?? ''),
          }));
          if (name === 'type') {
            setConfigJson(defaultConfigByType[String(value ?? 'loopback')] ?? '{}');
          }
        }}
        onSubmit={() => void saveChannel()}
        onCancel={() => setDialogOpen(false)}
        submitLabel="Save changes"
        extra={(
          <div className="space-y-4 border-t pt-4">
            <h3 className="text-sm font-semibold">Type-specific configuration</h3>
            {formValues.type === 'loopback' ? (
              <div className="space-y-2">
                <Label htmlFor="channels-loopback-base-url-adopted">Base URL</Label>
                <Input
                  id="channels-loopback-base-url-adopted"
                  value={readStringField(configJson, 'base_url', 'http://127.0.0.1:8020')}
                  onChange={(event) => setConfigJson(updateConfigField(configJson, 'base_url', event.target.value))}
                  disabled={dialogMode === 'view'}
                />
              </div>
            ) : null}
            {formValues.type === 'smtp' ? (
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="channels-smtp-host-adopted">SMTP host</Label>
                  <Input id="channels-smtp-host-adopted" value={readStringField(configJson, 'host', 'smtp.example.com')} onChange={(event) => setConfigJson(updateConfigField(configJson, 'host', event.target.value))} disabled={dialogMode === 'view'} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="channels-smtp-port-adopted">Port</Label>
                  <Input id="channels-smtp-port-adopted" type="number" value={String(readNumberField(configJson, 'port', 25))} onChange={(event) => setConfigJson(updateConfigField(configJson, 'port', Number(event.target.value || 25)))} disabled={dialogMode === 'view'} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="channels-smtp-username-adopted">Username</Label>
                  <Input id="channels-smtp-username-adopted" value={readStringField(configJson, 'username')} onChange={(event) => setConfigJson(updateConfigField(configJson, 'username', event.target.value))} disabled={dialogMode === 'view'} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="channels-smtp-password-adopted">Password</Label>
                  <Input id="channels-smtp-password-adopted" type="password" value={readStringField(configJson, 'password')} onChange={(event) => setConfigJson(updateConfigField(configJson, 'password', event.target.value))} disabled={dialogMode === 'view'} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="channels-smtp-from-address-adopted">From address</Label>
                  <Input id="channels-smtp-from-address-adopted" value={readStringField(configJson, 'from_address', 'notify@example.com')} onChange={(event) => setConfigJson(updateConfigField(configJson, 'from_address', event.target.value))} disabled={dialogMode === 'view'} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="channels-smtp-tls-adopted">TLS</Label>
                  <Select id="channels-smtp-tls-adopted" value={String(readBooleanField(configJson, 'tls', false))} onChange={(event) => setConfigJson(updateConfigField(configJson, 'tls', event.target.value === 'true'))} disabled={dialogMode === 'view'}>
                    <option value="false">Disabled</option>
                    <option value="true">Enabled</option>
                  </Select>
                </div>
              </div>
            ) : null}
            {formValues.type === 'chat_rest' ? (
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="channels-chat-endpoint-adopted">Webhook endpoint</Label>
                  <Input id="channels-chat-endpoint-adopted" value={readStringField(configJson, 'endpoint')} onChange={(event) => setConfigJson(updateConfigField(configJson, 'endpoint', event.target.value))} disabled={dialogMode === 'view'} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="channels-chat-method-adopted">Method</Label>
                  <Select id="channels-chat-method-adopted" value={readStringField(configJson, 'method', 'POST')} onChange={(event) => setConfigJson(updateConfigField(configJson, 'method', event.target.value))} disabled={dialogMode === 'view'}>
                    <option value="POST">POST</option>
                    <option value="GET">GET</option>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="channels-chat-headers-adopted">Headers</Label>
                  <Textarea id="channels-chat-headers-adopted" rows={4} value={JSON.stringify(safeParseConfigJson(configJson).headers ?? {}, null, 2)} onChange={(event) => {
                    try {
                      setConfigJson(updateConfigField(configJson, 'headers', JSON.parse(event.target.value)));
                    } catch {
                      setConfigJson(updateConfigField(configJson, 'headers', {}));
                    }
                  }} disabled={dialogMode === 'view'} />
                </div>
              </div>
            ) : null}
            {formValues.type === 'file' ? (
              <div className="space-y-2">
                <Label htmlFor="channels-file-base-path-adopted">Base path</Label>
                <Input id="channels-file-base-path-adopted" value={readStringField(configJson, 'base_path', '/tmp/notify-files')} onChange={(event) => setConfigJson(updateConfigField(configJson, 'base_path', event.target.value))} disabled={dialogMode === 'view'} />
              </div>
            ) : null}
            <div className="grid gap-3 md:grid-cols-[2fr_3fr]">
              <div className="space-y-2">
                <Label htmlFor="channels-test-destination-adopted">Test recipient or endpoint</Label>
                <Select id="channels-test-destination-adopted" value={formValues.testDestination} onChange={(event) => setFormValues((current) => ({ ...current, testDestination: event.target.value }))} disabled={dialogMode === 'view' && activeChannel === null}>
                  <option value="loopback://notification-ui">loopback://notification-ui</option>
                  <option value="ops@example.com">ops@example.com</option>
                  <option value="+15550001111">+15550001111</option>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="channels-test-payload-adopted">Test payload</Label>
                <Textarea id="channels-test-payload-adopted" rows={5} value={testPayload} onChange={(event) => setTestPayload(event.target.value)} disabled={dialogMode === 'view' && activeChannel === null} />
              </div>
            </div>
            {activeChannel ? (
              <div className="flex justify-end">
                <Button variant="secondary" onClick={() => void testChannel(activeChannel)}>Run live test</Button>
              </div>
            ) : null}
            {lastTestResult ? <JsonBlock title="Last live test result" value={lastTestResult} defaultCollapsed={false} /> : null}
          </div>
        )}
        relatedPanels={activeChannel ? [{
          title: 'Related items',
          items: relatedItems,
          emptyMessage: 'Open a channel to inspect related message and delivery pages.',
        }] : undefined}
      />

    </div>
  );
}
