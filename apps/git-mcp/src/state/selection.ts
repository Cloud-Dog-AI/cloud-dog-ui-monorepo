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

// @cloud-dog/app-git-mcp — cross-page selection state (W28J-1310 / W28J-1303 §3.2).
//
// The "current" profile + workspace carry across pages so the shared
// SelectionCriteriaPanel can pick them up everywhere. Persisted under the SAME
// sessionStorage key the @cloud-dog/ui SelectionCriteriaPanel uses
// (`cd-selection-criteria-{appName}`), so opening a workspace on the Workspaces
// page flows straight into Browser / Commits / Diff / Branches / … etc.

export const SELECTION_APP_NAME = "git-mcp";
const SELECTION_KEY = `cd-selection-criteria-${SELECTION_APP_NAME}`;

export type Selection = Readonly<{ profileId?: string; workspaceId?: string }>;

/** Read the current cross-page selection. */
export function getSelection(): Selection {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.sessionStorage.getItem(SELECTION_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Selection;
    return { profileId: parsed.profileId, workspaceId: parsed.workspaceId };
  } catch {
    return {};
  }
}

/** Merge a patch into the current selection and persist it. */
export function setSelection(patch: Selection): Selection {
  const next = { ...getSelection(), ...patch };
  if (typeof window !== "undefined") {
    try {
      window.sessionStorage.setItem(SELECTION_KEY, JSON.stringify(next));
    } catch {
      /* sessionStorage unavailable — non-fatal */
    }
  }
  return next;
}

/** Make a workspace (and optionally its profile) the current selection. */
export function setCurrentWorkspace(workspaceId: string, profileId?: string): Selection {
  return setSelection(profileId ? { workspaceId, profileId } : { workspaceId });
}

/** Clear the current workspace (e.g. "Close") while keeping the profile. */
export function clearCurrentWorkspace(): Selection {
  return setSelection({ workspaceId: undefined });
}
