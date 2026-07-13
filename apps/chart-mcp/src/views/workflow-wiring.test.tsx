// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
//
// Licensed under the Apache License, Version 2.0.

// W28F-954 (CH-DEF-002): one render test per workflow page proving its DATA PATH is
// wired to the real @cloud-dog/api-client surface (mocked here at the unit boundary —
// the Playwright author journey exercises the same calls against the real backend).
// Each test asserts the page invokes the expected `api.*` method with the right body.

import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// Mock the chart-mcp api client (the data-path target). Every method is a spy so the
// tests can assert exact method + body without any network.
const api = {
  recommend: vi.fn(),
  validate: vi.fn(),
  render: vi.fn(),
  renderDiagram: vi.fn(),
  config: vi.fn(),
  capabilities: vi.fn(),
  listStylePacks: vi.fn(),
  listRenderers: vi.fn(),
  listAssets: vi.fn(),
  listSessions: vi.fn(),
  listJobs: vi.fn(),
};
vi.mock("../state/AppState", () => ({
  useChartState: () => ({ api, appVersion: "test", apiBaseUrl: "/api" }),
}));

// Controllable workflow draft state (set per-test before render).
let workflow: Record<string, unknown>;
vi.mock("../state/ChartWorkflow", () => ({
  useChartWorkflow: () => workflow,
}));

import { DataInputPage } from "./DataInputPage";
import { DataPreviewPage } from "./DataPreviewPage";
import { FieldMappingPage } from "./FieldMappingPage";
import { ChartSpecEditorPage } from "./ChartSpecEditorPage";
import { StyleSelectorPage } from "./StyleSelectorPage";
import { LocaleSelectorPage } from "./LocaleSelectorPage";
import { RenderPreviewPage } from "./RenderPreviewPage";
import { ClipartThemingPanelPage, DiagramPanelPage, MathDocumentPanelPage } from "./VisualRenderingPanels";
import { LifecycleCachePage } from "./LifecycleCachePage";
import { LicenceStatusPage } from "./LicenceStatusPage";

const SAMPLE_BODY = { csv: "category,value\nA,4\nB,7" } as const;

function makeWorkflow(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    data: null,
    rows: [],
    columns: [],
    mapping: {},
    spec: null,
    recommendation: null,
    style: null,
    locale: {},
    setData: vi.fn(),
    setMapping: vi.fn(),
    setSpec: vi.fn(),
    setRecommendation: vi.fn(),
    setStyle: vi.fn(),
    setLocale: vi.fn(),
    reset: vi.fn(),
    dataRaw: "",
    dataSource: null,
    ...over,
  };
}

const ui = (node: React.ReactNode): React.ReactElement => <MemoryRouter>{node}</MemoryRouter>;

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  api.recommend.mockResolvedValue({ chart_type: "bar", x: "category", y: "value", confidence: 0.9, reasons: [] });
  api.validate.mockResolvedValue({ ok: true });
  api.render.mockResolvedValue({ assets: [], manifest_id: "m1" });
  api.renderDiagram.mockResolvedValue({ assets: [], manifest_id: "dgm1" });
  api.config.mockResolvedValue({ default_locale: "en-GB", cache_mode: "use_cache" });
  api.capabilities.mockResolvedValue({ formats: ["svg"], renderers: { allowed: {} } });
  api.listStylePacks.mockResolvedValue([{ style_id: "s1", name: "S1" }]);
  api.listRenderers.mockResolvedValue({ allowed: { matplotlib: { licence_class: "OSS" } }, blocked: {} });
  api.listAssets.mockResolvedValue([]);
  api.listSessions.mockResolvedValue([]);
  api.listJobs.mockResolvedValue([]);
  workflow = makeWorkflow();
});

afterEach(() => cleanup());

