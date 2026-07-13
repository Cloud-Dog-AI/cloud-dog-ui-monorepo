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

// @cloud-dog/ui — SettingsPanel pattern (PS-73 Settings/configuration shell).

import * as React from "react";
import { cn } from "../utils/cn";
import { Badge } from "../components/layout/Badge";
import { Button } from "../components/button/Button";
import { Card, CardContent, CardHeader } from "../components/card/Card";
import { ConfirmDialog } from "../components/dialog/ConfirmDialog";
import { Input } from "../components/input/Input";
import { JsonExplorer } from "./JsonExplorer";
import type { JsonExplorerSourceMap } from "./JsonExplorer";
import { SettingGroup } from "./SettingGroup";
import type { SettingDef } from "./SettingControl";

export type SettingGroupDef = Readonly<{
  id: string;
  label: string;
  settings: SettingDef[];
}>;

export type SettingsPanelServerTab = Readonly<{
  id: string;
  label: string;
  data: unknown;
  sources?: JsonExplorerSourceMap;
  description?: string;
  badge?: string;
  disabled?: boolean;
  emptyLabel?: string;
}>;

export type SettingsPanelStatus = Readonly<{
  label: string;
  value?: string | number;
  variant?: "default" | "secondary" | "destructive";
  testId?: string;
}>;

export type SettingsPanelProps = Readonly<{
  groups?: SettingGroupDef[];
  onSave?: (key: string, value: unknown) => void;
  onExport?: () => void;
  onImport?: () => void;
  onRefresh?: () => void;
  className?: string;

  title?: string;
  description?: string;
  eyebrow?: string;
  serviceName?: string;
  version?: string;
  environment?: string;
  statusItems?: readonly SettingsPanelStatus[];

  configData?: unknown;
  sources?: JsonExplorerSourceMap;
  serverTabs?: readonly SettingsPanelServerTab[];
  activeServerId?: string;
  defaultServerId?: string;
  onActiveServerChange?: (serverId: string) => void;
  searchTerm?: string;
  onSearchTermChange?: (value: string) => void;
  maxDepth?: number;
  maskToken?: string;
  revealedSecrets?: ReadonlySet<string>;
  /** DM-SET-01: alignment of the JsonExplorer table-mode Value column. Default "left". */
  alignValues?: "left" | "right";

  loading?: boolean;
  error?: React.ReactNode;
  emptyState?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;

  canExport?: boolean;
  canImport?: boolean;
  canRefresh?: boolean;
  canRevealSecrets?: boolean;
  secretsRevealed?: boolean;
  onRevealSecrets?: () => void;
  revealSecretsLabel?: string;
  hideSecretsLabel?: string;

  confirmRevealOpen?: boolean;
  onConfirmReveal?: () => void;
  onCancelReveal?: () => void;
  revealConfirmTitle?: string;
  revealConfirmDescription?: string;
}>;

const EMPTY_CONFIG = Object.freeze({});

function sanitizeServerId(id: string): string {
  return id.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-");
}

function hasInspectableData(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  if (value && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>).length > 0;
  }
  return value !== undefined && value !== null && value !== "";
}

function buildTabs(props: SettingsPanelProps): readonly SettingsPanelServerTab[] {
  if (props.serverTabs && props.serverTabs.length > 0) {
    return props.serverTabs;
  }
  if (props.configData !== undefined || props.sources) {
    return [
      {
        id: "all",
        label: "ALL",
        data: props.configData ?? EMPTY_CONFIG,
        sources: props.sources,
      },
    ];
  }
  return [];
}

