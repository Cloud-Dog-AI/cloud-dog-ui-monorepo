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
  RelativeTime,
  createDataTableActionColumn,
  type DataColumn,
  type EntityFieldDef,
} from "@cloud-dog/ui";
import { useChartState } from "../state/AppState";
import { JsonDetailDialog, PageHeader, StatusLine, errMessage, useEntityList } from "../lib/ui";
import type { Profile } from "../lib/types";

type FormState = Readonly<{
  profile_id: string;
  name: string;
  description: string;
  renderer: string;
  locale: string;
  default_style_id: string;
  asset_retention_days: string;
}>;

const EMPTY_FORM: FormState = {
  profile_id: "",
  name: "",
  description: "",
  renderer: "",
  locale: "en-GB",
  default_style_id: "",
  asset_retention_days: "7",
};

function toForm(profile: Profile | null): FormState {
  if (!profile) return EMPTY_FORM;
  return {
    profile_id: profile.profile_id ?? "",
    name: profile.name ?? "",
    description: profile.description ?? "",
    renderer: profile.renderer ?? "",
    locale: profile.locale ?? "en-GB",
    default_style_id: profile.default_style_id ?? profile.default_style_pack_id ?? "",
    asset_retention_days: String(profile.asset_retention_days ?? 7),
  };
}

