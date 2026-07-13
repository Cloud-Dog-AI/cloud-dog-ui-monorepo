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

// @cloud-dog/app-index-retriever — Document Structure (W28E-603 / W28E-1805B).

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

type StructureDocumentRow = Readonly<{
  structure_document_id: string;
  profile_id: string;
  collection_id: string;
  page_count: number;
  status: string;
  quality_score: number | null;
  language_hints: string[];
}>;

function asDocumentRow(value: unknown): StructureDocumentRow {
  const record = asRecord(value);
  const quality = record.quality_score;
  return {
    structure_document_id: String(record.structure_document_id ?? ""),
    profile_id: String(record.profile_id ?? ""),
    collection_id: String(record.collection_id ?? ""),
    page_count: typeof record.page_count === "number" ? record.page_count : 0,
    status: String(record.status ?? ""),
    quality_score: typeof quality === "number" ? quality : null,
    language_hints: asStringArray(record.language_hints),
  };
}

type ExtractDraft = Readonly<{
  profile: string;
  collection: string;
  provider: string;
  text: string;
}>;

const PROVIDER_OPTIONS = ["internal", "mineru", "marker", "docling"];

export function StructureDocumentsPage() {
  const app = useIndexRetrieverState();
  const { api, captureFailure, recordActivity } = app;
  const canWrite = app.roles.includes("admin") || app.roles.includes("maintainer") || app.roles.includes("writer");

  const [documents, setDocuments] = React.useState<StructureDocumentRow[]>([]);
  const [result, setResult] = React.useState<unknown>(null);
  const [status, setStatus] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);

  const [extractOpen, setExtractOpen] = React.useState(false);
  const [extractDraft, setExtractDraft] = React.useState<ExtractDraft>({
    profile: app.sourceConfig.profile || "default",
    collection: app.sourceConfig.collection || "default",
    provider: "internal",
    text: "",
  });

  const [viewOpen, setViewOpen] = React.useState(false);
  const [viewData, setViewData] = React.useState<unknown>(null);

  const run = React.useCallback(
    async (action: string, fn: () => Promise<unknown>) => {
      setError(null);
      try {
        const out = await fn();
        setResult(out);
        setStatus(`${action} OK`);
        recordActivity(`structure.documents.${action}`, "ok");
        return out;
      } catch (runError) {
        const message = captureFailure(runError);
        setError(message);
        setStatus("");
        recordActivity(`structure.documents.${action}`, "error", message);
        throw runError;
      }
    },
    [captureFailure, recordActivity]
  );

  const listDocuments = React.useCallback(async () => {
    const out = asRecord(await api.structureDocumentList({ limit: 100 }));
    const rows = Array.isArray(out.documents) ? out.documents.map(asDocumentRow) : [];
    setDocuments(rows);
    return rows;
  }, [api]);

  React.useEffect(() => {
    void listDocuments().catch((listError) => {
      setError(captureFailure(listError));
    });
  }, [listDocuments, captureFailure]);

  const extractErrors = React.useMemo(() => {
    const next: Record<string, string> = {};
    if (!extractDraft.profile.trim()) next.profile = "Profile is required.";
    if (!extractDraft.collection.trim()) next.collection = "Collection is required.";
    if (!extractDraft.text.trim()) next.text = "Text is required.";
    return next;
  }, [extractDraft]);

  const extractFields = React.useMemo<EntityFieldDef[]>(
    () => [
      { name: "profile", label: "Profile", type: "text", required: true },
      { name: "collection", label: "Collection", type: "text", required: true },
      { name: "provider", label: "Provider", type: "select", options: PROVIDER_OPTIONS },
      { name: "text", label: "Text", type: "textarea", required: true, rows: 10, placeholder: "Paste document text to extract canonical structure from." },
    ],
    []
  );

  const openExtract = () => {
    setExtractDraft({
      profile: app.sourceConfig.profile || "default",
      collection: app.sourceConfig.collection || "default",
      provider: "internal",
      text: "",
    });
    setExtractOpen(true);
  };

  const submitExtract = async () => {
    if (Object.keys(extractErrors).length > 0) return;
    await run("extract", async () => {
      const out = await api.structureExtract({
        profile: extractDraft.profile.trim(),
        collection: extractDraft.collection.trim(),
        provider: extractDraft.provider,
        text: extractDraft.text,
      });
      await listDocuments();
      return out;
    });
    setExtractOpen(false);
  };

  const viewDocument = async (row: StructureDocumentRow) => {
    await run("view", async () => {
      const [document, outline] = await Promise.all([
        api.structureDocumentGet(row.structure_document_id),
        api.structureOutlineGet(row.structure_document_id).catch(() => ({})),
      ]);
      const combined = { document, outline };
      setViewData(combined);
      setViewOpen(true);
      return combined;
    });
  };

  const deleteDocument = async (row: StructureDocumentRow) => {
    await run("delete", async () => {
      const out = await api.structureDocumentDelete(row.structure_document_id);
      await listDocuments();
      return out;
    });
  };

  const columns: DataColumn<StructureDocumentRow>[] = [
    {
      id: "structure_document_id",
      header: "Structure Document ID",
      cell: (row) => (
        <Button
          variant="link"
          size="sm"
          className="h-auto p-0"
          data-testid="structure-doc-id"
          onClick={() => void viewDocument(row)}
        >
          {row.structure_document_id}
        </Button>
      ),
      sortable: true,
      sortValue: (row) => row.structure_document_id,
    },
    { id: "profile", header: "Profile", cell: (row) => row.profile_id || "-", sortable: true, sortValue: (row) => row.profile_id },
    { id: "collection", header: "Collection", cell: (row) => row.collection_id || "-", sortable: true, sortValue: (row) => row.collection_id },
    { id: "page_count", header: "Pages", cell: (row) => String(row.page_count) },
    { id: "status", header: "Status", cell: (row) => row.status || "-" },
    { id: "quality_score", header: "Quality", cell: (row) => (row.quality_score == null ? "-" : row.quality_score.toFixed(3)) },
    { id: "language_hints", header: "Languages", cell: (row) => (row.language_hints.length ? row.language_hints.join(", ") : "-") },
    {
      id: "actions",
      header: "Actions",
      cell: (row) => (
        <div className="flex flex-wrap gap-2" data-testid="structure-doc-row">
          <Button size="sm" variant="secondary" data-testid="structure-doc-view" onClick={() => void viewDocument(row)}>
            View
          </Button>
          <Button
            size="sm"
            variant="destructive"
            data-testid="structure-doc-delete"
            disabled={!canWrite}
            onClick={() => {
              if (window.confirm(`Delete structure document ${row.structure_document_id}?`)) void deleteDocument(row);
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
        <h1 className="text-2xl font-semibold">Document Structure</h1>
        <Button variant="secondary" size="sm" data-testid="structure-doc-refresh" onClick={() => void listDocuments()}>
          List Documents
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
          <h2 className="text-lg font-semibold">Structure documents</h2>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button data-testid="structure-extract-open" disabled={!canWrite} onClick={openExtract}>
              Extract Document
            </Button>
            <Button variant="secondary" size="sm" onClick={() => void listDocuments()}>
              Refresh
            </Button>
          </div>
          <DataTable
            tableId="structure-document-list"
            ariaLabel="structure document list"
            rows={documents}
            getRowId={(row) => row.structure_document_id}
            columns={columns}
            emptyMessage="No structure documents extracted yet."
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
            Shows the raw API response from the last extract, view, or delete operation.
          </p>
        </CardHeader>
        <CardContent>
          <JsonExplorer title="result" data={result ?? {}} defaultExpanded />
        </CardContent>
      </Card>

      <EntityDialog
        open={extractOpen}
        onOpenChange={setExtractOpen}
        title="Extract Document Structure"
        body={(
          <div className="space-y-4" data-testid="structure-extract-form">
            <EntityForm
              fields={extractFields}
              values={extractDraft as unknown as Record<string, unknown>}
              errors={extractErrors}
              mode="add"
              submitLabel="Extract"
              onChange={(name, value) => setExtractDraft((current) => ({ ...current, [name]: value }) as ExtractDraft)}
              onSubmit={() => void submitExtract()}
              onCancel={() => setExtractOpen(false)}
            />
          </div>
        )}
      />

      <EntityDialog
        open={viewOpen}
        onOpenChange={setViewOpen}
        title="View Structure Document"
        body={(
          <div className="space-y-4" data-testid="structure-doc-view-body">
            <JsonExplorer title="document + outline" data={asRecord(viewData)} defaultExpanded />
          </div>
        )}
      />
    </div>
  );
}