function SettingsPanelLegacy(props: SettingsPanelProps) {
  const groups = props.groups ?? [];
  const [activeGroup, setActiveGroup] = React.useState(groups[0]?.id ?? "");

  React.useEffect(() => {
    if (activeGroup && groups.some((group) => group.id === activeGroup)) {
      return;
    }
    setActiveGroup(groups[0]?.id ?? "");
  }, [activeGroup, groups]);

  return (
    <div
      data-testid="settings-panel"
      className={cn("flex rounded-md border bg-background", props.className)}
    >
      <nav className="w-48 shrink-0 border-r p-3 space-y-1" aria-label="Settings groups">
        {groups.map((group) => (
          <button
            key={group.id}
            type="button"
            className={cn(
              "w-full text-left text-sm rounded-md px-2 py-1.5 hover:bg-muted/50",
              group.id === activeGroup ? "bg-primary/10 font-medium" : "",
            )}
            onClick={() => setActiveGroup(group.id)}
            aria-label={`${group.label} settings group`}
          >
            {group.label}
          </button>
        ))}

        {props.onExport || props.onImport ? (
          <div className="pt-3 space-y-1">
            {props.onExport ? (
              <Button variant="secondary" size="sm" className="w-full" onClick={props.onExport}>
                Export
              </Button>
            ) : null}
            {props.onImport ? (
              <Button variant="secondary" size="sm" className="w-full" onClick={props.onImport}>
                Import
              </Button>
            ) : null}
          </div>
        ) : null}
      </nav>

      <div className="flex-1 min-w-0 p-4 space-y-4">
        {groups
          .filter((group) => group.id === activeGroup)
          .map((group) => (
            <SettingGroup
              key={group.id}
              label={group.label}
              settings={group.settings}
              onChange={props.onSave ?? (() => undefined)}
              defaultExpanded
            />
          ))}
      </div>
    </div>
  );
}

