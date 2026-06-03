import * as React from 'react';
import { Button, Card, CardContent, CardHeader, Checkbox, Dialog, Input, JsonBlock, Label, Select, Textarea, statusColumn, type EntityFieldDef, type EntityFormMode, type RelatedItem } from '@cloud-dog/ui';
import { useAuth } from '@cloud-dog/auth';
import { useAuthz } from '../lib/authz';
import { useExpertAgentState } from '../state/AppState';
import type { ChannelRecord, ExpertRecord, ExpertServiceBindingRecord, KnowledgeRecord, PromptTemplateRecord, ProviderRecord, ProviderModelRecord, ServiceRecord, SubExpertBindingRecord, TestProbeResult } from '../lib/api';
import { AppDataTable, CrudEntityDialog } from '../lib/data-table-adapter';
import { LoadingNote, PageScaffold, SummaryGrid, formatCount } from './shared';


type ExpertForm = {
  name: string;
  title: string;
  description: string;
  prompt_template: string;
  llm_provider: string;
  llm_model: string;
  temperature: string;
  top_k: string;
  max_tokens: string;
  enabled: boolean;
};

const emptyForm: ExpertForm = {
  name: '',
  title: '',
  description: '',
  prompt_template: 'You are an expert AI assistant. Answer questions accurately and concisely based on the knowledge available to you.',
  llm_provider: 'ollama',
  llm_model: 'qwen3:14b',
  temperature: '0.7',
  top_k: '',
  max_tokens: '1024',
  enabled: true,
};

const fields: EntityFieldDef[] = [
  { name: 'name', label: 'Name', type: 'text', required: true },
  { name: 'title', label: 'Title', type: 'text', required: true },
  { name: 'enabled', label: 'Enabled', type: 'boolean' },
];

function validate(form: ExpertForm): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!form.name.trim()) errors.name = 'Name is required.';
  if (!form.title.trim()) errors.title = 'Title is required.';
  if (!form.llm_provider.trim()) errors.llm_provider = 'Provider is required.';
  if (!form.llm_model.trim()) errors.llm_model = 'Model is required.';
  if (!form.description.trim()) errors.description = 'Description is required.';
  if (form.temperature && (Number(form.temperature) < 0 || Number(form.temperature) > 2)) errors.temperature = 'Temperature must be 0-2.';
  if (form.top_k && Number(form.top_k) < 0) errors.top_k = 'Top-K must be >= 0.';
  if (form.max_tokens && Number(form.max_tokens) < 1) errors.max_tokens = 'Max tokens must be >= 1.';
  return errors;
}

