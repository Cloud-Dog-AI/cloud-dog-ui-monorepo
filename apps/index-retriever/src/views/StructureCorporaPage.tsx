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

// @cloud-dog/app-index-retriever — Structure Corpora (W28E-603 / W28E-1805B).

import * as React from "react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  DataTable,
  EntityDialog,
  EntityForm,
  JsonExplorer,
  type DataColumn,
  type EntityFieldDef,
  type EntityFormMode,
} from "@cloud-dog/ui";
import { useIndexRetrieverState } from "../state/AppState";
import type { JsonRecord } from "../lib/types";

function asRecord(value: unknown): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as JsonRecord;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function parseCsv(value: string): string[] {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

type CorpusRow = Readonly<{
  corpus_id: string;
  name: string;
  profile_id: string;
  description: string;
  document_ids: string[];
  document_count: number;
}>;

function asCorpusRow(value: unknown): CorpusRow {
  const record = asRecord(value);
  const documentIds = asStringArray(record.document_ids);
  return {
    corpus_id: String(record.corpus_id ?? ""),
    name: String(record.name ?? ""),
    profile_id: String(record.profile_id ?? ""),
    description: String(record.description ?? ""),
    document_ids: documentIds,
    document_count: typeof record.document_count === "number" ? record.document_count : documentIds.length,
  };
}

type CorpusDraft = Readonly<{
  corpus_id: string;
  name: string;
  profile: string;
  description: string;
  document_ids: string;
}>;

function toDraft(row: CorpusRow | null, fallbackProfile: string): CorpusDraft {
  return {
    corpus_id: row?.corpus_id ?? "",
    name: row?.name ?? "",
    profile: row?.profile_id ?? fallbackProfile,
    description: row?.description ?? "",
    document_ids: (row?.document_ids ?? []).join(", "),
  };
}

export function StructureCorporaPage() {
  const app = useIndexRetrieverState();
  const { api, captureFailure, recordActivity } = app;
  const canWrite = app.roles.includes("admin") || app.roles.includes("maintainer") || app.roles.includes("writer");

  const [corpora, setCorpora] = React.useState<CorpusRow[]>([]);
  const [result, setResult] = React.useState<unknown>(null);
  const [status, setStatus] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [dialogMode, setDialogMode] = React.useState<EntityFormMode>("add");
  const [draft, setDraft] = React.useState<CorpusDraft>(toDraft(null, app.sourceConfig.profile || "default"));

  const [analyseOpen, setAnalyseOpen] = React.useState(false);
  const [analyseData, setAnalyseData] = React.useState<unknown>(null);

  const run = React.useCallback(
    async (action: string, fn: () => Promise<unknown>) => {
      setError(null);
      try {
        const out = await fn();
        setResult(out);
        setStatus(`${action} OK`);
        recordActivity(`structure.corpora.${action}`, "ok");
        return out;
      } catch (runError) {
        const message = captureFailure(runError);
        setError(message);
        setStatus("");
        recordActivity(`structure.corpora.${action}`, "error", message);
        throw runError;
      }
    },
    [captureFailure, recordActivity]
  );

  const listCorpora = React.useCallback(async () => {
    const out = asRecord(await api.structureCorpusList({ limit: 100 }));
    const rows = Array.isArray(out.corpora) ? out.corpora.map(asCorpusRow) : [];
    setCorpora(rows);
    return rows;
  }, [api]);

  React.useEffect(() => {
    void listCorpora().catch((listError) => {
      setError(captureFailure(listError));
    });
  }, [listCorpora, captureFailure]);

  const errors = React.useMemo(() => {
    const next: Record<string, string> = {};
    if (!draft.name.trim()) next.name = "Name is required.";
    if (!draft.profile.trim()) next.profile = "Profile is required.";
    return next;
  }, [draft]);

  const fields = React.useMemo<EntityFieldDef[]>(
    () => [
      { name: "name", label: "Name", type: "text", required: true },
      { name: "profile", label: "Profile", type: "text", required: true, readOnly: dialogMode !== "add" },
      { name: "description", label: "Description", type: "text" },
      { name: "document_ids", label: "Document IDs (comma-separated)", type: "textarea", rows: 4, placeholder: "sdoc_..., sdoc_..." },
    ],
    [dialogMode]
  );

  const openAdd = () => {
    setDialogMode("add");
    setDraft(toDraft(null, app.sourceConfig.profile || "default"));
    setDialogOpen(true);
  };

  const openEdit = (row: CorpusRow) => {
    setDialogMode("edit");
    setDraft(toDraft(row, app.sourceConfig.profile || "default"));
    setDialogOpen(true);
  };

  const submit = async () => {
    if (Object.keys(errors).length > 0) return;
    if (dialogMode === "add") {
      await run("create", async () => {
        const out = await api.structureCorpusCreate({
          name: draft.name.trim(),
          profile_id: draft.profile.trim(),
          description: draft.description.trim(),
          document_ids: parseCsv(draft.document_ids),
        });
        await listCorpora();
        return out;
      });
    } else {
      await run("update", async () => {
        const out = await api.structureCorpusUpdate(draft.corpus_id, {
          name: draft.name.trim(),
          description: draft.description.trim(),
          document_ids: parseCsv(draft.document_ids),
        });
        await listCorpora();
        return out;
      });
    }
    setDialogOpen(false);
  };

  const deleteCorpus = async (row: CorpusRow) => {
    await run("delete", async () => {
      const out = await api.structureCorpusDelete(row.corpus_id);
      await listCorpora();
      return out;
    });
  };

  const analyseCorpus = async (row: CorpusRow) => {
    await run("analyse", async () => {
      const [report, patterns] = await Promise.all([
        api.structureCorpusAnalyse(row.corpus_id),
        api.structureCorpusPatternsGet(row.corpus_id).catch(() => ({})),
      ]);
      const reportRecord = asRecord(report);
      const combined = {
        corpus_id: row.corpus_id,
        commonality_score: reportRecord.commonality_score ?? null,
        variation_score: reportRecord.variation_score ?? null,
        mean_pairwise_distance: reportRecord.mean_pairwise_distance ?? null,
        report,
        patterns,
      };
      setAnalyseData(combined);
      setAnalyseOpen(true);
      return combined;
    });
  };

  const columns: DataColumn<CorpusRow>[] = [
    {
      id: "name",
      header: "Name",
      cell: (row) => (
        <Button
          variant="link"
          size="sm"
          className="h-auto p-0"
          data-testid="corpus-name"
          onClick={() => openEdit(row)}
        >
          {row.name || row.corpus_id}
        </Button>
      ),
      sortable: true,
      sortValue: (row) => row.name,
    },
    { id: "corpus_id", header: "Corpus ID", cell: (row) => row.corpus_id },
    { id: "profile", header: "Profile", cell: (row) => row.profile_id || "-" },
    { id: "description", header: "Description", cell: (row) => row.description || "-" },
    { id: "document_count", header: "Documents", cell: (row) => String(row.document_count) },
    {
      id: "actions",
      header: "Actions",
      cell: (row) => (
        <div className="flex flex-wrap gap-2" data-testid="corpus-row">
          <Button size="sm" variant="secondary" data-testid="corpus-analyse" onClick={() => void analyseCorpus(row)}>
            Analyse
          </Button>
          <Button size="sm" variant="secondary" data-testid="corpus-edit" disabled={!canWrite} onClick={() => openEdit(row)}>
            Edit
          </Button>
          <Button
            size="sm"
            variant="destructive"
            data-testid="corpus-delete"
            disabled={!canWrite}
            onClick={() => {
              if (window.confirm(`Delete corpus ${row.name || row.corpus_id}?`)) void deleteCorpus(row);
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
        <h1 className="text-2xl font-semibold">Structure Corpora</h1>
        <Button variant="secondary" size="sm" data-testid="corpus-refresh" onClick={() => void listCorpora()}>
          List Corpora
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
          <h2 className="text-lg font-semibold">Structure corpora</h2>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button data-testid="corpus-add" disabled={!canWrite} onClick={openAdd}>
              Add Corpus
            </Button>
            <Button variant="secondary" size="sm" onClick={() => void listCorpora()}>
              Refresh
            </Button>
          </div>
          <DataTable
            tableId="structure-corpus-list"
            ariaLabel="structure corpus list"
            rows={corpora}
            getRowId={(row) => row.corpus_id}
            columns={columns}
            emptyMessage="No corpora created yet."
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
            Shows the raw API response from the last corpus create, update, delete, or analyse operation.
          </p>
        </CardHeader>
        <CardContent>
          <JsonExplorer title="result" data={result ?? {}} defaultExpanded />
        </CardContent>
      </Card>

      <EntityDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={dialogMode === "add" ? "Add Corpus" : "Edit Corpus"}
        body={(
          <div className="space-y-4" data-testid="corpus-form">
            <EntityForm
              fields={fields}
              values={draft as unknown as Record<string, unknown>}
              errors={errors}
              mode={dialogMode}
              onChange={(name, value) => setDraft((current) => ({ ...current, [name]: value }) as CorpusDraft)}
              onSubmit={() => void submit()}
              onCancel={() => setDialogOpen(false)}
            />
          </div>
        )}
      />

      <EntityDialog
        open={analyseOpen}
        onOpenChange={setAnalyseOpen}
        title="Corpus Analysis"
        body={(
          <div className="space-y-4" data-testid="corpus-analyse-body">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Card>
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground">Commonality score</p>
                  <p className="text-lg font-semibold" data-testid="corpus-commonality">
                    {String(asRecord(analyseData).commonality_score ?? "-")}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground">Variation score</p>
                  <p className="text-lg font-semibold" data-testid="corpus-variation">
                    {String(asRecord(analyseData).variation_score ?? "-")}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground">Mean pairwise distance</p>
                  <p className="text-lg font-semibold" data-testid="corpus-distance">
                    {String(asRecord(analyseData).mean_pairwise_distance ?? "-")}
                  </p>
                </CardContent>
              </Card>
            </div>
            <JsonExplorer title="analysis + patterns" data={asRecord(analyseData)} defaultExpanded />
          </div>
        )}
      />
    </div>
  );
}
