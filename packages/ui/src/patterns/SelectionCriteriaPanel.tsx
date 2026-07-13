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

// @cloud-dog/ui — SelectionCriteriaPanel: the one reusable Profile / Workspace /
// Ref / Path / Author / Date / Stash selector (W28J-1303 §3).
//
// Replaces the per-page-rebuilt "WorkspaceSessionCard" proto across the git-mcp
// WebUI (and any sibling service that surfaces a similar selector). Cascading,
// iconographic, audit-linked, and (optionally) persisted across navigation.

import * as React from "react";
import { cn } from "../utils/cn";
import { Combobox, type ComboboxOption } from "../components/input/Combobox";
import { DatePicker } from "../components/input/DatePicker";
import { Archive, Calendar, FileText, FolderGit2, GitBranch, ScrollText, User } from "lucide-react";

export type RefType = "branch" | "tag" | "commit";

export type SelectionCriteriaField =
  | "profile"
  | "workspace"
  | "refType"
  | "refName"
  | "path"
  | "author"
  | "since"
  | "until"
  | "stash";

export type SelectionCriteria = Readonly<{
  profileId?: string;
  workspaceId?: string;
  refType?: RefType;
  refName?: string;
  path?: string;
  author?: string;
  since?: Date;
  until?: Date;
  stashId?: string;
}>;

/** Generic option shape returned by every `sources` loader. */
export type SelectionOption = Readonly<{ value: string; label: string; secondary?: string }>;
/** Profile options may carry the derived repo source (W28J-1303 §3.2 showDerived). */
export type ProfileOption = SelectionOption & Readonly<{ repoSource?: string }>;
export type WorkspaceOption = SelectionOption;
export type RefOption = SelectionOption;
export type PathOption = SelectionOption;
export type AuthorOption = SelectionOption;
export type StashOption = SelectionOption;

export type SelectionCriteriaSources = Readonly<{
  profiles?: () => Promise<ProfileOption[]>;
  workspaces?: (profileId?: string) => Promise<WorkspaceOption[]>;
  refs?: (workspaceId: string, refType: RefType) => Promise<RefOption[]>;
  paths?: (workspaceId: string, ref?: string) => Promise<PathOption[]>;
  authors?: (workspaceId: string) => Promise<AuthorOption[]>;
  stashes?: (workspaceId: string) => Promise<StashOption[]>;
}>;

export type SelectionCriteriaPanelProps = Readonly<{
  value: SelectionCriteria;
  onChange: (next: SelectionCriteria) => void;
  fields: SelectionCriteriaField[];
  sources: SelectionCriteriaSources;
  /** show the read-only derived "Repo Source" once a profile is selected. */
  showDerived?: boolean;
  variant?: "inline" | "card" | "compact";
  /** render a Lucide icon beside each field label (default true). */
  iconography?: boolean;
  /** persist profile + workspace selection across navigation under this app key. */
  appName?: string;
  /** called by the "View audit for this selection" button (visible when a workspace is set). */
  onViewAudit?: (criteria: SelectionCriteria) => void;
  className?: string;
}>;

const REF_TYPE_OPTIONS: ComboboxOption[] = [
  { value: "branch", label: "Branch" },
  { value: "tag", label: "Tag" },
  { value: "commit", label: "Commit" },
];

const FIELD_META: Record<SelectionCriteriaField, { label: string; Icon: typeof User }> = {
  profile: { label: "Profile", Icon: User },
  workspace: { label: "Workspace", Icon: FolderGit2 },
  refType: { label: "Ref type", Icon: GitBranch },
  refName: { label: "Ref name", Icon: GitBranch },
  path: { label: "Path", Icon: FileText },
  author: { label: "Author", Icon: User },
  since: { label: "Since", Icon: Calendar },
  until: { label: "Until", Icon: Calendar },
  stash: { label: "Stash", Icon: Archive },
};

function persistKey(appName: string): string {
  return `cd-selection-criteria-${appName}`;
}

