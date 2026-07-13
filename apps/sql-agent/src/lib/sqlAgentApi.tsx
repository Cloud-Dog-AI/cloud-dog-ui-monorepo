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

// @cloud-dog/app-sql-agent — Shared API helpers and lightweight UI primitives.

import { createApiClient } from '@cloud-dog/api-client';
import * as React from 'react';

export type QuerySubmission = {
  job_id?: string;
  answer?: string;
  sql?: string;
  status?: string;
};

export type JobsListResponse = {
  jobs?: Array<Record<string, unknown>>;
  total_jobs?: number;
};

export type ContextValidationResponse = {
  status?: string;
  errors?: unknown[];
  warnings?: unknown[];
};

export type GenericRecord = Record<string, unknown>;

export type ContextTableRecord = GenericRecord & {
  name?: string;
  title?: string;
  description?: string;
  enabled?: boolean;
};

export type ContextFieldRecord = {
  name: string;
  type: string;
  nullable?: boolean;
  indexed?: boolean;
  description?: string;
  keywords?: string[];
  triggerWords?: string[];
  sampleValue?: string;
};

export type ResourceState<T> = {
  data: T | null;
  error: string | null;
  loading: boolean;
  refresh: () => void;
};

function createCookieClient(baseUrl: string) {
  return createApiClient({
    baseUrl,
    credentials: 'include',
  });
}

export async function requestJson<T>(
  baseUrl: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const method = (init?.method ?? 'GET').toUpperCase();
  const headers = new Headers(init?.headers);
  if (init?.body !== undefined && init?.body !== null && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    method,
    credentials: 'include',
    headers,
  });
  const rawText = await response.text();

  let payload: unknown = null;
  if (rawText) {
    try {
      payload = JSON.parse(rawText);
    } catch {
      payload = rawText;
    }
  }

  if (!response.ok) {
    const errorObject = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : null;
    const detailValue = errorObject?.detail;
    const detail =
      Array.isArray(detailValue)
        ? detailValue
            .map((item) => {
              if (!item || typeof item !== 'object') return String(item);
              const record = item as Record<string, unknown>;
              const location = Array.isArray(record.loc) ? record.loc.join('.') : record.loc;
              return [location, record.msg].filter(Boolean).join(': ');
            })
            .filter(Boolean)
            .join('; ')
        : errorObject
          ? String(
              detailValue ??
                errorObject.message ??
                errorObject.error ??
                `Request failed with status ${response.status}`,
            )
          : rawText || `Request failed with status ${response.status}`;
    throw new Error(detail);
  }

  return payload as T;
}

export async function requestText(
  baseUrl: string,
  path: string,
  init?: RequestInit,
): Promise<string> {
  const client = createCookieClient(baseUrl);
  const signal = init?.signal ?? undefined;
  return client.get<string>(path, {
    headers: {
      Accept: 'text/plain,application/json,text/html',
      ...Object.fromEntries(new Headers(init?.headers).entries()),
    },
    credentials: 'include',
    signal,
  });
}

export function safeStringify(value: unknown, spacing = 2): string {
  try {
    return JSON.stringify(value, null, spacing);
  } catch {
    return String(value);
  }
}

export function downloadTextFile(
  filename: string,
  content: string,
  mimeType = 'text/plain;charset=utf-8',
) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function downloadJsonFile(filename: string, value: unknown) {
  downloadTextFile(filename, safeStringify(value), 'application/json;charset=utf-8');
}

export function getTableName(table: GenericRecord): string {
  return String(table.name ?? table.table_name ?? table.title ?? 'unknown_table');
}

export function normaliseContextTables(value: unknown): ContextTableRecord[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is ContextTableRecord => Boolean(item) && typeof item === 'object');
  }

  if (value && typeof value === 'object') {
    return Object.entries(value as GenericRecord).map(([name, raw]) => {
      if (raw && typeof raw === 'object') {
        return {
          name,
          ...(raw as GenericRecord),
        };
      }

      return {
        name,
        value: raw,
      };
    });
  }

  return [];
}

function coerceFieldRow(name: string, raw: unknown): ContextFieldRecord {
  if (raw && typeof raw === 'object') {
    const record = raw as GenericRecord;
    return {
      name,
      type: String(record.type ?? record.data_type ?? record.COLUMN_TYPE ?? 'unknown'),
      nullable:
        typeof record.nullable === 'boolean'
          ? record.nullable
          : typeof record.IS_NULLABLE === 'string'
            ? record.IS_NULLABLE === 'YES'
            : undefined,
      indexed: typeof record.indexed === 'boolean' ? record.indexed : undefined,
      description: record.description ? String(record.description) : undefined,
      keywords: Array.isArray(record.keywords)
        ? record.keywords.map((item) => String(item))
        : undefined,
      triggerWords: Array.isArray(record.trigger_words)
        ? record.trigger_words.map((item) => String(item))
        : undefined,
      sampleValue:
        record.example != null
          ? String(record.example)
          : record.sample_value != null
            ? String(record.sample_value)
            : undefined,
    };
  }

  return {
    name,
    type: String(raw ?? 'unknown'),
  };
}

