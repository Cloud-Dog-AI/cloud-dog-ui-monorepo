// @vitest-environment jsdom
// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
// SPDX-License-Identifier: Apache-2.0
// W28J-1310 — UT for the cross-page selection container.

import { describe, it, expect, beforeEach } from "vitest";
import {
  getSelection,
  setSelection,
  setCurrentWorkspace,
  clearCurrentWorkspace,
  SELECTION_APP_NAME,
} from "./selection";

const KEY = `cd-selection-criteria-${SELECTION_APP_NAME}`;

describe("selection container (W28J-1310)", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it("round-trips a selection via sessionStorage under the SelectionCriteriaPanel key", () => {
    setSelection({ profileId: "p1", workspaceId: "ws-1" });
    expect(getSelection()).toEqual({ profileId: "p1", workspaceId: "ws-1" });
    expect(window.sessionStorage.getItem(KEY)).toContain("ws-1");
  });

  it("setSelection merges into the existing selection", () => {
    setSelection({ profileId: "p1" });
    setSelection({ workspaceId: "ws-9" });
    expect(getSelection()).toEqual({ profileId: "p1", workspaceId: "ws-9" });
  });

  it("setCurrentWorkspace makes a workspace current (with its profile)", () => {
    setCurrentWorkspace("ws-2", "p2");
    expect(getSelection()).toEqual({ profileId: "p2", workspaceId: "ws-2" });
  });

  it("clearCurrentWorkspace drops the workspace but keeps the profile", () => {
    setCurrentWorkspace("ws-2", "p2");
    clearCurrentWorkspace();
    expect(getSelection().workspaceId).toBeUndefined();
    expect(getSelection().profileId).toBe("p2");
  });
});
