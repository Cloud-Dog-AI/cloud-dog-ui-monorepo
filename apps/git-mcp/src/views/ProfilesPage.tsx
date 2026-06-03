import * as React from "react";
import { Button, Card, CardContent, CardHeader, DataTable, EntityDialog, Input, type BulkAction, type DataColumn, type EntityFieldDef } from "@cloud-dog/ui";
import { profileTemplate, useGitMcpState } from "../state/AppState";
import type { ProfileRecord } from "../lib/types";

type ProfileFormState = Readonly<{
  name: string;
  source: string;
  defaultBranch: string;
  credentialMode: string;
}>;

type DialogMode = "add" | "edit" | "view";

const fields: EntityFieldDef[] = [
  { name: "name", label: "Profile name", type: "text", required: true, readOnly: false },
  { name: "source", label: "Repository URL", type: "text", required: true },
  { name: "defaultBranch", label: "Default branch", type: "text", required: true },
  { name: "credentialMode", label: "Credential mode", type: "select", options: ["session", "stored"], required: true },
];

function exportProfiles(rows: ProfileRecord[]) {
  const blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "git-mcp-profiles.json";
  anchor.click();
  URL.revokeObjectURL(url);
}

export function ProfilesPage() {
  const app = useGitMcpState();
  const [profiles, setProfiles] = React.useState<ProfileRecord[]>([]);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [dialogMode, setDialogMode] = React.useState<DialogMode>("add");
  const [editingName, setEditingName] = React.useState("");
  const [form, setForm] = React.useState<ProfileFormState>({
    name: "",
    source: app.remoteRepoUrl,
    defaultBranch: "main",
    credentialMode: "session",
  });
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [status, setStatus] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);

  const refresh = React.useCallback(async () => {
    setError(null);
    try {
      const nextProfiles = await app.loadProfiles();
      setProfiles(nextProfiles);
      setStatus(`Loaded ${nextProfiles.length} profiles.`);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load profiles.");
    }
  }, [app]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  React.useEffect(() => {
    setPage(1);
  }, [query]);

  const resetForm = React.useCallback(() => {
    setEditingName("");
    setErrors({});
    setForm({
      name: "",
      source: app.remoteRepoUrl,
      defaultBranch: "main",
      credentialMode: "session",
    });
  }, [app.remoteRepoUrl]);

  const openDialog = (mode: DialogMode, profile?: ProfileRecord) => {
    setDialogMode(mode);
    if (!profile) {
      resetForm();
      setDialogOpen(true);
      return;
    }
    setEditingName(profile.name);
    setErrors({});
    setForm({
      name: profile.name,
      source: profile.source || app.remoteRepoUrl,
      defaultBranch: profile.defaultBranch || "main",
      credentialMode: "session",
    });
    setDialogOpen(true);
  };

  const saveProfile = async () => {
    const nextErrors: Record<string, string> = {};
    if (!form.name.trim()) nextErrors.name = "Profile name is required.";
    if (!form.source.trim()) nextErrors.source = "Repository URL is required.";
    if (!form.defaultBranch.trim()) nextErrors.defaultBranch = "Default branch is required.";
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    setError(null);
    const payload = profileTemplate(form.source.trim(), form.defaultBranch.trim());
    payload.auth = { credential_mode: form.credentialMode || "session" };
    const outcome = editingName
      ? await app.updateProfile(editingName, payload)
      : await app.createProfile(form.name.trim(), payload);

    if (!outcome.ok) {
      setError(outcome.errorMessage || "Profile save failed.");
      return;
    }

    setStatus(editingName ? `Updated profile ${editingName}.` : `Created profile ${form.name.trim()}.`);
    setDialogOpen(false);
    resetForm();
    await refresh();
  };

  const removeProfile = async (profileName: string) => {
    const outcome = await app.deleteProfile(profileName);
    if (!outcome.ok) {
      setError(outcome.errorMessage || `Failed to delete ${profileName}.`);
      return;
    }
    setStatus(`Deleted profile ${profileName}.`);
    await refresh();
  };

  const columns: DataColumn<ProfileRecord>[] = [
    { id: "name", header: "Name", cell: (row) => row.name, sortable: true, sortValue: (row) => row.name },
    { id: "source", header: "Source", cell: (row) => row.source || "-", sortable: true, sortValue: (row) => row.source || "" },
    { id: "branch", header: "Default branch", cell: (row) => row.defaultBranch || "main", sortable: true, sortValue: (row) => row.defaultBranch || "main" },
    {
      id: "actions",
      header: "Actions",
      cell: (row) => (
        <div className="flex flex-wrap gap-1">
          <Button size="sm" variant="secondary" onClick={() => openDialog("view", row)}>
            View
          </Button>
          <Button size="sm" variant="secondary" onClick={() => openDialog("edit", row)}>
            Edit
          </Button>
          <Button size="sm" variant="destructive" onClick={() => void removeProfile(row.name)}>
            Delete
          </Button>
        </div>
      ),
    },
  ];

  const filteredProfiles = React.useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return profiles;
    return profiles.filter((row) => `${row.name} ${row.source || ""} ${row.defaultBranch || "main"}`.toLowerCase().includes(trimmed));
  }, [profiles, query]);

  const bulkActions = React.useMemo<BulkAction[]>(() => [
    { label: "Delete selected", action: "delete" },
    { label: "Export", action: "export" },
  ], []);

  const onBulkAction = React.useCallback((action: string, selectedIds: string[]) => {
    const rows = filteredProfiles.filter((row) => selectedIds.includes(row.name));
    if (action === "delete") {
      void (async () => {
        for (const row of rows) {
          await removeProfile(row.name);
        }
      })();
      return;
    }
    if (action === "export") {
      exportProfiles(rows);
    }
  }, [filteredProfiles]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">Profiles</h1>
        <Button onClick={() => openDialog("add")}>Add Profile</Button>
      </header>

      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      {status ? <p role="status" className="text-sm text-foreground/80">{status}</p> : null}

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Stored profiles</h2>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Input
              className="max-w-md"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search profiles..."
              aria-label="Search profiles"
            />
            <Button variant="secondary" onClick={() => void refresh()}>Refresh</Button>
          </div>
          <DataTable
            tableId="git-mcp.profiles.columns"
            columns={columns}
            rows={filteredProfiles}
            totalRows={profiles.length}
            getRowId={(row) => row.name}
            emptyMessage="No profiles available."
            page={page}
            onPageChange={setPage}
            pageSize={pageSize}
            onPageSizeChange={setPageSize}
            selectable={true}
            bulkActions={bulkActions}
            onBulkAction={onBulkAction}
            columnPickerEnabled={true}
          />
        </CardContent>
      </Card>

      <EntityDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}
        title={
          dialogMode === "add"
            ? "Add Profile"
            : dialogMode === "view"
              ? `View Profile ${form.name}`
              : `Edit Profile ${editingName}`
        }
        fields={fields.map((field) => ({
          ...field,
          readOnly: dialogMode === "view" || (field.name === "name" && dialogMode === "edit"),
        }))}
        values={form}
        errors={errors}
        mode={dialogMode}
        onChange={(name, value) => setForm((current) => ({ ...current, [name]: String(value) }))}
        onSubmit={() => void (dialogMode === "view" ? Promise.resolve() : saveProfile())}
        onCancel={() => {
          setDialogOpen(false);
          resetForm();
        }}
      />
    </div>
  );
}