export function extractContextFields(table: GenericRecord): ContextFieldRecord[] {
  const schema = table.schema && typeof table.schema === 'object' ? (table.schema as GenericRecord) : null;
  const schemaColumns = schema?.columns;

  if (Array.isArray(schemaColumns)) {
    return schemaColumns.map((raw, index) => {
      if (raw && typeof raw === 'object') {
        const record = raw as GenericRecord;
        return coerceFieldRow(String(record.name ?? record.column_name ?? `field_${index + 1}`), record);
      }
      return coerceFieldRow(`field_${index + 1}`, raw);
    });
  }

  if (schemaColumns && typeof schemaColumns === 'object') {
    return Object.entries(schemaColumns as GenericRecord).map(([name, raw]) => coerceFieldRow(name, raw));
  }

  if (Array.isArray(table.fields)) {
    return (table.fields as unknown[]).map((raw, index) => {
      if (raw && typeof raw === 'object') {
        const record = raw as GenericRecord;
        return coerceFieldRow(String(record.name ?? record.column_name ?? `field_${index + 1}`), record);
      }
      return coerceFieldRow(`field_${index + 1}`, raw);
    });
  }

  return [];
}

export function extractSampleRows(table: GenericRecord): GenericRecord[] {
  const directSample =
    Array.isArray(table.sample_data) ? table.sample_data :
    Array.isArray(table.sample_rows) ? table.sample_rows :
    Array.isArray((table.sample_analysis as GenericRecord | undefined)?.sample_rows)
      ? ((table.sample_analysis as GenericRecord).sample_rows as unknown[])
      : null;

  if (!directSample) {
    return [];
  }

  return directSample.map((row, index) => {
    if (row && typeof row === 'object' && !Array.isArray(row)) {
      return row as GenericRecord;
    }

    return {
      index,
      value: row,
    };
  });
}

export function extractRelationships(table: GenericRecord): GenericRecord[] {
  if (!Array.isArray(table.relationships)) {
    return [];
  }

  return table.relationships.filter(
    (item): item is GenericRecord => Boolean(item) && typeof item === 'object',
  );
}

export function useApiResource<T>(
  fetcher: () => Promise<T>,
  deps: React.DependencyList,
): ResourceState<T> {
  const [data, setData] = React.useState<T | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [refreshTick, setRefreshTick] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError(null);

    fetcher()
      .then((next) => {
        if (!cancelled) {
          setData(next);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [...deps, refreshTick]);

  return {
    data,
    error,
    loading,
    refresh: () => setRefreshTick((value) => value + 1),
  };
}

export function PageFrame(props: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white/95 p-6 shadow-sm shadow-slate-200/60">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">
              {props.eyebrow}
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950">{props.title}</h1>
            <p className="max-w-3xl text-sm leading-6 text-slate-600">{props.description}</p>
          </div>
          {props.actions ? <div className="flex items-center gap-2">{props.actions}</div> : null}
        </div>
      </section>
      {props.children}
    </div>
  );
}

export function PanelCard(props: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <section
      className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/50"
      id={props.id}
    >
      <div className="mb-4 space-y-1">
        <h2 className="text-lg font-semibold text-slate-950">{props.title}</h2>
        {props.subtitle ? <p className="text-sm text-slate-500">{props.subtitle}</p> : null}
      </div>
      {props.children}
    </section>
  );
}

export function MetricTile(props: {
  label: string;
  value: React.ReactNode;
  tone?: 'default' | 'success' | 'warning';
}) {
  const toneClass =
    props.tone === 'success'
      ? 'bg-emerald-50 text-emerald-800'
      : props.tone === 'warning'
        ? 'bg-amber-50 text-amber-800'
        : 'bg-slate-50 text-slate-700';

  return (
    <div className={`rounded-2xl border border-slate-200 p-4 ${toneClass}`}>
      <div className="text-xs font-semibold uppercase tracking-[0.18em]">{props.label}</div>
      <div className="mt-2 text-2xl font-semibold tracking-tight">{props.value}</div>
    </div>
  );
}

export function StatusBadge({ value }: { value: string | undefined | null }) {
  const normalised = `${value ?? 'unknown'}`.toLowerCase();
  const toneClass =
    normalised.includes('pass') || normalised.includes('ready') || normalised.includes('ok')
      ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
      : normalised.includes('warn')
        ? 'border-amber-300 bg-amber-50 text-amber-800'
        : normalised.includes('fail') || normalised.includes('error')
          ? 'border-rose-300 bg-rose-50 text-rose-800'
          : 'border-slate-300 bg-slate-50 text-slate-700';

  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${toneClass}`}>
      {value ?? 'unknown'}
    </span>
  );
}

export function DataList(props: {
  items: Array<{ label: string; value: React.ReactNode }>;
}) {
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {props.items.map((item) => (
        <div key={item.label} className="rounded-2xl bg-slate-50 p-4">
          <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            {item.label}
          </dt>
          <dd className="mt-2 break-words text-sm text-slate-800">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function JsonBlock(props: { value: unknown; maxHeightClass?: string }) {
  return (
    <pre
      aria-label="JSON content"
      className={`overflow-auto rounded-2xl bg-slate-950 p-4 text-xs leading-6 text-slate-100 ${
        props.maxHeightClass ?? 'max-h-96'
      }`}
      tabIndex={0}
    >
      {JSON.stringify(props.value, null, 2)}
    </pre>
  );
}

export function EmptyState(props: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
      <div className="font-semibold text-slate-900">{props.title}</div>
      <p className="mt-2">{props.body}</p>
    </div>
  );
}

export function ErrorState(props: { message: string }) {
  return (
    <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
      {props.message}
    </div>
  );
}

export function LoadingState({ label }: { label: string }) {
  return <div className="text-sm text-slate-500">Loading {label}...</div>;
}