/** Read the persisted {profileId, workspaceId} selection for an app, if any. */
export function loadPersistedSelection(appName: string): SelectionCriteria {
  try {
    const raw = window.sessionStorage.getItem(persistKey(appName));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as { profileId?: string; workspaceId?: string };
    return { profileId: parsed.profileId, workspaceId: parsed.workspaceId };
  } catch {
    return {};
  }
}

function toComboOptions(options: SelectionOption[]): ComboboxOption[] {
  return options.map((o) => ({ value: o.value, label: o.label }));
}

function useAsyncOptions(
  load: (() => Promise<SelectionOption[]>) | null,
  deps: React.DependencyList,
): { options: SelectionOption[]; loading: boolean } {
  const [state, setState] = React.useState<{ options: SelectionOption[]; loading: boolean }>({
    options: [],
    loading: false,
  });
  React.useEffect(() => {
    if (!load) {
      setState({ options: [], loading: false });
      return;
    }
    let cancelled = false;
    setState((s) => ({ ...s, loading: true }));
    Promise.resolve(load()).then(
      (opts) => {
        if (!cancelled) setState({ options: opts ?? [], loading: false });
      },
      () => {
        if (!cancelled) setState({ options: [], loading: false });
      },
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}

export function SelectionCriteriaPanel(props: SelectionCriteriaPanelProps) {
  const {
    value,
    onChange,
    fields,
    sources,
    showDerived = false,
    variant = "card",
    iconography = true,
    appName,
    onViewAudit,
    className,
  } = props;

  const { profileId, workspaceId, refType, refName } = value;

  const profileState = useAsyncOptions(
    sources.profiles ? () => sources.profiles!() : null,
    [sources.profiles],
  );
  const workspaceState = useAsyncOptions(
    sources.workspaces ? () => sources.workspaces!(profileId) : null,
    [sources.workspaces, profileId],
  );
  const refState = useAsyncOptions(
    sources.refs && workspaceId ? () => sources.refs!(workspaceId, refType ?? "branch") : null,
    [sources.refs, workspaceId, refType],
  );
  const pathState = useAsyncOptions(
    sources.paths && workspaceId ? () => sources.paths!(workspaceId, refName) : null,
    [sources.paths, workspaceId, refName],
  );
  const authorState = useAsyncOptions(
    sources.authors && workspaceId ? () => sources.authors!(workspaceId) : null,
    [sources.authors, workspaceId],
  );
  const stashState = useAsyncOptions(
    sources.stashes && workspaceId ? () => sources.stashes!(workspaceId) : null,
    [sources.stashes, workspaceId],
  );

  // Persist profile + workspace across navigation when an app key is supplied.
  React.useEffect(() => {
    if (!appName) return;
    try {
      window.sessionStorage.setItem(
        persistKey(appName),
        JSON.stringify({ profileId, workspaceId }),
      );
    } catch {
      /* sessionStorage unavailable — non-fatal */
    }
  }, [appName, profileId, workspaceId]);

  // Cascading setters: changing an upstream value clears its dependents.
  const setProfile = (next: string) =>
    onChange({
      ...value,
      profileId: next || undefined,
      workspaceId: undefined,
      refName: undefined,
      path: undefined,
      author: undefined,
      stashId: undefined,
    });
  const setWorkspace = (next: string) =>
    onChange({
      ...value,
      workspaceId: next || undefined,
      refName: undefined,
      path: undefined,
      author: undefined,
      stashId: undefined,
    });
  const setRefType = (next: string) =>
    onChange({ ...value, refType: (next || undefined) as RefType | undefined, refName: undefined, path: undefined });
  const setRefName = (next: string) => onChange({ ...value, refName: next || undefined, path: undefined });
  const setPath = (next: string) => onChange({ ...value, path: next || undefined });
  const setAuthor = (next: string) => onChange({ ...value, author: next || undefined });
  const setStash = (next: string) => onChange({ ...value, stashId: next || undefined });
  const setSince = (next: Date | null) => onChange({ ...value, since: next ?? undefined });
  const setUntil = (next: Date | null) => onChange({ ...value, until: next ?? undefined });

  const derivedRepoSource = React.useMemo(() => {
    if (!showDerived || !profileId) return undefined;
    const opt = profileState.options.find((o) => o.value === profileId) as ProfileOption | undefined;
    return opt?.repoSource ?? opt?.secondary;
  }, [showDerived, profileId, profileState.options]);

  function renderField(field: SelectionCriteriaField): React.ReactNode {
    const meta = FIELD_META[field];
    let control: React.ReactNode;
    switch (field) {
      case "profile":
        control = (
          <Combobox
            options={toComboOptions(profileState.options)}
            value={profileId ?? ""}
            onChange={setProfile}
            loading={profileState.loading}
            placeholder="Select a profile"
            aria-label="Profile"
          />
        );
        break;
      case "workspace":
        control = (
          <Combobox
            options={toComboOptions(workspaceState.options)}
            value={workspaceId ?? ""}
            onChange={setWorkspace}
            loading={workspaceState.loading}
            disabled={!profileId && Boolean(sources.workspaces)}
            placeholder="Select a workspace"
            aria-label="Workspace"
          />
        );
        break;
      case "refType":
        control = (
          <Combobox
            options={REF_TYPE_OPTIONS}
            value={refType ?? ""}
            onChange={setRefType}
            placeholder="Select a ref type"
            aria-label="Ref type"
          />
        );
        break;
      case "refName":
        control = (
          <Combobox
            options={toComboOptions(refState.options)}
            value={refName ?? ""}
            onChange={setRefName}
            loading={refState.loading}
            disabled={!workspaceId}
            placeholder="Select a ref name"
            aria-label="Ref name"
          />
        );
        break;
      case "path":
        control = (
          <Combobox
            options={toComboOptions(pathState.options)}
            value={value.path ?? ""}
            onChange={setPath}
            loading={pathState.loading}
            disabled={!workspaceId}
            allowCustom
            placeholder="Select a path"
            aria-label="Path"
          />
        );
        break;
      case "author":
        control = (
          <Combobox
            options={toComboOptions(authorState.options)}
            value={value.author ?? ""}
            onChange={setAuthor}
            loading={authorState.loading}
            disabled={!workspaceId}
            placeholder="Select an author"
            aria-label="Author"
          />
        );
        break;
      case "stash":
        control = (
          <Combobox
            options={toComboOptions(stashState.options)}
            value={value.stashId ?? ""}
            onChange={setStash}
            loading={stashState.loading}
            disabled={!workspaceId}
            placeholder="Select a stash"
            aria-label="Stash"
          />
        );
        break;
      case "since":
        control = <DatePicker value={value.since ?? null} onChange={setSince} max={value.until} aria-label="Since" />;
        break;
      case "until":
        control = <DatePicker value={value.until ?? null} onChange={setUntil} min={value.since} aria-label="Until" />;
        break;
      default:
        control = null;
    }

    return (
      <div key={field} className={cn("flex flex-col gap-1", variant === "inline" && "min-w-[12rem] flex-1")}>
        <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
          {iconography ? <meta.Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" /> : null}
          {meta.label}
        </span>
        {control}
      </div>
    );
  }

  const layout =
    variant === "inline"
      ? "flex flex-row flex-wrap items-end gap-3"
      : variant === "compact"
        ? "flex flex-col gap-2"
        : "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3";

  return (
    <section
      aria-label="Selection criteria"
      className={cn(
        variant === "card" && "rounded-lg border border-input bg-card p-4",
        variant === "compact" && "rounded-md border border-input bg-card p-3",
        className,
      )}
    >
      <div className={layout}>{fields.map(renderField)}</div>

      {derivedRepoSource ? (
        <p className="mt-3 text-xs text-muted-foreground">
          <span className="font-medium">Repo Source:</span> {derivedRepoSource}
        </p>
      ) : null}

      {onViewAudit && workspaceId ? (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => onViewAudit(value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-sm",
              "font-medium ring-offset-background hover:bg-accent hover:text-accent-foreground",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
          >
            <ScrollText className="h-4 w-4" aria-hidden="true" />
            View audit for this selection
          </button>
        </div>
      ) : null}
    </section>
  );
}
