import * as React from 'react';
import { Button, JsonBlock, Label, Textarea, type EntityFieldDef, type EntityFormMode } from '@cloud-dog/ui';
import { useAuthz } from '../lib/authz';
import { useExpertAgentState } from '../state/AppState';
import type { ExpertRecord, PromptGenerateResult, PromptTemplateRecord, PromptTestCase, PromptValidation } from '../lib/api';
import { AppDataTable, CrudEntityDialog } from '../lib/data-table-adapter';
import { PageScaffold, formatCount } from './shared';


const defaultPrompt = 'You are an expert assistant that must answer with concise evidence-backed steps.';

export function PromptsPage() {
  const authz = useAuthz();
  const { api, latestFailure, captureFailure, clearFailure } = useExpertAgentState();
  const [templates, setTemplates] = React.useState<PromptTemplateRecord[]>([]);
  const [experts, setExperts] = React.useState<ExpertRecord[]>([]);
  const [promptExperts, setPromptExperts] = React.useState<Record<number, Array<{ expert_id: number; expert_name?: string }>>>({});
  const [cases, setCases] = React.useState<PromptTestCase[]>([]);
  const [validation, setValidation] = React.useState<PromptValidation | null>(null);
  const [generatedPrompt, setGeneratedPrompt] = React.useState<PromptGenerateResult | null>(null);
  const [preview, setPreview] = React.useState<string | null>(null);
  const [selectedExpertId, setSelectedExpertId] = React.useState<number | undefined>(undefined);
  const [name, setName] = React.useState('');
  const [content, setContent] = React.useState(defaultPrompt);
  const [editingId, setEditingId] = React.useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [status, setStatus] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    clearFailure();
    setLoading(true);
    try {
      const [tpls, exps] = await Promise.all([api.listPromptTemplates(), api.listExperts()]);
      setTemplates(tpls);
      setExperts(exps);
      // EXPWEB-111: fetch prompt-expert assignments
      const assignMap: Record<number, Array<{ expert_id: number; expert_name?: string }>> = {};
      await Promise.all(tpls.map(async (t) => {
        try {
          const linked = await api.listPromptExperts(t.id);
          if (linked.length > 0) assignMap[t.id] = linked.map((a) => ({ expert_id: a.expert_id, expert_name: a.expert_name }));
        } catch { /* ignore per-template fetch errors */ }
      }));
      setPromptExperts(assignMap);
    } catch (error) {
      captureFailure(error);
    } finally {
      setLoading(false);
    }
  }, [api, captureFailure, clearFailure]);

  React.useEffect(() => { void refresh(); }, [refresh]);

  const inventoryRows = React.useMemo(
    () => [...templates].sort((left, right) => right.id - left.id),
    [templates],
  );

  const fields: EntityFieldDef[] = [
    { name: 'name', label: 'Template name', type: 'text', required: true, readOnly: editingId !== null },
  ];

  const openCreate = React.useCallback(() => {
    setEditingId(null);
    setName('');
    setContent(defaultPrompt);
    setDialogOpen(true);
  }, []);

  const openEdit = React.useCallback((template: PromptTemplateRecord) => {
    setEditingId(template.id);
    setName(template.name);
    setContent(template.content ?? '');
    setDialogOpen(true);
  }, []);

  const closeDialog = React.useCallback(() => {
    setDialogOpen(false);
    setEditingId(null);
    setName('');
    setContent(defaultPrompt);
    setPreview(null);
  }, []);

  const saveTemplate = React.useCallback(async () => {
    if (!name.trim() || !content.trim()) return;
    setSaving(true);
    clearFailure();
    try {
      if (editingId === null) {
        const optimisticId = -Date.now();
        const optimisticTemplate: PromptTemplateRecord = {
          id: optimisticId,
          name,
          content,
          version: 1,
        };
        setTemplates((current) => [optimisticTemplate, ...current.filter((template) => template.id !== optimisticId)]);
        closeDialog();
        const created = await api.createPromptTemplate({ name, content });
        setTemplates((current) => [created, ...current.filter((template) => template.id !== optimisticId && template.id !== created.id)]);
        setStatus(`Created prompt template ${name}.`);
      } else {
        const updated = await api.updatePromptTemplate(editingId, { content });
        setTemplates((current) => current.map((template) => (template.id === updated.id ? updated : template)));
        closeDialog();
        setStatus(`Updated prompt template ${name}.`);
      }
      await refresh();
    } catch (error) {
      await refresh();
      captureFailure(error);
    } finally {
      setSaving(false);
    }
  }, [api, captureFailure, clearFailure, closeDialog, content, editingId, name, refresh]);

  const deleteTemplate = React.useCallback(async (template: PromptTemplateRecord) => {
    if (!window.confirm(`Delete prompt template ${template.name}?`)) return;
    clearFailure();
    try {
      await api.deletePromptTemplate(template.id);
      setTemplates((current) => current.filter((item) => item.id !== template.id));
      setStatus(`Deleted prompt template ${template.name}.`);
      await refresh();
    } catch (error) {
      captureFailure(error);
    }
  }, [api, captureFailure, clearFailure, refresh]);

  const activePrompt = content.trim() || defaultPrompt;
  const onGenerateTestCases = React.useCallback(async () => {
    clearFailure();
    try {
      const nextCases = await api.generatePromptTestCases(activePrompt, selectedExpertId);
      setCases(nextCases);
      setStatus(`Generated ${nextCases.length} test cases.${selectedExpertId ? ` Expert context: ID ${selectedExpertId}` : ''}`);
    } catch (error) {
      captureFailure(error);
    }
  }, [activePrompt, api, captureFailure, clearFailure, selectedExpertId]);

  const onGeneratePrompt = React.useCallback(async () => {
    clearFailure();
    try {
      const result = await api.generatePrompt(activePrompt, selectedExpertId);
      setGeneratedPrompt(result);
      setStatus(`Generated prompt.${selectedExpertId ? ` Expert context: ID ${selectedExpertId}` : ''}`);
    } catch (error) {
      captureFailure(error);
    }
  }, [activePrompt, api, captureFailure, clearFailure, selectedExpertId]);

  const onValidate = React.useCallback(async () => {
    clearFailure();
    try {
      const result = await api.validatePrompt(activePrompt);
      setValidation(result);
    } catch (error) {
      captureFailure(error);
    }
  }, [activePrompt, api, captureFailure, clearFailure]);

  const onPreview = React.useCallback(async () => {
    const previewTarget = editingId ?? templates[0]?.id;
    if (!previewTarget) return;
    clearFailure();
    try {
      const result = await api.testPromptTemplate(previewTarget, activePrompt);
      setPreview(result.preview ?? null);
      setStatus('Prompt preview generated.');
    } catch (error) {
      captureFailure(error);
    }
  }, [activePrompt, api, captureFailure, clearFailure, editingId, templates]);

  return (
    <PageScaffold title="Prompts" description="Prompt template CRUD with live preview." alert={latestFailure} status={status}>
      {/* EXPWEB-113: Templates/Generated cases/Validation score/Prompt valid summary blocks REMOVED */}
      {authz.isAdmin ? (
        <div className="flex justify-end gap-2">
          <Button type="button" onClick={openCreate}>Create Prompt</Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Prompt CRUD is restricted to administrators. Validation, preview, and test-case generation remain available for inspection workflows.</p>
      )}
      <AppDataTable
        title="Prompt inventory"
        rows={inventoryRows}
        getRowId={(template) => String(template.id)}
        emptyMessage="No prompt templates reported by the backend."
        itemLabel="templates"
        onRefresh={refresh}
        columns={[
          { id: 'name', header: 'Name', sortable: true, sortValue: (template) => template.name, cell: (template) => template.name },
          { id: 'description', header: 'Description', cell: (template) => (template.content ?? '').slice(0, 80) || 'N/A' },
          { id: 'variables', header: 'Variables Count', cell: (template) => String((template.content ?? '').match(/\{\{[^}]+\}\}/g)?.length ?? 0) },
          { id: 'version', header: 'Version', cell: (template) => template.version ?? 1 },
          // EXPWEB-111/112: Show which experts use each prompt (assignments + content match fallback)
          {
            id: 'linked_experts',
            header: 'Linked Experts',
            cell: (template) => {
              const assigned = promptExperts[template.id] ?? [];
              const contentMatched = experts.filter((e) => e.prompt_template && template.content && e.prompt_template.trim() === template.content.trim() && !assigned.some((a) => a.expert_id === e.id));
              const all = [...assigned.map((a) => ({ id: a.expert_id, name: a.expert_name ?? `Expert ${a.expert_id}` })), ...contentMatched.map((e) => ({ id: e.id, name: e.name }))];
              return all.length > 0
                ? <span className="text-xs" data-testid={`prompt-linked-experts-${template.id}`}>{all.map((e) => <a key={e.id} href={`/experts?highlight=${e.id}`} className="text-primary underline mr-1">{e.name}</a>)}</span>
                : <span className="text-xs text-muted-foreground">None</span>;
            },
          },
        ]}
        rowActions={authz.isAdmin ? [
          { label: 'Edit', onClick: openEdit },
          { label: 'Delete', variant: 'destructive', onClick: (template) => void deleteTemplate(template) },
          { label: 'Duplicate', onClick: (template) => { setEditingId(null); setName(`${template.name}-copy`); setContent(template.content ?? ''); setDialogOpen(true); } },
        ] : undefined}
      />

      {/* EXPWEB-120: Prompt contract surface REMOVED */}

      {/* EXPWEB-114: Prompt Workbench moved to BOTTOM of page (was above table) */}
      <div className="rounded-xl border bg-background p-4 space-y-4" data-testid="prompt-workbench">
        <div>
          <h2 className="text-lg font-semibold">Prompt workbench</h2>
          <p className="text-sm text-muted-foreground">Edit template content directly, then preview, validate, or generate test cases against the live prompt endpoints.</p>
        </div>
        <label className="space-y-2 block">
          <Label htmlFor="prompt-workbench-content">Template content</Label>
          <Textarea
            id="prompt-workbench-content"
            rows={8}
            value={content}
            onChange={(event) => setContent(event.target.value)}
          />
        </label>
        {/* EXPWEB-115/117: Expert context selector for prompt generation and test-case generation */}
        {experts.length > 0 ? (
          <div className="flex items-center gap-2" data-testid="expert-context-selector">
            <Label htmlFor="expert-context-select" className="text-sm whitespace-nowrap">Expert context:</Label>
            <select
              id="expert-context-select"
              className="rounded border bg-background px-2 py-1 text-sm"
              value={selectedExpertId ?? ''}
              onChange={(e) => setSelectedExpertId(e.target.value ? Number(e.target.value) : undefined)}
              data-testid="expert-context-dropdown"
            >
              <option value="">None (no expert context)</option>
              {experts.map((e) => <option key={e.id} value={e.id}>{e.name}{e.title ? ` — ${e.title}` : ''}</option>)}
            </select>
          </div>
        ) : null}
        {/* EXPWEB-119: Variable picker — shows detected variables and common variable suggestions */}
        {(() => {
          const detected = (content.match(/\{\{([^}]+)\}\}/g) ?? []).map((m) => m.replace(/^\{\{|\}\}$/g, '').trim());
          const suggestions = ['context', 'question', 'expert_type', 'topic', 'outcome', 'sub_agents', 'constraints', 'history'].filter((s) => !detected.includes(s));
          return (detected.length > 0 || suggestions.length > 0) ? (
            <div className="flex flex-wrap items-center gap-1 text-xs" data-testid="prompt-variable-picker">
              <span className="text-muted-foreground mr-1">Variables:</span>
              {detected.map((v) => <span key={v} className="inline-flex items-center rounded bg-primary/10 px-1.5 py-0.5 font-mono text-primary">{`{{${v}}}`}</span>)}
              {suggestions.length > 0 ? <span className="text-muted-foreground ml-2 mr-1">Insert:</span> : null}
              {suggestions.slice(0, 5).map((v) => (
                <button key={v} type="button" className="inline-flex items-center rounded bg-muted px-1.5 py-0.5 font-mono hover:bg-muted-foreground/20" onClick={() => setContent((c) => `${c}{{${v}}}`)} data-testid={`insert-var-${v}`}>{`{{${v}}}`}</button>
              ))}
            </div>
          ) : null;
        })()}
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => void onPreview()} disabled={!content.trim()}>Preview template</Button>
          <Button type="button" variant="secondary" onClick={() => void onValidate()} disabled={!content.trim()}>Validate prompt</Button>
          <Button type="button" variant="secondary" onClick={() => void onGeneratePrompt()} disabled={!content.trim()} data-testid="generate-prompt-btn">Generate prompt</Button>
          <Button type="button" variant="secondary" onClick={() => void onGenerateTestCases()} disabled={!content.trim()} data-testid="generate-test-cases-btn">Generate test cases</Button>
        </div>
      </div>
      {/* EXPWEB-116: Validation result display */}
      {validation !== null ? (
        <div className="rounded-xl border bg-background p-4 space-y-3" data-testid="prompt-validation-result">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Validation result</h2>
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${(validation.score ?? 0) >= 70 ? 'bg-green-100 text-green-800' : (validation.score ?? 0) >= 40 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`} data-testid="validation-score">
              Score: {validation.score ?? 0}/100
            </span>
          </div>
          {(validation.strengths ?? []).length > 0 ? (
            <div>
              <h3 className="text-sm font-medium text-green-700">Strengths</h3>
              <ul className="mt-1 space-y-1 text-sm">{(validation.strengths ?? []).map((s, i) => <li key={i} className="text-muted-foreground">+ {s}</li>)}</ul>
            </div>
          ) : null}
          {(validation.weaknesses ?? []).length > 0 ? (
            <div>
              <h3 className="text-sm font-medium text-red-700">Weaknesses</h3>
              <ul className="mt-1 space-y-1 text-sm">{(validation.weaknesses ?? []).map((w, i) => <li key={i} className="text-muted-foreground">- {w}</li>)}</ul>
            </div>
          ) : null}
          {(validation.recommendations ?? []).length > 0 ? (
            <div>
              <h3 className="text-sm font-medium text-blue-700">Recommendations</h3>
              <ul className="mt-1 space-y-1 text-sm">{(validation.recommendations ?? []).map((r, i) => <li key={i} className="text-muted-foreground">{r}</li>)}</ul>
            </div>
          ) : null}
        </div>
      ) : null}
      {/* EXPWEB-115: Generated prompt result display */}
      {generatedPrompt !== null ? (
        <div className="rounded-xl border bg-background p-4 space-y-3" data-testid="generated-prompt-result">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Generated prompt</h2>
            {generatedPrompt.expert_id ? <span className="text-xs text-muted-foreground">Expert context: ID {generatedPrompt.expert_id}</span> : null}
          </div>
          <pre className="whitespace-pre-wrap rounded bg-muted p-3 text-sm" data-testid="generated-prompt-text">{generatedPrompt.prompt ?? 'No prompt returned.'}</pre>
          {generatedPrompt.reasoning ? (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Reasoning</h3>
              <p className="text-sm mt-1">{generatedPrompt.reasoning}</p>
            </div>
          ) : null}
        </div>
      ) : null}
      {(cases.length > 0 || preview !== null) ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {cases.length > 0 ? (
            <div className="rounded-xl border bg-background p-4">
              <h2 className="text-lg font-semibold">Generated test cases ({cases.length})</h2>
              <ul className="mt-3 space-y-2 text-sm">{cases.map((item, index) => <li key={`${item.name ?? 'case'}-${index}`} className="rounded border p-3"><p className="font-medium">{item.name ?? `Case ${index + 1}`}</p><p className="text-muted-foreground">{item.objective ?? 'No objective returned.'}</p></li>)}</ul>
            </div>
          ) : null}
          {preview !== null ? (
            <div className="rounded-xl border bg-background p-4">
              <h2 className="text-lg font-semibold">Prompt preview</h2>
              <div className="mt-3">
                <JsonBlock title="Rendered preview" value={preview} defaultCollapsed={false} />
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
      {authz.isAdmin ? (
        <CrudEntityDialog
          open={dialogOpen}
          title={editingId === null ? 'Create Prompt Template' : 'Edit Prompt Template'}
          mode={(editingId === null ? 'add' : 'edit') as EntityFormMode}
          fields={fields}
          values={{ name }}
          onChange={(_, value) => setName(String(value ?? ''))}
          onSubmit={() => void saveTemplate()}
          onCancel={closeDialog}
          extra={
            <div className="space-y-4">
              <label className="space-y-2 block">
                <Label htmlFor="prompt-content">Template content</Label>
                <Textarea id="prompt-content" rows={10} value={content} onChange={(event) => setContent(event.target.value)} />
              </label>
            </div>
          }
        />
      ) : null}
    </PageScaffold>
  );
}
