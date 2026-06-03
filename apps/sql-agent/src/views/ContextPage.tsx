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

// @cloud-dog/app-sql-agent — Data context and metadata workspace.

// Covers: FR-55
// Covers: FR-91
// Covers: FR-92
// Covers: FR-93
// Covers: FR-94
// Covers: FR-95
// Covers: FR-96
// Covers: FR-97
// Covers: FR-100
// Covers: FR-101
// Covers: FR-102
// Covers: FR-103

import * as React from 'react';
import { useConfig } from '@cloud-dog/config';
import {
  Button,
  CodeEditor,
  DataTable,
  DocumentViewer,
  Input,
  JsonExplorer,
  type DataColumn,
} from '@cloud-dog/ui';
import {
  DataList,
  EmptyState,
  ErrorState,
  LoadingState,
  MetricTile,
  PageFrame,
  PanelCard,
  StatusBadge,
  downloadJsonFile,
  extractContextFields,
  extractRelationships,
  extractSampleRows,
  getTableName,
  normaliseContextTables,
  requestJson,
  safeStringify,
  useApiResource,
  type ContextFieldRecord,
  type ContextValidationResponse,
  type GenericRecord,
} from '../lib/sqlAgentApi';

type AppRuntimeConfig = {
  API_BASE_URL: string;
};

type ContextResponse = {
  database?: GenericRecord;
  tables?: unknown;
  metadata_text?: string;
  table_count?: number;
  timestamp?: string;
  version?: string;
};

type SystemContextResponse = {
  text?: string;
  length?: number;
};

type I18nStatus = {
  default?: string;
  supported?: string[];
  prebuild?: string[];
  built?: string[];
  enabled_tables?: number;
  enforce_built?: boolean;
  cache_dir?: string;
  last_saved_stage?: string;
  timestamp?: string;
  error?: string;
};

type MetadataTextResponse = {
  success?: boolean;
  metadata_uri?: string;
  metadata_uri_exists?: boolean;
  metadata_text?: string;
  inline_metadata_text?: string;
};

type MetadataRecordResponse = {
  success?: boolean;
  table_name?: string;
  record?: GenericRecord | null;
};

type ActionResult = {
  success?: boolean;
  message?: string;
  error?: string;
  validation?: unknown;
};

type HealthResponse = {
  ready?: boolean;
  status?: string;
  message?: string;
  context_progress?: GenericRecord;
  context_validation?: {
    status?: string;
    errors?: number;
    warnings?: number;
    message?: string;
  };
};

type ZeroAsMissingConfig = {
  min_confidence?: number;
  note?: string;
  error?: string;
  success?: boolean;
  message?: string;
};

type FieldGapRow = {
  id: string;
  field: string;
  gapType: string;
  currentValue: string;
};

const NON_FATAL_ACTION_MESSAGES = [
  /^no cached context to mark stale$/i,
  /^no cached context available$/i,
  /^all tables meet minimum requirements$/i,
];

function joinList(values: unknown): string {
  if (!Array.isArray(values)) return '—';
  if (values.length === 0) return '—';
  return values.map((item) => String(item)).join(', ');
}

function toValidationIssueRows(value: unknown): GenericRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((issue, index) => {
    if (issue && typeof issue === 'object') {
      return {
        id: index,
        ...(issue as GenericRecord),
      };
    }

    return {
      id: index,
      message: String(issue),
    };
  });
}

function formatDuration(value: unknown): string {
  const seconds = Number(value ?? 0);
  if (!Number.isFinite(seconds) || seconds <= 0) return '0s';
  const totalSeconds = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(totalSeconds / 60);
  const remainderSeconds = totalSeconds % 60;
  if (minutes <= 0) return `${remainderSeconds}s`;
  return `${minutes}m ${remainderSeconds}s`;
}

function deriveCurrentTable(health: HealthResponse | null): string {
  const contextProgress = health?.context_progress;
  if (!contextProgress || typeof contextProgress !== 'object') return '';
  const explicit = String(contextProgress.current_table ?? '').trim();
  if (explicit) return explicit;

  const message = String(contextProgress.message ?? health?.message ?? '').trim();
  if (!message.includes(' - ')) return '';
  const candidate = message.split(' - ').pop()?.trim() ?? '';
  if (!candidate) return '';
  if (candidate.toLowerCase().startsWith('processing ')) {
    return candidate.slice(11).trim();
  }
  if (candidate.toLowerCase().startsWith('completed ')) {
    return candidate.slice(10).trim();
  }
  return candidate;
}

