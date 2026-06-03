import * as React from 'react';
import { Button, Dialog, Input, Label, Select, StatusBadge, Switch } from '@cloud-dog/ui';
import { Activity, ExternalLink, KeyRound, Plus, ShieldCheck, Wrench, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthz } from '../lib/authz';
import { useExpertAgentState } from '../state/AppState';
import type { ExpertRecord, ExpertServiceBindingRecord, ServiceEndpointTestResult, ServiceHealthResult, ServiceRecord, ServiceToolsResult } from '../lib/api';
import { AppDataTable } from '../lib/data-table-adapter';
import { LoadingNote, PageScaffold, renderRelativeTime } from './shared';


type MetadataEntry = Readonly<{
  id: string;
  key: string;
  value: string;
}>;

type ServiceForm = {
  name: string;
  service_type: string;
  endpoint_url: string;
  enabled: boolean;
  auth_type: string;
  auth_header_name: string;
  auth_header_scheme: string;
  auth_value: string;
  metadata_entries: MetadataEntry[];
};

const serviceTypeOptions = ['mcp', 'a2a', 'rest'];

const emptyForm: ServiceForm = {
  name: '',
  service_type: 'mcp',
  endpoint_url: '',
  enabled: true,
  auth_type: 'none',
  auth_header_name: 'Authorization',
  auth_header_scheme: 'Bearer',
  auth_value: '',
  metadata_entries: [{ id: 'metadata-empty', key: '', value: '' }],
};

function metadataToEntries(metadata: Record<string, unknown> | null | undefined): MetadataEntry[] {
  const entries = Object.entries(metadata ?? {}).map(([key, value], index) => ({
    id: `${key}-${index}`,
    key,
    value: typeof value === 'string' ? value : JSON.stringify(value),
  }));
  return entries.length ? entries : [{ id: 'metadata-empty', key: '', value: '' }];
}

function entriesToMetadata(entries: MetadataEntry[]): Record<string, unknown> {
  const metadata: Record<string, unknown> = {};
  for (const entry of entries) {
    const key = entry.key.trim();
    if (!key) continue;
    metadata[key] = entry.value;
  }
  return metadata;
}

function formFromService(service: ServiceRecord): ServiceForm {
  const auth = service.auth_config ?? {};
  const authType = String(auth.type ?? auth.auth_type ?? 'none');
  return {
    name: service.name,
    service_type: service.service_type ?? 'mcp',
    endpoint_url: service.endpoint_url ?? service.base_url ?? '',
    enabled: service.enabled !== false,
    auth_type: authType,
    auth_header_name: String(auth.header_name ?? (authType === 'api_key' ? 'X-API-Key' : 'Authorization')),
    auth_header_scheme: String(auth.header_scheme ?? (authType === 'bearer' ? 'Bearer' : '')),
    auth_value: String(auth.value ?? ''),
    metadata_entries: metadataToEntries(service.metadata),
  };
}

function buildAuthConfig(form: ServiceForm): Record<string, unknown> {
  if (form.auth_type === 'none') return { type: 'none' };
  const headerName = form.auth_header_name.trim() || (form.auth_type === 'api_key' ? 'X-API-Key' : 'Authorization');
  return {
    type: form.auth_type,
    header_name: headerName,
    header_scheme: form.auth_header_scheme.trim(),
    value: form.auth_value,
  };
}

function healthLabel(service: ServiceRecord, healthResults: Record<number, ServiceHealthResult & { checking?: boolean }>): string {
  const result = healthResults[service.id];
  if (result?.checking) return 'checking';
  return result?.health_status ?? service.health_status ?? 'not reported';
}

function maskSecret(value: string): string {
  if (!value) return 'not configured';
  if (value.length <= 4) return 'configured';
  return `${value.slice(0, 2)}...${value.slice(-2)}`;
}

