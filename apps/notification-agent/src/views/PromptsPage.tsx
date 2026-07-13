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
import { Link } from 'react-router-dom';
import { Badge, Button, Card, CardContent, CardHeader, DataTable, EntityDialog, Input, JsonBlock, Label, RelativeTime, Select, Textarea, createDataTableActionColumn } from '@cloud-dog/ui';
import type { BulkAction, DataColumn, EntityFormMode } from '@cloud-dog/ui';
import { FileText, MessageSquare, Pencil, Copy, Trash2 } from 'lucide-react';
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
      // CX-103: first identifier column opens the view/edit dialog via a Link.
      cell: (prompt) => (
        <Link
          to={`/prompts?promptId=${encodeURIComponent(String(prompt.id))}`}
          className="font-medium text-primary underline-offset-4 hover:underline"
          aria-label={`View prompt ${prompt.name}`}
          onClick={(e) => { e.preventDefault(); openDialog('view', prompt); }}
        >
          {prompt.name}
        </Link>
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
    // CX-102 / CX-104: shared action-cell helper (Edit, Duplicate, Log, Delete).
    createDataTableActionColumn<PromptRecord>((prompt) => [
      {
        id: 'edit',
        label: 'Edit',
        icon: <Pencil className="h-4 w-4" />,
        onClick: () => openDialog('edit', prompt),
      },
      {
        id: 'duplicate',
        label: 'Duplicate',
        icon: <Copy className="h-4 w-4" />,
        onClick: () => void duplicatePrompt(prompt),
      },
      // NA-P-07: prompt -> Messages filtered by prompt name (Messages page
      // text-search matches against the prompt label embedded in the row).
      {
        id: 'messages',
        label: 'Messages',
        icon: <MessageSquare className="h-4 w-4" />,
        href: () => `/messages?prompt=${encodeURIComponent(prompt.name)}`,
        title: () => `View messages using prompt ${prompt.name}`,
      },
      {
        id: 'audit-log',
        label: 'Audit & Log',
        icon: <FileText className="h-4 w-4" />,
        href: () => `/diagnostics-audit?actor=${encodeURIComponent(prompt.name)}`,
        title: () => `View Audit & Log entries for prompt ${prompt.name}`,
      },
      {
        id: 'delete',
        label: 'Delete',
        icon: <Trash2 className="h-4 w-4" />,
        destructive: true,
        onClick: () => void deletePrompts([prompt]),
      },
    ]),
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
        <p className="text-xs text-muted-foreground">
          Runtime prompt selection consumes enabled prompts by channel, language, keyword, group, and priority.
        </p>
        {/* NA-P-05: surface which prompts are the current per-channel default
            (highest-priority enabled prompt for each channel_type). NA-P-08/09:
            this is the same view the backend prompt-selection path consumes
            (see notification-agent /webapi/proxy/prompts — sort by priority
            desc, channel/language filter applied at send time). */}
        {prompts.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            Default prompts in use (highest priority per channel type):
            {' '}
            {Object.entries(
              prompts
                .filter((p) => p.enabled === true || p.enabled === 1)
                .reduce<Record<string, PromptRecord>>((acc, p) => {
                  const ct = (p.channel_type ?? 'any').toLowerCase();
                  if (!acc[ct] || Number(p.priority ?? 0) > Number(acc[ct].priority ?? 0)) acc[ct] = p;
                  return acc;
                }, {}),
            )
              .map(([ct, p]) => `${ct}=${p.name} (lang ${p.language ?? 'en'}, priority ${p.priority ?? 0})`)
              .join('; ') || 'none enabled.'}
          </p>
        ) : null}
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

      {/* NA-P-01 / NA-P-02 / NA-P-06: Prompt view/edit/add dialog — body-mode
          so the prompt text + variables sit INSIDE the modal (previous version
          rendered them in a sibling Card that the modal overlay hid). For view
          mode the prompt text is read-only; for edit/add it's editable.
          NA-P-03: when adding, the dialog can pre-seed from the channel filter. */}
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
        body={(
          <div className="space-y-4">
            <div className="flex items-start justify-end -mt-2">
              <Button type="button" variant="secondary" size="sm" aria-label="Close" onClick={() => setDialogOpen(false)}>
                Close
              </Button>
            </div>

            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                void savePrompt();
              }}
            >
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="prompts-form-name">Name</Label>
                  <Input id="prompts-form-name" value={formValues.name} onChange={(event) => setFormValues((current) => ({ ...current, name: event.target.value }))} disabled={dialogMode === 'view'} />
                  {formErrors.name ? <p className="text-sm text-destructive">{formErrors.name}</p> : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="prompts-form-channel-type">Channel type</Label>
                  <Select id="prompts-form-channel-type" value={formValues.channel_type} onChange={(event) => setFormValues((current) => ({ ...current, channel_type: event.target.value }))} disabled={dialogMode === 'view'}>
                    {['email', 'sms', 'whatsapp', 'slack', 'teams'].map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="prompts-form-language">Language</Label>
                  <Select id="prompts-form-language" value={formValues.language} onChange={(event) => setFormValues((current) => ({ ...current, language: event.target.value }))} disabled={dialogMode === 'view'}>
                    {LANGUAGE_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="prompts-form-group">Group</Label>
                  <Select id="prompts-form-group" value={formValues.group_id} onChange={(event) => setFormValues((current) => ({ ...current, group_id: event.target.value }))} disabled={dialogMode === 'view'}>
                    <option value="">— none —</option>
                    {groups.map((g) => <option key={g.id} value={String(g.id)}>{g.name}</option>)}
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="prompts-form-keyword">Keyword</Label>
                  <Input id="prompts-form-keyword" value={formValues.keyword} onChange={(event) => setFormValues((current) => ({ ...current, keyword: event.target.value }))} disabled={dialogMode === 'view'} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="prompts-form-priority">Priority</Label>
                  <Input id="prompts-form-priority" type="number" value={formValues.priority} onChange={(event) => setFormValues((current) => ({ ...current, priority: event.target.value }))} disabled={dialogMode === 'view'} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="prompts-form-enabled">Enabled</Label>
                  <Select id="prompts-form-enabled" value={String(formValues.enabled)} onChange={(event) => setFormValues((current) => ({ ...current, enabled: event.target.value === 'true' }))} disabled={dialogMode === 'view'}>
                    <option value="true">Enabled</option>
                    <option value="false">Disabled</option>
                  </Select>
                </div>
              </div>

              {/* NA-P-01: Prompt body — visible in view mode (read-only), editable in edit/add. */}
              <div className="space-y-2 border-t pt-3">
                <Label htmlFor="prompts-text-adopted">Template text</Label>
                <Textarea
                  id="prompts-text-adopted"
                  rows={12}
                  value={promptText}
                  onChange={(event) => setPromptText(event.target.value)}
                  disabled={dialogMode === 'view'}
                  placeholder="Enter the prompt template body. Use {{variable}} placeholders."
                />
                <p className="text-xs text-muted-foreground">Template variables use <code>{'{{variable}}'}</code> placeholders in the live backend prompt text.</p>
              </div>

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

              {dialogMode !== 'view' ? (
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="secondary" onClick={() => setDialogOpen(false)}>Cancel</Button>
                  <Button type="submit">Save changes</Button>
                </div>
              ) : null}
            </form>
          </div>
        )}
      />
    </div>
  );
}
