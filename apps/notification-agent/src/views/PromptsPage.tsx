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

// @cloud-dog/app-notification-agent — Prompt templates page adopted onto shared CRUD components.
// Covers: UI-R1, UI-R2

import * as React from 'react';
import { Badge, Button, Card, CardContent, CardHeader, DataTable, EntityDialog, Input, JsonBlock, Label, RelativeTime, Select, Textarea } from '@cloud-dog/ui';
import type { BulkAction, DataColumn, EntityFieldDef, EntityFormMode } from '@cloud-dog/ui';
import { useNotificationAgentState } from '../state/AppState';
import type { PromptRecord } from '../lib/api';

type PromptFormValues = Readonly<{
  name: string;
  channel_type: string;
  group_id: string;
  language: string;
  keyword: string;
  priority: string;
  enabled: boolean;
}>;

const LANGUAGE_OPTIONS = ['en', 'fr', 'de', 'es', 'ar', 'uk', 'ru', 'zh', 'ja'];

const promptFields = (mode: EntityFormMode, groupOptions: string[] = []): EntityFieldDef[] => [
  { name: 'name', label: 'Name', type: 'text', required: true, readOnly: mode === 'view' },
  { name: 'channel_type', label: 'Channel type', type: 'select', options: ['email', 'sms', 'whatsapp', 'slack', 'teams'], readOnly: mode === 'view' },
  { name: 'group_id', label: 'Group', type: 'select', options: [''].concat(groupOptions), readOnly: mode === 'view' },
  { name: 'language', label: 'Language', type: 'select', options: LANGUAGE_OPTIONS, readOnly: mode === 'view' },
  { name: 'keyword', label: 'Keyword', type: 'text', readOnly: mode === 'view' },
  { name: 'priority', label: 'Priority', type: 'number', readOnly: mode === 'view' },
  { name: 'enabled', label: 'Enabled', type: 'boolean', readOnly: mode === 'view' },
];

const emptyForm: PromptFormValues = {
  name: '',
  channel_type: 'email',
  group_id: '',
  language: 'en',
  keyword: '',
  priority: '0',
  enabled: true,
};

function toEnabledFlag(value: PromptRecord['enabled']) {
  return value === true || value === 1;
}