export function ExpertsPage() {
  const auth = useAuth();
  const authz = useAuthz();
  const { api, latestFailure, captureFailure, clearFailure } = useExpertAgentState();
  const [experts, setExperts] = React.useState<ExpertRecord[]>([]);
  const [channels, setChannels] = React.useState<ChannelRecord[]>([]);
  const [services, setServices] = React.useState<Record<number, ExpertServiceBindingRecord[]>>({});
  const [subExperts, setSubExperts] = React.useState<Record<number, SubExpertBindingRecord[]>>({});
  const [allServices, setAllServices] = React.useState<ServiceRecord[]>([]);
  const [allKnowledge, setAllKnowledge] = React.useState<KnowledgeRecord[]>([]);
  const [allPrompts, setAllPrompts] = React.useState<PromptTemplateRecord[]>([]);
  const [form, setForm] = React.useState<ExpertForm>(emptyForm);
  const [editingId, setEditingId] = React.useState<number | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [status, setStatus] = React.useState<string | null>(null);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [dialogOpen, setDialogOpen] = React.useState(false);

  // EXPWEB-026: multiselect binding state for services and sub-experts
  const [boundServiceIds, setBoundServiceIds] = React.useState<Set<number>>(new Set());
  const [boundSubExpertIds, setBoundSubExpertIds] = React.useState<Set<number>>(new Set());

  // EXPWEB-017/031: provider discovery
  const [providers, setProviders] = React.useState<ProviderRecord[]>([]);
  // EXPWEB-018/032: model discovery
  const [providerModels, setProviderModels] = React.useState<ProviderModelRecord[]>([]);
  const [modelsLoading, setModelsLoading] = React.useState(false);

  // EXPWEB-023: LLM test probe
  const [probeOpen, setProbeOpen] = React.useState(false);
  const [probeTarget, setProbeTarget] = React.useState<ExpertRecord | null>(null);
  const [probePrompt, setProbePrompt] = React.useState('Say hello and confirm you are working.');
  const [probeResult, setProbeResult] = React.useState<TestProbeResult | null>(null);
  const [probeRunning, setProbeRunning] = React.useState(false);

  // EXPWEB-024/030: popup dialogs instead of inline cards
  const [addServiceOpen, setAddServiceOpen] = React.useState(false);
  const [addServiceTarget, setAddServiceTarget] = React.useState<ExpertRecord | null>(null);
  const [addServiceId, setAddServiceId] = React.useState<string>('');
  const [addSubExpertOpen, setAddSubExpertOpen] = React.useState(false);
  const [addSubExpertTarget, setAddSubExpertTarget] = React.useState<ExpertRecord | null>(null);
  const [addSubExpertId, setAddSubExpertId] = React.useState<string>('');

  // EXPWEB-027/028/029: test query popup dialog
  const [testQueryOpen, setTestQueryOpen] = React.useState(false);
  const [testTarget, setTestTarget] = React.useState<ExpertRecord | null>(null);
  const [testQueryText, setTestQueryText] = React.useState<string>('What is cloud computing?');
  const [testResult, setTestResult] = React.useState<unknown>(null);
  const [testRunning, setTestRunning] = React.useState(false);
  const [testElapsed, setTestElapsed] = React.useState(0);

  const refresh = React.useCallback(async () => {
    clearFailure();
    setLoading(true);
    try {
      const [expertRecords, channelRecords, serviceRecords, knowledgeRecords, promptRecords, providerRecords] = await Promise.all([
        api.listExperts(),
        api.listChannels(),
        api.listServices().catch(() => [] as ServiceRecord[]),
        api.listKnowledge().catch(() => [] as KnowledgeRecord[]),
        api.listPromptTemplates().catch(() => [] as PromptTemplateRecord[]),
        api.listProviders().catch(() => [] as ProviderRecord[]),
      ]);
      setExperts(expertRecords);
      setChannels(channelRecords);
      setAllServices(serviceRecords);
      setAllKnowledge(knowledgeRecords);
      setAllPrompts(promptRecords);
      setProviders(providerRecords);
      const related = await Promise.all(expertRecords.map(async (expert) => ({
        id: expert.id,
        services: await api.listExpertServices(expert.id),
        subExperts: await api.listExpertSubExperts(expert.id),
      })));
      const serviceMap: Record<number, ExpertServiceBindingRecord[]> = {};
      const subExpertMap: Record<number, SubExpertBindingRecord[]> = {};
      for (const item of related) {
        serviceMap[item.id] = item.services;
        subExpertMap[item.id] = item.subExperts;
      }
      setServices(serviceMap);
      setSubExperts(subExpertMap);
    } catch (error) {
      captureFailure(error);
    } finally {
      setLoading(false);
    }
  }, [api, captureFailure, clearFailure]);

  React.useEffect(() => { void refresh(); }, [refresh]);

  // EXPWEB-018/032: fetch models when provider changes
  const loadModelsForProvider = React.useCallback(async (providerId: string) => {
    if (!providerId) { setProviderModels([]); return; }
    setModelsLoading(true);
    try {
      const models = await api.listProviderModels(providerId);
      setProviderModels(models);
    } catch {
      setProviderModels([]);
    } finally {
      setModelsLoading(false);
    }
  }, [api]);

  // Load models when dialog opens or provider changes
  React.useEffect(() => {
    if (dialogOpen && form.llm_provider) {
      void loadModelsForProvider(form.llm_provider);
    }
  }, [dialogOpen, form.llm_provider, loadModelsForProvider]);

  const openCreate = React.useCallback(() => {
    setEditingId(null);
    setForm(emptyForm);
    setErrors({});
    setBoundServiceIds(new Set());
    setBoundSubExpertIds(new Set());
    setDialogOpen(true);
  }, []);

  const openEdit = React.useCallback((expert: ExpertRecord) => {
    setEditingId(expert.id);
    setForm({
      name: expert.name,
      title: expert.title ?? expert.name,
      description: expert.description ?? '',
      prompt_template: expert.prompt_template ?? '',
      llm_provider: expert.llm_provider ?? 'ollama',
      llm_model: expert.llm_model ?? 'qwen3:14b',
      temperature: expert.temperature != null ? String(expert.temperature) : '0.7',
      top_k: expert.top_k != null ? String(expert.top_k) : '',
      max_tokens: expert.max_tokens != null ? String(expert.max_tokens) : '1024',
      enabled: expert.enabled !== false,
    });
    setErrors({});
    // EXPWEB-026: load existing bindings into multiselect state
    const svcBindings = services[expert.id] ?? [];
    setBoundServiceIds(new Set(svcBindings.map((b) => b.service_id)));
    const subBindings = subExperts[expert.id] ?? [];
    setBoundSubExpertIds(new Set(subBindings.map((b) => b.sub_expert_id)));
    setDialogOpen(true);
  }, [services, subExperts]);

  const closeDialog = React.useCallback(() => {
    setDialogOpen(false);
    setEditingId(null);
    setErrors({});
    setForm(emptyForm);
    setProviderModels([]);
    setBoundServiceIds(new Set());
    setBoundSubExpertIds(new Set());
  }, []);

  const saveExpert = React.useCallback(async () => {
    const nextErrors = validate(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setSaving(true);
    clearFailure();
    try {
      const payload = {
        ...form,
        temperature: form.temperature ? Number(form.temperature) : undefined,
        top_k: form.top_k ? Number(form.top_k) : undefined,
        max_tokens: form.max_tokens ? Number(form.max_tokens) : undefined,
      };
      let savedId = editingId;
      if (editingId === null) {
        const created = await api.createExpert(payload);
        savedId = created.id;
        setStatus(`Created expert ${form.name}.`);
      } else {
        await api.updateExpert(editingId, payload);
        setStatus(`Updated expert ${form.name}.`);
      }
      // EXPWEB-026: batch-update service and sub-expert bindings
      if (savedId !== null) {
        await api.batchSetExpertServices(savedId, [...boundServiceIds]);
        await api.batchSetExpertSubExperts(savedId, [...boundSubExpertIds]);
      }
      closeDialog();
      await refresh();
    } catch (error) {
      captureFailure(error);
    } finally {
      setSaving(false);
    }
  }, [api, boundServiceIds, boundSubExpertIds, captureFailure, clearFailure, closeDialog, editingId, form, refresh]);

  const deleteExpert = React.useCallback(async (expert: ExpertRecord) => {
    if (!window.confirm(`Delete expert ${expert.name}?`)) return;
    clearFailure();
    try {
      await api.deleteExpert(expert.id);
      setStatus(`Deleted expert ${expert.name}.`);
      await refresh();
    } catch (error) {
      captureFailure(error);
    }
  }, [api, captureFailure, clearFailure, refresh]);

  // EXPWEB-024: Add Service popup handler
  const handleAddService = React.useCallback(async () => {
    if (!addServiceTarget || !addServiceId) return;
    clearFailure();
    try {
      await api.addExpertService(addServiceTarget.id, { service_id: Number(addServiceId), priority: 1, enabled: true });
      setStatus(`Added service to ${addServiceTarget.name}.`);
      setAddServiceOpen(false);
      setAddServiceTarget(null);
      setAddServiceId('');
      await refresh();
    } catch (error) {
      captureFailure(error);
    }
  }, [addServiceTarget, addServiceId, api, captureFailure, clearFailure, refresh]);

  // EXPWEB-030: Add Sub Expert popup handler
  const handleAddSubExpert = React.useCallback(async () => {
    if (!addSubExpertTarget || !addSubExpertId) return;
    clearFailure();
    try {
      await api.addExpertSubExpert(addSubExpertTarget.id, { sub_expert_id: Number(addSubExpertId), max_depth: 2, enabled: true });
      setStatus(`Added sub-expert to ${addSubExpertTarget.name}.`);
      setAddSubExpertOpen(false);
      setAddSubExpertTarget(null);
      setAddSubExpertId('');
      await refresh();
    } catch (error) {
      captureFailure(error);
    }
  }, [addSubExpertTarget, addSubExpertId, api, captureFailure, clearFailure, refresh]);

  // EXPWEB-027/028/029: Test Query popup handler with async job/progress polling
  const handleTestQuery = React.useCallback(async () => {
    if (!testTarget || !testQueryText.trim()) return;
    setTestRunning(true);
    setTestResult(null);
    setTestElapsed(0);
    clearFailure();
    const startTime = Date.now();
    const timer = setInterval(() => setTestElapsed(Math.floor((Date.now() - startTime) / 1000)), 1000);
    try {
      const submitResult = await api.testExpertQuery(testTarget.id, { query: testQueryText, user_id: Number(auth.user?.id ?? 0) || undefined });
      const jobId = Number(submitResult.job_id);
      if (!jobId) {
        setTestResult(submitResult);
        return;
      }
      // Poll job status until terminal
      let job = await api.getJob(jobId);
      setTestResult({ job_id: jobId, status: job.status, message: 'Job submitted, polling for result...' });
      while (job.status !== 'completed' && job.status !== 'failed' && job.status !== 'cancelled' && job.status !== 'timed_out') {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        job = await api.getJob(jobId);
        setTestResult({ job_id: jobId, status: job.status, elapsed: Math.floor((Date.now() - startTime) / 1000) });
      }
      if (job.status === 'completed' && job.response_received) {
        try {
          const parsed = JSON.parse(job.response_received);
          setTestResult({ job_id: jobId, status: job.status, ...parsed });
        } catch {
          setTestResult({ job_id: jobId, status: job.status, response: job.response_received });
        }
      } else {
        setTestResult({ job_id: jobId, status: job.status, outcome: job.outcome, error_info: job.error_info });
      }
      setStatus(`Test query ${job.status} against ${testTarget.name} (job ${jobId}) in ${Math.floor((Date.now() - startTime) / 1000)}s.`);
    } catch (error) {
      captureFailure(error);
    } finally {
      clearInterval(timer);
      setTestRunning(false);
    }
  }, [api, auth.user?.id, captureFailure, clearFailure, testQueryText, testTarget]);

  // EXPWEB-023: LLM test probe handler
  const handleTestProbe = React.useCallback(async () => {
    if (!probeTarget) return;
    setProbeRunning(true);
    setProbeResult(null);
    clearFailure();
    try {
      const result = await api.testProbeExpert(probeTarget.id, probePrompt || undefined);
      setProbeResult(result);
      setStatus(result.success
        ? `LLM probe succeeded for ${probeTarget.name}.`
        : `LLM probe failed for ${probeTarget.name}: ${result.error ?? 'unknown error'}`);
    } catch (error) {
      captureFailure(error);
    } finally {
      setProbeRunning(false);
    }
  }, [api, captureFailure, clearFailure, probePrompt, probeTarget]);

  const bulkDelete = React.useCallback(async (selected: ExpertRecord[]) => {
    if (!selected.length || !window.confirm(`Delete ${selected.length} selected experts?`)) return;
    clearFailure();
    try {
      await Promise.all(selected.map(async (expert) => api.deleteExpert(expert.id)));
      setStatus(`Deleted ${selected.length} experts.`);
      await refresh();
    } catch (error) {
      captureFailure(error);
    }
  }, [api, captureFailure, clearFailure, refresh]);

  const activeExpert = experts.find((expert) => expert.id === editingId) ?? null;
  const formatServiceBinding = React.useCallback((binding: ExpertServiceBindingRecord) => {
    const service = binding.service;
    return [
      service?.name ?? `Service ${binding.service_id}`,
      service?.service_type ?? 'unknown type',
      service?.health_status ?? 'unknown health',
      `priority ${binding.priority ?? 'N/A'}`,
    ].join(' • ');
  }, []);
  const formatSubExpertBinding = React.useCallback((binding: SubExpertBindingRecord) => {
    return [
      binding.sub_expert?.name ?? `Expert ${binding.sub_expert_id}`,
      `max depth ${binding.max_depth ?? 'N/A'}`,
      binding.enabled === false ? 'disabled' : 'enabled',
    ].join(' • ');
  }, []);
  const channelItems: RelatedItem[] = activeExpert
    ? channels.filter((channel) => (channel.expert_config_id ?? channel.expert_id) === activeExpert.id).map((channel) => ({ id: String(channel.id), label: channel.name }))
    : [];
  const serviceItems: RelatedItem[] = activeExpert
    ? (services[activeExpert.id] ?? []).map((binding) => ({ id: String(binding.id), label: formatServiceBinding(binding) }))
    : [];
  const subExpertItems: RelatedItem[] = activeExpert
    ? (subExperts[activeExpert.id] ?? []).map((binding) => ({ id: String(binding.id), label: formatSubExpertBinding(binding) }))
    : [];
  const mode: EntityFormMode = editingId === null ? 'add' : 'edit';

  return (
    <PageScaffold title="Experts" description="Expert configuration CRUD using shared tables and shared form dialogs." alert={latestFailure} status={status}>
      <LoadingNote loading={loading} />
      <SummaryGrid items={[
        { label: 'Experts', value: formatCount(experts.length) },
        { label: 'Enabled', value: formatCount(experts.filter((expert) => expert.enabled !== false).length) },
        { label: 'Providers', value: formatCount(new Set(experts.map((expert) => expert.llm_provider ?? 'N/A')).size) },
      ]} />
      {authz.isAdmin ? (
        <div className="flex justify-end">
          <Button type="button" onClick={openCreate}>Create Expert</Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Expert CRUD is restricted to administrators. Non-admin users can inspect expert bindings only.</p>
      )}
      <AppDataTable
        title="Expert inventory"
        rows={experts}
        getRowId={(expert) => String(expert.id)}
        emptyMessage="No experts reported by the backend."
        itemLabel="experts"
        onRefresh={refresh}
        columns={[
          { id: 'name', header: 'Name', sortable: true, sortValue: (expert) => expert.name, cell: (expert) => expert.name },
          { id: 'model', header: 'Model', sortable: true, sortValue: (expert) => expert.llm_model ?? '', cell: (expert) => expert.llm_model ?? 'N/A' },
          statusColumn<ExpertRecord>({ getValue: (expert) => expert.enabled !== false ? 'active' : 'disabled' }),
          { id: 'channels', header: 'Channels Count', sortable: true, sortValue: (expert) => channels.filter((channel) => (channel.expert_config_id ?? channel.expert_id) === expert.id).length, cell: (expert) => formatCount(channels.filter((channel) => (channel.expert_config_id ?? channel.expert_id) === expert.id).length) },
          { id: 'provider', header: 'Provider', sortable: true, sortValue: (expert) => expert.llm_provider ?? '', cell: (expert) => expert.llm_provider ?? 'N/A' },
          // EXPWEB-033: history/audit link
          {
            id: 'history',
            header: 'History',
            cell: (expert) => (
              <a href={`/ui/logs?filter=expert_id:${expert.id}`} className="text-xs text-primary underline" data-testid={`expert-history-link-${expert.id}`}>
                View logs
              </a>
            ),
          },
        ]}
        rowActions={authz.isAdmin ? [
          { label: 'Edit', onClick: openEdit },
          // EXPWEB-024: popup dialog
          { label: 'Add Service', onClick: (expert) => { setAddServiceTarget(expert); setAddServiceId(''); setAddServiceOpen(true); } },
          // EXPWEB-030: popup dialog
          { label: 'Add Sub Expert', onClick: (expert) => { setAddSubExpertTarget(expert); setAddSubExpertId(''); setAddSubExpertOpen(true); } },
          // EXPWEB-023: LLM test probe
          { label: 'Test LLM', onClick: (expert) => { setProbeTarget(expert); setProbeResult(null); setProbeOpen(true); } },
          // EXPWEB-027: popup dialog
          { label: 'Test Query', onClick: (expert) => { setTestTarget(expert); setTestResult(null); setTestElapsed(0); setTestQueryOpen(true); } },
          { label: 'Delete', variant: 'destructive', onClick: (expert) => void deleteExpert(expert) },
        ] : undefined}
        bulkActions={authz.isAdmin ? [
          { label: 'Delete Selected', variant: 'destructive', onClick: (rows) => void bulkDelete(rows) },
        ] : undefined}
        searchText={(expert) => [
          expert.name,
          expert.title ?? '',
          expert.llm_provider ?? '',
          expert.llm_model ?? '',
          ...(services[expert.id] ?? []).map(formatServiceBinding),
          ...(subExperts[expert.id] ?? []).map(formatSubExpertBinding),
        ].join(' ')}
      />

      {/* EXPWEB-024: Add Service popup dialog (was inline Card) */}
      <Dialog open={addServiceOpen} onOpenChange={setAddServiceOpen} label="Add Service">
        <div data-testid="expert-add-service-dialog">
          <div>
            <h2>Add Service to {addServiceTarget?.name}</h2>
          </div>
          <label className="space-y-2 block">
            <Label htmlFor="add-service-select">Service</Label>
            <Select id="add-service-select" data-testid="add-service-select" value={addServiceId} onChange={(event) => setAddServiceId(event.target.value)}>
              <option value="">Select a service</option>
              {allServices.map((s) => <option key={s.id} value={String(s.id)}>{s.name} ({s.service_type ?? 'unknown'})</option>)}
            </Select>
          </label>
          <div>
            <Button variant="secondary" onClick={() => { setAddServiceOpen(false); setAddServiceTarget(null); setAddServiceId(''); }}>Cancel</Button>
            <Button onClick={() => void handleAddService()} disabled={!addServiceId} data-testid="add-service-submit">Add</Button>
          </div>
        </div>
      </Dialog>

      {/* EXPWEB-030: Add Sub Expert popup dialog (was inline Card) */}
      <Dialog open={addSubExpertOpen} onOpenChange={setAddSubExpertOpen} label="Add Sub Expert">
        <div data-testid="expert-add-sub-expert-dialog">
          <div>
            <h2>Add Sub Expert to {addSubExpertTarget?.name}</h2>
          </div>
          <label className="space-y-2 block">
            <Label htmlFor="add-sub-expert-select">Sub Expert</Label>
            <Select id="add-sub-expert-select" data-testid="add-sub-expert-select" value={addSubExpertId} onChange={(event) => setAddSubExpertId(event.target.value)}>
              <option value="">Select an expert</option>
              {experts.filter((e) => e.id !== addSubExpertTarget?.id).map((e) => <option key={e.id} value={String(e.id)}>{e.name}</option>)}
            </Select>
          </label>
          <div>
            <Button variant="secondary" onClick={() => { setAddSubExpertOpen(false); setAddSubExpertTarget(null); setAddSubExpertId(''); }}>Cancel</Button>
            <Button onClick={() => void handleAddSubExpert()} disabled={!addSubExpertId} data-testid="add-sub-expert-submit">Add</Button>
          </div>
        </div>
      </Dialog>

      {/* EXPWEB-023: LLM Test Probe dialog */}
      <Dialog open={probeOpen} onOpenChange={setProbeOpen} label="Test LLM">
        <div className="max-w-2xl" data-testid="expert-test-probe-dialog">
          <div>
            <h2>Test LLM — {probeTarget?.name}</h2>
            <p className="text-sm text-muted-foreground">Provider: {probeTarget?.llm_provider} | Model: {probeTarget?.llm_model}</p>
          </div>
          <div className="space-y-4">
            <label className="space-y-2 block">
              <Label htmlFor="probe-prompt-input">Test prompt</Label>
              <Textarea id="probe-prompt-input" data-testid="probe-prompt-input" rows={2} value={probePrompt} onChange={(event) => setProbePrompt(event.target.value)} />
            </label>
            {probeResult !== null ? (
              <div data-testid="probe-result">
                <h3 className="text-sm font-semibold mb-2">{probeResult.success ? 'Probe succeeded' : 'Probe failed'}</h3>
                <JsonBlock title="Probe Result" value={probeResult} defaultCollapsed={false} />
              </div>
            ) : null}
          </div>
          <div className="flex gap-2 mt-4">
            <Button variant="secondary" onClick={() => { setProbeOpen(false); setProbeTarget(null); setProbeResult(null); }}>Close</Button>
            <Button onClick={() => void handleTestProbe()} loading={probeRunning} data-testid="probe-submit">Run Probe</Button>
          </div>
        </div>
      </Dialog>

      {/* EXPWEB-027/028/029: Test Query popup dialog with clear presentation and async progress */}
      <Dialog open={testQueryOpen} onOpenChange={setTestQueryOpen} label="Test Query">
        <div className="max-w-2xl" data-testid="expert-test-query-dialog">
          <div>
            <h2>Test Query — {testTarget?.name}</h2>
          </div>
          <div className="space-y-4">
            <label className="space-y-2 block">
              <Label htmlFor="test-query-input">Query</Label>
              <Textarea id="test-query-input" data-testid="test-query-input" rows={3} value={testQueryText} onChange={(event) => setTestQueryText(event.target.value)} />
            </label>
            {testRunning ? (
              <p className="text-sm text-muted-foreground" data-testid="test-query-timer">
                Running... {testElapsed}s elapsed
              </p>
            ) : null}
            {testResult !== null ? (
              <div data-testid="test-query-result">
                <h3 className="text-sm font-semibold mb-2">Result</h3>
                <JsonBlock title="Response" value={testResult} defaultCollapsed={false} />
              </div>
            ) : null}
            <p className="text-xs text-muted-foreground">
              Knowledge items: {allKnowledge.filter((k) => Number((k.metadata as Record<string, unknown> | null)?.expert_id ?? 0) === testTarget?.id).length} | Prompt templates: {allPrompts.length}
            </p>
          </div>
          <div>
            <Button variant="secondary" onClick={() => { setTestQueryOpen(false); setTestTarget(null); setTestResult(null); }}>Close</Button>
            <Button onClick={() => void handleTestQuery()} loading={testRunning} disabled={!testQueryText.trim()} data-testid="test-query-submit">Run Query</Button>
          </div>
        </div>
      </Dialog>

      {/* EXPWEB-025: Expert Contract section REMOVED */}

      {authz.isAdmin ? (
        <CrudEntityDialog
          open={dialogOpen}
          title={editingId === null ? 'Create Expert' : 'Edit Expert'}
          mode={mode}
          fields={fields}
          values={form}
          errors={errors}
          onChange={(name, value) => setForm((current) => ({ ...current, [name]: value as never }))}
          onSubmit={() => void saveExpert()}
          onCancel={closeDialog}
          relatedPanels={[
            { title: 'Channels', items: channelItems, emptyMessage: 'No channels are currently mapped to this expert.' },
            { title: 'Services', items: serviceItems, emptyMessage: 'No services are currently bound to this expert.' },
            { title: 'Sub-experts', items: subExpertItems, emptyMessage: 'No delegated sub-experts are configured.' },
          ]}
          extra={
            <div className="space-y-4">
              {/* EXPWEB-017: Provider selection dropdown */}
              <label className="space-y-2 block">
                <Label htmlFor="expert-provider">Provider</Label>
                <Select
                  id="expert-provider"
                  data-testid="expert-provider-select"
                  value={form.llm_provider}
                  onChange={(event) => {
                    const newProvider = event.target.value;
                    setForm((current) => ({ ...current, llm_provider: newProvider, llm_model: '' }));
                  }}
                >
                  <option value="">Select a provider</option>
                  {providers.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.type})</option>)}
                  {providers.length === 0 ? <option value="ollama">Ollama</option> : null}
                  {!providers.some((p) => p.id === 'openai') ? <option value="openai">OpenAI</option> : null}
                </Select>
                {errors.llm_provider ? <p className="text-xs text-destructive">{errors.llm_provider}</p> : null}
              </label>
              {/* EXPWEB-018: Model pick list from provider discovery */}
              <label className="space-y-2 block">
                <Label htmlFor="expert-model">Model</Label>
                {modelsLoading ? (
                  <p className="text-xs text-muted-foreground">Loading models...</p>
                ) : null}
                <Select
                  id="expert-model"
                  data-testid="expert-model-select"
                  value={form.llm_model}
                  onChange={(event) => setForm((current) => ({ ...current, llm_model: event.target.value }))}
                >
                  <option value="">Select a model</option>
                  {providerModels.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}{m.parameter_size ? ` (${m.parameter_size})` : ''}{m.family ? ` — ${m.family}` : ''}
                    </option>
                  ))}
                </Select>
                {errors.llm_model ? <p className="text-xs text-destructive">{errors.llm_model}</p> : null}
              </label>
              <label className="space-y-2 block">
                <Label htmlFor="expert-description">Description</Label>
                <Textarea id="expert-description" rows={3} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
                {errors.description ? <p className="text-xs text-destructive">{errors.description}</p> : null}
              </label>
              {/* EXPWEB-020: System prompt visible with default */}
              <label className="space-y-2 block">
                <Label htmlFor="expert-prompt">System prompt</Label>
                <Textarea id="expert-prompt" data-testid="expert-system-prompt" rows={6} value={form.prompt_template} onChange={(event) => setForm((current) => ({ ...current, prompt_template: event.target.value }))} />
                <p className="text-xs text-muted-foreground">The system prompt is sent to the LLM as the first message in every conversation with this expert.</p>
              </label>
              {/* EXPWEB-019: Temperature, Top-K, Max Tokens */}
              <div className="grid grid-cols-3 gap-4">
                <label className="space-y-2 block">
                  <Label htmlFor="expert-temperature">Temperature</Label>
                  <Input id="expert-temperature" data-testid="expert-temperature" type="number" step="0.1" min="0" max="2" value={form.temperature} onChange={(event) => setForm((current) => ({ ...current, temperature: event.target.value }))} />
                  {errors.temperature ? <p className="text-xs text-destructive">{errors.temperature}</p> : null}
                </label>
                <label className="space-y-2 block">
                  <Label htmlFor="expert-top-k">Top-K</Label>
                  <Input id="expert-top-k" data-testid="expert-top-k" type="number" min="0" value={form.top_k} onChange={(event) => setForm((current) => ({ ...current, top_k: event.target.value }))} placeholder="Default" />
                  {errors.top_k ? <p className="text-xs text-destructive">{errors.top_k}</p> : null}
                </label>
                <label className="space-y-2 block">
                  <Label htmlFor="expert-max-tokens">Max Tokens</Label>
                  <Input id="expert-max-tokens" data-testid="expert-max-tokens" type="number" min="1" value={form.max_tokens} onChange={(event) => setForm((current) => ({ ...current, max_tokens: event.target.value }))} />
                  {errors.max_tokens ? <p className="text-xs text-destructive">{errors.max_tokens}</p> : null}
                </label>
              </div>
              {/* EXPWEB-026: Service binding multiselect */}
              <div className="space-y-2" data-testid="expert-service-bindings">
                <Label>Service Bindings</Label>
                {allServices.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No services available to bind.</p>
                ) : (
                  <div className="max-h-40 overflow-y-auto rounded border p-2 space-y-1">
                    {allServices.map((svc) => (
                      <label key={svc.id} className="flex items-center gap-2 text-sm cursor-pointer" data-testid={`service-binding-${svc.id}`}>
                        <Checkbox
                          checked={boundServiceIds.has(svc.id)}
                          onChange={(event) => {
                            const isChecked = event.target.checked;
                            setBoundServiceIds((prev) => {
                              const next = new Set(prev);
                              if (isChecked) next.add(svc.id); else next.delete(svc.id);
                              return next;
                            });
                          }}
                        />
                        <span>{svc.name}</span>
                        <span className="text-muted-foreground">({svc.service_type ?? 'unknown'})</span>
                      </label>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">{boundServiceIds.size} service(s) selected</p>
              </div>
              {/* EXPWEB-026: Sub-expert binding multiselect */}
              <div className="space-y-2" data-testid="expert-sub-expert-bindings">
                <Label>Sub-Expert Bindings</Label>
                {experts.filter((e) => e.id !== editingId).length === 0 ? (
                  <p className="text-xs text-muted-foreground">No other experts available to delegate to.</p>
                ) : (
                  <div className="max-h-40 overflow-y-auto rounded border p-2 space-y-1">
                    {experts.filter((e) => e.id !== editingId).map((e) => (
                      <label key={e.id} className="flex items-center gap-2 text-sm cursor-pointer" data-testid={`sub-expert-binding-${e.id}`}>
                        <Checkbox
                          checked={boundSubExpertIds.has(e.id)}
                          onChange={(event) => {
                            const isChecked = event.target.checked;
                            setBoundSubExpertIds((prev) => {
                              const next = new Set(prev);
                              if (isChecked) next.add(e.id); else next.delete(e.id);
                              return next;
                            });
                          }}
                        />
                        <span>{e.name}</span>
                      </label>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">{boundSubExpertIds.size} sub-expert(s) selected</p>
              </div>
              {saving ? <p className="text-sm text-muted-foreground">Saving expert changes...</p> : null}
            </div>
          }
        />
      ) : null}
    </PageScaffold>
  );
}