export function ProfilesPage() {
  const { api, appVersion } = useChartState();
  const { rows, loading, error, reload } = useEntityList<Profile>(() => api.listProfiles(), [api]);
  const [rendererOptions, setRendererOptions] = React.useState<string[]>([]);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [mode, setMode] = React.useState<"add" | "edit">("add");
  const [form, setForm] = React.useState<FormState>(EMPTY_FORM);
  const [detail, setDetail] = React.useState<Profile | null>(null);
  const [confirmDelete, setConfirmDelete] = React.useState<Profile | null>(null);
  const [status, setStatus] = React.useState<string | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);

  React.useEffect(() => {
    void api
      .listRenderers()
      .then((status) => setRendererOptions(Object.keys(status.allowed ?? {})))
      .catch(() => setRendererOptions([]));
  }, [api]);

  const fields: EntityFieldDef[] = [
    { name: "profile_id", label: "Profile ID — unique identifier", type: "text", required: true },
    { name: "name", label: "Name", type: "text" },
    { name: "description", label: "Description", type: "text" },
    {
      name: "renderer",
      label: "Default Renderer",
      type: "select",
      options: rendererOptions.length ? rendererOptions : ["vega_lite", "matplotlib", "great_tables"],
    },
    { name: "locale", label: "Locale (e.g. en-GB)", type: "text" },
    { name: "default_style_id", label: "Default Style Pack ID", type: "text" },
    { name: "asset_retention_days", label: "Asset Retention (days)", type: "text" },
  ];

  const openAdd = () => {
    setMode("add");
    setForm(EMPTY_FORM);
    setFormError(null);
    setDialogOpen(true);
  };

  const openEdit = (profile: Profile) => {
    setMode("edit");
    setForm(toForm(profile));
    setFormError(null);
    setDialogOpen(true);
  };

  const submit = async () => {
    setFormError(null);
    const retention = Number(form.asset_retention_days);
    const payload: Record<string, unknown> = {
      profile_id: form.profile_id.trim(),
      name: form.name.trim() || form.profile_id.trim(),
      description: form.description.trim(),
      renderer: form.renderer.trim() || undefined,
      locale: form.locale.trim() || undefined,
      default_style_id: form.default_style_id.trim() || undefined,
      asset_retention_days: Number.isFinite(retention) ? retention : undefined,
    };
    try {
      if (mode === "edit") {
        await api.updateProfile(form.profile_id.trim(), payload);
        setStatus(`Updated profile ${form.profile_id.trim()}.`);
      } else {
        await api.createProfile(payload);
        setStatus(`Created profile ${form.profile_id.trim()}.`);
      }
      setDialogOpen(false);
      await reload();
    } catch (e) {
      setFormError(errMessage(e, "Failed to save profile."));
    }
  };

  const remove = async (profile: Profile) => {
    try {
      await api.deleteProfile(profile.profile_id);
      setStatus(`Deleted profile ${profile.profile_id}.`);
      await reload();
    } catch (e) {
      setStatus(null);
      window.setTimeout(() => undefined, 0);
      throw e;
    }
  };

  const columns: DataColumn<Profile>[] = [
    {
      id: "profile_id",
      header: "Profile",
      sortable: true,
      sortValue: (row) => row.profile_id,
      cell: (row) => (
        <button
          type="button"
          className="text-left font-medium text-primary underline-offset-2 hover:underline"
          onClick={() => setDetail(row)}
        >
          {row.profile_id}
        </button>
      ),
    },
    { id: "name", header: "Name", sortable: true, sortValue: (row) => row.name ?? "", cell: (row) => row.name || "—" },
    { id: "renderer", header: "Renderer", sortable: true, sortValue: (row) => row.renderer ?? "", cell: (row) => row.renderer || "—" },
    { id: "locale", header: "Locale", sortable: true, sortValue: (row) => row.locale ?? "", cell: (row) => row.locale || "—" },
    {
      id: "retention",
      header: "Retention",
      sortable: true,
      sortValue: (row) => row.asset_retention_days ?? 0,
      cell: (row) => (row.asset_retention_days != null ? `${row.asset_retention_days} days` : "—"),
    },
    {
      id: "created",
      header: "Created",
      sortable: true,
      sortValue: (row) => row.created_at ?? "",
      cell: (row) => (row.created_at ? <RelativeTime timestamp={row.created_at} /> : "—"),
    },
    createDataTableActionColumn<Profile>((row) => [
      { id: "view", label: "View", onClick: () => setDetail(row) },
      { id: "edit", label: "Edit", onClick: () => openEdit(row) },
      {
        id: "audit",
        label: "Audit Log",
        href: () => `/audit-log?query=profile:${encodeURIComponent(row.profile_id)}`,
        title: () => `View Audit Log for profile ${row.profile_id}`,
      },
      { id: "delete", label: "Delete", destructive: true, onClick: () => setConfirmDelete(row) },
    ]),
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Profiles" version={appVersion} description="Chart rendering profiles — renderer, locale, style, and retention policy.">
        <Button variant="secondary" size="sm" onClick={() => void reload()}>
          Refresh
        </Button>
        <Button onClick={openAdd}>Add Profile</Button>
      </PageHeader>

      <StatusLine loading={loading} error={error} status={status} />

      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(row) => row.profile_id}
        emptyMessage="No profiles configured."
        pageSize={10}
        columnPickerEnabled
        tableId="chart-mcp-profiles"
      />

      <EntityDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={mode === "add" ? "Add Profile" : "Edit Profile"}
        fields={mode === "edit" ? fields.map((f) => (f.name === "profile_id" ? { ...f, type: "text" } : f)) : fields}
        values={form as unknown as Record<string, unknown>}
        onChange={(name, value) => setForm((cur) => ({ ...cur, [name]: String(value ?? "") }))}
        onSubmit={() => void submit()}
        onCancel={() => setDialogOpen(false)}
        mode={mode}
        extra={formError ? <p role="alert" className="text-sm text-destructive">{formError}</p> : undefined}
      />

      <JsonDetailDialog
        open={!!detail}
        onOpenChange={(open) => { if (!open) setDetail(null); }}
        label={`Profile ${detail?.profile_id ?? ""}`}
        data={detail ?? {}}
      />

      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(open) => { if (!open) setConfirmDelete(null); }}
        title="Delete Profile"
        description="Permanently delete this profile. This action cannot be undone."
        targetName={confirmDelete?.profile_id}
        confirmLabel="Delete Profile"
        confirmVariant="destructive"
        onConfirm={() => {
          const target = confirmDelete;
          setConfirmDelete(null);
          if (target) {
            void remove(target).catch((e) => setStatus(errMessage(e, "Failed to delete profile.")));
          }
        }}
      />
    </div>
  );
}
