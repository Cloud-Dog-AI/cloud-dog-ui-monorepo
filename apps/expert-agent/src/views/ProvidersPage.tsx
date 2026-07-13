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

// @cloud-dog/app-expert-agent — Providers surface (EA-27, W28E-1863 fix-wave-c).
//
// A dedicated page listing the configured LLM providers and, for a selected
// provider, the models it exposes. Backed by the existing GET /providers and
// GET /providers/{id}/models endpoints (already consumed inline by ExpertsPage);
// no new backend endpoint is required.

import * as React from 'react';
import { Label } from '@cloud-dog/ui';
import { useExpertAgentState } from '../state/AppState';
import type { ProviderModelRecord, ProviderRecord } from '../lib/api';
import { AppDataTable } from '../lib/data-table-adapter';
import { LoadingNote, PageScaffold, formatBoolean } from './shared';

export function ProvidersPage() {
  const { api, latestFailure, captureFailure, clearFailure } = useExpertAgentState();
  const [providers, setProviders] = React.useState<ProviderRecord[]>([]);
  const [selectedProviderId, setSelectedProviderId] = React.useState<string>('');
  const [models, setModels] = React.useState<ProviderModelRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [modelsLoading, setModelsLoading] = React.useState(false);
  const [status, setStatus] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    clearFailure();
    setLoading(true);
    try {
      const records = await api.listProviders();
      setProviders(records);
      // Default the model selector to the primary provider (or the first one).
      setSelectedProviderId((current) => {
        if (current && records.some((provider) => provider.id === current)) return current;
        return records.find((provider) => provider.is_primary)?.id ?? records[0]?.id ?? '';
      });
    } catch (error) {
      captureFailure(error);
    } finally {
      setLoading(false);
    }
  }, [api, captureFailure, clearFailure]);

  React.useEffect(() => { void refresh(); }, [refresh]);

  const loadModels = React.useCallback(async (providerId: string) => {
    if (!providerId) { setModels([]); return; }
    clearFailure();
    setModelsLoading(true);
    try {
      const records = await api.listProviderModels(providerId);
      setModels(records);
      setStatus(`Fetched ${records.length} model${records.length === 1 ? '' : 's'} from provider ${providerId}.`);
    } catch (error) {
      setModels([]);
      captureFailure(error);
    } finally {
      setModelsLoading(false);
    }
  }, [api, captureFailure, clearFailure]);

  React.useEffect(() => {
    if (selectedProviderId) void loadModels(selectedProviderId);
    else setModels([]);
  }, [selectedProviderId, loadModels]);

  return (
    <PageScaffold
      title="Providers"
      description="LLM providers configured for this service and the models each provider exposes."
      alert={latestFailure}
      status={status}
    >
      <LoadingNote loading={loading} />
      <AppDataTable
        title="Provider inventory"
        rows={providers}
        getRowId={(provider) => provider.id}
        emptyMessage="No providers reported by the backend."
        itemLabel="providers"
        onRefresh={refresh}
        searchText={(provider) => [provider.name, provider.type, provider.base_url].join(' ')}
        columns={[
          { id: 'name', header: 'Name', sortable: true, sortValue: (provider) => provider.name, cell: (provider) => provider.name },
          { id: 'id', header: 'ID', sortable: true, sortValue: (provider) => provider.id, cell: (provider) => <span className="font-mono text-xs">{provider.id}</span> },
          { id: 'type', header: 'Type', sortable: true, sortValue: (provider) => provider.type, cell: (provider) => provider.type },
          { id: 'base_url', header: 'Base URL', sortable: true, sortValue: (provider) => provider.base_url, cell: (provider) => <span className="font-mono text-xs">{provider.base_url}</span> },
          { id: 'is_primary', header: 'Primary', sortable: true, sortValue: (provider) => (provider.is_primary ? 1 : 0), cell: (provider) => formatBoolean(provider.is_primary) },
        ]}
        rowActions={[
          { label: 'View models', onClick: (provider) => setSelectedProviderId(provider.id) },
        ]}
      />

      <div className="space-y-4 rounded-xl border bg-background p-4" data-testid="provider-models-panel">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Provider models</h2>
          <p className="text-sm text-muted-foreground">Select a provider to fetch the models it currently exposes.</p>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="provider-model-select" className="text-sm whitespace-nowrap">Provider:</Label>
          <select
            id="provider-model-select"
            className="rounded border bg-background px-2 py-1 text-sm"
            value={selectedProviderId}
            onChange={(event) => setSelectedProviderId(event.target.value)}
            data-testid="provider-model-select"
          >
            <option value="">Select a provider</option>
            {providers.map((provider) => <option key={provider.id} value={provider.id}>{provider.name}</option>)}
          </select>
        </div>
        <LoadingNote loading={modelsLoading} label="Fetching models..." />
        <AppDataTable
          title="Models"
          rows={models}
          getRowId={(model) => model.id}
          emptyMessage={selectedProviderId ? 'No models reported for this provider.' : 'Select a provider to list its models.'}
          itemLabel="models"
          searchText={(model) => [model.id, model.name, model.family ?? '', model.parameter_size ?? ''].join(' ')}
          columns={[
            { id: 'name', header: 'Name', sortable: true, sortValue: (model) => model.name, cell: (model) => model.name },
            { id: 'id', header: 'ID', sortable: true, sortValue: (model) => model.id, cell: (model) => <span className="font-mono text-xs">{model.id}</span> },
            { id: 'family', header: 'Family', sortable: true, sortValue: (model) => model.family ?? '', cell: (model) => model.family ?? 'N/A' },
            { id: 'parameter_size', header: 'Parameters', sortable: true, sortValue: (model) => model.parameter_size ?? '', cell: (model) => model.parameter_size ?? 'N/A' },
            { id: 'quantization', header: 'Quantization', sortable: true, sortValue: (model) => model.quantization ?? '', cell: (model) => model.quantization ?? 'N/A' },
          ]}
        />
      </div>
    </PageScaffold>
  );
}
