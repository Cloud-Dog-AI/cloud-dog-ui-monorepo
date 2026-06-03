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

import * as React from 'react';
import { useConfig } from '@cloud-dog/config';
import {
  Button,
  DataTable,
  EntityDialog,
  RelatedItemsPanel,
  SettingsPanel,
  type DataColumn,
  type EntityFieldDef,
  type SettingGroupDef,
} from '@cloud-dog/ui';
import {
  EmptyState,
  ErrorState,
  JsonBlock,
  LoadingState,
  PageFrame,
  PanelCard,
  requestJson,
  useApiResource,
} from '../lib/sqlAgentApi';

type AppRuntimeConfig = {
  API_BASE_URL: string;
};

type ProfileRecord = {
  id?: string | number;
  name?: string;
  description?: string;
  database_target?: string;
  connection_uri_masked?: string;
};

type ProfilesResponse = {
  profiles?: ProfileRecord[];
};

function summariseTarget(value: string | undefined) {
  if (!value) return 'No target';
  if (value.length <= 18) return `Target: ${value}`;
  return `Target: ${value.slice(0, 8)}...${value.slice(-6)}`;
}

const PROFILE_FIELDS: EntityFieldDef[] = [
  { name: 'name', label: 'Name', type: 'text', required: true },
  { name: 'database_target', label: 'Database target', type: 'text', required: true },
  { name: 'description', label: 'Description', type: 'text' },
  { name: 'connection_uri', label: 'Connection URI', type: 'text', required: true },
  { name: 'allowed_schemas', label: 'Allowed schemas', type: 'text' },
  { name: 'allowed_tables', label: 'Allowed tables', type: 'text' },
];

function toSettingType(value: unknown): 'boolean' | 'number' | 'text' {
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') return 'number';
  return 'text';
}

function toSettingGroups(config: Record<string, unknown> | null): SettingGroupDef[] {
  if (!config) return [];

  const mappings: Array<[string, string, string[]]> = [
    ['server', 'Server', ['app', 'web_server', 'api_server']],
    ['auth', 'Auth', ['auth', 'web_server']],
    ['llm', 'LLM', ['llm']],
    ['database', 'Database', ['db', 'database']],
    ['query', 'Query Engine', ['query', 'context']],
    ['logging', 'Logging', ['log']],
  ];

  return mappings
    .map(([id, label, keys]) => {
      const settings = keys.flatMap((key) => {
        const section = config[key];
        if (!section || typeof section !== 'object' || Array.isArray(section)) return [];
        return Object.entries(section as Record<string, unknown>).map(([name, value]) => ({
          key: `${key}.${name}`,
          label: name.replace(/_/g, ' '),
          type: toSettingType(value),
          value,
          readOnly: true,
          description: `Read-only value from ${key}`,
        }));
      });
      return { id, label, settings };
    })
    .filter((group) => group.settings.length > 0);
}

