import * as React from 'react';
import { Button, statusColumn, type EntityFieldDef, type EntityFormMode, type RelatedItem } from '@cloud-dog/ui';
import { useExpertAgentState } from '../state/AppState';
import type { ApiKeyRecord, CreateApiKeyResult, GroupRecord, UserRecord } from '../lib/api';
import { AppDataTable, CrudEntityDialog } from '../lib/data-table-adapter';
import { LoadingNote, PageScaffold, SummaryGrid, formatBoolean, formatCount, renderRelativeTime } from './shared';


type ApiKeyForm = {
  name: string;
  user_id: string;
  group_id: string;
  expires_days: number;
  read_channels: boolean;
  read_logs: boolean;
  read_histories: boolean;
};

const emptyForm: ApiKeyForm = {
  name: '', user_id: '', group_id: '', expires_days: 30, read_channels: true, read_logs: true, read_histories: true,
};

export function ApiKeysPage() {
  const { api, latestFailure, captureFailure, clearFailure } = useExpertAgentState();
  const [apiKeys, setApiKeys] = React.useState<ApiKeyRecord[]>([]);
  const [users, setUsers] = React.useState<UserRecord[]>([]);
  const [groups, setGroups] = React.useState<GroupRecord[]>([]);
  const [form, setForm] = React.useState<ApiKeyForm>(emptyForm);
  const [createdKey, setCreatedKey] = React.useState<CreateApiKeyResult | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [status, setStatus] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    clearFailure();
    setLoading(true);
    try {
      const [keyRecords, userRecords, groupRecords] = await Promise.all([
        api.listApiKeys({ includeRevoked: true }), api.listUsers(), api.listGroups(),
      ]);
      setApiKeys(keyRecords);
      setUsers(userRecords);
      setGroups(groupRecords);
    } catch (error) {
      captureFailure(error);
    } finally {
      setLoading(false);
    }
  }, [api, captureFailure, clearFailure]);

  React.useEffect(() => { void refresh(); }, [refresh]);

  const fields: EntityFieldDef[] = React.useMemo(() => [
    { name: 'name', label: 'Name', type: 'text', required: true },
    { name: 'user_id', label: 'User', type: 'select', options: users.map((user) => String(user.id)) },
    { name: 'group_id', label: 'Bind key to group', type: 'select', options: groups.map((group) => String(group.id)) },
    { name: 'expires_days', label: 'Expiry (days)', type: 'number' },
    { name: 'read_channels', label: 'Read channels', type: 'boolean' },
    { name: 'read_logs', label: 'Read logs', type: 'boolean' },
    { name: 'read_histories', label: 'Read histories', type: 'boolean' },
  ], [groups, users]);

  const createKey = React.useCallback(async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    clearFailure();
    try {
      const result = await api.createApiKey({
        name: form.name,
        user_id: form.user_id ? Number(form.user_id) : undefined,
        group_id: form.group_id ? Number(form.group_id) : undefined,
        expires_days: form.expires_days,
        read_channels: form.read_channels,
        read_logs: form.read_logs,
        read_histories: form.read_histories,
      });
      setCreatedKey(result);
      setStatus(`Created API key ${result.name ?? result.id}.`);
      setDialogOpen(false);
      setForm(emptyForm);
      await refresh();
    } catch (error) {
      captureFailure(error);
    } finally {
      setSaving(false);
    }
  }, [api, captureFailure, clearFailure, form, refresh]);

  const revokeKey = React.useCallback(async (apiKey: ApiKeyRecord) => {
    if (!window.confirm(`Revoke API key ${apiKey.name ?? apiKey.id}?`)) return;
    clearFailure();
    try {
      await api.revokeApiKey(apiKey.id);
      setStatus(`Revoked API key ${apiKey.name ?? apiKey.id}.`);
      await refresh();
    } catch (error) {
      captureFailure(error);
    }
  }, [api, captureFailure, clearFailure, refresh]);

  const activeUser = users.find((user) => String(user.id) === form.user_id) ?? null;
  const activeGroup = groups.find((group) => String(group.id) === form.group_id) ?? null;
  const relatedUser: RelatedItem[] = activeUser ? [{ id: String(activeUser.id), label: activeUser.username }] : [];
  const relatedGroup: RelatedItem[] = activeGroup ? [{ id: String(activeGroup.id), label: activeGroup.name }] : [];

  return (
    <PageScaffold title="API Keys" description="API key CRUD and group binding using shared table and dialog patterns." alert={latestFailure} status={status}>
      <LoadingNote loading={loading} />
      <SummaryGrid items={[
        { label: 'Active keys', value: formatCount(apiKeys.filter((item) => !item.revoked).length) },
        { label: 'Revoked keys', value: formatCount(apiKeys.filter((item) => item.revoked).length) },
        { label: 'Group-bound', value: formatCount(apiKeys.filter((item) => item.group_id != null).length) },
      ]} />
      <div className="flex justify-end">
        <Button type="button" onClick={() => setDialogOpen(true)}>Create API Key</Button>
      </div>
      {createdKey ? (
        <div className="rounded-xl border bg-background p-4">
          <p className="font-medium">Generated key</p>
          <p className="break-all font-mono text-xs">{createdKey.key}</p>
        </div>
      ) : null}
      <AppDataTable
        title="API key inventory"
        rows={apiKeys}
        getRowId={(apiKey) => String(apiKey.id)}
        emptyMessage="No API keys reported by the backend."
        itemLabel="api keys"
        onRefresh={refresh}
        columns={[
          { id: 'id', header: 'Key ID', sortable: true, sortValue: (apiKey) => String(apiKey.id), cell: (apiKey) => <span className="font-mono text-xs">{String(apiKey.id).slice(0, 8)}...</span> },
          { id: 'name', header: 'Label', sortable: true, sortValue: (apiKey) => apiKey.name ?? '', cell: (apiKey) => apiKey.name ?? `Key ${apiKey.id}` },
          { id: 'owner', header: 'Owner', sortable: true, sortValue: (apiKey) => { const u = users.find((user) => user.id === apiKey.user_id); return u?.username ?? ''; }, cell: (apiKey) => { const u = users.find((user) => user.id === apiKey.user_id); return u?.username ?? 'N/A'; } },
          { id: 'created', header: 'Created', sortable: true, sortValue: (apiKey) => apiKey.created_at ?? '', cell: (apiKey) => renderRelativeTime(apiKey.created_at) },
          { id: 'expires', header: 'Expires', sortable: true, sortValue: (apiKey) => apiKey.expires_at ?? '', cell: (apiKey) => apiKey.expires_at ? renderRelativeTime(apiKey.expires_at) : 'Never' },
          statusColumn<ApiKeyRecord>({ getValue: (apiKey) => apiKey.revoked ? 'revoked' : 'active' }),
        ]}
        rowActions={[{ label: 'Revoke', variant: 'destructive', onClick: (apiKey) => void revokeKey(apiKey) }]}
        bulkActions={[{ label: 'Revoke Selected', variant: 'destructive', onClick: (rows) => { if (window.confirm(`Revoke ${rows.length} selected API keys?`)) { void Promise.all(rows.map((k) => api.revokeApiKey(k.id))).then(() => refresh()); } } }]}
      />
      <CrudEntityDialog
        open={dialogOpen}
        title="Create API Key"
        mode={'add' as EntityFormMode}
        fields={fields}
        values={form}
        onChange={(name, value) => setForm((current) => ({ ...current, [name]: value as never }))}
        onSubmit={() => void createKey()}
        onCancel={() => { setDialogOpen(false); setForm(emptyForm); }}
        relatedPanels={[
          { title: 'Selected user', items: relatedUser, emptyMessage: 'This key is not scoped to a user.' },
          { title: 'Selected group', items: relatedGroup, emptyMessage: 'This key is not bound to a group.' },
        ]}
        extra={saving ? <p className="text-sm text-muted-foreground">Creating API key...</p> : null}
      />
    </PageScaffold>
  );
}
