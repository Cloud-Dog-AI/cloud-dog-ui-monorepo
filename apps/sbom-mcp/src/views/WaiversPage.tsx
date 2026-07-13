// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
// Licensed under the Apache License 2.0

import * as React from "react";
import { useSearchParams } from "react-router-dom";
import {
  Button,
  DataTable,
  Dialog,
  Input,
  Select,
  StatusBadge,
  Textarea,
  createDataTableActionColumn,
  type DataColumn,
} from "@cloud-dog/ui";
import { useSbomState } from "../state/AppState";
import { PageHeader, StatusLine, errMessage } from "../lib/ui";
import type { CreateWaiverRequest, WaiverResponse } from "../lib/types";

type WaiverForm = CreateWaiverRequest;

function defaultExpiry(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
}

function toExpiryIso(date: string): string {
  return new Date(`${date}T23:59:59.000Z`).toISOString();
}

const emptyForm = (finding = ""): WaiverForm => ({
  cve_or_finding_id: finding,
  scope: "global",
  scope_value: "",
  expiry: defaultExpiry(),
  reason: "",
});

export function WaiversPage() {
  const { api, appVersion } = useSbomState();
  const [params] = useSearchParams();
  const [rows, setRows] = React.useState<WaiverResponse[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [statusFilter, setStatusFilter] = React.useState("");
  const [expiryFilter, setExpiryFilter] = React.useState("");
  const [editing, setEditing] = React.useState<WaiverResponse | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [form, setForm] = React.useState<WaiverForm>(() => emptyForm(params.get("finding") ?? ""));

  React.useEffect(() => {
    const finding = params.get("finding");
    const scan = params.get("scan");
    if (finding) {
      setForm((current) => ({
        ...current,
        cve_or_finding_id: finding,
        scope: scan ? "scan" : current.scope,
        scope_value: scan ?? current.scope_value,
      }));
      setCreateOpen(true);
    }
  }, [params]);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.listWaivers(200);
      setRows(result.items);
    } catch (e) {
      setError(errMessage(e, "Failed to load waivers."));
    } finally {
      setLoading(false);
    }
  }, [api]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const filtered = React.useMemo(() => {
    const now = Date.now();
    const soon = now + 30 * 24 * 60 * 60 * 1000;
    return rows.filter((row) => {
      if (statusFilter && row.status !== statusFilter) return false;
      const expiry = new Date(row.expiry).getTime();
      if (expiryFilter === "expired" && expiry >= now) return false;
      if (expiryFilter === "next30" && (expiry < now || expiry > soon)) return false;
      return true;
    });
  }, [expiryFilter, rows, statusFilter]);

  const submitCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const body = { ...form, expiry: toExpiryIso(form.expiry), scope_value: form.scope_value || null };
      const created = await api.createWaiver(body);
      setRows((current) => [created, ...current.filter((row) => row.waiver_id !== created.waiver_id)]);
      setNotice(`Created waiver ${created.waiver_id}`);
      setCreateOpen(false);
      setForm(emptyForm());
    } catch (e) {
      setError(errMessage(e, "Failed to create waiver."));
    } finally {
      setSaving(false);
    }
  };

  const submitUpdate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editing) return;
    setSaving(true);
    setError(null);
    try {
      const body = {
        reason: form.reason,
        ...(form.expiry !== editing.expiry.slice(0, 10) ? { expiry: toExpiryIso(form.expiry) } : {}),
      };
      const updated = await api.updateWaiver(editing.waiver_id, body);
      setRows((current) => current.map((row) => (row.waiver_id === updated.waiver_id ? updated : row)));
      setNotice(`Updated waiver ${updated.waiver_id}`);
      setEditing(null);
    } catch (e) {
      setError(errMessage(e, "Failed to update waiver."));
    } finally {
      setSaving(false);
    }
  };

  const revoke = async (row: WaiverResponse) => {
    setSaving(true);
    setError(null);
    try {
      const revoked = await api.revokeWaiver(row.waiver_id);
      setRows((current) => current.map((item) => (item.waiver_id === revoked.waiver_id ? revoked : item)));
      setNotice(`Revoked waiver ${revoked.waiver_id}`);
    } catch (e) {
      setError(errMessage(e, "Failed to revoke waiver."));
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (row: WaiverResponse) => {
    setEditing(row);
    setForm({
      cve_or_finding_id: row.cve_or_finding_id,
      scope: row.scope,
      scope_value: row.scope_value ?? "",
      expiry: row.expiry.slice(0, 10),
      reason: row.reason,
    });
  };

  const columns: DataColumn<WaiverResponse>[] = [
    { id: "cve_or_finding_id", header: "Finding", sortable: true, sortValue: (r) => r.cve_or_finding_id, cell: (r) => <span className="font-mono text-xs">{r.cve_or_finding_id}</span> },
    { id: "scope", header: "Scope", sortable: true, sortValue: (r) => r.scope, cell: (r) => `${r.scope}${r.scope_value ? `: ${r.scope_value}` : ""}` },
    { id: "expiry", header: "Expiry", sortable: true, sortValue: (r) => r.expiry, cell: (r) => <span className="text-xs text-muted-foreground">{r.expiry}</span> },
    { id: "granted_by", header: "Granted By", sortable: true, sortValue: (r) => r.granted_by, cell: (r) => r.granted_by },
    { id: "reason", header: "Reason", cell: (r) => r.reason },
    { id: "status", header: "State", sortable: true, sortValue: (r) => r.status, cell: (r) => <StatusBadge value={r.status} /> },
    createDataTableActionColumn<WaiverResponse>((row) => [
      { id: "edit", label: "Update", onClick: () => openEdit(row), disabled: () => row.status !== "active" },
      { id: "revoke", label: "Revoke", destructive: true, onClick: () => void revoke(row), disabled: () => row.status !== "active" || saving },
    ]),
  ];

  const statuses = [...new Set(rows.map((row) => row.status))].sort();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Waivers"
        version={appVersion}
        description="PS-99 waiver registrations with create, update, revoke, and expiry state."
      >
        <Button variant="secondary" size="sm" onClick={() => void load()}>Refresh</Button>
        <Button size="sm" onClick={() => setCreateOpen(true)}>Create Waiver</Button>
      </PageHeader>

      <div className="grid gap-3 md:grid-cols-[16rem_16rem]">
        <Select aria-label="Filter waiver state" value={statusFilter} onChange={(event) => setStatusFilter(event.currentTarget.value)}>
          <option value="">Any state</option>
          {statuses.map((item) => <option key={item} value={item}>{item}</option>)}
        </Select>
        <Select aria-label="Filter waiver expiry" value={expiryFilter} onChange={(event) => setExpiryFilter(event.currentTarget.value)}>
          <option value="">Any expiry</option>
          <option value="next30">Next 30 days</option>
          <option value="expired">Expired</option>
        </Select>
      </div>

      <StatusLine loading={loading} error={error} status={notice ?? `${filtered.length} waivers visible`} />
      <DataTable
        columns={columns}
        rows={filtered}
        getRowId={(r) => r.waiver_id}
        getRowTestId={(r) => `waiver-row-${r.waiver_id}`}
        emptyMessage="No waivers match the current filters."
        pageSize={25}
        columnPickerEnabled
        tableId="sbom-mcp-waivers"
      />

      <WaiverDialog
        open={createOpen}
        title="Create Waiver"
        form={form}
        saving={saving}
        mode="create"
        onChange={setForm}
        onSubmit={submitCreate}
        onOpenChange={setCreateOpen}
      />
      <WaiverDialog
        open={editing !== null}
        title={editing ? `Update Waiver ${editing.waiver_id}` : "Update Waiver"}
        form={form}
        saving={saving}
        mode="update"
        onChange={setForm}
        onSubmit={submitUpdate}
        onOpenChange={(open) => { if (!open) setEditing(null); }}
      />
    </div>
  );
}

