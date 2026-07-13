// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
// Licensed under the Apache License, Version 2.0
//
// W28K-1408 F-1408-1 — run-status eligibility unit coverage (mirrors backend
// scheduler-mcp-server api/runs.py _TERMINAL / _RETRIABLE / _DEAD_LETTER).

import { describe, expect, it } from "vitest";
import {
  canCancelStatus,
  canDeleteStatus,
  canRetryStatus,
  isDeadLetterStatus,
  normStatus,
} from "../run-status";

describe("normStatus", () => {
  it("lower-cases + trims + defaults", () => {
    expect(normStatus(" FAILED ")).toBe("failed");
    expect(normStatus(null)).toBe("unknown");
    expect(normStatus(undefined)).toBe("unknown");
  });
});

describe("canCancelStatus (NOT terminal)", () => {
  it.each(["scheduled", "claimed", "queued", "running", "blocked"])("%s -> cancellable", (s) => {
    expect(canCancelStatus(s)).toBe(true);
  });
  it.each(["succeeded", "failed", "cancelled", "skipped", "misfired"])("%s -> not cancellable", (s) => {
    expect(canCancelStatus(s)).toBe(false);
  });
});

describe("canRetryStatus / canDeleteStatus (_RETRIABLE = terminal ∪ blocked)", () => {
  it.each(["succeeded", "failed", "cancelled", "skipped", "misfired", "blocked"])("%s -> retriable+deletable", (s) => {
    expect(canRetryStatus(s)).toBe(true);
    expect(canDeleteStatus(s)).toBe(true);
  });
  it.each(["scheduled", "claimed", "queued", "running"])("%s -> in-flight, not retriable/deletable", (s) => {
    expect(canRetryStatus(s)).toBe(false);
    expect(canDeleteStatus(s)).toBe(false);
  });
});

describe("isDeadLetterStatus (failed|blocked|misfired)", () => {
  it.each(["failed", "blocked", "misfired"])("%s -> dead-letter", (s) => {
    expect(isDeadLetterStatus(s)).toBe(true);
  });
  it.each(["succeeded", "cancelled", "scheduled", "running", "skipped"])("%s -> not dead-letter", (s) => {
    expect(isDeadLetterStatus(s)).toBe(false);
  });
});