export function SettingsPanel(props: SettingsPanelProps) {
  const tabs = buildTabs(props);
  const firstEnabledTab = tabs.find((tab) => !tab.disabled) ?? tabs[0];
  const [localActiveServerId, setLocalActiveServerId] = React.useState(
    props.defaultServerId ?? firstEnabledTab?.id ?? "",
  );
  const [internalSearch, setInternalSearch] = React.useState("");

  React.useEffect(() => {
    const requested = props.activeServerId ?? localActiveServerId;
    if (requested && tabs.some((tab) => tab.id === requested && !tab.disabled)) {
      return;
    }
    if (firstEnabledTab?.id) {
      setLocalActiveServerId(firstEnabledTab.id);
      props.onActiveServerChange?.(firstEnabledTab.id);
    }
  }, [firstEnabledTab?.id, localActiveServerId, props, tabs]);

  if (tabs.length === 0) {
    return <SettingsPanelLegacy {...props} />;
  }

  const activeServerId = props.activeServerId ?? localActiveServerId;
  const activeTab = tabs.find((tab) => tab.id === activeServerId && !tab.disabled) ?? firstEnabledTab;
  const searchValue = props.searchTerm ?? internalSearch;
  const showExport = props.onExport && props.canExport !== false;
  const showImport = props.onImport && props.canImport !== false;
  const showRefresh = props.onRefresh && props.canRefresh !== false;
  const showReveal = props.onRevealSecrets && props.canRevealSecrets !== false;
  const title = props.title ?? "Settings";
  const onSave = props.onSave;
  const editableGroups = props.groups && onSave ? props.groups : [];

  const onSearchChange = (value: string) => {
    setInternalSearch(value);
    props.onSearchTermChange?.(value);
  };

  const onServerChange = (serverId: string) => {
    setLocalActiveServerId(serverId);
    props.onActiveServerChange?.(serverId);
  };

  return (
    <section
      data-testid="settings-panel"
      className={cn("space-y-4", props.className)}
      aria-label={`${title} panel`}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-1">
          {props.eyebrow ? (
            <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">{props.eyebrow}</p>
          ) : null}
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h1 className="min-w-0 text-2xl font-semibold">{title}</h1>
            {props.serviceName ? <Badge variant="secondary">{props.serviceName}</Badge> : null}
            {props.environment ? <Badge variant="secondary">{props.environment}</Badge> : null}
            {props.version ? <Badge variant="secondary">{props.version}</Badge> : null}
          </div>
          {props.description ? (
            <p className="max-w-3xl text-sm text-muted-foreground">{props.description}</p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {props.statusItems?.map((item) => (
            <Badge key={`${item.label}:${item.value ?? ""}`} variant={item.variant ?? "secondary"} data-testid={item.testId}>
              {item.value === undefined ? item.label : `${item.label}: ${item.value}`}
            </Badge>
          ))}
          {showRefresh ? (
            <Button data-testid="settings-refresh" variant="secondary" size="sm" onClick={props.onRefresh}>
              Refresh
            </Button>
          ) : null}
          {showExport ? (
            <Button data-testid="settings-export" variant="secondary" size="sm" onClick={props.onExport}>
              Export
            </Button>
          ) : null}
          {showImport ? (
            <Button data-testid="settings-import" variant="secondary" size="sm" onClick={props.onImport}>
              Import
            </Button>
          ) : null}
          {showReveal ? (
            <Button data-testid="settings-reveal-toggle" variant="secondary" size="sm" onClick={props.onRevealSecrets}>
              {props.secretsRevealed ? (props.hideSecretsLabel ?? "Hide secrets") : (props.revealSecretsLabel ?? "Reveal secrets")}
            </Button>
          ) : null}
          {props.actions}
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <Input
          data-testid="settings-search"
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search settings"
          aria-label="Search settings"
        />

        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Settings server tabs">
          {tabs.map((tab) => {
            const selected = activeTab?.id === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                data-testid={`settings-server-tab-${sanitizeServerId(tab.id)}`}
                aria-selected={selected}
                disabled={tab.disabled}
                onClick={() => onServerChange(tab.id)}
                className={cn(
                  "inline-flex min-h-10 items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
                  selected ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted/50",
                )}
              >
                <span>{tab.label}</span>
                {tab.badge ? (
                  <Badge variant={selected ? "secondary" : "default"}>{tab.badge}</Badge>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {props.error ? (
        <Card data-testid="settings-error" role="alert" className="border-destructive/50">
          <CardContent className="p-4 text-sm text-destructive">{props.error}</CardContent>
        </Card>
      ) : null}

      {props.loading ? (
        <Card data-testid="settings-loading">
          <CardContent className="p-4 text-sm text-muted-foreground">Loading settings</CardContent>
        </Card>
      ) : activeTab && hasInspectableData(activeTab.data) ? (
        <JsonExplorer
          data={activeTab.data}
          title={activeTab.description ?? activeTab.label}
          sources={activeTab.sources}
          searchTerm={searchValue}
          revealedSecrets={props.revealedSecrets}
          hideInternalSearch
          defaultExpanded
          maxDepth={props.maxDepth}
          maskToken={props.maskToken}
          viewMode="table"
          alignValues={props.alignValues}
        />
      ) : (
        <Card data-testid="settings-empty">
          <CardHeader className="p-4 pb-0">
            <h2 className="text-base font-semibold">{activeTab?.label ?? title}</h2>
          </CardHeader>
          <CardContent className="p-4 text-sm text-muted-foreground">
            {props.emptyState ?? activeTab?.emptyLabel ?? "No settings available"}
          </CardContent>
        </Card>
      )}

      {editableGroups.length > 0 && onSave ? (
        <div data-testid="settings-editable-groups" className="grid gap-4 lg:grid-cols-2">
          {editableGroups.map((group) => (
            <SettingGroup
              key={group.id}
              label={group.label}
              settings={group.settings}
              onChange={onSave}
              defaultExpanded={false}
            />
          ))}
        </div>
      ) : null}

      {props.children ? (
        <div data-testid="settings-extensions" className="space-y-4">
          {props.children}
        </div>
      ) : null}

      {props.footer ? (
        <div data-testid="settings-footer" className="text-sm text-muted-foreground">
          {props.footer}
        </div>
      ) : null}

      {props.onConfirmReveal && props.onCancelReveal ? (
        <ConfirmDialog
          open={Boolean(props.confirmRevealOpen)}
          onOpenChange={(open) => {
            if (!open) {
              props.onCancelReveal?.();
            }
          }}
          title={props.revealConfirmTitle ?? "Reveal secrets"}
          description={
            props.revealConfirmDescription ??
            "Confirm temporary access before secret values are shown in this session."
          }
          irreversible={false}
          confirmLabel={props.revealSecretsLabel ?? "Reveal secrets"}
          confirmVariant="default"
          onConfirm={props.onConfirmReveal}
        />
      ) : null}
    </section>
  );
}