describe("CH-DEF-002 chart workflow page data paths", () => {
  it("DataInputPage -> POST /recommend (validate + ingest the captured data)", async () => {
    render(ui(<DataInputPage />));
    fireEvent.click(screen.getByTestId("data-input-ingest"));
    await waitFor(() => expect(api.recommend).toHaveBeenCalledTimes(1));
    expect(api.recommend.mock.calls[0][0]).toMatchObject({ csv: expect.any(String) });
  });

  it("DataPreviewPage -> POST /recommend (recommend on the captured body)", async () => {
    workflow = makeWorkflow({
      data: { raw: "", body: SAMPLE_BODY, source: "csv" },
      rows: [{ category: "A", value: 4 }],
      columns: ["category", "value"],
    });
    render(ui(<DataPreviewPage />));
    fireEvent.click(screen.getByTestId("data-preview-recommend"));
    await waitFor(() => expect(api.recommend).toHaveBeenCalledWith(SAMPLE_BODY));
  });

  it("FieldMappingPage -> POST /validate (bind mapped fields into a spec and validate)", async () => {
    workflow = makeWorkflow({
      data: { raw: "", body: SAMPLE_BODY, source: "csv" },
      columns: ["category", "value"],
      recommendation: { chart_type: "bar", x: "category", y: "value" },
    });
    render(ui(<FieldMappingPage />));
    fireEvent.click(screen.getByTestId("field-mapping-apply"));
    await waitFor(() => expect(api.validate).toHaveBeenCalledTimes(1));
    const arg = api.validate.mock.calls[0][0] as { spec?: { chart_type?: string } };
    expect(arg).toHaveProperty("spec");
    expect(arg.spec).toMatchObject({ chart_type: "bar" });
  });

  it("ChartSpecEditorPage -> GET /capabilities on mount + POST /validate on save", async () => {
    workflow = makeWorkflow({
      data: { raw: "", body: SAMPLE_BODY, source: "csv" },
      mapping: { x: "category", y: "value" },
    });
    render(ui(<ChartSpecEditorPage />));
    await waitFor(() => expect(api.capabilities).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByTestId("chartspec-apply"));
    await waitFor(() => expect(api.validate).toHaveBeenCalledTimes(1));
    expect(api.validate.mock.calls[0][0]).toHaveProperty("spec");
  });

  it("StyleSelectorPage -> GET /style-packs on mount", async () => {
    render(ui(<StyleSelectorPage />));
    await waitFor(() => expect(api.listStylePacks).toHaveBeenCalled());
  });

  it("LocaleSelectorPage -> GET /config on mount (service default locale)", async () => {
    render(ui(<LocaleSelectorPage />));
    await waitFor(() => expect(api.config).toHaveBeenCalled());
  });

  it("RenderPreviewPage -> POST /render with {data, spec}", async () => {
    workflow = makeWorkflow({
      data: { raw: "", body: SAMPLE_BODY, source: "csv" },
      rows: [{ category: "A", value: 4 }],
      spec: { chart_type: "bar", x: "category", y: "value", title: "t", output_formats: ["svg"] },
    });
    render(ui(<RenderPreviewPage />));
    fireEvent.click(screen.getByTestId("render-preview-run"));
    await waitFor(() => expect(api.render).toHaveBeenCalledTimes(1));
    const arg = api.render.mock.calls[0][0] as Record<string, unknown>;
    expect(arg).toHaveProperty("spec");
    expect(arg).toMatchObject({ csv: expect.any(String) });
  });

  it("DiagramPanelPage -> POST /render-diagram with diagram_spec and diagram_styles", async () => {
    render(ui(<DiagramPanelPage />));
    fireEvent.click(screen.getByTestId("diagram-panel-render"));
    await waitFor(() => expect(api.renderDiagram).toHaveBeenCalledTimes(1));
    const arg = api.renderDiagram.mock.calls[0][0] as Record<string, unknown>;
    expect(arg).toMatchObject({
      diagram_spec: expect.objectContaining({ kind: "flow", source: expect.any(String) }),
      diagram_styles: expect.objectContaining({ node_fill: expect.any(String) }),
      renderer: "graph",
      output_formats: ["svg"],
    });
  });

  it("MathDocumentPanelPage -> POST /render-diagram for mathtext and document-card modes", async () => {
    render(ui(<MathDocumentPanelPage />));
    fireEvent.click(screen.getByTestId("document-panel-render"));
    await waitFor(() => expect(api.renderDiagram).toHaveBeenCalledTimes(1));
    expect(api.renderDiagram.mock.calls[0][0]).toMatchObject({
      doc_spec: expect.objectContaining({ math: expect.any(String) }),
      renderer: "mathtext",
    });

    fireEvent.click(screen.getByRole("tab", { name: "Document Card" }));
    fireEvent.click(screen.getByTestId("document-panel-render"));
    await waitFor(() => expect(api.renderDiagram).toHaveBeenCalledTimes(2));
    expect(api.renderDiagram.mock.calls[1][0]).toMatchObject({
      doc_spec: expect.objectContaining({ markdown: expect.any(String) }),
      renderer: "doc_card",
    });
  });

  it("ClipartThemingPanelPage -> POST /render-diagram for clipart and diagram theme payloads", async () => {
    render(ui(<ClipartThemingPanelPage />));
    fireEvent.click(screen.getByTestId("clipart-panel-render"));
    await waitFor(() => expect(api.renderDiagram).toHaveBeenCalledTimes(1));
    expect(api.renderDiagram.mock.calls[0][0]).toMatchObject({
      clipart_spec: expect.objectContaining({ elements: expect.any(Array) }),
      renderer: "clipart",
    });

    fireEvent.click(screen.getByRole("tab", { name: "Diagram Theme" }));
    fireEvent.click(screen.getByTestId("clipart-panel-render"));
    await waitFor(() => expect(api.renderDiagram).toHaveBeenCalledTimes(2));
    expect(api.renderDiagram.mock.calls[1][0]).toMatchObject({
      diagram_spec: expect.objectContaining({ kind: "flow" }),
      diagram_styles: expect.objectContaining({ node_fill: expect.any(String) }),
      renderer: "graph",
    });
  });

  it("LifecycleCachePage -> GET /assets + /sessions + /jobs + /config on mount", async () => {
    render(ui(<LifecycleCachePage />));
    await waitFor(() => {
      expect(api.listAssets).toHaveBeenCalled();
      expect(api.listSessions).toHaveBeenCalled();
      expect(api.listJobs).toHaveBeenCalled();
      expect(api.config).toHaveBeenCalled();
    });
  });

  it("LicenceStatusPage -> GET /renderers on mount (licence policy)", async () => {
    render(ui(<LicenceStatusPage />));
    await waitFor(() => expect(api.listRenderers).toHaveBeenCalled());
  });
});