function validate(values: PromptFormValues, promptText: string, variablesJson: string): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!values.name.trim()) errors.name = 'Prompt name is required.';
  if (!promptText.trim()) errors.channel_type = 'Prompt text is required.';
  if (variablesJson.trim()) {
    try {
      JSON.parse(variablesJson);
    } catch {
      errors.group_id = 'Variables JSON is invalid.';
    }
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

export function PromptsPage() {
  const { api, latestFailure, captureFailure, clearFailure } = useNotificationAgentState();
  const [prompts, setPrompts] = React.useState<PromptRecord[]>([]);
  const [groups, setGroups] = React.useState<Array<{ id: number; name: string }>>([]);
  const [status, setStatus] = React.useState('');
  const [query, setQuery] = React.useState('');
  const [channelFilter, setChannelFilter] = React.useState('');
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [dialogMode, setDialogMode] = React.useState<EntityFormMode>('add');
  const [activePrompt, setActivePrompt] = React.useState<PromptRecord | null>(null);
  const [formValues, setFormValues] = React.useState<PromptFormValues>(emptyForm);
  const [promptText, setPromptText] = React.useState('');
  const [variablesJson, setVariablesJson] = React.useState('');
  const [formErrors, setFormErrors] = React.useState<Record<string, string>>({});
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);

  const loadPrompts = React.useCallback(async () => {
    clearFailure();
    try {
      const [result, grps] = await Promise.all([api.listPrompts(), api.listGroups().catch(() => [])]);
      setGroups((grps ?? []).map((g: Record<string, unknown>) => ({ id: Number(g.id), name: String(g.name ?? g.id) })));
      setPrompts(
        result.sort((left, right) => {
          const leftPriority = Number(left.priority ?? 0);
          const rightPriority = Number(right.priority ?? 0);
          if (leftPriority !== rightPriority) return rightPriority - leftPriority;
          return left.name.localeCompare(right.name);
        }),
      );
    } catch (error) {
      captureFailure(error);
    }
  }, [api, captureFailure, clearFailure]);

  React.useEffect(() => {
    void loadPrompts();
  }, [loadPrompts]);

  React.useEffect(() => {
    setPage(1);
  }, [channelFilter, query]);

  const channelOptions = React.useMemo(() => {
    const values = new Set(['email', 'sms', 'whatsapp', 'slack', 'teams']);
    for (const prompt of prompts) {
      if (prompt.channel_type?.trim()) values.add(prompt.channel_type.trim());
    }
    return Array.from(values).sort((left, right) => left.localeCompare(right));
  }, [prompts]);

  const filteredPrompts = prompts.filter((prompt) => {
    const matchesChannel = !channelFilter || (prompt.channel_type ?? '').toLowerCase() === channelFilter.toLowerCase();
    if (!matchesChannel) return false;
    if (!query.trim()) return true;
    const haystack = `${prompt.name} ${prompt.channel_type ?? ''} ${prompt.language ?? ''} ${prompt.keyword ?? ''}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  });

  const parsedVariablesState = React.useMemo(() => {
    if (!variablesJson.trim()) return { kind: 'empty' as const, value: null };
    try {
      return { kind: 'valid' as const, value: JSON.parse(variablesJson) };
    } catch (error) {
      return {
        kind: 'invalid' as const,
        value: error instanceof Error ? error.message : 'Variables JSON is invalid.',
      };
    }
  }, [variablesJson]);

  const deletePrompts = async (items: PromptRecord[]) => {
    clearFailure();
    setStatus('');
    try {
      for (const item of items) {
        await api.deletePrompt(item.id);
      }
      setStatus(`Deleted ${items.length} prompt${items.length === 1 ? '' : 's'}.`);
      if (activePrompt && items.some((item) => item.id === activePrompt.id)) {
        setDialogOpen(false);
        setActivePrompt(null);
      }
      await loadPrompts();
    } catch (error) {
      captureFailure(error);
    }
  };

  const duplicatePrompt = async (prompt: PromptRecord) => {
    clearFailure();
    setStatus('');
    try {
      await api.createPrompt({
        name: `${prompt.name}-copy-${Date.now()}`,
        channel_type: prompt.channel_type ?? undefined,
        group_id: prompt.group_id ?? undefined,
        language: prompt.language ?? undefined,
        keyword: prompt.keyword ?? undefined,
        variables_json: prompt.variables_json ?? undefined,
        priority: Number(prompt.priority ?? 0),
        enabled: toEnabledFlag(prompt.enabled),
        prompt_text: prompt.prompt_text,
      });
      setStatus(`Duplicated prompt ${prompt.name}.`);
      await loadPrompts();
    } catch (error) {
      captureFailure(error);
    }
  };

  const columns = React.useMemo<DataColumn<PromptRecord>[]>(() => [
    {
      id: 'name',
      header: 'Name',
      sortable: true,
      sortValue: (prompt) => prompt.name,
      cell: (prompt) => (
        <span className="cursor-pointer font-medium underline-offset-4 hover:underline" onClick={() => openDialog('view', prompt)}>
          {prompt.name}
        </span>
      ),
    },
    {
      id: 'channel_type',
      header: 'Channel',
      sortable: true,
      sortValue: (prompt) => prompt.channel_type ?? '',
      cell: (prompt) => <Badge variant="secondary">{prompt.channel_type ?? 'all'}</Badge>,
    },
    {
      id: 'language',
      header: 'Language',
      sortable: true,
      sortValue: (prompt) => prompt.language ?? '',
      cell: (prompt) => <Badge variant="secondary">{prompt.language ?? 'en'}</Badge>,
    },
    {
      id: 'keyword',
      header: 'Keyword',
      sortable: true,
      sortValue: (prompt) => prompt.keyword ?? '',
      cell: (prompt) => prompt.keyword ?? '',
    },
    {
      id: 'priority',
      header: 'Priority',
      sortable: true,
      sortValue: (prompt) => prompt.priority ?? 0,
      cell: (prompt) => String(prompt.priority ?? 0),
    },
    {
      id: 'updated_at',
      header: 'Updated',
      sortable: true,
      sortValue: (prompt) => prompt.updated_at ?? '',
      cell: (prompt) => prompt.updated_at ? <RelativeTime timestamp={prompt.updated_at} /> : 'N/A',
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: (prompt) => (
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => openDialog('edit', prompt)}>Edit</Button>
          <Button variant="secondary" onClick={() => void duplicatePrompt(prompt)}>Duplicate</Button>
          <Button variant="secondary" onClick={() => void deletePrompts([prompt])}>Delete</Button>
        </div>
      ),
    },
  ], [deletePrompts, duplicatePrompt]);

  const bulkActions = React.useMemo<BulkAction[]>(() => [
    { label: 'Delete selected', action: 'delete' },
    { label: 'Export', action: 'export' },
  ], []);

  const onBulkAction = React.useCallback((action: string, selectedIds: string[]) => {
    const items = filteredPrompts.filter((prompt) => selectedIds.includes(String(prompt.id)));
    if (action === 'delete') {
      void deletePrompts(items);
      return;
    }
    if (action === 'export') {
      downloadJson('notification-prompts.json', items);
    }
  }, [deletePrompts, filteredPrompts]);

  const openDialog = (mode: EntityFormMode, prompt?: PromptRecord) => {
    setDialogMode(mode);
    setActivePrompt(prompt ?? null);
    setFormErrors({});
    if (!prompt) {
      setFormValues(emptyForm);
      setPromptText('');
      setVariablesJson('');
    } else {
      setFormValues({
        name: prompt.name,
        channel_type: prompt.channel_type ?? 'email',
        group_id: prompt.group_id ? String(prompt.group_id) : '',
        language: prompt.language ?? 'en',
        keyword: prompt.keyword ?? '',
        priority: String(prompt.priority ?? 0),
        enabled: toEnabledFlag(prompt.enabled),
      });
      setPromptText(prompt.prompt_text);
      setVariablesJson(prompt.variables_json ?? '');
    }
    setDialogOpen(true);
  };

  const savePrompt = async () => {
    const errors = validate(formValues, promptText, variablesJson);
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    clearFailure();
    setStatus('');
    try {
      const payload = {
        name: formValues.name.trim(),
        channel_type: formValues.channel_type || undefined,
        group_id: formValues.group_id.trim() ? Number(formValues.group_id) : undefined,
        language: formValues.language.trim() || undefined,
        keyword: formValues.keyword.trim() || undefined,
        variables_json: variablesJson.trim() || undefined,
        priority: Number(formValues.priority || '0'),
        enabled: formValues.enabled,
        prompt_text: promptText,
      };

      if (dialogMode === 'add') {
        await api.createPrompt(payload);
        setStatus(`Created prompt ${payload.name}.`);
      } else if (activePrompt) {
        await api.updatePrompt(activePrompt.id, payload);
        setStatus(`Updated prompt ${activePrompt.name}.`);
      }

      await loadPrompts();
      setDialogOpen(false);
    } catch (error) {
      captureFailure(error);
    }
  };

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Prompts</h1>
      </header>

      {latestFailure ? <p role="alert" className="text-sm text-destructive">{latestFailure}</p> : null}
      {status ? <p role="status" className="text-sm text-foreground/80">{status}</p> : null}

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Prompt templates</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="flex-1">
              <Label htmlFor="prompts-search-adopted">Search prompts</Label>
              <Input
                id="prompts-search-adopted"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by prompt name, language or keyword"
              />
            </div>
            <div className="w-full md:w-56">
              <Label htmlFor="prompts-channel-filter-adopted">Channel type</Label>
              <Select id="prompts-channel-filter-adopted" value={channelFilter} onChange={(event) => setChannelFilter(event.target.value)}>
                <option value="">All channels</option>
                {channelOptions.map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </Select>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => void loadPrompts()}>Refresh</Button>
              <Button onClick={() => openDialog('add')}>Add prompt</Button>
            </div>
          </div>

          <DataTable
            tableId="notification-prompts"
            columns={columns}
            rows={filteredPrompts}
            totalRows={prompts.length}
            getRowId={(prompt) => String(prompt.id)}
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
            ? 'Add prompt'
            : dialogMode === 'edit'
              ? `Edit prompt ${activePrompt?.name ?? ''}`
              : `View prompt ${activePrompt?.name ?? ''}`
        }
        mode={dialogMode}
        fields={promptFields(dialogMode, groups.map((g) => String(g.id)))}
        values={formValues}
        errors={formErrors}
        onChange={(name, value) => {
          setFormValues((current) => ({
            ...current,
            [name]: name === 'enabled' ? Boolean(value) : String(value ?? ''),
          }));
        }}
        onSubmit={() => void savePrompt()}
        onCancel={() => setDialogOpen(false)}
      />

      {dialogOpen ? (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Prompt content</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="prompts-variables-json-adopted">Variables JSON schema</Label>
              <Textarea
                id="prompts-variables-json-adopted"
                rows={6}
                value={variablesJson}
                onChange={(event) => setVariablesJson(event.target.value)}
                disabled={dialogMode === 'view'}
              />
              {parsedVariablesState.kind === 'valid' ? (
                <JsonBlock title="Variables JSON preview" value={parsedVariablesState.value} defaultCollapsed={false} />
              ) : parsedVariablesState.kind === 'invalid' ? (
                <p role="alert" className="text-sm text-destructive">{parsedVariablesState.value}</p>
              ) : (
                <p className="text-xs text-muted-foreground">Use a JSON object to describe the variables available to the template editor and compose workflow.</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="prompts-text-adopted">Template text</Label>
              <Textarea
                id="prompts-text-adopted"
                rows={12}
                value={promptText}
                onChange={(event) => setPromptText(event.target.value)}
                disabled={dialogMode === 'view'}
              />
            </div>
            <p className="text-xs text-muted-foreground">Template variables use <code>{'{{variable}}'}</code> placeholders in the live backend prompt text.</p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
