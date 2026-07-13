// @vitest-environment jsdom
// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
// SPDX-License-Identifier: Apache-2.0
// W28J-1330 — UT for buildWorkspaceOpenArgs. Locks the fix: a selected profile drives the open
// (the backend resolves profile -> source); the app-default repo_source must NOT be sent alongside
// a profile, or the backend prefers it and silently opens the wrong/unreachable repo (clone 400).

import { describe, it, expect } from "vitest";
import { buildWorkspaceOpenArgs, type WorkspaceSessionState } from "./WorkspaceSessionCard";

function makeState(over: Partial<WorkspaceSessionState>): WorkspaceSessionState {
  return {
    profile: "",
    setProfile: () => {},
    repoSource: "https://git.example.com/your-org/your-repo.git",
    setRepoSource: () => {},
    sessionId: "s",
    setSessionId: () => {},
    refType: "branch",
    setRefType: () => {},
    refName: "main",
    setRefName: () => {},
    workspaceId: "",
    setWorkspaceId: () => {},
    ...over,
  } as WorkspaceSessionState;
}

describe("buildWorkspaceOpenArgs (W28J-1330)", () => {
  it("sends ONLY the profile (not the app-default repo_source) when a profile is selected", () => {
    const args = buildWorkspaceOpenArgs(makeState({ profile: "w28j-commits" }));
    expect(args.profile).toBe("w28j-commits");
    expect(args).not.toHaveProperty("repo_source");
    expect(args.workspace_mode).toBe("ephemeral");
    expect(args.ref).toEqual({ type: "branch", name: "main" });
  });

  it("falls back to repo_source for ad-hoc (profile-less) opens", () => {
    const args = buildWorkspaceOpenArgs(makeState({ profile: "", repoSource: "/app/data/repo" }));
    expect(args.repo_source).toBe("/app/data/repo");
    expect(args).not.toHaveProperty("profile");
  });

  it("omits ref when no ref name is set", () => {
    const args = buildWorkspaceOpenArgs(makeState({ profile: "w28j-diff", refName: "  " }));
    expect(args).not.toHaveProperty("ref");
  });
});
