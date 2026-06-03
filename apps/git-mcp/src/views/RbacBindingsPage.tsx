import * as React from "react";
import { Badge, Button, Card, CardContent, CardHeader, DataTable, EntityDialog, Input, JsonBlock, type BulkAction, type DataColumn, type EntityFieldDef } from "@cloud-dog/ui";
import { useGitMcpState } from "../state/AppState";

type RbacRow = Readonly<{
  id: string;
  subject: string;
  subjectType: "user" | "group";
  roles: string[];
}>;

type BindingFormState = Readonly<{
  userId: string;
  group: string;
  role: string;
}>;

const ROLE_OPTIONS = ["reader", "writer", "maintainer", "admin"];

type RoleDefinition = Readonly<{ role: string; description: string; permissions: string }>;
const STANDARD_ROLES: RoleDefinition[] = [
  { role: "admin", description: "Full access: system configuration, user management, all CRUD, MCP admin", permissions: "*" },
  { role: "maintainer", description: "Manage repositories, branches, and merge operations", permissions: "repos:read, repos:write, branches:manage, repos:admin" },
  { role: "writer", description: "Push commits, create branches, submit PRs", permissions: "repos:read, repos:write, branches:create" },
  { role: "reader", description: "Read-only access to repositories and branches", permissions: "repos:read" },
];
const roleDefColumns: DataColumn<RoleDefinition>[] = [
  { id: "role", header: "Role", cell: (r) => <Badge>{r.role}</Badge>, sortable: true, sortValue: (r) => r.role },
  { id: "description", header: "Description", cell: (r) => r.description },
  { id: "permissions", header: "Permissions", cell: (r) => <span className="text-xs font-mono">{r.permissions}</span> },
];
const fields: EntityFieldDef[] = [
  { name: "userId", label: "User ID", type: "text", required: true },
  { name: "group", label: "Group", type: "text" },
  { name: "role", label: "Role", type: "select", options: ROLE_OPTIONS, required: true },
];

