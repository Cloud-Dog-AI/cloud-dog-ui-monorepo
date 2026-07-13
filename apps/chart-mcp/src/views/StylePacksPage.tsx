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

import * as React from "react";
import {
  Button,
  ConfirmDialog,
  DataTable,
  EntityDialog,
  Label,
  RelativeTime,
  Textarea,
  createDataTableActionColumn,
  type DataColumn,
  type EntityFieldDef,
} from "@cloud-dog/ui";
import { useChartState } from "../state/AppState";
import { JsonDetailDialog, PageHeader, StatusLine, errMessage, useEntityList } from "../lib/ui";
import type { StylePack } from "../lib/types";

type FormState = Readonly<{ style_id: string; name: string; description: string; definitionJson: string }>;

const EMPTY_FORM: FormState = { style_id: "", name: "", description: "", definitionJson: "{}" };

function styleDefinition(pack: StylePack): unknown {
  return pack.definition ?? pack.spec_json ?? {};
}

function toForm(pack: StylePack | null): FormState {
  if (!pack) return EMPTY_FORM;
  return {
    style_id: pack.style_id ?? "",
    name: pack.name ?? "",
    description: pack.description ?? "",
    definitionJson: JSON.stringify(styleDefinition(pack), null, 2),
  };
}

export function StylePacksPage() {
  const { api, appVersion } = useChartState();
  const { rows, loading, error, reload } = useEntityList<StylePack>(() => api.listStylePacks(), [api]);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [mode, setMode] = React.useState<"add" | "edit">("add");
  const [form, setForm] = React.useState<FormState>(EMPTY_FORM);
  const [detail, setDetail] = React.useState<StylePack | null>(null);
  const [confirmDelete, setConfirmDelete] = React.useState<StylePack | null>(null);
  const [status, setStatus] = React.useState<string | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);

  const fields: EntityFieldDef[] = [
    { name: "style_id", label: "Style Pack ID — unique identifier", type: "text", required: true },
    { name: "name", label: "Name", type: "text" },
    { name: "description", label: "Description", type: "text" },
  ];

  const openAdd = () => {
    setMode("add");
    setForm(EMPTY_FORM);
    setFormError(null);
    setDialogOpen(true);
  };

  const openEdit = (pack: StylePack) => {
    setMode("edit");
    setForm(toForm(pack));
    setFormError(null);
    setDialogOpen(true);
  };

  const duplicate = (pack: StylePack) => {
    setMode("add");
    setForm({
      style_id: `${pack.style_id}-copy`,
      name: pack.name ? `${pack.name} (copy)` : "",
      description: pack.description ?? "",
      definitionJson: JSON.stringify(styleDefinition(pack), null, 2),
    });
    setFormError(null);
    setDialogOpen(true);
  };

  const submit = async () => {
    setFormError(null);
    let definition: unknown = {};
    try {
      definition = form.definitionJson.trim() ? JSON.parse(form.definitionJson) : {};
    } catch {
      setFormError("Definition must be valid JSON.");
      return;
    }
    const payload: Record<string, unknown> = {
      style_id: form.style_id.trim(),
      name: form.name.trim() || form.style_id.trim(),
      description: form.description.trim(),
      definition,
    };
    try {
      if (mode === "edit") {
        await api.updateStylePack(form.style_id.trim(), payload);
        setStatus(`Updated style pack ${form.style_id.trim()}.`);
      } else {
        await api.createStylePack(payload);
        setStatus(`Created style pack ${form.style_id.trim()}.`);
      }
      setDialogOpen(false);
      await reload();
    } catch (e) {
      setFormError(errMessage(e, "Failed to save style pack."));
    }
  };

  const remove = async (pack: StylePack) => {
    await api.deleteStylePack(pack.style_id);
    setStatus(`Deleted style pack ${pack.style_id}.`);
    await reload();
  };

  const columns: DataColumn<StylePack>[] = [
    {
      id: "style_id",
      header: "Style Pack",
      sortable: true,
      sortValue: (row) => row.style_id,
      cell: (row) => (
        <button type="button" className="text-left font-medium text-primary hover:underline" onClick={() => setDetail(row)}>
          {row.style_id}
        </button>
      ),
    },
    { id: "name", header: "Name", sortable: true, sortValue: (row) => row.name ?? "", cell: (row) => row.name || "—" },
    { id: "description", header: "Description", cell: (row) => row.description || "—" },
    {
      id: "updated",
      header: "Updated",
      sortable: true,
      sortValue: (row) => row.updated_at ?? row.created_at ?? "",
      cell: (row) => (row.updated_at || row.created_at ? <RelativeTime timestamp={(row.updated_at ?? row.created_at)!} /> : "—"),
    },
    createDataTableActionColumn<StylePack>((row) => [
      { id: "view", label: "View", onClick: () => setDetail(row) },
      { id: "edit", label: "Edit", onClick: () => openEdit(row) },
      { id: "duplicate", label: "Duplicate", onClick: () => duplicate(row) },
      { id: "delete", label: "Delete", destructive: true, onClick: () => setConfirmDelete(row) },
    ]),
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Style Packs" version={appVersion} description="Reusable colour, typography, layout and table-formatting definitions for brand-safe output.">
        <Button variant="secondary" size="sm" onClick={() => void reload()}>
          Refresh
        </Button>
        <Button onClick={openAdd}>Add Style Pack</Button>
      </PageHeader>

      <StatusLine loading={loading} error={error} status={status} />

      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(row) => row.style_id}
        emptyMessage="No style packs."
        pageSize={10}
        columnPickerEnabled
        tableId="chart-mcp-style-packs"
      />

      <EntityDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={mode === "add" ? "Add Style Pack" : "Edit Style Pack"}
        fields={fields}
        values={form as unknown as Record<string, unknown>}
        onChange={(name, value) => setForm((cur) => ({ ...cur, [name]: String(value ?? "") }))}
        onSubmit={() => void submit()}
        onCancel={() => setDialogOpen(false)}
        mode={mode}
        extra={
          <div className="space-y-2 border-t pt-4">
            <Label htmlFor="style-definition">Definition (JSON)</Label>
            <Textarea
              id="style-definition"
              rows={10}
              className="font-mono text-xs"
              value={form.definitionJson}
              onChange={(e) => setForm((cur) => ({ ...cur, definitionJson: e.target.value }))}
            />
            {formError ? <p role="alert" className="text-sm text-destructive">{formError}</p> : null}
          </div>
        }
      />

      <JsonDetailDialog
        open={!!detail}
        onOpenChange={(open) => { if (!open) setDetail(null); }}
        label={`Style Pack ${detail?.style_id ?? ""}`}
        data={detail ? styleDefinition(detail) : {}}
      />

      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(open) => { if (!open) setConfirmDelete(null); }}
        title="Delete Style Pack"
        description="Permanently delete this style pack. Profiles referencing it fall back to defaults."
        targetName={confirmDelete?.style_id}
        confirmLabel="Delete Style Pack"
        confirmVariant="destructive"
        onConfirm={() => {
          const target = confirmDelete;
          setConfirmDelete(null);
          if (target) void remove(target).catch((e) => setStatus(errMessage(e, "Failed to delete style pack.")));
        }}
      />
    </div>
  );
}
