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

// W28F-931 — shared draft state for the chart workflow pages (Data Input ->
// Data Preview -> Field Mapping -> ChartSpec Editor -> Style Selector ->
// Locale Selector -> Render Preview). State lives in-memory only; reloads reset.

import * as React from "react";
import type { ChartSpec, Recommendation } from "../lib/types";

export type WorkflowDataSource = "csv" | "json" | "file";

export type WorkflowData = Readonly<{
  raw: string;
  body: Record<string, unknown>;
  source: WorkflowDataSource;
}>;

export type WorkflowMapping = Readonly<{
  x?: string | null;
  y?: string | null;
  group?: string | null;
  aggregate?: string | null;
}>;

export type WorkflowLocale = Readonly<{
  locale?: string;
  numberFormat?: string;
  dateFormat?: string;
}>;

type WorkflowState = Readonly<{
  data: WorkflowData | null;
  rows: Array<Record<string, unknown>>;
  columns: string[];
  mapping: WorkflowMapping;
  spec: ChartSpec | null;
  recommendation: Recommendation | null;
  style: string | null;
  locale: WorkflowLocale;
  setData: (data: { raw: string; body: Record<string, unknown>; source: WorkflowDataSource }) => void;
  setMapping: (mapping: WorkflowMapping) => void;
  setSpec: (spec: ChartSpec | null) => void;
  setRecommendation: (recommendation: Recommendation | null) => void;
  setStyle: (style: string | null) => void;
  setLocale: (locale: WorkflowLocale) => void;
  reset: () => void;
  dataRaw: string;
  dataSource: WorkflowDataSource | null;
}>;

const Ctx = React.createContext<WorkflowState | null>(null);

/** Best-effort CSV->rows parser; quoted fields supported, no fancy escapes. */
function parseCsv(text: string): { columns: string[]; rows: Array<Record<string, unknown>> } {
  const lines = text.replace(/\r\n?/g, "\n").split("\n").filter((line) => line.trim());
  if (lines.length === 0) return { columns: [], rows: [] };
  const split = (line: string): string[] => {
    const out: string[] = [];
    let cur = "";
    let inQuote = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (ch === '"' && line[i + 1] === '"' && inQuote) {
        cur += '"';
        i += 1;
        continue;
      }
      if (ch === '"') {
        inQuote = !inQuote;
        continue;
      }
      if (ch === "," && !inQuote) {
        out.push(cur);
        cur = "";
        continue;
      }
      cur += ch;
    }
    out.push(cur);
    return out;
  };
  const headerCols = split(lines[0]!).map((c) => c.trim());
  const rows: Array<Record<string, unknown>> = [];
  for (const line of lines.slice(1)) {
    const cells = split(line);
    const row: Record<string, unknown> = {};
    headerCols.forEach((col, idx) => {
      const v = (cells[idx] ?? "").trim();
      const num = Number(v);
      row[col] = v === "" ? null : Number.isFinite(num) && v !== "" && /^-?[0-9]+(\.[0-9]+)?$/.test(v) ? num : v;
    });
    rows.push(row);
  }
  return { columns: headerCols, rows };
}

/** Pull the rows-and-columns view out of a workflow body (`csv` text or `data.rows` array). */
function projectRows(body: Record<string, unknown>): {
  rows: Array<Record<string, unknown>>;
  columns: string[];
} {
  if (typeof body.csv === "string") return parseCsv(body.csv);
  const data = body.data as Record<string, unknown> | undefined;
  if (data && Array.isArray(data.rows)) {
    const rows = data.rows as Array<Record<string, unknown>>;
    const columns = rows.length ? Array.from(new Set(rows.flatMap((r) => Object.keys(r)))) : [];
    return { rows, columns };
  }
  return { rows: [], columns: [] };
}

export function ChartWorkflowProvider(props: { children: React.ReactNode }) {
  const [data, setDataState] = React.useState<WorkflowData | null>(null);
  const [rows, setRows] = React.useState<Array<Record<string, unknown>>>([]);
  const [columns, setColumns] = React.useState<string[]>([]);
  const [mapping, setMapping] = React.useState<WorkflowMapping>({});
  const [spec, setSpec] = React.useState<ChartSpec | null>(null);
  const [recommendation, setRecommendation] = React.useState<Recommendation | null>(null);
  const [style, setStyle] = React.useState<string | null>(null);
  const [locale, setLocale] = React.useState<WorkflowLocale>({});

  const setData = React.useCallback((next: { raw: string; body: Record<string, unknown>; source: WorkflowDataSource }) => {
    setDataState({ raw: next.raw, body: next.body, source: next.source });
    const projected = projectRows(next.body);
    setRows(projected.rows);
    setColumns(projected.columns);
  }, []);

  const reset = React.useCallback(() => {
    setDataState(null);
    setRows([]);
    setColumns([]);
    setMapping({});
    setSpec(null);
    setRecommendation(null);
    setStyle(null);
    setLocale({});
  }, []);

  const value: WorkflowState = {
    data,
    rows,
    columns,
    mapping,
    spec,
    recommendation,
    style,
    locale,
    setData,
    setMapping,
    setSpec,
    setRecommendation,
    setStyle,
    setLocale,
    reset,
    dataRaw: data?.raw ?? "",
    dataSource: data?.source ?? null,
  };
  return <Ctx.Provider value={value}>{props.children}</Ctx.Provider>;
}

export function useChartWorkflow(): WorkflowState {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error("useChartWorkflow must be used inside <ChartWorkflowProvider>.");
  return ctx;
}

// Exposed for unit tests.
export const __test = { parseCsv, projectRows };
