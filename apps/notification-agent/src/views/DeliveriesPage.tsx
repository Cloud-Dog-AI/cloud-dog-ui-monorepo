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

// @cloud-dog/app-notification-agent — Deliveries list adopted onto the shared DataTable flow.
// Covers: UI-R1

import * as React from 'react';
import { Badge, Button, Card, CardContent, CardHeader, DataTable, Input, Label, RelativeTime, Select } from '@cloud-dog/ui';
import type { BulkAction, DataColumn } from '@cloud-dog/ui';
import { useNotificationAgentState } from '../state/AppState';
import type { DeliveryRecord } from '../lib/api';

function downloadJson(filename: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function deliveryBadgeVariant(state: string | null | undefined): 'default' | 'secondary' | 'destructive' {
  const value = String(state ?? '').toLowerCase();
  if (['delivered', 'sent', 'accepted'].includes(value)) return 'default';
  if (['failed', 'hard_failed', 'soft_failed', 'bounced', 'dead_lettered'].includes(value)) return 'destructive';
  return 'secondary';
}

function canRetryDelivery(state: string | null | undefined): boolean {
  const value = String(state ?? '').toLowerCase();
  return ['failed', 'hard_failed', 'soft_failed', 'bounced', 'dead_lettered'].includes(value);
}

function canAbortDelivery(state: string | null | undefined): boolean {
  const value = String(state ?? '').toLowerCase();
  return ['pending', 'queued', 'processing', 'formatting', 'sending', 'retrying'].includes(value);
}

export function DeliveriesPage() {
  const { api, latestFailure, captureFailure, clearFailure } = useNotificationAgentState();
  const [deliveries, setDeliveries] = React.useState<DeliveryRecord[]>([]);
  const [status, setStatus] = React.useState('');
  const [messageFilter, setMessageFilter] = React.useState(() => new URLSearchParams(window.location.search).get('message_id') ?? '');
  const [channelFilter, setChannelFilter] = React.useState(() => new URLSearchParams(window.location.search).get('channel') ?? '');
  const [destinationFilter, setDestinationFilter] = React.useState('');
  const [textFilter, setTextFilter] = React.useState('');
  const [fromFilter, setFromFilter] = React.useState('');
  const [toFilter, setToFilter] = React.useState('');
  const [stateFilter, setStateFilter] = React.useState(() => new URLSearchParams(window.location.search).get('state') ?? '');
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);

  const loadDeliveries = React.useCallback(async () => {
    clearFailure();
    try {
      const direct = await api.listDeliveries(messageFilter);
      if (direct.length > 0 || messageFilter.trim()) {
        setDeliveries(direct);
        return;
      }
      const messages = await api.listMessages();
      const perMessage = await Promise.all(
        messages.slice(0, 100).map((message) => api.listMessageDeliveries(message.id).catch(() => [])),
      );
      const merged = perMessage.flat();
      setDeliveries(merged.length > 0 ? merged.sort((left, right) => right.id - left.id) : direct);
    } catch (error) {
      captureFailure(error);
    }
  }, [api, captureFailure, clearFailure, messageFilter]);

  React.useEffect(() => {
    void loadDeliveries();
  }, [loadDeliveries]);

  React.useEffect(() => {
    setPage(1);
  }, [messageFilter, channelFilter, destinationFilter, textFilter, fromFilter, toFilter, stateFilter]);

  const resendDeliveries = async (items: DeliveryRecord[]) => {
    const retryable = items.filter((item) => canRetryDelivery(item.state));
    if (retryable.length === 0) {
      setStatus('Select at least one failed delivery to retry.');
      return;
    }
    clearFailure();
    setStatus('');
    try {
      for (const item of retryable) {
        await api.resendDelivery(item.id);
      }
      setStatus(`Resent ${retryable.length} deliver${retryable.length === 1 ? 'y' : 'ies'}.`);
      await loadDeliveries();
    } catch (error) {
      captureFailure(error);
    }
  };

  const deleteDeliveries = async (items: DeliveryRecord[]) => {
    clearFailure();
    setStatus('');
    try {
      for (const item of items) {
        await api.deleteDelivery(item.id);
      }
      setStatus(`Deleted ${items.length} deliver${items.length === 1 ? 'y' : 'ies'}.`);
      await loadDeliveries();
    } catch (error) {
      captureFailure(error);
    }
  };

  const abortDelivery = async (item: DeliveryRecord) => {
    clearFailure();
    setStatus('');
    try {
      await api.abortDelivery(item.id);
      setStatus(`Aborted delivery ${item.id}.`);
      await loadDeliveries();
    } catch (error) {
      captureFailure(error);
    }
  };

  const filtered = deliveries.filter((delivery) => {
    const matchesMessage = !messageFilter.trim() || String(delivery.message_id ?? '').includes(messageFilter.trim());
    const matchesChannel = !channelFilter.trim() || String(delivery.channel_name ?? '').toLowerCase().includes(channelFilter.trim().toLowerCase());
    const matchesDestination = !destinationFilter.trim() || String(delivery.destination ?? '').toLowerCase().includes(destinationFilter.trim().toLowerCase());
    const matchesText = !textFilter.trim() || `${delivery.id} ${delivery.message_id ?? ''} ${delivery.channel_name ?? ''} ${delivery.destination ?? ''} ${delivery.state ?? ''} ${delivery.error ?? ''} ${delivery.tracking_id ?? ''}`.toLowerCase().includes(textFilter.trim().toLowerCase());
    const matchesState = !stateFilter || String(delivery.state ?? '').toLowerCase() === stateFilter.toLowerCase();
    const timestamp = String(delivery.created_at ?? delivery.updated_at ?? '');
    const matchesFrom = !fromFilter || timestamp >= fromFilter;
    const matchesTo = !toFilter || timestamp <= `${toFilter}T23:59:59`;
    return matchesMessage && matchesChannel && matchesDestination && matchesText && matchesState && matchesFrom && matchesTo;
  });

  const columns = React.useMemo<DataColumn<DeliveryRecord>[]>(() => [
    {
      id: 'id',
      header: 'ID',
      sortable: true,
      sortValue: (delivery) => delivery.id,
      cell: (delivery) => <span className="font-medium">{delivery.id}</span>,
    },
    {
      id: 'message_id',
      header: 'Message',
      sortable: true,
      sortValue: (delivery) => delivery.message_id ?? 0,
      cell: (delivery) => String(delivery.message_id ?? 'n/a'),
    },
    {
      id: 'channel_name',
      header: 'Channel',
      sortable: true,
      sortValue: (delivery) => delivery.channel_name ?? '',
      cell: (delivery) => delivery.channel_name ?? 'n/a',
    },
    {
      id: 'destination',
      header: 'Recipient',
      sortable: true,
      sortValue: (delivery) => delivery.destination ?? '',
      cell: (delivery) => delivery.destination ?? 'n/a',
    },
    {
      id: 'state',
      header: 'Status',
      sortable: true,
      sortValue: (delivery) => delivery.state ?? '',
      cell: (delivery) => (
        <Badge variant={deliveryBadgeVariant(delivery.state)}>
          {delivery.state ?? 'unknown'}
        </Badge>
      ),
    },
    {
      id: 'updated_at',
      header: 'Sent At',
      sortable: true,
      sortValue: (delivery) => delivery.updated_at ?? delivery.created_at ?? '',
      cell: (delivery) =>
        delivery.delivered_at || delivery.updated_at || delivery.created_at
          ? <RelativeTime timestamp={delivery.delivered_at ?? delivery.updated_at ?? delivery.created_at ?? ''} />
          : 'N/A',
    },
    {
      id: 'error',
      header: 'Error',
      cell: (delivery) => delivery.error ?? '',
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: (delivery) => (
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" disabled={!canRetryDelivery(delivery.state)} onClick={() => void resendDeliveries([delivery])}>Resend delivery</Button>
          <Button variant="secondary" disabled={!canAbortDelivery(delivery.state)} onClick={() => void abortDelivery(delivery)}>Abort delivery</Button>
          <Button variant="secondary" onClick={() => void deleteDeliveries([delivery])}>Delete delivery</Button>
        </div>
      ),
    },
  ], [abortDelivery, deleteDeliveries, resendDeliveries]);

  const bulkActions = React.useMemo<BulkAction[]>(() => [
    { label: 'Retry failed', action: 'retry' },
    { label: 'Delete selected', action: 'delete' },
    { label: 'Export', action: 'export' },
  ], []);

  const onBulkAction = React.useCallback((action: string, selectedIds: string[]) => {
    const items = filtered.filter((delivery) => selectedIds.includes(String(delivery.id)));
    if (action === 'retry') {
      void resendDeliveries(items);
      return;
    }
    if (action === 'delete') {
      void deleteDeliveries(items);
      return;
    }
    if (action === 'export') {
      downloadJson('notification-deliveries.json', items);
    }
  }, [deleteDeliveries, filtered, resendDeliveries]);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Deliveries</h1>
        <p className="text-sm text-muted-foreground">Shared list adoption for delivery status, retries and cleanup.</p>
      </header>

      {latestFailure ? <p role="alert" className="text-sm text-destructive">{latestFailure}</p> : null}
      {status ? <p role="status" className="text-sm text-foreground/80">{status}</p> : null}

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Filters</h2>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <div>
            <Label htmlFor="deliveries-message-filter-adopted">Message ID</Label>
            <Input id="deliveries-message-filter-adopted" value={messageFilter} onChange={(event) => setMessageFilter(event.target.value)} />
          </div>
          <div>
            <Label htmlFor="deliveries-channel-filter-adopted">Channel</Label>
            <Input id="deliveries-channel-filter-adopted" value={channelFilter} onChange={(event) => setChannelFilter(event.target.value)} placeholder="Channel name" />
          </div>
          <div>
            <Label htmlFor="deliveries-destination-filter-adopted">Destination</Label>
            <Input id="deliveries-destination-filter-adopted" value={destinationFilter} onChange={(event) => setDestinationFilter(event.target.value)} placeholder="Email, URL or phone" />
          </div>
          <div>
            <Label htmlFor="deliveries-state-filter-adopted">State</Label>
            <Select id="deliveries-state-filter-adopted" value={stateFilter} onChange={(event) => setStateFilter(event.target.value)}>
              <option value="">All</option>
              <option value="pending">Pending</option>
              <option value="queued">Queued</option>
              <option value="formatting">Formatting</option>
              <option value="processing">Processing</option>
              <option value="sending">Sending</option>
              <option value="retrying">Retrying</option>
              <option value="sent">Sent</option>
              <option value="delivered">Delivered</option>
              <option value="failed">Failed</option>
              <option value="dead_lettered">Dead lettered</option>
              <option value="aborted">Aborted</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="deliveries-text-filter-adopted">Search</Label>
            <Input id="deliveries-text-filter-adopted" value={textFilter} onChange={(event) => setTextFilter(event.target.value)} placeholder="Search delivery fields" />
          </div>
          <div>
            <Label htmlFor="deliveries-from-filter-adopted">Date from</Label>
            <Input id="deliveries-from-filter-adopted" type="date" value={fromFilter} onChange={(event) => setFromFilter(event.target.value)} />
          </div>
          <div>
            <Label htmlFor="deliveries-to-filter-adopted">Date to</Label>
            <Input id="deliveries-to-filter-adopted" type="date" value={toFilter} onChange={(event) => setToFilter(event.target.value)} />
          </div>
          <div className="self-end">
            <Button variant="secondary" onClick={() => void loadDeliveries()}>Refresh deliveries</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Delivery list</h2>
        </CardHeader>
        <CardContent>
          <DataTable
            tableId="notification-deliveries"
            columns={columns}
            rows={filtered}
            totalRows={deliveries.length}
            getRowId={(delivery) => String(delivery.id)}
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
    </div>
  );
}
