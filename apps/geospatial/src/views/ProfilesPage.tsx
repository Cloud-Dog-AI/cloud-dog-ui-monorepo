// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
//
// Licensed under the Apache License, Version 2.0.

import * as React from "react";
import { useAuth } from "@cloud-dog/auth";
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
import { useGeoState } from "../state/AppState";
import { JsonDetailDialog, PageHeader, StatusLine, errMessage, useEntityList } from "../lib/ui";
import type { GeoProfile } from "../lib/api";

const WRITE_ROLES = new Set(["geo.operator", "geo.analyst", "geo.admin", "admin", "read-write"]);

type FormState = Readonly<{ profile_id: string; name: string; description: string }>;
const EMPTY_FORM: FormState = { profile_id: "", name: "", description: "" };

export function ProfilesPage() {
  const { api, appVersion } = useGeoState();
  const auth = useAuth();
  const canWrite = (auth.user?.roles ?? []).some((r) => WRITE_ROLES.has(r));
  const { rows, loading, error, reload } = useEntityList<GeoProfile>(() => api.listProfiles(), [api]);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [mode, setMode] = React.useState<"add" | "edit">("add");
  const [form, setForm] = React.useState<FormState>(EMPTY_FORM);
  const [detail, setDetail] = React.useState<GeoProfile | null>(null);
  const [confirmDelete, setConfirmDelete] = React.useState<GeoProfile | null>(null);
  const [status, setStatus] = React.useState<string | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);

  const fields: EntityFieldDef[] = [
    { name: "profile_id", label: "Profile ID — unique identifier", type: "text", required: true },
    { name: "name", label: "Name", type: "text" },
    { name: "description", label: "Description", type: "text" },
  ];

  const openAdd = () => {
    setMode("add");
    setForm(EMPTY_FORM);
    setFormError(null);
    setDialogOpen(true);
  };
  const openEdit = (p: GeoProfile) => {
    setMode("edit");
    setForm({ profile_id: p.profile_id ?? "", name: (p.name as string) ?? "", description: (p.description as string) ?? "" });
    setFormError(null);
    setDialogOpen(true);
  };

  const submit = async () => {
    setFormError(null);
    const payload = { profile_id: form.profile_id.trim(), name: form.name.trim() || form.profile_id.trim(), description: form.description.trim() };
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
      setFormError(errMessage(e, "Failed to save profile (you may lack permission)."));
    }
  };

  const remove = async (p: GeoProfile) => {
    await api.deleteProfile(p.profile_id ?? "");
    setStatus(`Deleted profile ${p.profile_id}.`);
    await reload();
  };

  const columns: DataColumn<GeoProfile>[] = [
    {
      id: "profile_id",
      header: "Profile",
      sortable: true,
      sortValue: (r) => r.profile_id ?? "",
      cell: (r) => (
        <button type="button" aria-label={`Open profile ${String(r.name ?? r.profile_id ?? "details")}`} className="text-left font-medium text-primary underline-offset-2 hover:underline" onClick={() => setDetail(r)}>
          {r.profile_id || "(unnamed)"}
        </button>
      ),
    },
    { id: "name", header: "Name", sortable: true, sortValue: (r) => (r.name as string) ?? "", cell: (r) => (r.name as string) || "—" },
    {
      id: "created",
      header: "Created",
      sortable: true,
      sortValue: (r) => (r.created_at as string) ?? "",
      cell: (r) => (r.created_at ? <RelativeTime timestamp={r.created_at as string} /> : "—"),
    },
    createDataTableActionColumn<GeoProfile>((r) => [
      { id: "view", label: "View", onClick: () => setDetail(r) },
      ...(canWrite
        ? [
            { id: "edit", label: "Edit", onClick: () => openEdit(r) },
            { id: "delete", label: "Delete", destructive: true, onClick: () => setConfirmDelete(r) },
          ]
        : []),
    ]),
  ];

  return (
    <div className="space-y-6" data-testid="page-profiles">
      <PageHeader title="Profiles" version={appVersion} description="Geospatial profiles — tenant-scoped configuration for sessions and rendering.">
        <Button variant="secondary" size="sm" onClick={() => void reload()}>
          Refresh
        </Button>
        {canWrite ? <Button onClick={openAdd} data-testid="profiles-add">Add Profile</Button> : null}
      </PageHeader>

      <StatusLine loading={loading} error={error} status={status} />

      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(r) => r.profile_id ?? ""}
        emptyMessage="No profiles configured."
        pageSize={10}
        columnPickerEnabled
        tableId="geospatial-profiles"
      />

      <EntityDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={mode === "add" ? "Add Profile" : "Edit Profile"}
        fields={fields}
        values={form as unknown as Record<string, unknown>}
        onChange={(name, value) => setForm((cur) => ({ ...cur, [name]: String(value ?? "") }))}
        onSubmit={() => void submit()}
        onCancel={() => setDialogOpen(false)}
        mode={mode}
        extra={formError ? <p role="alert" className="text-sm text-destructive">{formError}</p> : undefined}
      />

      <JsonDetailDialog open={!!detail} onOpenChange={(o) => { if (!o) setDetail(null); }} label={`Profile ${detail?.profile_id ?? ""}`} data={detail ?? {}} />

      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(o) => { if (!o) setConfirmDelete(null); }}
        title="Delete Profile"
        description="Permanently delete this profile. This action cannot be undone."
        targetName={confirmDelete?.profile_id}
        confirmLabel="Delete Profile"
        confirmVariant="destructive"
        onConfirm={() => {
          const target = confirmDelete;
          setConfirmDelete(null);
          if (target) void remove(target).catch((e) => setStatus(errMessage(e, "Failed to delete profile (you may lack permission).")));
        }}
      />
    </div>
  );
}
