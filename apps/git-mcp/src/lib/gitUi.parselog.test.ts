// @vitest-environment node
// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
// SPDX-License-Identifier: Apache-2.0
// W28J-1330 — parseGitLogOutput must parse the tab-delimited git_log format (and verbose fallback).
import { describe, it, expect } from "vitest";
import { parseGitLogOutput } from "./gitUi";

describe("parseGitLogOutput (W28J-1330)", () => {
  it("parses tab-delimited <hash>\\t<author>\\t<date>\\t<subject> per line", () => {
    const log = [
      "27712da057a8\tAda Lovelace\t2026-04-04T00:00:00+00:00\tC4: document the public API",
      "ac0063e\tAda Lovelace\t2026-04-03T00:00:00+00:00\tC3: add module beta + tests",
      "0fa9aa3\tAda Lovelace\t2026-04-02T00:00:00+00:00\tC2: add module alpha",
      "e27d9ec\tAda Lovelace\t2026-04-01T00:00:00+00:00\tC1: scaffold project (README + LICENSE)",
    ].join("\n");
    const out = parseGitLogOutput(log);
    expect(out).toHaveLength(4);
    expect(out.map((c) => c.message)).toEqual([
      "C4: document the public API",
      "C3: add module beta + tests",
      "C2: add module alpha",
      "C1: scaffold project (README + LICENSE)",
    ]);
    expect(out[0].author).toBe("Ada Lovelace");
    expect(out[0].hash).toBe("27712da057a8");
  });
  it("still parses the verbose commit/Author/Date format", () => {
    const log = "commit abc123\nAuthor: Ada Lovelace <a@x>\nDate: x\n\n    hello world\n";
    const out = parseGitLogOutput(log);
    expect(out).toHaveLength(1);
    expect(out[0].message).toBe("hello world");
    expect(out[0].author).toBe("Ada Lovelace <a@x>");
  });
});
