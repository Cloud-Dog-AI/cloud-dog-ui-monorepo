import * as React from "react";
import { Badge, Button, Card, CardContent, CardHeader, DataTable, EntityDialog, Input, JsonBlock, type BulkAction, type DataColumn, type EntityFieldDef } from "@cloud-dog/ui";
import { useGitMcpState } from "../state/AppState";
import type { GroupRecord } from "../lib/types";

type GroupFormState = Readonly<{
  groupId: string;
  description: string;
  roles: string[];
  members: string[];
}>;

const ROLE_OPTIONS = [
  "admin",
  "maintainer",
  "writer",
  "reader",
];

function makeGroupFields(users: Array<{ userId: string }>): EntityFieldDef[] {
  const memberOptions = users.map((u) => u.userId);
  return [
    { name: "groupId", label: "Name", type: "text", required: true },
    { name: "description", label: "Description", type: "text" },
    { name: "roles", label: "Roles", type: "multiselect", options: ROLE_OPTIONS },
    { name: "members", label: "Members", type: "multiselect", options: memberOptions },
  ];
}

function exportGroups(rows: GroupRecord[]) {
  const blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "git-mcp-groups.json";
  anchor.click();
  URL.revokeObjectURL(url);
}

export function GroupsPage() {
  const app = useGitMcpState();
  const [groups, setGroups] = React.useState<GroupRecord[]>([]);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingGroupId, setEditingGroupId] = React.useState("");
  const [form, setForm] = React.useState<GroupFormState>({ groupId: "", description: "", roles: [], members: [] });
  const [allUsers, setAllUsers] = React.useState<Array<{ userId: string }>>([]);

  React.useEffect(() => {
    app.loadUsers().then((items) => setAllUsers(items)).catch(() => {});
  }, [app]);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [status, setStatus] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [inspectedGroupId, setInspectedGroupId] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);

  const refresh = React.useCallback(async () => {
    setError(null);
    try {
      const items = await app.loadGroups();
      setGroups(items);
      setStatus(`Loaded ${items.length} groups.`);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load groups.");
    }
  }, [app]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  React.useEffect(() => {
    setPage(1);
  }, [query]);

  React.useEffect(() => {
    if (!groups.length) {
      setInspectedGroupId("");
      return;
    }
    setInspectedGroupId((current) => (groups.some((row) => row.groupId === current) ? current : groups[0].groupId));
  }, [groups]);

  const resetForm = React.useCallback(() => {
    setEditingGroupId("");
    setForm({ groupId: "", description: "", roles: [], members: [] });
    setErrors({});
  }, []);

  const openAdd = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (group: GroupRecord) => {
    setEditingGroupId(group.groupId);
    setForm({
      groupId: group.groupId,
      description: group.description || "",
      roles: [...group.roles],
      members: [...group.members],
    });
    setErrors({});
    setDialogOpen(true);
  };

  const saveGroup = async () => {
    const nextErrors: Record<string, string> = {};
    if (!form.groupId.trim()) nextErrors.groupId = "Group ID is required.";
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }
    setErrors({});
    const payload = {
      description: form.description.trim(),
      roles: form.roles,
      members: form.members,
    };
    const outcome = editingGroupId
      ? await app.updateGroup(editingGroupId, payload)
      : await app.createGroup(form.groupId.trim(), payload);
    if (!outcome.ok) {
      setError(outcome.errorMessage || "Group save failed.");
      return;
    }
    setStatus(editingGroupId ? `Updated group ${editingGroupId}.` : `Created group ${form.groupId.trim()}.`);
    setDialogOpen(false);
    resetForm();
    await refresh();
  };

  const removeGroup = async (groupId: string) => {
    const outcome = await app.deleteGroup(groupId);
    if (!outcome.ok) {
      setError(outcome.errorMessage || `Failed to delete ${groupId}.`);
      return;
    }
    setStatus(`Deleted group ${groupId}.`);
    await refresh();
  };

  const columns: DataColumn<GroupRecord>[] = [
    { id: "groupId", header: "Name", cell: (row) => row.groupId, sortable: true, sortValue: (row) => row.groupId },
    { id: "description", header: "Description", cell: (row) => row.description || "-", sortable: true, sortValue: (row) => row.description || "" },
    {
      id: "members",
      header: "Members",
      cell: (row) => (
        <div className="flex flex-wrap items-center gap-1">
          <Badge variant="secondary">{row.members.length}</Badge>
          {row.members.length ? row.members.map((member) => (
            <Badge key={`${row.groupId}-member-${member}`} variant="secondary">{member}</Badge>
          )) : <span className="text-sm text-muted-foreground">No members</span>}
        </div>
      ),
      sortable: true,
      sortValue: (row) => row.members.length,
    },
    {
      id: "roles",
      header: "Roles",
      cell: (row) => row.roles.length ? <div className="flex flex-wrap gap-1">{row.roles.map((item) => <Badge key={`${row.groupId}-role-${item}`}>{item}</Badge>)}</div> : <span className="text-sm text-muted-foreground">No roles</span>,
    },
    {
      id: "status",
      header: "Status",
      cell: () => <Badge variant="default" className="bg-emerald-600 text-white border-emerald-700">active</Badge>,
    },
    {
      id: "created",
      header: "Created",
      cell: (row) => row.createdAt || "-",
      sortable: true,
      sortValue: (row) => row.createdAt,
    },
    {
      id: "actions",
      header: "Actions",
      cell: (row) => (
        <div className="flex flex-wrap gap-1">
          <Button size="sm" variant="secondary" onClick={() => openEdit(row)}>
            Edit
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setInspectedGroupId(row.groupId)}>
            Inspect
          </Button>
          <Button size="sm" variant="destructive" onClick={() => void removeGroup(row.groupId)}>
            Delete
          </Button>
        </div>
      ),
    },
  ];

  const filteredGroups = React.useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return groups;
    return groups.filter((row) =>
      `${row.groupId} ${row.description || ""} ${row.roles.join(" ")} ${row.members.join(" ")}`
        .toLowerCase()
        .includes(trimmed),
    );
  }, [groups, query]);

  const bulkActions = React.useMemo<BulkAction[]>(() => [
    { label: "Delete selected", action: "delete" },
    { label: "Export", action: "export" },
  ], []);

  const onBulkAction = React.useCallback((action: string, selectedIds: string[]) => {
    const rows = filteredGroups.filter((row) => selectedIds.includes(row.groupId));
    if (action === "delete") {
      void (async () => {
        for (const row of rows) {
          await removeGroup(row.groupId);
        }
      })();
      return;
    }
    if (action === "export") {
      exportGroups(rows);
    }
  }, [filteredGroups]);

  const inspectedGroup = React.useMemo(
    () => groups.find((row) => row.groupId === inspectedGroupId) ?? null,
    [groups, inspectedGroupId],
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">Groups</h1>
        <Button onClick={openAdd}>Add Group</Button>
      </header>

      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      {status ? <p role="status" className="text-sm text-foreground/80">{status}</p> : null}

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Managed groups</h2>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Input className="max-w-md" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search groups..." aria-label="Search groups" />
            <Button variant="secondary" onClick={() => void refresh()}>Refresh</Button>
          </div>
          <DataTable
            tableId="git-mcp.groups.columns"
            columns={columns}
            rows={filteredGroups}
            totalRows={groups.length}
            getRowId={(row) => row.groupId}
            emptyMessage="No groups available."
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

      {inspectedGroup ? (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Raw group inspection</h2>
          </CardHeader>
          <CardContent>
            <JsonBlock title={`Group ${inspectedGroup.groupId}`} value={inspectedGroup} defaultCollapsed={false} />
          </CardContent>
        </Card>
      ) : null}

      <EntityDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}
        title={editingGroupId ? `Edit Group ${editingGroupId}` : "Add Group"}
        fields={makeGroupFields(allUsers).map((field) => ({ ...field, readOnly: field.name === "groupId" && Boolean(editingGroupId) }))}
        values={form}
        errors={errors}
        mode={editingGroupId ? "edit" : "add"}
        onChange={(name, value) => setForm((current) => ({ ...current, [name]: (name === "roles" || name === "members") ? (Array.isArray(value) ? value : String(value).split(",").map((s: string) => s.trim()).filter(Boolean)) : String(value) }))}
        onSubmit={() => void saveGroup()}
        onCancel={() => {
          setDialogOpen(false);
          resetForm();
        }}
      />
    </div>
  );
}
