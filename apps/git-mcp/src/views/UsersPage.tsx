import * as React from "react";
import { Badge, Button, Card, CardContent, CardHeader, DataTable, EntityDialog, Input, JsonBlock, type BulkAction, type DataColumn, type EntityFieldDef } from "@cloud-dog/ui";
import { useGitMcpState } from "../state/AppState";
import type { UserRecord } from "../lib/types";

type UserFormState = Readonly<{
  userId: string;
  username: string;
  email: string;
  groupIds: string[];
}>;

function makeGroupFields(groups: Array<{ groupId: string }>): EntityFieldDef[] {
  const groupOptions = groups.map((g) => g.groupId);
  return [
    { name: "userId", label: "User ID", type: "text", required: true },
    { name: "username", label: "Username", type: "text", required: true },
    { name: "email", label: "Email", type: "text" },
    { name: "groupIds", label: "Groups", type: "multiselect", options: groupOptions },
  ];
}

function exportUsers(rows: UserRecord[]) {
  const blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "git-mcp-users.json";
  anchor.click();
  URL.revokeObjectURL(url);
}

export function UsersPage() {
  const app = useGitMcpState();
  const [users, setUsers] = React.useState<UserRecord[]>([]);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingUserId, setEditingUserId] = React.useState("");
  const [form, setForm] = React.useState<UserFormState>({ userId: "", username: "", email: "", groupIds: [] });
  const [groups, setGroups] = React.useState<Array<{ groupId: string }>>([]);

  React.useEffect(() => {
    app.loadGroups().then((items) => setGroups(items)).catch(() => {});
  }, [app]);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [status, setStatus] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [inspectedUserId, setInspectedUserId] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);

  const refresh = React.useCallback(async () => {
    setError(null);
    try {
      const items = await app.loadUsers();
      setUsers(items);
      setStatus(`Loaded ${items.length} users.`);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load users.");
    }
  }, [app]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  React.useEffect(() => {
    setPage(1);
  }, [query]);

  React.useEffect(() => {
    if (!users.length) {
      setInspectedUserId("");
      return;
    }
    setInspectedUserId((current) => (users.some((row) => row.userId === current) ? current : users[0].userId));
  }, [users]);

  const resetForm = React.useCallback(() => {
    setEditingUserId("");
    setForm({ userId: "", username: "", email: "", groupIds: [] });
    setErrors({});
  }, []);

  const openAdd = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (user: UserRecord) => {
    setEditingUserId(user.userId);
    setForm({
      userId: user.userId,
      username: user.username || user.userId,
      email: user.email || "",
      groupIds: [...user.groupIds],
    });
    setErrors({});
    setDialogOpen(true);
  };

  const saveUser = async () => {
    const nextErrors: Record<string, string> = {};
    if (!form.userId.trim()) nextErrors.userId = "User ID is required.";
    if (!form.username.trim()) nextErrors.username = "Username is required.";
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    const payload = {
      username: form.username.trim() || form.userId.trim(),
      email: form.email.trim(),
      group_ids: form.groupIds,
      status: "active",
    };
    const outcome = editingUserId
      ? await app.updateUser(editingUserId, payload)
      : await app.createUser(form.userId.trim(), payload);
    if (!outcome.ok) {
      setError(outcome.errorMessage || "User save failed.");
      return;
    }
    setStatus(editingUserId ? `Updated user ${editingUserId}.` : `Created user ${form.userId.trim()}.`);
    setDialogOpen(false);
    resetForm();
    await refresh();
  };

  const removeUser = async (userId: string) => {
    const outcome = await app.deleteUser(userId);
    if (!outcome.ok) {
      setError(outcome.errorMessage || `Failed to delete ${userId}.`);
      return;
    }
    setStatus(`Deleted user ${userId}.`);
    await refresh();
  };

  const columns: DataColumn<UserRecord>[] = [
    { id: "username", header: "Username", cell: (row) => row.username || "-", sortable: true, sortValue: (row) => row.username || "" },
    { id: "displayName", header: "Display Name", cell: (row) => (row as Record<string, unknown>).displayName ? String((row as Record<string, unknown>).displayName) : row.username || "-", sortable: true, sortValue: (row) => String((row as Record<string, unknown>).displayName ?? row.username ?? "") },
    { id: "email", header: "Email", cell: (row) => row.email || "-", sortable: true, sortValue: (row) => row.email || "" },
    {
      id: "role",
      header: "Role",
      cell: (row) => {
        const primaryRole = row.roles.includes("admin") ? "admin" : row.roles[0] ?? "";
        return primaryRole ? <Badge role="status" className="badge">{primaryRole}</Badge> : <span className="text-sm text-muted-foreground">No role</span>;
      },
      sortable: true,
      sortValue: (row) => (row.roles.includes("admin") ? "admin" : row.roles[0] ?? ""),
    },
    {
      id: "status",
      header: "Status",
      cell: (row) => <Badge variant={row.status === "disabled" ? "destructive" : "default"} className={row.status === "disabled" ? "" : "bg-emerald-600 text-white border-emerald-700"}>{row.status || "active"}</Badge>,
      sortable: true,
      sortValue: (row) => row.status || "active",
    },
    {
      id: "groups",
      header: "Groups",
      cell: (row) => row.groupIds.length ? <div className="flex flex-wrap gap-1">{row.groupIds.map((item) => <Badge key={`${row.userId}-${item}`}>{item}</Badge>)}</div> : <span className="text-sm text-muted-foreground">No groups</span>,
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
          <Button size="sm" variant="secondary" onClick={() => setInspectedUserId(row.userId)}>
            Inspect
          </Button>
          <Button size="sm" variant="destructive" onClick={() => void removeUser(row.userId)}>
            Delete
          </Button>
        </div>
      ),
    },
  ];

  const filteredUsers = React.useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return users;
    return users.filter((row) =>
      `${row.userId} ${row.username || ""} ${row.email || ""} ${row.groupIds.join(" ")} ${row.roles.join(" ")}`
        .toLowerCase()
        .includes(trimmed),
    );
  }, [query, users]);

  const bulkActions = React.useMemo<BulkAction[]>(() => [
    { label: "Delete selected", action: "delete" },
    { label: "Export", action: "export" },
  ], []);

  const onBulkAction = React.useCallback((action: string, selectedIds: string[]) => {
    const rows = filteredUsers.filter((row) => selectedIds.includes(row.userId));
    if (action === "delete") {
      void (async () => {
        for (const row of rows) {
          await removeUser(row.userId);
        }
      })();
      return;
    }
    if (action === "export") {
      exportUsers(rows);
    }
  }, [filteredUsers]);

  const inspectedUser = React.useMemo(
    () => users.find((row) => row.userId === inspectedUserId) ?? null,
    [inspectedUserId, users],
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">Users</h1>
        <Button onClick={openAdd}>Add User</Button>
      </header>

      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      {status ? <p role="status" className="text-sm text-foreground/80">{status}</p> : null}

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Managed users</h2>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Input
              className="max-w-md"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search users..."
              aria-label="Search users"
            />
            <Button variant="secondary" onClick={() => void refresh()}>Refresh</Button>
          </div>
          <DataTable
            tableId="git-mcp.users.columns"
            columns={columns}
            rows={filteredUsers}
            totalRows={users.length}
            getRowId={(row) => row.userId}
            emptyMessage="No users available."
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

      {inspectedUser ? (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Raw user inspection</h2>
          </CardHeader>
          <CardContent>
            <JsonBlock title={`User ${inspectedUser.userId}`} value={inspectedUser} defaultCollapsed={false} />
          </CardContent>
        </Card>
      ) : null}

      <EntityDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}
        title={editingUserId ? `Edit User ${editingUserId}` : "Add User"}
        fields={makeGroupFields(groups).map((field) => ({ ...field, readOnly: field.name === "userId" && Boolean(editingUserId) }))}
        values={form}
        errors={errors}
        mode={editingUserId ? "edit" : "add"}
        onChange={(name, value) => setForm((current) => ({ ...current, [name]: name === "groupIds" ? (Array.isArray(value) ? value : String(value).split(",").map((s: string) => s.trim()).filter(Boolean)) : String(value) }))}
        onSubmit={() => void saveUser()}
        onCancel={() => {
          setDialogOpen(false);
          resetForm();
        }}
      />
    </div>
  );
}
