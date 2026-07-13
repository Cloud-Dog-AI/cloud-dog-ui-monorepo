// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
//
// Licensed under the Apache License, Version 2.0.

// GE-DEF-002: Vitest unit tests for the pure bbox/feature helpers that drive the
// interactive map (parse/format/bounds/area/feature extraction).

import { describe, expect, it } from "vitest";
import {
  parseBbox,
  formatBbox,
  bboxToLeafletBounds,
  bboxCenter,
  bboxAreaDeg2,
  extractFeatures,
} from "./bbox";

describe("parseBbox", () => {
  it("parses a valid bbox string", () => {
    expect(parseBbox("-0.51,51.28,0.33,51.69")).toEqual([-0.51, 51.28, 0.33, 51.69]);
  });
  it("rejects null/empty/short input", () => {
    expect(parseBbox(null)).toBeNull();
    expect(parseBbox("")).toBeNull();
    expect(parseBbox("1,2,3")).toBeNull();
  });
  it("rejects non-numeric input", () => {
    expect(parseBbox("a,b,c,d")).toBeNull();
  });
  it("rejects inverted min/max", () => {
    expect(parseBbox("10,10,0,0")).toBeNull();
  });
  it("rejects out-of-range lon/lat", () => {
    expect(parseBbox("-200,0,10,10")).toBeNull();
    expect(parseBbox("0,-100,10,10")).toBeNull();
  });
});

describe("formatBbox", () => {
  it("round-trips through parseBbox", () => {
    const parsed = parseBbox("-0.51,51.28,0.33,51.69")!;
    expect(formatBbox(parsed)).toBe("-0.51,51.28,0.33,51.69");
  });
  it("trims excessive precision to 5 dp", () => {
    expect(formatBbox([0.123456789, 1, 2, 3])).toBe("0.12346,1,2,3");
  });
});

describe("bboxToLeafletBounds", () => {
  it("maps [minLon,minLat,maxLon,maxLat] -> [[S,W],[N,E]]", () => {
    expect(bboxToLeafletBounds([-1, 50, 1, 52])).toEqual([[50, -1], [52, 1]]);
  });
});

describe("bboxCenter / bboxAreaDeg2", () => {
  it("computes the centre [lat,lon]", () => {
    expect(bboxCenter([-2, 50, 2, 54])).toEqual([52, 0]);
  });
  it("computes the area in square degrees", () => {
    expect(bboxAreaDeg2([0, 0, 10, 5])).toBe(50);
  });
});

describe("extractFeatures", () => {
  it("wraps a bare features array into a FeatureCollection", () => {
    const fc = extractFeatures({ features: [{ type: "Feature", geometry: null, properties: {} }] });
    expect(fc).toMatchObject({ type: "FeatureCollection" });
  });
  it("passes through an existing FeatureCollection (nested under data)", () => {
    const fc = extractFeatures({ data: { geojson: { type: "FeatureCollection", features: [] } } });
    expect(fc).toMatchObject({ type: "FeatureCollection" });
  });
  it("returns null when there are no features", () => {
    expect(extractFeatures({ status: "ok" })).toBeNull();
    expect(extractFeatures(null)).toBeNull();
  });
});
