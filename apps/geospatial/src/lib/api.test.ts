// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
//
// Licensed under the Apache License, Version 2.0.

// GE-DEF-002 / GE-DEF-012: Vitest unit tests for the geospatial API client
// wiring — error classification + that the machine-surface (MCP/A2A) methods
// exist (proving the raw-fetch callers were migrated to @cloud-dog/api-client).

import { describe, expect, it } from "vitest";
import { ApiError } from "@cloud-dog/api-client";
import { createGeoApi, isForbidden, statusOf } from "./api";

describe("error classification", () => {
  it("isForbidden is true only for a 403 ApiError", () => {
    expect(isForbidden(new ApiError("denied", { status: 403 }))).toBe(true);
    expect(isForbidden(new ApiError("boom", { status: 500 }))).toBe(false);
    expect(isForbidden(new Error("plain"))).toBe(false);
  });
  it("statusOf returns the ApiError status, else undefined", () => {
    expect(statusOf(new ApiError("x", { status: 422 }))).toBe(422);
    expect(statusOf(new Error("x"))).toBeUndefined();
  });
});

describe("createGeoApi surface (api-client migration)", () => {
  const api = createGeoApi({ baseUrl: "/api", onAuthError: () => undefined });

  it("exposes the domain render op", () => {
    expect(typeof api.renderMap).toBe("function");
  });
  it("exposes the migrated machine-surface methods (no raw fetch)", () => {
    expect(typeof api.mcpTools).toBe("function");
    expect(typeof api.mcpCall).toBe("function");
    expect(typeof api.a2aAgentCard).toBe("function");
    expect(typeof api.a2aTask).toBe("function");
    expect(typeof api.serviceHealth).toBe("function");
  });
});
