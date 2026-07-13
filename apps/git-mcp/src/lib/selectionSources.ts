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

// @cloud-dog/app-git-mcp — SelectionCriteriaPanel data sources (W28J-1313/1314/1315).
//
// One adapter binds the @cloud-dog/ui SelectionCriteriaPanel `sources` to the
// git-mcp backend enumeration endpoints (W28J-1308 + W28J-1327) so every git
// page (Workspace / Browser / Commits / Diff / Branches / Merge / Tags /
// Stashes / Recovery) populates its comboboxes identically.

import type { SelectionCriteriaSources, RefType } from "@cloud-dog/ui";
import type { GitMcpApi } from "./api";

export function buildSelectionSources(api: GitMcpApi, apiKey: string): SelectionCriteriaSources {
  return {
    profiles: async () => {
      const profiles = await api.listProfiles(apiKey);
      return profiles.map((p) => ({ value: p.name, label: p.name, repoSource: p.source, secondary: p.source }));
    },
    workspaces: async (profileId?: string) => {
      const workspaces = await api.listWorkspaces(apiKey, "me", profileId ?? "");
      return workspaces.map((w) => ({
        value: w.workspace_id,
        label: w.workspace_id,
        secondary: w.current_ref ?? w.path,
      }));
    },
    refs: async (workspaceId: string, refType: RefType) => api.listWorkspaceRefs(apiKey, workspaceId, refType),
    paths: async (workspaceId: string, ref?: string) => api.listWorkspacePaths(apiKey, workspaceId, ref ?? ""),
    authors: async (workspaceId: string) => api.listWorkspaceAuthors(apiKey, workspaceId),
    stashes: async (workspaceId: string) => api.listWorkspaceStashes(apiKey, workspaceId),
  };
}
