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

// @cloud-dog/app-index-retriever — Structure Templates (W28E-603 / W28E-1805B).

import * as React from "react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CodeEditor,
  DataTable,
  EntityDialog,
  EntityForm,
  JsonExplorer,
  type DataColumn,
  type EntityFieldDef,
} from "@cloud-dog/ui";
import { useIndexRetrieverState } from "../state/AppState";
import type { JsonRecord } from "../lib/types";

function asRecord(value: unknown): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as JsonRecord;
}

type TemplateRow = Readonly<{
  template_id: string;
  name: string;
  corpus_id: string;
  profile_id: string;
  confidence: number | null;
}>;

function asTemplateRow(value: unknown): TemplateRow {
  const record = asRecord(value);
  const confidence = record.confidence;
  return {
    template_id: String(record.template_id ?? ""),
    name: String(record.name ?? ""),
    corpus_id: String(record.corpus_id ?? ""),
    profile_id: String(record.profile_id ?? ""),
    confidence: typeof confidence === "number" ? confidence : null,
  };
}

type GenerateDraft = Readonly<{
  corpus_id: string;
  name: string;
}>;

type MatchDraft = Readonly<{
  structure_document_id: string;
}>;

export function StructureTemplatesPage() {
  const app = useIndexRetrieverState();
  const { api, captureFailure, recordActivity } = app;
  const canWrite = app.roles.includes("admin") || app.roles.includes("maintainer") || app.roles.includes("writer");

  const [templates, setTemplates] = React.useState<TemplateRow[]>([]);
  const [result, setResult] = React.useState<unknown>(null);
  const [status, setStatus] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);

  const [generateOpen, setGenerateOpen] = React.useState(false);
  const [generateDraft, setGenerateDraft] = React.useState<GenerateDraft>({ corpus_id: "", name: "" });

  const [viewOpen, setViewOpen] = React.useState(false);
  const [viewData, setViewData] = React.useState<unknown>(null);

  const [exportOpen, setExportOpen] = React.useState(false);
  const [exportData, setExportData] = React.useState<{ markdown: string; json: string }>({ markdown: "", json: "" });

  const [matchOpen, setMatchOpen] = React.useState(false);
  const [matchTemplate, setMatchTemplate] = React.useState<TemplateRow | null>(null);
  const [matchDraft, setMatchDraft] = React.useState<MatchDraft>({ structure_document_id: "" });
  const [matchResult, setMatchResult] = React.useState<unknown>(null);

  const run = React.useCallback(
    async (action: string, fn: () => Promise<unknown>) => {
      setError(null);
      try {
        const out = await fn();
        setResult(out);
        setStatus(`${action} OK`);
        recordActivity(`structure.templates.${action}`, "ok");
        return out;
      } catch (runError) {
        const message = captureFailure(runError);
        setError(message);
        setStatus("");
        recordActivity(`structure.templates.${action}`, "error", message);
        throw runError;
      }
    },
    [captureFailure, recordActivity]
  );

  const listTemplates = React.useCallback(async () => {
    const out = asRecord(await api.structureTemplateList({ limit: 100 }));
    const rows = Array.isArray(out.templates) ? out.templates.map(asTemplateRow) : [];
    setTemplates(rows);
    return rows;
  }, [api]);

  React.useEffect(() => {
    void listTemplates().catch((listError) => {
      setError(captureFailure(listError));
    });
  }, [listTemplates, captureFailure]);

  const generateErrors = React.useMemo(() => {
    const next: Record<string, string> = {};
    if (!generateDraft.corpus_id.trim()) next.corpus_id = "Corpus ID is required.";
    return next;
  }, [generateDraft]);

  const generateFields = React.useMemo<EntityFieldDef[]>(
    () => [
      { name: "corpus_id", label: "Corpus ID", type: "text", required: true, placeholder: "corp_..." },
      { name: "name", label: "Template name (optional)", type: "text" },
    ],
    []
  );

  const matchErrors = React.useMemo(() => {
    const next: Record<string, string> = {};
    if (!matchDraft.structure_document_id.trim()) next.structure_document_id = "Structure document ID is required.";
    return next;
  }, [matchDraft]);

  const matchFields = React.useMemo<EntityFieldDef[]>(
    () => [{ name: "structure_document_id", label: "Structure document ID", type: "text", required: true, placeholder: "sdoc_..." }],
    []
  );

  const openGenerate = () => {
    setGenerateDraft({ corpus_id: "", name: "" });
    setGenerateOpen(true);
  };

  const submitGenerate = async () => {
    if (Object.keys(generateErrors).length > 0) return;
    await run("generate", async () => {
      const out = await api.structureTemplateGenerate({
        corpus_id: generateDraft.corpus_id.trim(),
        name: generateDraft.name.trim() || undefined,
      });
      await listTemplates();
      return out;
    });
    setGenerateOpen(false);
  };

  const viewTemplate = async (row: TemplateRow) => {
    await run("view", async () => {
      const template = await api.structureTemplateGet(row.template_id);
      setViewData(template);
      setViewOpen(true);
      return template;
    });
  };

  const exportTemplate = async (row: TemplateRow) => {
    await run("export", async () => {
      const [md, json] = await Promise.all([
        api.structureTemplateExport(row.template_id, "markdown"),
        api.structureTemplateExport(row.template_id, "json"),
      ]);
      const data = {
        markdown: String(asRecord(md).content ?? ""),
        json: String(asRecord(json).content ?? ""),
      };
      setExportData(data);
      setExportOpen(true);
      return { markdown: md, json };
    });
  };

  const openMatch = (row: TemplateRow) => {
    setMatchTemplate(row);
    setMatchDraft({ structure_document_id: "" });
    setMatchResult(null);
    setMatchOpen(true);
  };

  const submitMatch = async () => {
    if (Object.keys(matchErrors).length > 0 || !matchTemplate) return;
    await run("match", async () => {
      const out = await api.structureTemplateMatch(matchTemplate.template_id, matchDraft.structure_document_id.trim());
      setMatchResult(out);
      return out;
    });
  };

  const deleteTemplate = async (row: TemplateRow) => {
    await run("delete", async () => {
      const out = await api.structureTemplateDelete(row.template_id);
      await listTemplates();
      return out;
    });
  };

  const columns: DataColumn<TemplateRow>[] = [
    {
      id: "name",
      header: "Name",
      cell: (row) => (
        <Button
          variant="link"
          size="sm"
          className="h-auto p-0"
          data-testid="template-name"
          onClick={() => void viewTemplate(row)}
        >
          {row.name || row.template_id}
        </Button>
      ),
      sortable: true,
      sortValue: (row) => row.name,
    },
    { id: "template_id", header: "Template ID", cell: (row) => row.template_id },
    { id: "corpus_id", header: "Corpus", cell: (row) => row.corpus_id || "-" },
    { id: "profile", header: "Profile", cell: (row) => row.profile_id || "-" },
    { id: "confidence", header: "Confidence", cell: (row) => (row.confidence == null ? "-" : row.confidence.toFixed(3)) },
    {
      id: "actions",
      header: "Actions",
      cell: (row) => (
        <div className="flex flex-wrap gap-2" data-testid="template-row">
          <Button size="sm" variant="secondary" data-testid="template-view" onClick={() => void viewTemplate(row)}>
            View
          </Button>
          <Button size="sm" variant="secondary" data-testid="template-export" onClick={() => void exportTemplate(row)}>
            Export
          </Button>
          <Button size="sm" variant="secondary" data-testid="template-match-open" onClick={() => openMatch(row)}>
            Match
          </Button>
          <Button
            size="sm"
            variant="destructive"
            data-testid="template-delete"
            disabled={!canWrite}
            onClick={() => {
              if (window.confirm(`Delete template ${row.name || row.template_id}?`)) void deleteTemplate(row);
            }}
          >
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold">Structure Templates</h1>
        <Button variant="secondary" size="sm" data-testid="template-refresh" onClick={() => void listTemplates()}>
          List Templates
        </Button>
      </header>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {status ? (
        <p role="status" className="text-sm text-foreground/80">
          {status}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Structure templates</h2>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button data-testid="template-generate-open" disabled={!canWrite} onClick={openGenerate}>
              Generate Template
            </Button>
            <Button variant="secondary" size="sm" onClick={() => void listTemplates()}>
              Refresh
            </Button>
          </div>
          <DataTable
            tableId="structure-template-list"
            ariaLabel="structure template list"
            rows={templates}
            getRowId={(row) => row.template_id}
            columns={columns}
            emptyMessage="No templates generated yet."
            page={page}
            onPageChange={setPage}
            pageSize={pageSize}
            onPageSizeChange={setPageSize}
            columnPickerEnabled={true}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Operation result</h2>
          <p className="text-sm text-muted-foreground">
            Shows the raw API response from the last generate, view, export, match, or delete operation.
          </p>
        </CardHeader>
        <CardContent>
          <JsonExplorer title="result" data={result ?? {}} defaultExpanded />
        </CardContent>
      </Card>

      <EntityDialog
        open={generateOpen}
        onOpenChange={setGenerateOpen}
        title="Generate Template"
        body={(
          <div className="space-y-4" data-testid="template-generate-form">
            <EntityForm
              fields={generateFields}
              values={generateDraft as unknown as Record<string, unknown>}
              errors={generateErrors}
              mode="add"
              submitLabel="Generate"
              onChange={(name, value) => setGenerateDraft((current) => ({ ...current, [name]: value }) as GenerateDraft)}
              onSubmit={() => void submitGenerate()}
              onCancel={() => setGenerateOpen(false)}
            />
          </div>
        )}
      />

      <EntityDialog
        open={viewOpen}
        onOpenChange={setViewOpen}
        title="View Template"
        body={(
          <div className="space-y-4" data-testid="template-view-body">
            <JsonExplorer title="template" data={asRecord(viewData)} defaultExpanded />
          </div>
        )}
      />

      <EntityDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        title="Export Template"
        body={(
          <div className="space-y-4" data-testid="template-export-body">
            <Card>
              <CardHeader>
                <h3 className="text-base font-semibold">Markdown</h3>
              </CardHeader>
              <CardContent>
                <CodeEditor value={exportData.markdown} language="markdown" ariaLabel="Template markdown export" readOnly height={220} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <h3 className="text-base font-semibold">JSON</h3>
              </CardHeader>
              <CardContent>
                <CodeEditor value={exportData.json} language="json" ariaLabel="Template JSON export" readOnly height={220} />
              </CardContent>
            </Card>
          </div>
        )}
      />

      <EntityDialog
        open={matchOpen}
        onOpenChange={setMatchOpen}
        title={`Match Document to ${matchTemplate?.name || matchTemplate?.template_id || "Template"}`}
        body={(
          <div className="space-y-4" data-testid="template-match-form">
            <EntityForm
              fields={matchFields}
              values={matchDraft as unknown as Record<string, unknown>}
              errors={matchErrors}
              mode="add"
              submitLabel="Match"
              onChange={(name, value) => setMatchDraft((current) => ({ ...current, [name]: value }) as MatchDraft)}
              onSubmit={() => void submitMatch()}
              onCancel={() => setMatchOpen(false)}
            />
            {matchResult ? (
              <div className="space-y-3" data-testid="template-match-result">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-xs text-muted-foreground">Match score</p>
                      <p className="text-lg font-semibold" data-testid="template-match-score">
                        {String(asRecord(matchResult).match_score ?? "-")}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-xs text-muted-foreground">Matched</p>
                      <p className="text-lg font-semibold">
                        {String((Array.isArray(asRecord(matchResult).matched) ? (asRecord(matchResult).matched as unknown[]).length : 0))}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-xs text-muted-foreground">Missing / Extra</p>
                      <p className="text-lg font-semibold">
                        {String((Array.isArray(asRecord(matchResult).missing) ? (asRecord(matchResult).missing as unknown[]).length : 0))}
                        {" / "}
                        {String((Array.isArray(asRecord(matchResult).extra) ? (asRecord(matchResult).extra as unknown[]).length : 0))}
                      </p>
                    </CardContent>
                  </Card>
                </div>
                <JsonExplorer title="match breakdown" data={asRecord(matchResult)} defaultExpanded />
              </div>
            ) : null}
          </div>
        )}
      />
    </div>
  );
}