export function ConfigPage() {
  const cfg = useConfig<AppRuntimeConfig>();
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);
  const config = useApiResource<Record<string, unknown>>(
    () => requestJson(cfg.API_BASE_URL, '/api/v1/config'),
    [cfg.API_BASE_URL],
  );
  const auth = useApiResource<Record<string, unknown>>(
    () => requestJson(cfg.API_BASE_URL, '/api/v1/auth/status'),
    [cfg.API_BASE_URL],
  );
  const profiles = useApiResource<ProfilesResponse>(
    () => requestJson(cfg.API_BASE_URL, '/api/v1/admin/profiles'),
    [cfg.API_BASE_URL],
  );

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [profileForm, setProfileForm] = React.useState<Record<string, unknown>>({
    name: '',
    database_target: '',
    description: '',
    connection_uri: '',
    allowed_schemas: 'public',
    allowed_tables: 'countries',
  });

  const isAdmin = Boolean((auth.data || {}).is_system_admin);
  const profileRows = React.useMemo(() => {
    const rows = [...(profiles.data?.profiles ?? [])];
    rows.sort((left, right) => {
      const rightId = Number(right.id ?? 0);
      const leftId = Number(left.id ?? 0);
      if (Number.isFinite(leftId) && Number.isFinite(rightId) && leftId !== rightId) {
        return rightId - leftId;
      }
      return String(right.name ?? '').localeCompare(String(left.name ?? ''));
    });
    return rows;
  }, [profiles.data?.profiles]);
  const settingGroups = React.useMemo(() => toSettingGroups(config.data), [config.data]);

  React.useEffect(() => {
    setPage(1);
  }, [profileRows.length]);
  const profileColumns: DataColumn<ProfileRecord>[] = [
    {
      id: 'name',
      header: 'Name',
      cell: (row) => row.name ?? 'Unnamed profile',
      sortable: true,
      sortValue: (row) => row.name ?? '',
    },
    {
      id: 'target',
      header: 'Database target',
      cell: (row) =>
        row.database_target ? (
          <span title={row.database_target}>{summariseTarget(row.database_target)}</span>
        ) : (
          'No target'
        ),
    },
    {
      id: 'connection',
      header: 'Connection',
      cell: (row) => row.connection_uri_masked ?? 'masked',
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: (row) => (
        <Button
          onClick={() => {
            if (!row.id) return;
            void deleteProfile(row.id);
          }}
          type="button"
          variant="destructive"
        >
          Delete
        </Button>
      ),
    },
  ];

  async function createProfile() {
    setSaveError(null);
    try {
      await requestJson(cfg.API_BASE_URL, '/api/v1/admin/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: String(profileForm.name || ''),
          database_target: String(profileForm.database_target || ''),
          description: String(profileForm.description || ''),
          connection_uri: String(profileForm.connection_uri || ''),
          allowed_schemas: String(profileForm.allowed_schemas || 'public')
            .split(',')
            .map((value) => value.trim())
            .filter(Boolean),
          allowed_tables: String(profileForm.allowed_tables || 'countries')
            .split(',')
            .map((value) => value.trim())
            .filter(Boolean),
          read_only: true,
          query_timeout: 300,
          max_result_rows: 1000,
        }),
      });
      profiles.refresh();
      setDialogOpen(false);
      setProfileForm({
        name: '',
        database_target: '',
        description: '',
        connection_uri: '',
        allowed_schemas: 'public',
        allowed_tables: 'countries',
      });
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : String(error));
    }
  }

  async function deleteProfile(profileId: string | number) {
    setSaveError(null);
    try {
      await requestJson(cfg.API_BASE_URL, `/api/v1/admin/profiles/${profileId}`, {
        method: 'DELETE',
      });
      profiles.refresh();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <PageFrame
      eyebrow="FR-56"
      title="Config"
      description="Inspect grouped runtime configuration through the shared settings panel and manage SQL-agent connection profiles with shared entity dialogs."
    >
      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <PanelCard id="panelConfig" title="Settings" subtitle="Read-only grouped runtime configuration">
          {config.loading ? <LoadingState label="config" /> : null}
          {config.error ? <ErrorState message={config.error} /> : null}
          {!config.loading && !config.error && settingGroups.length > 0 ? (
            <SettingsPanel groups={settingGroups} onSave={() => undefined} />
          ) : null}
        </PanelCard>

        <PanelCard title="Masked config payload" subtitle="Raw backend config response">
          {config.data ? <JsonBlock value={config.data} /> : <LoadingState label="config payload" />}
        </PanelCard>
      </div>

      <PanelCard id="panelAdminConfig" title="Config profiles" subtitle="Profile CRUD via `/api/v1/admin/profiles`">
        {!isAdmin ? (
          <EmptyState title="Admin access required" body="Sign in as a system admin to manage profiles." />
        ) : (
          <div className="space-y-4" id="adminConfigContainer">
            <div className="flex flex-wrap items-center gap-3">
              <Button id="acSaveBtn" onClick={() => setDialogOpen(true)} type="button">
                Add profile
              </Button>
              <Button onClick={profiles.refresh} type="button" variant="outline">
                Refresh
              </Button>
            </div>

            {saveError ? <ErrorState message={saveError} /> : null}

            {profiles.loading ? <LoadingState label="profiles" /> : null}
            {profiles.error ? <ErrorState message={profiles.error} /> : null}
            {!profiles.loading && !profiles.error ? (
              <DataTable
                columns={profileColumns}
                rows={profileRows}
                emptyMessage="No config profiles returned by the backend."
                getRowId={(row) => String(row.id ?? row.name ?? '')}
                page={page}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
                columnPickerEnabled
                tableId="sql-agent-config-profiles"
              />
            ) : null}

            <RelatedItemsPanel
              emptyMessage="No profiles available for export."
              items={(profiles.data?.profiles ?? []).slice(0, 5).map((profile) => ({
                id: String(profile.id ?? profile.name ?? 'profile'),
                label: `${profile.name ?? 'Unnamed'} • ${profile.database_target ?? 'target unknown'}`,
              }))}
              title="Recent profile targets"
            />
          </div>
        )}
      </PanelCard>

      <EntityDialog
        errors={saveError ? { name: saveError } : undefined}
        fields={PROFILE_FIELDS}
        mode="add"
        onCancel={() => setDialogOpen(false)}
        onChange={(name, value) => setProfileForm((current) => ({ ...current, [name]: value }))}
        onOpenChange={setDialogOpen}
        onSubmit={() => void createProfile()}
        open={dialogOpen}
        title="Create config profile"
        values={profileForm}
      />
    </PageFrame>
  );
}