export function RbacBindingsPage() {
  const app = useGitMcpState();
  const [bindings, setBindings] = React.useState<Record<string, string[]>>({});
  const [groups, setGroups] = React.useState<Array<{ groupId: string; roles: string[]; description: string; members: string[] }>>([]);
  const [inspectedUserId, setInspectedUserId] = React.useState("");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [form, setForm] = React.useState<BindingFormState>({ userId: "ui-rbac-user", group: "", role: "writer" });
  const [status, setStatus] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);

  const rows: RbacRow[] = [
    ...Object.entries(bindings).map(([name, roles]) => ({ id: `user:${name}`, subject: name, subjectType: "user" as const, roles })),
    ...groups
      .filter((group) => group.roles.length > 0)
      .map((group) => ({ id: `group:${group.groupId}`, subject: group.groupId, subjectType: "group" as const, roles: group.roles })),
  ].sort((a, b) => a.subject.localeCompare(b.subject));

  const loadGroups = React.useCallback(async () => {
    const items = await app.loadGroups();
    setGroups(items);
  }, [app]);

  React.useEffect(() => {
    void loadGroups().catch(() => {});
  }, [loadGroups]);

  React.useEffect(() => {
    setPage(1);
  }, [query]);

  React.useEffect(() => {
    if (!rows.length) {
      setInspectedUserId("");
      return;
    }
    setInspectedUserId((current) => (rows.some((row) => row.id === current) ? current : rows[0].id));
  }, [rows]);

  const bindRole = async () => {
    setError(null);
    const groupCandidate = form.group.trim();
    const userCandidate = form.userId.trim();
    if (groupCandidate) {
      const group = groups.find((item) => item.groupId === groupCandidate);
      if (!group) {
        setError(`Unknown group: ${groupCandidate}`);
        return;
      }
      const roles = Array.from(new Set([...group.roles, form.role])).sort();
      const outcome = await app.updateGroup(groupCandidate, {
        description: group.description,
        roles,
        members: group.members,
      });
      if (!outcome.ok) {
        setError(outcome.errorMessage || "Group role binding failed.");
        return;
      }
      await loadGroups();
      setInspectedUserId(`group:${groupCandidate}`);
      setStatus(`Bound role ${form.role} to group ${groupCandidate}.`);
      setDialogOpen(false);
      return;
    }
    if (!userCandidate) {
      setError("User ID or Group is required.");
      return;
    }
    await app.runApiTool("admin_user_create", {
      user_id: userCandidate,
      username: userCandidate,
      email: `${userCandidate}@example.test`,
    });
    const outcome = await app.runApiTool("admin_rbac_bind", {
      user_id: userCandidate,
      role: form.role,
    });
    if (!outcome.ok) {
      setError(outcome.errorMessage);
      return;
    }

    const result = (outcome.data ?? {}) as { roles?: string[] };
    const nextRoles = Array.isArray(result.roles) ? result.roles : [];
    setBindings((current) => ({
      ...current,
      [userCandidate]: nextRoles,
    }));
    setInspectedUserId(`user:${userCandidate}`);
    setStatus(`Bound role ${form.role} to ${userCandidate}.`);
    setDialogOpen(false);
  };

  const unbindRole = async (row: RbacRow, targetRole?: string) => {
    setError(null);
    if (row.subjectType === "group") {
      const group = groups.find((item) => item.groupId === row.subject);
      if (!group) return;
      const roles = targetRole ? group.roles.filter((role) => role !== targetRole) : [];
      const outcome = await app.updateGroup(row.subject, {
        description: group.description,
        roles,
        members: group.members,
      });
      if (!outcome.ok) {
        setError(outcome.errorMessage || "Group role unbind failed.");
        return;
      }
      await loadGroups();
      setStatus(`Unbound role from group ${row.subject}.`);
      return;
    }
    const targetUser = row.subject;
    const role = targetRole || row.roles[0];
    if (!role) return;
    const outcome = await app.runApiTool("admin_rbac_unbind", {
      user_id: targetUser,
      role,
    });
    if (!outcome.ok) {
      setError(outcome.errorMessage);
      return;
    }

    const result = (outcome.data ?? {}) as { roles?: string[] };
    const nextRoles = Array.isArray(result.roles) ? result.roles : [];
    setBindings((current) => ({
      ...current,
      [targetUser]: nextRoles,
    }));
    setStatus(`Unbound role ${role} from ${targetUser}.`);
  };

  const columns: DataColumn<RbacRow>[] = [
    { id: "subject", header: "Subject", cell: (row) => row.subject, sortable: true, sortValue: (row) => row.subject },
    { id: "subjectType", header: "Type", cell: (row) => <Badge variant="secondary">{row.subjectType}</Badge>, sortable: true, sortValue: (row) => row.subjectType },
    {
      id: "roles",
      header: "Roles",
      cell: (row) => (
        <div className="flex flex-wrap gap-1">
          {row.roles.length ? (
            row.roles.map((item) => (
              <span key={`${row.id}-${item}`} className="inline-flex items-center gap-1">
                <Badge>{item}</Badge>
                <Button size="sm" variant="secondary" onClick={() => void unbindRole(row, item)}>
                  Unbind
                </Button>
              </span>
            ))
          ) : (
            <span className="text-sm text-muted-foreground">No roles</span>
          )}
        </div>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: (row) => (
        <div className="flex flex-wrap gap-1">
          <Button size="sm" variant="secondary" onClick={() => setInspectedUserId(row.id)}>
            Inspect
          </Button>
          <Button size="sm" variant="destructive" onClick={() => void unbindRole(row)}>
            Delete
          </Button>
        </div>
      ),
    },
  ];

  const filteredRows = React.useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return rows;
    return rows.filter((row) => `${row.subject} ${row.subjectType} ${row.roles.join(" ")}`.toLowerCase().includes(trimmed));
  }, [query, rows]);

  const bulkActions = React.useMemo<BulkAction[]>(() => [{ label: "Unbind selected", action: "unbind" }], []);

  const onBulkAction = React.useCallback((_action: string, selectedIds: string[]) => {
    const selectedRows = filteredRows.filter((row) => selectedIds.includes(row.id));
    void (async () => {
      for (const row of selectedRows) {
        for (const roleName of row.roles) {
          await unbindRole(row, roleName);
        }
      }
    })();
  }, [filteredRows]);

  const inspectedRow = React.useMemo(
    () => rows.find((row) => row.id === inspectedUserId) ?? null,
    [inspectedUserId, rows],
  );

  const effectivePermissions = React.useMemo(() => {
    if (!inspectedRow) return [];
    const permissions = new Set<string>();
    for (const roleName of inspectedRow.roles) {
      const match = STANDARD_ROLES.find((candidate) => candidate.role === roleName);
      if (!match) continue;
      for (const permission of match.permissions.split(",").map((item) => item.trim()).filter(Boolean)) {
        permissions.add(permission);
      }
    }
    return Array.from(permissions).sort();
  }, [inspectedRow]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">RBAC Bindings</h1>
        <Button onClick={() => setDialogOpen(true)}>Bind Role</Button>
      </header>

      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      {status ? <p role="status" className="text-sm text-foreground/80">{status}</p> : null}

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Role Definitions (PS-71 IW5)</h2>
        </CardHeader>
        <CardContent>
          <DataTable columns={roleDefColumns} rows={STANDARD_ROLES} getRowId={(r) => r.role} emptyMessage="No roles defined." tableId="git-mcp-rbac-roles" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Current bindings</h2>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input className="max-w-md" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search RBAC bindings..." aria-label="Search RBAC bindings" />
          <DataTable
            tableId="git-mcp.rbac.columns"
            columns={columns}
            rows={filteredRows}
            totalRows={rows.length}
            getRowId={(row) => row.id}
            emptyMessage="No RBAC bindings recorded yet."
            page={page}
            onPageChange={setPage}
            pageSize={pageSize}
            onPageSizeChange={setPageSize}
            selectable={true}
            selectionColumnPosition="end"
            getSelectionLabel={(row) => `Select RBAC binding ${row.subject}`}
            bulkActions={bulkActions}
            onBulkAction={onBulkAction}
            columnPickerEnabled={true}
          />
        </CardContent>
      </Card>

      {inspectedRow ? (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Effective permissions</h2>
          </CardHeader>
          <CardContent>
            <JsonBlock
              title={`RBAC ${inspectedRow.subject}`}
              value={{
                subject: inspectedRow.subject,
                subject_type: inspectedRow.subjectType,
                direct_roles: inspectedRow.roles,
                effective_permissions: effectivePermissions,
              }}
              defaultCollapsed={false}
            />
          </CardContent>
        </Card>
      ) : null}

      <EntityDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title="Bind RBAC Role"
        fields={fields}
        values={form}
        mode="add"
        onChange={(name, value) => setForm((current) => ({ ...current, [name]: String(value) }))}
        onSubmit={() => void bindRole()}
        onCancel={() => setDialogOpen(false)}
      />
    </div>
  );
}
