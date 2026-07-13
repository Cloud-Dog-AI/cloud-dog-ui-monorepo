// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
//
// Licensed under the Apache License, Version 2.0.

// GE-DEF-001 / GE-DEF-002: Vitest render tests for the interactive MapPage. The
// Leaflet component is stubbed (Leaflet needs a sized DOM) so these tests focus
// on the page contract: inputs, validation, the draw toggle, render wiring, and
// the inline 403 (reader-cannot-render).

import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { ApiError } from "@cloud-dog/api-client";

// Stub the real Leaflet map (jsdom has no layout) — record the props it receives.
const leafletProps: Array<Record<string, unknown>> = [];
vi.mock("../components/LeafletMap", () => ({
  LeafletMap: (props: Record<string, unknown>) => {
    leafletProps.push(props);
    return <div data-testid="leaflet-map-stub" data-has-bbox={String(props.bbox != null)} />;
  },
}));

const renderMap = vi.fn();
const discoverFeatures = vi.fn();
const basemapTiles = vi.fn();
vi.mock("../state/AppState", () => ({
  useGeoState: () => ({ api: { renderMap, discoverFeatures, basemapTiles }, appVersion: "0.1.0", apiBaseUrl: "/api" }),
}));

import { MapPage } from "./MapPage";

beforeEach(() => {
  leafletProps.length = 0;
  renderMap.mockReset();
  discoverFeatures.mockReset();
  basemapTiles.mockReset();
  cleanup();
});

describe("MapPage", () => {
  it("renders the map page with bbox/basemap inputs and the interactive map", () => {
    render(<MapPage />);
    expect(screen.getByTestId("page-map")).toBeInTheDocument();
    expect(screen.getByTestId("map-bbox")).toHaveValue("-0.51,51.28,0.33,51.69");
    expect(screen.getByTestId("map-basemap")).toBeInTheDocument();
    expect(screen.getByTestId("map-feature-selector")).toHaveValue("amenity");
    expect(screen.getByTestId("map-feature-radius")).toHaveValue(250);
    expect(screen.getByTestId("map-submit")).toBeInTheDocument();
    expect(screen.getByTestId("leaflet-map-stub")).toBeInTheDocument();
  });

  it("passes the parsed bbox to the map and disables submit on invalid bbox", () => {
    render(<MapPage />);
    // valid default -> map has a bbox, submit enabled
    expect(screen.getByTestId("leaflet-map-stub").getAttribute("data-has-bbox")).toBe("true");
    expect(screen.getByTestId("map-submit")).not.toBeDisabled();
    // type an invalid bbox -> validation message + submit disabled + map bbox null
    fireEvent.change(screen.getByTestId("map-bbox"), { target: { value: "not,a,bbox" } });
    expect(screen.getByTestId("map-bbox-invalid")).toBeInTheDocument();
    expect(screen.getByTestId("map-submit")).toBeDisabled();
  });

  it("toggles the bbox draw tool (aria-pressed)", () => {
    render(<MapPage />);
    const draw = screen.getByTestId("map-draw");
    expect(draw).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(draw);
    expect(draw).toHaveAttribute("aria-pressed", "true");
  });

  it("renders a map and shows the result summary on success", async () => {
    basemapTiles.mockResolvedValue({
      data: {
        provider: "openstreetmap",
        sample_tile: { verified_status: 200, content_type: "image/png" },
      },
    });
    discoverFeatures.mockResolvedValue({
      data: {
        items: [
          {
            feature: {
              feature_id: "feature-1",
              names: [{ value: "Feature One" }],
              geometry: { type: "Point", coordinates: [-0.1278, 51.5074] },
            },
            distance_m: 12,
          },
        ],
      },
    });
    renderMap.mockResolvedValue({
      transfer_mode: "url",
      data: {
        asset_id: "asset-42",
        width: 640,
        asset_url: "https://storage.example/renders/asset-42.png",
        storage_path: "/renders/asset-42.png",
      },
    });
    render(<MapPage />);
    fireEvent.click(screen.getByTestId("map-submit"));
    await waitFor(() => expect(basemapTiles).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(discoverFeatures).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(renderMap).toHaveBeenCalledTimes(1));
    expect(basemapTiles.mock.calls[0][0]).toMatchObject({ z: 15 });
    const featureArg = discoverFeatures.mock.calls[0][0] as { selectors?: string[]; radius_m?: number };
    expect(featureArg.selectors).toEqual(["amenity"]);
    expect(featureArg.radius_m).toBe(250);
    const arg = renderMap.mock.calls[0][0] as { bbox?: number[]; transfer_mode?: string; spec?: { basemap?: string; layers?: unknown[] } };
    expect(arg.bbox).toEqual([-0.51, 51.28, 0.33, 51.69]);
    expect(arg.transfer_mode).toBe("url");
    expect(arg.spec?.basemap).toBe("osm");
    expect(arg.spec?.layers).toHaveLength(1);
    await screen.findByTestId("map-result");
    expect(screen.getByTestId("map-result")).toHaveTextContent("asset-42");
    expect(screen.getByTestId("map-render-image")).toHaveAttribute("src", "https://storage.example/renders/asset-42.png");
    expect(leafletProps.at(-1)?.features).toMatchObject({ geojson: { features: [{ properties: { label: "Feature One" } }] } });
  });

  it("shows the inline 403 (reader-cannot-render) without leaking data", async () => {
    basemapTiles.mockResolvedValue({});
    discoverFeatures.mockRejectedValue(new ApiError("permission_denied", { status: 403 }));
    render(<MapPage />);
    fireEvent.click(screen.getByTestId("map-submit"));
    await screen.findByTestId("map-forbidden");
    expect(screen.getByTestId("map-forbidden")).toHaveTextContent("permission");
    expect(screen.queryByTestId("map-result")).toBeNull();
  });
});