function WaiverDialog(props: Readonly<{
  open: boolean;
  title: string;
  form: WaiverForm;
  saving: boolean;
  mode: "create" | "update";
  onChange: (form: WaiverForm) => void;
  onSubmit: (event: React.FormEvent) => void;
  onOpenChange: (open: boolean) => void;
}>) {
  const set = (patch: Partial<WaiverForm>) => props.onChange({ ...props.form, ...patch });
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange} label={props.title}>
      <form className="space-y-4" onSubmit={props.onSubmit}>
        <h2 className="text-lg font-semibold">{props.title}</h2>
        <label className="block space-y-1 text-sm">
          <span>Finding or CVE</span>
          <Input
            required
            disabled={props.mode === "update"}
            value={props.form.cve_or_finding_id}
            onChange={(event) => set({ cve_or_finding_id: event.currentTarget.value })}
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span>Scope</span>
          <Select
            disabled={props.mode === "update"}
            value={props.form.scope}
            onChange={(event) => set({ scope: event.currentTarget.value })}
          >
            <option value="global">global</option>
            <option value="boundary">boundary</option>
            <option value="target">target</option>
            <option value="scan">scan</option>
          </Select>
        </label>
        <label className="block space-y-1 text-sm">
          <span>Scope Value</span>
          <Input
            disabled={props.mode === "update"}
            value={props.form.scope_value ?? ""}
            onChange={(event) => set({ scope_value: event.currentTarget.value })}
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span>Expiry</span>
          <Input required type="date" value={props.form.expiry} onChange={(event) => set({ expiry: event.currentTarget.value })} />
        </label>
        <label className="block space-y-1 text-sm">
          <span>Reason</span>
          <Textarea required value={props.form.reason} onChange={(event) => set({ reason: event.currentTarget.value })} />
        </label>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => props.onOpenChange(false)}>Cancel</Button>
          <Button type="submit" disabled={props.saving}>{props.saving ? "Saving..." : props.mode === "create" ? "Create" : "Update"}</Button>
        </div>
      </form>
    </Dialog>
  );
}
