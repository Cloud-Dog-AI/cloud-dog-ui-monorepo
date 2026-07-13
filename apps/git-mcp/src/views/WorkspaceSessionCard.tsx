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

// @cloud-dog/app-git-mcp — Selection criteria card (W28J-1313).
//
// Was the bespoke per-page "WorkspaceSessionCard" proto. Now a thin wrapper
// over the shared @cloud-dog/ui SelectionCriteriaPanel, so every consuming page
// (Browser / Commits / Diff / Branches / Merge / Tags / Stashes) gets the same
// cascading, combobox-populated, audit-linked selector. There is NO "Session ID"
// field — session_id is owned internally (lib/session, W28J-1302). The keys are
// kept on the state object only for backwards source-compat with callers.

import * as React from "react";
import { useNavigate } from "react-router-dom";
import { Button, SelectionCriteriaPanel, useAuditLink, type RefType, type SelectionCriteria } from "@cloud-dog/ui";
import { useGitMcpState } from "../state/AppState";
import { getSessionId } from "../lib/session";
import { setSelection } from "../state/selection";
import { buildSelectionSources } from "../lib/selectionSources";

export type WorkspaceSessionState = Readonly<{
  profile: string;
  setProfile: React.Dispatch<React.SetStateAction<string>>;
  repoSource: string;
  setRepoSource: React.Dispatch<React.SetStateAction<string>>;
  sessionId: string;
  setSessionId: React.Dispatch<React.SetStateAction<string>>;
  refType: string;
  setRefType: React.Dispatch<React.SetStateAction<string>>;
  refName: string;
  setRefName: React.Dispatch<React.SetStateAction<string>>;
  workspaceId: string;
  setWorkspaceId: (workspaceId: string) => void;
}>;

export function useWorkspaceSession(defaultRefName = "main"): WorkspaceSessionState {
  const app = useGitMcpState();
  const [profile, setProfile] = React.useState(app.defaultProfile);
  const [repoSource, setRepoSource] = React.useState(app.remoteRepoUrl);
  // session_id is internal (per-browser-session) — never user-facing (W28J-1302).
  const [sessionId, setSessionId] = React.useState(() => getSessionId());
  const [refType, setRefType] = React.useState("branch");
  const [refName, setRefName] = React.useState(defaultRefName);

  return {
    profile,
    setProfile,
    repoSource,
    setRepoSource,
    sessionId,
    setSessionId,
    refType,
    setRefType,
    refName,
    setRefName,
    workspaceId: app.workspaceId,
    setWorkspaceId: app.setWorkspaceId,
  };
}

export function buildWorkspaceOpenArgs(state: WorkspaceSessionState): Record<string, unknown> {
  const profile = state.profile.trim();
  const repoSource = state.repoSource.trim();
  const payload: Record<string, unknown> = {
    session_id: getSessionId(), // client-owned; not typed by the user
    workspace_mode: "ephemeral",
  };
  // A selected profile drives the open via its configured source; the backend resolves
  // profile -> repo. An explicit repo_source is only for ad-hoc (profile-less) opens.
  // Sending BOTH made the backend prefer repo_source (the app-default placeholder URL),
  // silently overriding the chosen profile so the open cloned the wrong/unreachable repo
  // and failed — the profile selector was effectively dead on every page (W28J-1330).
  if (profile) {
    payload.profile = profile;
  } else if (repoSource) {
    payload.repo_source = repoSource;
  }
  if (state.refName.trim()) {
    payload.ref = { type: state.refType, name: state.refName.trim() };
  }
  return payload;
}

export function WorkspaceSessionCard(props: Readonly<{
  state: WorkspaceSessionState;
  onOpenWorkspace: () => Promise<void>;
  status?: string;
  error?: string | null;
  actions?: React.ReactNode;
  title?: string;
}>) {
  const { state } = props;
  const app = useGitMcpState();
  const navigate = useNavigate();
  const { linkToWorkspace } = useAuditLink();
  const sources = React.useMemo(() => buildSelectionSources(app.api, app.apiKey), [app.api, app.apiKey]);

  const value: SelectionCriteria = {
    profileId: state.profile || undefined,
    workspaceId: state.workspaceId || undefined,
    refType: (state.refType as RefType) || undefined,
    refName: state.refName || undefined,
  };

  const handleChange = (next: SelectionCriteria) => {
    state.setProfile(next.profileId ?? "");
    state.setWorkspaceId(next.workspaceId ?? "");
    state.setRefType(next.refType ?? "branch");
    state.setRefName(next.refName ?? "");
    setSelection({ profileId: next.profileId, workspaceId: next.workspaceId });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">{props.title ?? "Selection Criteria"}</h2>
        <Button onClick={() => void props.onOpenWorkspace()}>Open workspace</Button>
      </div>
      {props.error ? <p role="alert" className="text-sm text-destructive">{props.error}</p> : null}
      {props.status ? <p role="status" className="text-sm text-foreground/80">{props.status}</p> : null}
      <SelectionCriteriaPanel
        value={value}
        onChange={handleChange}
        fields={["profile", "workspace", "refType", "refName"]}
        sources={sources}
        showDerived
        appName="git-mcp"
        variant="card"
        onViewAudit={(criteria) => {
          if (criteria.workspaceId) navigate(linkToWorkspace(criteria.workspaceId));
        }}
      />
      {props.actions ? <div className="flex flex-wrap gap-2">{props.actions}</div> : null}
    </div>
  );
}
