// @vitest-environment jsdom
// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
// SPDX-License-Identifier: Apache-2.0
// W28J-1310 — UT for the client session-id helper.

import { describe, it, expect, beforeEach } from "vitest";
import { getSessionId, clearSessionId } from "./session";

describe("getSessionId (W28J-1310)", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it("returns a stable id across calls within the session", () => {
    const first = getSessionId();
    const second = getSessionId();
    expect(first).toBeTruthy();
    expect(second).toBe(first);
  });

  it("persists the id in sessionStorage (not localStorage)", () => {
    const id = getSessionId();
    expect(window.sessionStorage.getItem("cd-session-id")).toBe(id);
    expect(window.localStorage.getItem("cd-session-id")).toBeNull();
  });

  it("regenerates a fresh id after clearSessionId", () => {
    const first = getSessionId();
    clearSessionId();
    const second = getSessionId();
    expect(second).not.toBe(first);
  });
});
