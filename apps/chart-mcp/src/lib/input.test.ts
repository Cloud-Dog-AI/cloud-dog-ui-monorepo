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

import { describe, expect, it } from "vitest";
import { buildInputBody, specFromRecommendation, svgDataUri } from "./input";

describe("buildInputBody", () => {
  it("treats plain text as CSV", () => {
    expect(buildInputBody("a,b\n1,2")).toEqual({ csv: "a,b\n1,2" });
  });

  it("wraps a JSON array of rows under data.rows", () => {
    expect(buildInputBody('[{"a":1},{"a":2}]')).toEqual({ data: { rows: [{ a: 1 }, { a: 2 }] } });
  });

  it("unwraps an object with a rows array", () => {
    expect(buildInputBody('{"rows":[{"a":1}]}')).toEqual({ data: { rows: [{ a: 1 }] } });
  });

  it("wraps a bare JSON object as a single row", () => {
    expect(buildInputBody('{"a":1,"b":2}')).toEqual({ data: { rows: [{ a: 1, b: 2 }] } });
  });

  it("throws on empty input", () => {
    expect(() => buildInputBody("   ")).toThrow();
  });
});

describe("specFromRecommendation", () => {
  it("builds an svg bar spec from a recommendation", () => {
    expect(specFromRecommendation({ chart_type: "line", x: "t", y: "v" })).toMatchObject({
      chart_type: "line",
      x: "t",
      y: "v",
      output_formats: ["svg"],
    });
  });

  it("defaults to bar when chart_type is missing", () => {
    expect(specFromRecommendation({})).toMatchObject({ chart_type: "bar", x: null, y: null });
  });
});

describe("svgDataUri", () => {
  it("returns an svg data uri for an svg asset", () => {
    const uri = svgDataUri({ assets: [{ format: "svg", base64_data: "PHN2Zz4=" }] });
    expect(uri).toBe("data:image/svg+xml;base64,PHN2Zz4=");
  });

  it("falls back to the first asset's content type", () => {
    const uri = svgDataUri({ assets: [{ format: "png", content_type: "image/png", base64_data: "AAAA" }] });
    expect(uri).toBe("data:image/png;base64,AAAA");
  });

  it("returns null when there are no assets", () => {
    expect(svgDataUri({})).toBeNull();
  });
});