function buildFieldGapRows(fields: ContextFieldRecord[]): FieldGapRow[] {
  const rows: FieldGapRow[] = [];
  fields.forEach((field) => {
    if (!field.description?.trim()) {
      rows.push({
        id: `${field.name}-description`,
        field: field.name,
        gapType: 'Missing description',
        currentValue: '—',
      });
    }
    if (!Array.isArray(field.keywords) || field.keywords.length === 0) {
      rows.push({
        id: `${field.name}-keywords`,
        field: field.name,
        gapType: 'Missing keywords',
        currentValue: Array.isArray(field.keywords) && field.keywords.length > 0 ? field.keywords.join(', ') : '—',
      });
    }
    if (!Array.isArray(field.triggerWords) || field.triggerWords.length === 0) {
      rows.push({
        id: `${field.name}-trigger-words`,
        field: field.name,
        gapType: 'Missing trigger words',
        currentValue:
          Array.isArray(field.triggerWords) && field.triggerWords.length > 0 ? field.triggerWords.join(', ') : '—',
      });
    }
  });
  return rows;
}

export function ContextPage() {
  const cfg = useConfig<AppRuntimeConfig>();
  const [tablePage, setTablePage] = React.useState(1);
  const [tablePageSize, setTablePageSize] = React.useState(10);
  const [fieldPage, setFieldPage] = React.useState(1);
  const [fieldPageSize, setFieldPageSize] = React.useState(10);
  const [tableFilter, setTableFilter] = React.useState('');
  const [selectedTableName, setSelectedTableName] = React.useState('');
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [actionMessage, setActionMessage] = React.useState<string | null>(null);
  const [tableValidation, setTableValidation] = React.useState<GenericRecord | null>(null);
  const [languageInput, setLanguageInput] = React.useState('');
  const [metadataTextState, setMetadataTextState] = React.useState<MetadataTextResponse | null>(null);
  const [metadataTextDraft, setMetadataTextDraft] = React.useState('');
  const [metadataTextError, setMetadataTextError] = React.useState<string | null>(null);
  const [tableMetadataState, setTableMetadataState] = React.useState<MetadataRecordResponse | null>(null);
  const [tableMetadataDraft, setTableMetadataDraft] = React.useState('{}');
  const [tableMetadataError, setTableMetadataError] = React.useState<string | null>(null);
  const [healthState, setHealthState] = React.useState<HealthResponse | null>(null);
  const [healthError, setHealthError] = React.useState<string | null>(null);
  const [zeroAsMissingConfig, setZeroAsMissingConfig] = React.useState<ZeroAsMissingConfig | null>(null);
  const [zeroAsMissingDraft, setZeroAsMissingDraft] = React.useState('0.6');
  const [zeroAsMissingError, setZeroAsMissingError] = React.useState<string | null>(null);

  const context = useApiResource<ContextResponse>(
    () => requestJson(cfg.API_BASE_URL, '/api/v1/context/full'),
    [cfg.API_BASE_URL],
  );
  const validation = useApiResource<ContextValidationResponse>(
    () => requestJson(cfg.API_BASE_URL, '/api/v1/context/validate'),
    [cfg.API_BASE_URL],
  );
  const databaseValidation = useApiResource<GenericRecord>(
    () => requestJson(cfg.API_BASE_URL, '/api/v1/context/validate/database'),
    [cfg.API_BASE_URL],
  );
  const keywordsValidation = useApiResource<GenericRecord>(
    () => requestJson(cfg.API_BASE_URL, '/api/v1/context/validate/keywords'),
    [cfg.API_BASE_URL],
  );
  const systemValidation = useApiResource<GenericRecord>(
    () => requestJson(cfg.API_BASE_URL, '/api/v1/context/validate/system_context'),
    [cfg.API_BASE_URL],
  );
  const systemContext = useApiResource<SystemContextResponse>(
    () => requestJson(cfg.API_BASE_URL, '/api/v1/context/system_summary'),
    [cfg.API_BASE_URL],
  );
  const i18n = useApiResource<I18nStatus>(
    () => requestJson(cfg.API_BASE_URL, '/api/v1/context/i18n/status'),
    [cfg.API_BASE_URL],
  );

  const tables = React.useMemo(
    () => normaliseContextTables(context.data?.tables),
    [context.data?.tables],
  );

  const filteredTables = React.useMemo(() => {
    const needle = tableFilter.trim().toLowerCase();
    if (!needle) return tables;
    return tables.filter((table) => safeStringify(table).toLowerCase().includes(needle));
  }, [tableFilter, tables]);

  const selectedTable = React.useMemo(
    () => filteredTables.find((table) => getTableName(table) === selectedTableName) ?? null,
    [filteredTables, selectedTableName],
  );

  const fieldRows = React.useMemo(
    () => (selectedTable ? extractContextFields(selectedTable) : []),
    [selectedTable],
  );
  const relationshipRows = React.useMemo(
    () => (selectedTable ? extractRelationships(selectedTable) : []),
    [selectedTable],
  );
  const sampleRows = React.useMemo(
    () => (selectedTable ? extractSampleRows(selectedTable) : []),
    [selectedTable],
  );

  const supportedLanguages = React.useMemo(
    () => (Array.isArray(i18n.data?.supported) ? i18n.data?.supported : []),
    [i18n.data?.supported],
  );
  const builtLanguages = React.useMemo(
    () => (Array.isArray(i18n.data?.built) ? i18n.data?.built : []),
    [i18n.data?.built],
  );
  const languageRows = React.useMemo(
    () =>
      supportedLanguages.map((language) => ({
        language,
        built: builtLanguages.includes(language),
        prebuild: Array.isArray(i18n.data?.prebuild) ? i18n.data.prebuild.includes(language) : false,
        default: language === i18n.data?.default,
      })),
    [builtLanguages, i18n.data?.default, i18n.data?.prebuild, supportedLanguages],
  );

  const validationIssueRows = React.useMemo(
    () => toValidationIssueRows(tableValidation?.errors),
    [tableValidation],
  );
  const fieldGapRows = React.useMemo(() => buildFieldGapRows(fieldRows), [fieldRows]);

  React.useEffect(() => {
    if (filteredTables.length === 0) {
      setSelectedTableName('');
      return;
    }

    if (!filteredTables.some((table) => getTableName(table) === selectedTableName)) {
      setSelectedTableName(getTableName(filteredTables[0]));
    }
  }, [filteredTables, selectedTableName]);

  React.useEffect(() => {
    setFieldPage(1);
  }, [selectedTableName]);

  React.useEffect(() => {
    let cancelled = false;

    requestJson<MetadataTextResponse>(cfg.API_BASE_URL, '/api/v1/admin/metadata/text')
      .then((payload) => {
        if (cancelled) return;
        setMetadataTextState(payload);
        setMetadataTextDraft(payload.metadata_text ?? '');
        setMetadataTextError(null);
      })
      .catch((error) => {
        if (cancelled) return;
        setMetadataTextState(null);
        setMetadataTextDraft('');
        setMetadataTextError(error instanceof Error ? error.message : String(error));
      });

    return () => {
      cancelled = true;
    };
  }, [cfg.API_BASE_URL]);

  React.useEffect(() => {
    if (!selectedTableName) {
      setTableMetadataState(null);
      setTableMetadataDraft('{}');
      return;
    }

    let cancelled = false;

    requestJson<MetadataRecordResponse>(
      cfg.API_BASE_URL,
      `/api/v1/admin/metadata/records/${encodeURIComponent(selectedTableName)}`,
    )
      .then((payload) => {
        if (cancelled) return;
        setTableMetadataState(payload);
        setTableMetadataDraft(
          safeStringify(
            payload.record ?? {
              title: '',
              description: '',
              source: '',
              creator: '',
              url: '',
              notes: '',
            },
          ),
        );
        setTableMetadataError(null);
      })
      .catch((error) => {
        if (cancelled) return;
        setTableMetadataState(null);
        setTableMetadataDraft('{}');
        setTableMetadataError(error instanceof Error ? error.message : String(error));
      });

    return () => {
      cancelled = true;
    };
  }, [cfg.API_BASE_URL, selectedTableName]);

  const loadHealthState = React.useCallback(async () => {
    try {
      const payload = await requestJson<HealthResponse>(cfg.API_BASE_URL, '/api/v1/health');
      setHealthState(payload);
      setHealthError(null);
    } catch (error) {
      setHealthError(error instanceof Error ? error.message : String(error));
    }
  }, [cfg.API_BASE_URL]);

  const loadZeroAsMissingConfig = React.useCallback(async () => {
    try {
      const payload = await requestJson<ZeroAsMissingConfig>(cfg.API_BASE_URL, '/api/v1/config/zero_as_missing');
      setZeroAsMissingConfig(payload);
      setZeroAsMissingDraft(`${payload.min_confidence ?? 0.6}`);
      setZeroAsMissingError(null);
    } catch (error) {
      setZeroAsMissingError(error instanceof Error ? error.message : String(error));
    }
  }, [cfg.API_BASE_URL]);

  React.useEffect(() => {
    void loadHealthState();
    const intervalId = window.setInterval(() => {
      void loadHealthState();
    }, 3000);
    return () => window.clearInterval(intervalId);
  }, [loadHealthState]);

  React.useEffect(() => {
    void loadZeroAsMissingConfig();
  }, [loadZeroAsMissingConfig]);

  const refreshAll = React.useCallback(() => {
    context.refresh();
    validation.refresh();
    databaseValidation.refresh();
    keywordsValidation.refresh();
    systemValidation.refresh();
    systemContext.refresh();
    i18n.refresh();
    void loadHealthState();
    void loadZeroAsMissingConfig();
  }, [
    context,
    databaseValidation,
    i18n,
    keywordsValidation,
    loadHealthState,
    loadZeroAsMissingConfig,
    systemContext,
    systemValidation,
    validation,
  ]);

  const runAction = React.useCallback(
    async (runner: () => Promise<ActionResult>, successMessage: string) => {
      setActionError(null);
      setActionMessage(null);
      try {
        const payload = await runner();
        if (payload.success === false) {
          const responseMessage = payload.message || payload.error || 'Request failed';
          if (NON_FATAL_ACTION_MESSAGES.some((pattern) => pattern.test(responseMessage))) {
            setActionMessage(responseMessage);
            refreshAll();
            return;
          }
          throw new Error(responseMessage);
        }
        setActionMessage(payload.message || successMessage);
        refreshAll();
      } catch (error) {
        setActionError(error instanceof Error ? error.message : String(error));
      }
    },
    [refreshAll],
  );

  const tableColumns = React.useMemo<DataColumn<GenericRecord>[]>(
    () => [
      {
        id: 'name',
        header: 'Table',
        cell: (row) => (
          <Button
            onClick={() => setSelectedTableName(getTableName(row))}
            type="button"
            variant="link"
          >
            {getTableName(row)}
          </Button>
        ),
        sortable: true,
        sortValue: (row) => getTableName(row),
      },
      {
        id: 'description',
        header: 'Description',
        cell: (row) => `${row.description ?? row.title ?? 'No description provided'}`,
      },
      {
        id: 'fields',
        header: 'Fields',
        cell: (row) => `${extractContextFields(row).length}`,
        sortable: true,
        sortValue: (row) => extractContextFields(row).length,
      },
      {
        id: 'keywords',
        header: 'Keywords',
        cell: (row) => `${Array.isArray(row.keywords) ? row.keywords.length : 0}`,
        sortable: true,
        sortValue: (row) => (Array.isArray(row.keywords) ? row.keywords.length : 0),
      },
      {
        id: 'relationships',
        header: 'Relationships',
        cell: (row) => `${extractRelationships(row).length}`,
        sortable: true,
        sortValue: (row) => extractRelationships(row).length,
      },
    ],
    [],
  );

  const fieldColumns = React.useMemo<DataColumn<ContextFieldRecord>[]>(
    () => [
      {
        id: 'name',
        header: 'Field',
        cell: (row) => row.name,
        sortable: true,
        sortValue: (row) => row.name,
      },
      {
        id: 'type',
        header: 'Type',
        cell: (row) => row.type,
        sortable: true,
        sortValue: (row) => row.type,
      },
      {
        id: 'nullable',
        header: 'Nullable',
        cell: (row) => (row.nullable == null ? '—' : row.nullable ? 'yes' : 'no'),
      },
      {
        id: 'indexed',
        header: 'Indexed',
        cell: (row) => (row.indexed == null ? '—' : row.indexed ? 'yes' : 'no'),
      },
      {
        id: 'description',
        header: 'Description',
        cell: (row) => row.description ?? '—',
      },
    ],
    [],
  );

  const relationshipColumns = React.useMemo<DataColumn<GenericRecord>[]>(
    () => [
      {
        id: 'table',
        header: 'Related Table',
        cell: (row) => `${row.table ?? '—'}`,
      },
      {
        id: 'type',
        header: 'Type',
        cell: (row) => `${row.type ?? 'relationship'}`,
      },
      {
        id: 'note',
        header: 'Note',
        cell: (row) => `${row.note ?? '—'}`,
      },
    ],
    [],
  );

  const sampleColumns = React.useMemo<DataColumn<GenericRecord>[]>(() => {
    const keys = new Set<string>();
    sampleRows.slice(0, 5).forEach((row) => {
      Object.keys(row).forEach((key) => keys.add(key));
    });
    return Array.from(keys).map((key) => ({
      id: key,
      header: key,
      cell: (row) => `${row[key] ?? ''}`,
    }));
  }, [sampleRows]);

  const issueColumns = React.useMemo<DataColumn<GenericRecord>[]>(
    () => [
      { id: 'table', header: 'Table', cell: (row) => `${row.table ?? row.table_name ?? '—'}` },
      { id: 'field', header: 'Field', cell: (row) => `${row.field ?? row.field_name ?? '—'}` },
      { id: 'message', header: 'Message', cell: (row) => `${row.message ?? row.error ?? safeStringify(row)}` },
    ],
    [],
  );

  const fieldGapColumns = React.useMemo<DataColumn<FieldGapRow>[]>(
    () => [
      {
        id: 'field',
        header: 'Field',
        cell: (row) => row.field,
        sortable: true,
        sortValue: (row) => row.field,
      },
      {
        id: 'gapType',
        header: 'Gap Type',
        cell: (row) => row.gapType,
        sortable: true,
        sortValue: (row) => row.gapType,
      },
      {
        id: 'currentValue',
        header: 'Current Value',
        cell: (row) => row.currentValue,
      },
    ],
    [],
  );

  const languageColumns = React.useMemo<DataColumn<GenericRecord>[]>(
    () => [
      {
        id: 'language',
        header: 'Language',
        cell: (row) => `${row.language ?? '—'}`,
        sortable: true,
        sortValue: (row) => `${row.language ?? ''}`,
      },
      {
        id: 'state',
        header: 'Built',
        cell: (row) => <StatusBadge value={row.built ? 'built' : 'pending'} />,
      },
      {
        id: 'prebuild',
        header: 'Prebuild',
        cell: (row) => (row.prebuild ? 'yes' : 'no'),
      },
      {
        id: 'actions',
        header: '',
        cell: (row) => (
          <div className="flex gap-2">
            <Button
              onClick={() => {
                const language = `${row.language ?? ''}`;
                if (!language) return;
                setLanguageInput(language);
                void runAction(
                  () =>
                    requestJson<ActionResult>(cfg.API_BASE_URL, '/api/v1/context/i18n/build', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ language, background: true }),
                    }),
                  `Built i18n language '${language}'.`,
                );
              }}
              type="button"
              variant="outline"
            >
              Build
            </Button>
            <Button
              onClick={() => {
                const language = `${row.language ?? ''}`;
                if (!language) return;
                void runAction(
                  () =>
                    requestJson<ActionResult>(cfg.API_BASE_URL, '/api/v1/context/i18n/remove', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ language }),
                    }),
                  `Removed i18n language '${language}'.`,
                );
              }}
              type="button"
              variant="destructive"
            >
              Remove
            </Button>
          </div>
        ),
      },
    ],
    [cfg.API_BASE_URL, runAction],
  );

  const healthProgress = React.useMemo(
    () => (healthState?.context_progress && typeof healthState.context_progress === 'object' ? healthState.context_progress : {}),
    [healthState?.context_progress],
  );
  const currentBuildTable = React.useMemo(() => deriveCurrentTable(healthState), [healthState]);
  const progressTableTotal = Number(healthProgress.total_tables ?? 0);
  const progressTablesCompleted = Number(healthProgress.tables_completed ?? 0);
  const progressElapsed = formatDuration(healthProgress.elapsed_seconds);
  const validationErrors = Number(healthState?.context_validation?.errors ?? 0);
  const validationWarnings = Number(healthState?.context_validation?.warnings ?? 0);
  const zeroAsMissingEnabled = Number(zeroAsMissingConfig?.min_confidence ?? 0) > 0;

  return (
    <PageFrame
      eyebrow="FR-55 / FR-91 / FR-95 / FR-96 / FR-100"
      title="Data Context"
      description="Inspect database metadata, drill into per-table context, rebuild stale context from the WebUI, manage i18n language state, and edit database metadata through the authenticated web proxy."
      actions={
        <Button onClick={refreshAll} type="button" variant="outline">
          Refresh context
        </Button>
      }
    >
      <div className="grid gap-4 xl:grid-cols-4">
        <MetricTile label="Context tables" value={tables.length} />
        <MetricTile label="Validation" value={<StatusBadge value={validation.data?.status} />} />
        <MetricTile label="Built languages" value={builtLanguages.length} />
        <MetricTile label="I18n coverage" value={`${supportedLanguages.length === 0 ? 0 : Math.round((builtLanguages.length / supportedLanguages.length) * 100)}%`} />
      </div>

      <PanelCard
        title="Context build progress"
        subtitle="Live build and rebuild progress from `/api/v1/health`, including per-table progress, current table, elapsed time, and validation counts."
      >
        {healthError ? <ErrorState message={healthError} /> : null}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <MetricTile label="Build status" value={<StatusBadge value={(healthProgress.phase as string | undefined) ?? healthState?.status} />} />
          <MetricTile
            label="Tables complete"
            value={
              progressTableTotal > 0
                ? `${progressTablesCompleted} / ${progressTableTotal}`
                : `${healthState?.ready ? tables.length : 0} / ${tables.length || 0}`
            }
          />
          <MetricTile label="Current table" value={currentBuildTable || '—'} />
          <MetricTile label="Elapsed" value={progressElapsed} />
          <MetricTile label="Errors / warnings" value={`${validationErrors} / ${validationWarnings}`} />
        </div>
        <div className="mt-4">
          <DataList
            items={[
              { label: 'Message', value: healthState?.message ?? '—' },
              { label: 'Progress', value: `${Number(healthProgress.percentage ?? 0).toFixed(1)}%` },
              { label: 'ETA', value: formatDuration(healthProgress.eta_seconds) },
              {
                label: 'Validation status',
                value: healthState?.context_validation?.status ? (
                  <StatusBadge value={healthState.context_validation.status} />
                ) : (
                  '—'
                ),
              },
            ]}
          />
        </div>
      </PanelCard>

      {actionMessage ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{actionMessage}</div> : null}
      {actionError ? <ErrorState message={actionError} /> : null}

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <PanelCard id="panelContext" title="Context inventory" subtitle="Filter and drill into the loaded tables without dumping the whole context as raw JSON.">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <Input
              className="max-w-sm"
              onChange={(event) => setTableFilter(event.target.value)}
              placeholder="Filter tables, keywords, or descriptions"
              value={tableFilter}
            />
            <Button
              onClick={() => {
                void runAction(
                  () =>
                    requestJson<ActionResult>(cfg.API_BASE_URL, '/api/v1/context/rebuild', {
                      method: 'POST',
                    }),
                  'Started full context rebuild.',
                );
              }}
              type="button"
            >
              Rebuild all
            </Button>
            <Button
              onClick={() => {
                if (!selectedTableName) return;
                void requestJson<GenericRecord>(cfg.API_BASE_URL, `/api/v1/context/validate/${encodeURIComponent(selectedTableName)}`)
                  .then((payload) => {
                    setTableValidation(payload);
                    setActionError(null);
                    setActionMessage(`Validated table '${selectedTableName}'.`);
                  })
                  .catch((error) => setActionError(error instanceof Error ? error.message : String(error)));
              }}
              type="button"
              variant="outline"
            >
              Validate selected table
            </Button>
            <Button
              disabled={!selectedTableName}
              onClick={() => {
                if (!selectedTableName) return;
                void runAction(
                  () =>
                    requestJson<ActionResult>(cfg.API_BASE_URL, `/api/v1/context/rebuild/${encodeURIComponent(selectedTableName)}`, {
                      method: 'POST',
                    }),
                  `Rebuilt table '${selectedTableName}'.`,
                );
              }}
              type="button"
              variant="outline"
            >
              Rebuild selected table
            </Button>
          </div>

          {context.loading ? <LoadingState label="context inventory" /> : null}
          {context.error ? <ErrorState message={context.error} /> : null}
          {!context.loading && !context.error ? (
            <DataTable
              columns={tableColumns}
              rows={filteredTables}
              emptyMessage="No context tables available."
              getRowId={(row) => getTableName(row)}
              page={tablePage}
              pageSize={tablePageSize}
              onPageChange={setTablePage}
              onPageSizeChange={setTablePageSize}
              columnPickerEnabled
              tableId="sql-agent-context-tables"
            />
          ) : null}
        </PanelCard>

        <PanelCard title="Selected table" subtitle="Field inventory, relationships, sample rows, validation output, and metadata editor for the active table.">
          {!selectedTable ? (
            <EmptyState title="No table selected" body="Select a table from the inventory to inspect fields, validation, sample rows, and metadata." />
          ) : (
            <div className="space-y-6">
              <DataList
                items={[
                  { label: 'Table', value: getTableName(selectedTable) },
                  { label: 'Fields', value: fieldRows.length },
                  { label: 'Relationships', value: relationshipRows.length },
                  { label: 'Sample rows', value: sampleRows.length },
                ]}
              />

              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => {
                    void runAction(
                      () =>
                        requestJson<ActionResult>(cfg.API_BASE_URL, `/api/v1/context/mark_stale/${encodeURIComponent(getTableName(selectedTable))}`, {
                          method: 'POST',
                        }),
                      `Marked '${getTableName(selectedTable)}' stale.`,
                    );
                  }}
                  type="button"
                  variant="outline"
                >
                  Mark stale
                </Button>
                <Button
                  onClick={() => {
                    void runAction(
                      () =>
                        requestJson<ActionResult>(cfg.API_BASE_URL, '/api/v1/context/fill_gaps', {
                          method: 'POST',
                        }),
                      'Gap fill completed.',
                    );
                  }}
                  type="button"
                  variant="outline"
                >
                  Gap fill
                </Button>
                <Button
                  onClick={() => {
                    if (!selectedTable) return;
                    downloadJsonFile(`${getTableName(selectedTable)}-context.json`, selectedTable);
                  }}
                  type="button"
                  variant="outline"
                >
                  Download table JSON
                </Button>
              </div>

              <DataTable
                columns={fieldColumns}
                rows={fieldRows}
                emptyMessage="No fields available for the selected table."
                getRowId={(row) => row.name}
                page={fieldPage}
                pageSize={fieldPageSize}
                onPageChange={setFieldPage}
                onPageSizeChange={setFieldPageSize}
                columnPickerEnabled
                tableId="sql-agent-context-fields"
              />

              <div className="space-y-3">
                <div>
                  <h3 className="text-lg font-semibold text-slate-950">Field gaps</h3>
                  <p className="text-sm text-slate-600">
                    Identify fields that still need descriptions, keywords, or trigger-word enrichment.
                  </p>
                </div>
                <DataTable
                  columns={fieldGapColumns}
                  rows={fieldGapRows}
                  emptyMessage="No field enrichment gaps detected for the selected table."
                  getRowId={(row) => row.id}
                  tableId="sql-agent-context-field-gaps"
                />
              </div>

              {relationshipRows.length > 0 ? (
                <DataTable
                  columns={relationshipColumns}
                  rows={relationshipRows}
                  emptyMessage="No relationships available."
                  getRowId={(row, index) => `${row.table ?? 'relationship'}-${index}`}
                  tableId="sql-agent-context-relationships"
                />
              ) : null}

              {sampleRows.length > 0 && sampleColumns.length > 0 ? (
                <DataTable
                  columns={sampleColumns}
                  rows={sampleRows.slice(0, 5)}
                  emptyMessage="No sample rows available."
                  getRowId={(row, index) => `${getTableName(selectedTable)}-sample-${index}-${safeStringify(row)}`}
                  tableId="sql-agent-context-samples"
                />
              ) : null}

              {validationIssueRows.length > 0 ? (
                <DataTable
                  columns={issueColumns}
                  rows={validationIssueRows}
                  emptyMessage="No validation issues for the selected table."
                  getRowId={(row) => `${row.id ?? row.message ?? Math.random()}`}
                  tableId="sql-agent-context-validation-issues"
                />
              ) : null}

              {tableValidation ? <JsonExplorer data={tableValidation} title="Selected table validation" defaultExpanded /> : null}

              {tableMetadataState ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-lg font-semibold text-slate-950">Per-table metadata</h3>
                    <Button
                      onClick={() => {
                        try {
                          const payload = JSON.parse(tableMetadataDraft) as GenericRecord;
                          void requestJson<ActionResult>(
                            cfg.API_BASE_URL,
                            `/api/v1/admin/metadata/records/${encodeURIComponent(getTableName(selectedTable))}?rebuild=true`,
                            {
                              method: 'PUT',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify(payload),
                            },
                          )
                            .then((payload) => {
                              setTableMetadataError(null);
                              setActionMessage(payload.message || `Saved metadata record for '${getTableName(selectedTable)}'.`);
                              refreshAll();
                            })
                            .catch((error) => setTableMetadataError(error instanceof Error ? error.message : String(error)));
                        } catch (error) {
                          setTableMetadataError(error instanceof Error ? error.message : String(error));
                        }
                      }}
                      type="button"
                    >
                      Save metadata record
                    </Button>
                  </div>
                  {tableMetadataError ? <ErrorState message={tableMetadataError} /> : null}
                  <CodeEditor
                    value={tableMetadataDraft}
                    onChange={setTableMetadataDraft}
                    language="json"
                    height={280}
                  />
                  <JsonExplorer data={tableMetadataState.record ?? {}} title="Current metadata record" defaultExpanded />
                </div>
              ) : null}
            </div>
          )}
        </PanelCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <PanelCard title="System context" subtitle="Rendered `system_context.md` plus regeneration from the WebUI.">
          <div className="mb-4 flex flex-wrap gap-2">
            <Button
              onClick={() => {
                void runAction(
                  () =>
                    requestJson<ActionResult>(cfg.API_BASE_URL, '/api/v1/context/rebuild_system_context', {
                      method: 'POST',
                    }),
                  'Regenerated system context.',
                );
              }}
              type="button"
            >
              Regenerate system context
            </Button>
            <Button
              onClick={() => {
                void runAction(
                  () =>
                    requestJson<ActionResult>(cfg.API_BASE_URL, '/api/v1/context/rebuild_database_metadata', {
                      method: 'POST',
                    }),
                  'Rebuilt database metadata.',
                );
              }}
              type="button"
              variant="outline"
            >
              Rebuild database metadata
            </Button>
          </div>

          {systemContext.loading ? <LoadingState label="system context" /> : null}
          {systemContext.error ? <ErrorState message={systemContext.error} /> : null}
          {systemContext.data?.text ? (
            <DocumentViewer
              content={systemContext.data.text}
              downloadFilename="system_context.md"
              format="markdown"
              title="system_context.md"
            />
          ) : null}
        </PanelCard>

        <PanelCard title="Validation workspace" subtitle="Database, keyword, and system-context validation snapshots.">
          <div className="grid gap-4 md:grid-cols-3">
            <MetricTile label="Database validation" value={<StatusBadge value={databaseValidation.data?.status as string | undefined} />} />
            <MetricTile label="Keyword validation" value={<StatusBadge value={keywordsValidation.data?.status as string | undefined} />} />
            <MetricTile label="System context" value={<StatusBadge value={systemValidation.data?.status as string | undefined} />} />
          </div>
          <div className="mt-6 space-y-4">
            {context.data?.database ? <JsonExplorer data={context.data.database} title="Database overview" defaultExpanded /> : null}
            {databaseValidation.data ? <JsonExplorer data={databaseValidation.data} title="Database validation" /> : null}
            {keywordsValidation.data ? <JsonExplorer data={keywordsValidation.data} title="Keyword validation" /> : null}
            {systemValidation.data ? <JsonExplorer data={systemValidation.data} title="System-context validation" /> : null}
          </div>
        </PanelCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <PanelCard title="Global metadata" subtitle="Database-level metadata text editor and inspector.">
          {metadataTextState ? (
            <div className="space-y-3">
              <DataList
                items={[
                  { label: 'Metadata URI', value: metadataTextState.metadata_uri ?? '—' },
                  { label: 'URI exists', value: metadataTextState.metadata_uri_exists ? 'true' : 'false' },
                  { label: 'Characters', value: metadataTextDraft.length },
                ]}
              />
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-2">
                    <h3 className="text-base font-semibold text-slate-950">Zero-as-missing handling</h3>
                    <p className="text-sm text-slate-600">
                      Treat zero-like values as missing during field-gap analysis using the backend-backed minimum confidence setting.
                    </p>
                  </div>
                  <StatusBadge value={zeroAsMissingEnabled ? 'enabled' : 'disabled'} />
                </div>
                <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,0.8fr)_auto]">
                  <DataList
                    items={[
                      { label: 'Current threshold', value: zeroAsMissingConfig?.min_confidence ?? '—' },
                      { label: 'Backend note', value: zeroAsMissingConfig?.note ?? zeroAsMissingConfig?.message ?? '—' },
                    ]}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={() => setZeroAsMissingDraft('0.6')}
                      type="button"
                      variant="outline"
                    >
                      Enable (0.6)
                    </Button>
                    <Button
                      onClick={() => setZeroAsMissingDraft('0')}
                      type="button"
                      variant="outline"
                    >
                      Disable (0.0)
                    </Button>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-end gap-3">
                  <label className="flex min-w-[16rem] flex-col gap-1 text-sm font-medium text-slate-700">
                    Minimum confidence threshold
                    <Input
                      inputMode="decimal"
                      onChange={(event) => setZeroAsMissingDraft(event.target.value)}
                      placeholder="0.0 - 1.0"
                      value={zeroAsMissingDraft}
                    />
                  </label>
                  <Button
                    onClick={() => {
                      const nextValue = Number(zeroAsMissingDraft);
                      if (!Number.isFinite(nextValue) || nextValue < 0 || nextValue > 1) {
                        setZeroAsMissingError('Minimum confidence must be a number between 0.0 and 1.0.');
                        return;
                      }
                      void requestJson<ZeroAsMissingConfig>(cfg.API_BASE_URL, '/api/v1/config/zero_as_missing', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ min_confidence: nextValue }),
                      })
                        .then((payload) => {
                          setZeroAsMissingConfig(payload);
                          setZeroAsMissingDraft(`${payload.min_confidence ?? nextValue}`);
                          setZeroAsMissingError(null);
                          setActionMessage(payload.message || 'Updated zero-as-missing configuration.');
                        })
                        .catch((error) => {
                          setZeroAsMissingError(error instanceof Error ? error.message : String(error));
                        });
                    }}
                    type="button"
                  >
                    Save zero-as-missing setting
                  </Button>
                </div>
                {zeroAsMissingError ? <div className="mt-3"><ErrorState message={zeroAsMissingError} /></div> : null}
              </div>
              <Button
                onClick={() => {
                  void requestJson<ActionResult>(cfg.API_BASE_URL, '/api/v1/admin/metadata/text', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ metadata_text: metadataTextDraft }),
                  })
                    .then((payload) => {
                      setMetadataTextError(null);
                      setActionMessage(payload.message || 'Saved global metadata text.');
                      refreshAll();
                    })
                    .catch((error) => setMetadataTextError(error instanceof Error ? error.message : String(error)));
                }}
                type="button"
              >
                Save metadata text
              </Button>
              {metadataTextError ? <ErrorState message={metadataTextError} /> : null}
              <CodeEditor
                value={metadataTextDraft}
                onChange={setMetadataTextDraft}
                language="markdown"
                height={320}
              />
            </div>
          ) : (
            <EmptyState title="Admin metadata unavailable" body={metadataTextError ?? 'The current user cannot access the metadata editor.'} />
          )}
        </PanelCard>

        <PanelCard title="i18n language management" subtitle="Build and remove language packs from the current context, then inspect the live status payload.">
          <div className="mb-4 flex flex-wrap gap-3">
            <Input
              className="max-w-xs"
              onChange={(event) => setLanguageInput(event.target.value)}
              placeholder="language code, e.g. es"
              value={languageInput}
            />
            <Button
              onClick={() => {
                if (!languageInput.trim()) return;
                void runAction(
                  () =>
                    requestJson<ActionResult>(cfg.API_BASE_URL, '/api/v1/context/i18n/build', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ language: languageInput.trim(), background: true }),
                    }),
                  `Built i18n language '${languageInput.trim()}'.`,
                );
              }}
              type="button"
            >
              Build language
            </Button>
            <Button
              onClick={() => {
                if (!languageInput.trim()) return;
                void runAction(
                  () =>
                    requestJson<ActionResult>(cfg.API_BASE_URL, '/api/v1/context/i18n/remove', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ language: languageInput.trim() }),
                    }),
                  `Removed i18n language '${languageInput.trim()}'.`,
                );
              }}
              type="button"
              variant="destructive"
            >
              Remove language
            </Button>
          </div>

          <DataList
            items={[
              { label: 'Default language', value: i18n.data?.default ?? 'en' },
              { label: 'Supported', value: joinList(i18n.data?.supported) },
              { label: 'Built', value: joinList(i18n.data?.built) },
              { label: 'Enabled tables', value: i18n.data?.enabled_tables ?? 0 },
            ]}
          />

          <div className="mt-4">
            <DataTable
              columns={languageColumns}
              rows={languageRows}
              emptyMessage="No supported languages configured."
              getRowId={(row) => `${row.language ?? ''}`}
              tableId="sql-agent-i18n-status"
            />
          </div>

          {i18n.data ? <div className="mt-4"><JsonExplorer data={i18n.data} title="Raw i18n status" /></div> : null}
          {i18n.error ? <ErrorState message={i18n.error} /> : null}
        </PanelCard>
      </div>
    </PageFrame>
  );
}