export function ServicesPage() {
  const authz = useAuthz();
  const navigate = useNavigate();
  const { api, latestFailure, captureFailure, clearFailure } = useExpertAgentState();
  const [services, setServices] = React.useState<ServiceRecord[]>([]);
  const [bindingsByServiceId, setBindingsByServiceId] = React.useState<Record<number, Array<{ expert: ExpertRecord; binding: ExpertServiceBindingRecord }>>>({});
  const [form, setForm] = React.useState<ServiceForm>(emptyForm);
  const [editingService, setEditingService] = React.useState<ServiceRecord | null>(null);
  const [selectedService, setSelectedService] = React.useState<ServiceRecord | null>(null);
  const [serviceTools, setServiceTools] = React.useState<ServiceToolsResult | null>(null);
  const [detailLoading, setDetailLoading] = React.useState(false);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [detailOpen, setDetailOpen] = React.useState(false);
  const [healthDialogOpen, setHealthDialogOpen] = React.useState(false);
  const [healthResult, setHealthResult] = React.useState<ServiceHealthResult | null>(null);
  const [endpointTestResult, setEndpointTestResult] = React.useState<ServiceEndpointTestResult | null>(null);
  const [healthResults, setHealthResults] = React.useState<Record<number, ServiceHealthResult & { checking?: boolean }>>({});
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [testingEndpoint, setTestingEndpoint] = React.useState(false);
  const [status, setStatus] = React.useState<string | null>(null);
  const checkedHealthIds = React.useRef<Set<number>>(new Set());
  const checkingHealthIds = React.useRef<Set<number>>(new Set());

  const refresh = React.useCallback(async () => {
    if (!authz.isAdmin) {
      setServices([]);
      setBindingsByServiceId({});
      setLoading(false);
      return;
    }

    clearFailure();
    setLoading(true);
    try {
      const [serviceRecords, expertRecords] = await Promise.all([api.listServices(), api.listExperts()]);
      const serviceBindings = await Promise.all(
        expertRecords.map(async (expert) => ({
          expert,
          bindings: await api.listExpertServices(expert.id),
        }))
      );

      const nextBindingsByServiceId: Record<number, Array<{ expert: ExpertRecord; binding: ExpertServiceBindingRecord }>> = {};
      for (const entry of serviceBindings) {
        for (const binding of entry.bindings) {
          if (!nextBindingsByServiceId[binding.service_id]) nextBindingsByServiceId[binding.service_id] = [];
          nextBindingsByServiceId[binding.service_id].push({ expert: entry.expert, binding });
        }
      }

      setServices(serviceRecords);
      setBindingsByServiceId(nextBindingsByServiceId);
    } catch (error) {
      captureFailure(error);
    } finally {
      setLoading(false);
    }
  }, [api, authz.isAdmin, captureFailure, clearFailure]);

  React.useEffect(() => { void refresh(); }, [refresh]);

  const applyHealthResult = React.useCallback((serviceId: number, result: ServiceHealthResult & { checking?: boolean }) => {
    setHealthResults((current) => ({ ...current, [serviceId]: result }));
    if (!result.checking && result.health_status) {
      setServices((current) => current.map((service) => (
        service.id === serviceId
          && !(service.enabled === false && result.health_status !== 'disabled')
          ? { ...service, health_status: result.health_status, updated_at: result.checked_at ?? service.updated_at }
          : service
      )));
    }
  }, []);

  const checkHealth = React.useCallback(async (service: ServiceRecord, options: { silent?: boolean } = {}) => {
    if (checkingHealthIds.current.has(service.id) && options.silent) return;
    checkingHealthIds.current.add(service.id);
    const pendingResult: ServiceHealthResult = {
      service_id: service.id,
      healthy: false,
      health_status: 'checking',
      detail: 'Health check in progress.',
      resolved_url: service.endpoint_url ?? service.base_url ?? null,
      checked_at: new Date().toISOString(),
    };
    applyHealthResult(service.id, { ...pendingResult, checking: true });
    if (!options.silent) {
      clearFailure();
      setHealthResult(pendingResult);
      setHealthDialogOpen(true);
      setStatus(`Health check for ${service.name}: checking.`);
    }
    try {
      const result = await api.checkServiceHealth(service.id);
      checkedHealthIds.current.add(service.id);
      applyHealthResult(service.id, result);
      if (!options.silent) {
        setHealthResult(result);
        setStatus(`Health check for ${service.name}: ${result.health_status ?? (result.healthy ? 'healthy' : 'unhealthy')}.`);
      }
    } catch (error) {
      const result = { service_id: service.id, healthy: false, health_status: 'unhealthy', detail: error instanceof Error ? error.message : 'Health check failed.' };
      applyHealthResult(service.id, result);
      if (!options.silent) {
        setHealthResult(result);
        setStatus(`Health check for ${service.name}: unhealthy.`);
        captureFailure(error);
      }
    } finally {
      checkingHealthIds.current.delete(service.id);
    }
  }, [api, applyHealthResult, captureFailure, clearFailure]);

  React.useEffect(() => {
    if (!authz.isAdmin || loading) return;
    for (const service of services) {
      if (service.enabled === false) continue;
      if (checkedHealthIds.current.has(service.id) || checkingHealthIds.current.has(service.id)) continue;
      void checkHealth(service, { silent: true });
    }
  }, [authz.isAdmin, checkHealth, loading, services]);

  const openCreate = React.useCallback(() => {
    setEditingService(null);
    setEndpointTestResult(null);
    setForm({ ...emptyForm, metadata_entries: [{ id: `metadata-${Date.now()}`, key: '', value: '' }] });
    setDialogOpen(true);
  }, []);

  const openEdit = React.useCallback((service: ServiceRecord) => {
    setEditingService(service);
    setEndpointTestResult(null);
    setForm(formFromService(service));
    setDialogOpen(true);
  }, []);

  const closeDialog = React.useCallback(() => {
    setDialogOpen(false);
    setEditingService(null);
    setEndpointTestResult(null);
    setForm(emptyForm);
  }, []);

  const saveService = React.useCallback(async () => {
    if (!form.name.trim() || !form.service_type.trim() || !form.endpoint_url.trim()) return;
    setSaving(true);
    clearFailure();
    try {
      const authConfig = buildAuthConfig(form);
      const metadata = entriesToMetadata(form.metadata_entries);
      if (editingService) {
        await api.updateService(editingService.id, {
          service_type: form.service_type,
          endpoint_url: form.endpoint_url,
          enabled: form.enabled,
          auth_config: authConfig,
          metadata,
        });
        checkedHealthIds.current.delete(editingService.id);
        setStatus(`Updated service ${editingService.name}.`);
      } else {
        await api.createService({
          name: form.name,
          service_type: form.service_type,
          endpoint_url: form.endpoint_url,
          enabled: form.enabled,
          auth_config: authConfig,
          metadata,
        });
        setStatus(`Registered service ${form.name}.`);
      }
      closeDialog();
      await refresh();
    } catch (error) {
      captureFailure(error);
    } finally {
      setSaving(false);
    }
  }, [api, captureFailure, clearFailure, closeDialog, editingService, form, refresh]);

  const deleteService = React.useCallback(async (service: ServiceRecord) => {
    clearFailure();
    try {
      await api.deleteService(service.id);
      setSelectedService((current) => current?.id === service.id ? null : current);
      setStatus(`Deleted service ${service.name}.`);
      await refresh();
    } catch (error) {
      captureFailure(error);
    }
  }, [api, captureFailure, clearFailure, refresh]);

  const toggleEnabled = React.useCallback(async (service: ServiceRecord, enabled: boolean) => {
    clearFailure();
    try {
      const updated = await api.updateService(service.id, { enabled });
      setServices((current) => current.map((item) => item.id === service.id ? updated : item));
      applyHealthResult(service.id, {
        service_id: service.id,
        healthy: enabled,
        health_status: enabled ? (updated.health_status ?? 'unknown') : 'disabled',
        checked_at: new Date().toISOString(),
      });
      if (enabled) checkedHealthIds.current.delete(service.id);
      setStatus(`${enabled ? 'Enabled' : 'Disabled'} service ${service.name}.`);
    } catch (error) {
      captureFailure(error);
    }
  }, [api, applyHealthResult, captureFailure, clearFailure]);

  const testEndpoint = React.useCallback(async () => {
    if (!form.endpoint_url.trim()) return;
    setTestingEndpoint(true);
    clearFailure();
    try {
      const result = await api.testServiceEndpoint({
        endpoint_url: form.endpoint_url,
        service_type: form.service_type,
        auth_config: buildAuthConfig(form),
      });
      setEndpointTestResult(result);
      if (result.detected_type) {
        setForm((current) => ({ ...current, service_type: result.detected_type ?? current.service_type }));
      }
      setStatus(`Endpoint test returned ${result.health_status ?? 'unknown'} for ${result.detected_type ?? form.service_type}.`);
    } catch (error) {
      captureFailure(error);
    } finally {
      setTestingEndpoint(false);
    }
  }, [api, captureFailure, clearFailure, form]);

  const openDetail = React.useCallback(async (service: ServiceRecord) => {
    setSelectedService(service);
    setServiceTools(null);
    setDetailOpen(true);
    setDetailLoading(true);
    clearFailure();
    try {
      setServiceTools(await api.getServiceTools(service.id));
    } catch (error) {
      captureFailure(error);
    } finally {
      setDetailLoading(false);
    }
  }, [api, captureFailure, clearFailure]);

  const bindingSummary = React.useCallback((serviceId: number) => {
    const serviceBindings = services.find((service) => service.id === serviceId)?.expert_bindings ?? [];
    if (serviceBindings.length > 0) {
      return serviceBindings.map((binding) => `${binding.expert_name ?? `Expert ${binding.expert_id ?? '?'}`} / ${binding.enabled === false ? 'disabled' : 'enabled'} / priority ${binding.priority ?? 'N/A'}`);
    }
    const bindings = bindingsByServiceId[serviceId] ?? [];
    if (bindings.length === 0) return ['No expert bindings'];
    return bindings.map(({ expert, binding }) => `${expert.name} / ${binding.enabled === false ? 'disabled' : 'enabled'} / priority ${binding.priority ?? 'N/A'}`);
  }, [bindingsByServiceId, services]);

  const updateMetadataEntry = React.useCallback((id: string, patch: Partial<MetadataEntry>) => {
    setForm((current) => ({
      ...current,
      metadata_entries: current.metadata_entries.map((entry) => entry.id === id ? { ...entry, ...patch } : entry),
    }));
  }, []);

  const removeMetadataEntry = React.useCallback((id: string) => {
    setForm((current) => ({
      ...current,
      metadata_entries: current.metadata_entries.filter((entry) => entry.id !== id),
    }));
  }, []);

  const addMetadataEntry = React.useCallback(() => {
    setForm((current) => ({
      ...current,
      metadata_entries: [...current.metadata_entries, { id: `metadata-${Date.now()}`, key: '', value: '' }],
    }));
  }, []);

  const selectedHealth = selectedService ? healthResults[selectedService.id] : null;

  return (
    <PageScaffold title="Services" description="External MCP, A2A, and REST service registry using the adopted shared table surface." alert={latestFailure} status={status}>
      <LoadingNote loading={loading} />
      {authz.isAdmin ? (
        <div className="flex justify-end">
          <Button type="button" onClick={openCreate}><Plus className="h-4 w-4" aria-hidden="true" /> Register Service</Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Service registry access is restricted to administrators because the backend service endpoints are admin-only.</p>
      )}
      <AppDataTable
        title="Registered services"
        rows={services}
        getRowId={(service) => String(service.id)}
        emptyMessage="No external services reported by the backend."
        itemLabel="services"
        onRefresh={refresh}
        columns={[
          { id: 'name', header: 'Name', sortable: true, sortValue: (service) => service.name, cell: (service) => <span className="font-medium">{service.name}</span> },
          { id: 'type', header: 'Type', sortable: true, sortValue: (service) => service.service_type ?? '', cell: (service) => <span className="uppercase">{service.service_type ?? 'N/A'}</span> },
          { id: 'url', header: 'URL', sortable: true, sortValue: (service) => service.endpoint_url ?? service.base_url ?? '', cell: (service) => <span className="font-mono text-xs">{service.endpoint_url ?? service.base_url ?? 'N/A'}</span> },
          { id: 'enabled', header: 'Enabled', sortable: true, sortValue: (service) => service.enabled === false ? '0' : '1', cell: (service) => (
            <div className="flex items-center gap-2">
              <Switch checked={service.enabled !== false} onCheckedChange={(checked) => void toggleEnabled(service, checked)} aria-label={`${service.enabled === false ? 'Enable' : 'Disable'} ${service.name}`} />
              <span className="text-xs text-muted-foreground">{service.enabled === false ? 'Disabled' : 'Enabled'}</span>
            </div>
          ) },
          { id: 'health', header: 'Health', sortable: true, sortValue: (service) => healthLabel(service, healthResults), cell: (service) => <StatusBadge value={healthLabel(service, healthResults)} /> },
          { id: 'bindings', header: 'Expert bindings', cell: (service) => <div className="space-y-1 text-xs">{bindingSummary(service.id).slice(0, 3).map((item) => <p key={item}>{item}</p>)}</div> },
          { id: 'checked', header: 'Last Health Check', sortable: true, sortValue: (service) => healthResults[service.id]?.checked_at ?? service.updated_at ?? service.created_at ?? '', cell: (service) => renderRelativeTime(healthResults[service.id]?.checked_at ?? service.updated_at ?? service.created_at) },
        ]}
        rowActions={authz.isAdmin ? [
          { label: 'Detail', onClick: (service) => void openDetail(service) },
          { label: 'Health Check', onClick: (service) => void checkHealth(service) },
          { label: 'Edit', onClick: openEdit },
          { label: 'History', onClick: (service) => navigate(`/admin/monitoring?surface=audit&query=${encodeURIComponent(service.name)}`) },
          { label: 'Delete', variant: 'destructive', onClick: (service) => void deleteService(service) },
        ] : undefined}
        searchText={(service) => [service.name, service.service_type ?? '', service.endpoint_url ?? service.base_url ?? '', service.health_status ?? '', healthLabel(service, healthResults), ...bindingSummary(service.id)].join(' ')}
      />

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }} label={editingService ? `Edit ${editingService.name}` : 'Register Service'}>
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">{editingService ? `Edit ${editingService.name}` : 'Register Service'}</h2>
          <div className="grid gap-4">
            <label className="space-y-2 block">
              <Label htmlFor="service-name">Name</Label>
              <Input id="service-name" value={form.name} disabled={editingService !== null} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
            </label>
            <label className="space-y-2 block">
              <Label htmlFor="service-type">Service type</Label>
              <Select id="service-type" value={form.service_type} onChange={(event) => setForm((current) => ({ ...current, service_type: event.target.value }))}>
                {serviceTypeOptions.map((option) => <option key={option} value={option}>{option.toUpperCase()}</option>)}
              </Select>
            </label>
            <label className="space-y-2 block">
              <Label htmlFor="service-endpoint">Endpoint URL</Label>
              <div className="flex gap-2">
                <Input id="service-endpoint" value={form.endpoint_url} onChange={(event) => setForm((current) => ({ ...current, endpoint_url: event.target.value }))} />
                <Button type="button" variant="secondary" onClick={() => void testEndpoint()} loading={testingEndpoint}><Activity className="h-4 w-4" aria-hidden="true" /> Test</Button>
              </div>
            </label>
            <label className="flex items-center gap-3">
              <Switch checked={form.enabled} onCheckedChange={(checked) => setForm((current) => ({ ...current, enabled: checked }))} aria-label="Service enabled" />
              <span className="text-sm">Enabled</span>
            </label>
          </div>

          {endpointTestResult ? (
            <div className="rounded-lg border p-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium">Endpoint test</span>
                <StatusBadge value={endpointTestResult.health_status ?? 'unknown'} />
              </div>
              <p className="mt-2 text-muted-foreground">Detected {endpointTestResult.detected_type ?? form.service_type.toUpperCase()} at {endpointTestResult.resolved_url ?? form.endpoint_url}.</p>
            </div>
          ) : null}

          <div className="space-y-3 rounded-lg border p-3">
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4" aria-hidden="true" />
              <h3 className="text-sm font-semibold">Auth configuration</h3>
            </div>
            <label className="space-y-2 block">
              <Label htmlFor="service-auth-type">Auth type</Label>
              <Select id="service-auth-type" value={form.auth_type} onChange={(event) => setForm((current) => ({
                ...current,
                auth_type: event.target.value,
                auth_header_name: event.target.value === 'api_key' ? 'X-API-Key' : current.auth_header_name,
                auth_header_scheme: event.target.value === 'bearer' ? 'Bearer' : current.auth_header_scheme,
              }))}>
                <option value="none">None</option>
                <option value="bearer">Bearer token</option>
                <option value="api_key">API key</option>
                <option value="custom_header">Custom header</option>
              </Select>
            </label>
            {form.auth_type !== 'none' ? (
              <div className="grid gap-3 md:grid-cols-3">
                <label className="space-y-2 block">
                  <Label htmlFor="service-auth-header">Header</Label>
                  <Input id="service-auth-header" value={form.auth_header_name} onChange={(event) => setForm((current) => ({ ...current, auth_header_name: event.target.value }))} />
                </label>
                <label className="space-y-2 block">
                  <Label htmlFor="service-auth-scheme">Scheme</Label>
                  <Input id="service-auth-scheme" value={form.auth_header_scheme} onChange={(event) => setForm((current) => ({ ...current, auth_header_scheme: event.target.value }))} />
                </label>
                <label className="space-y-2 block">
                  <Label htmlFor="service-auth-value">Secret</Label>
                  <Input id="service-auth-value" type="password" value={form.auth_value} onChange={(event) => setForm((current) => ({ ...current, auth_value: event.target.value }))} />
                </label>
              </div>
            ) : null}
          </div>

          <div className="space-y-3 rounded-lg border p-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold">Metadata</h3>
              <Button type="button" variant="secondary" size="sm" onClick={addMetadataEntry}><Plus className="h-4 w-4" aria-hidden="true" /> Add</Button>
            </div>
            {form.metadata_entries.map((entry) => (
              <div key={entry.id} className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                <Input aria-label="Metadata key" placeholder="Key" value={entry.key} onChange={(event) => updateMetadataEntry(entry.id, { key: event.target.value })} />
                <Input aria-label="Metadata value" placeholder="Value" value={entry.value} onChange={(event) => updateMetadataEntry(entry.id, { value: event.target.value })} />
                <Button type="button" variant="secondary" size="icon" aria-label="Remove metadata row" onClick={() => removeMetadataEntry(entry.id)}><X className="h-4 w-4" aria-hidden="true" /></Button>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={closeDialog}>Cancel</Button>
            <Button type="button" onClick={() => void saveService()} loading={saving} disabled={!form.name.trim() || !form.service_type.trim() || !form.endpoint_url.trim()}>Save</Button>
          </div>
        </div>
      </Dialog>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen} label="Service detail">
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">{selectedService?.name ?? 'Service detail'}</h2>
              <p className="text-sm text-muted-foreground">{selectedService?.endpoint_url ?? selectedService?.base_url ?? 'No endpoint reported'}</p>
            </div>
            {selectedService ? <StatusBadge value={healthLabel(selectedService, healthResults)} /> : null}
          </div>
          {selectedService ? (
            <div className="grid gap-3 text-sm">
              <div className="rounded-lg border p-3">
                <h3 className="text-sm font-semibold">Connection</h3>
                <dl className="mt-2 grid gap-2">
                  <div><dt className="text-xs text-muted-foreground">Type</dt><dd>{selectedService.service_type ?? 'N/A'}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Enabled</dt><dd>{selectedService.enabled === false ? 'No' : 'Yes'}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Last health detail</dt><dd>{selectedHealth?.detail ?? 'No health result loaded.'}</dd></div>
                </dl>
              </div>
              <div className="rounded-lg border p-3">
                <h3 className="text-sm font-semibold">Auth and metadata</h3>
                <dl className="mt-2 grid gap-2">
                  <div><dt className="text-xs text-muted-foreground">Auth</dt><dd>{String(selectedService.auth_config?.type ?? 'none')} / {maskSecret(String(selectedService.auth_config?.value ?? ''))}</dd></div>
                  {Object.entries(selectedService.metadata ?? {}).length === 0 ? <div><dt className="text-xs text-muted-foreground">Metadata</dt><dd>No metadata</dd></div> : null}
                  {Object.entries(selectedService.metadata ?? {}).slice(0, 6).map(([key, value]) => (
                    <div key={key}><dt className="text-xs text-muted-foreground">{key}</dt><dd>{typeof value === 'string' ? value : JSON.stringify(value)}</dd></div>
                  ))}
                </dl>
              </div>
              <div className="rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <Wrench className="h-4 w-4" aria-hidden="true" />
                  <h3 className="text-sm font-semibold">Tools</h3>
                </div>
                {detailLoading ? <p className="mt-2 text-sm text-muted-foreground">Loading tool discovery...</p> : null}
                {!detailLoading && (serviceTools?.tools?.length ?? 0) === 0 ? <p className="mt-2 text-sm text-muted-foreground">No tools reported for this service.</p> : null}
                <div className="mt-2 space-y-2">
                  {(serviceTools?.tools ?? []).map((tool, index) => (
                    <div key={`${String(tool.name ?? 'tool')}-${index}`} className="rounded-md border p-2">
                      <p className="font-medium">{String(tool.name ?? `Tool ${index + 1}`)}</p>
                      <p className="text-xs text-muted-foreground">{String(tool.description ?? 'No description')}</p>
                    </div>
                  ))}
                </div>
                {serviceTools?.discovery_error ? <p className="mt-2 text-xs text-destructive">{serviceTools.discovery_error}</p> : null}
              </div>
              <div className="rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                  <h3 className="text-sm font-semibold">RBAC and bindings</h3>
                </div>
                <div className="mt-2 space-y-1 text-xs">
                  {bindingSummary(selectedService.id).map((item) => <p key={item}>{item}</p>)}
                </div>
              </div>
              <Button type="button" variant="secondary" onClick={() => navigate(`/admin/monitoring?surface=audit&query=${encodeURIComponent(selectedService.name)}`)}>
                <ExternalLink className="h-4 w-4" aria-hidden="true" /> Open service logs
              </Button>
            </div>
          ) : null}
          <div className="flex justify-end">
            <Button type="button" variant="secondary" onClick={() => setDetailOpen(false)}>Close</Button>
          </div>
        </div>
      </Dialog>

      <Dialog open={healthDialogOpen} onOpenChange={setHealthDialogOpen} label="Health result">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Health result</h2>
            {healthResult ? <StatusBadge value={healthResult.health_status ?? 'unknown'} /> : null}
          </div>
          <dl className="grid gap-2 text-sm">
            <div><dt className="text-xs text-muted-foreground">Service</dt><dd>{healthResult?.service_id ?? 'N/A'}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Resolved URL</dt><dd className="break-all">{healthResult?.resolved_url ?? 'N/A'}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Checked</dt><dd>{healthResult?.checked_at ? renderRelativeTime(healthResult.checked_at) : 'N/A'}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Detail</dt><dd>{healthResult?.detail ?? 'No detail returned.'}</dd></div>
          </dl>
          <div className="flex justify-end">
            <Button type="button" variant="secondary" onClick={() => setHealthDialogOpen(false)}>Close</Button>
          </div>
        </div>
      </Dialog>
    </PageScaffold>
  );
}
