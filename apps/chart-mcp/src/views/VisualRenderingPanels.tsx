// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
//
// Licensed under the Apache License, Version 2.0.

import * as React from "react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  Input,
  JsonExplorer,
  Label,
  Select,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
} from "@cloud-dog/ui";
import { Play, RotateCcw } from "lucide-react";
import { useChartState } from "../state/AppState";
import { PageHeader, StatusLine, errMessage } from "../lib/ui";
import { svgDataUri } from "../lib/input";

const DIAGRAM_SOURCE = `Ingress -> Validate [label="schema"];
Validate -> Render [label="policy"];
Render -> Evidence [label="manifest"];`;

const DIAGRAM_STYLES = JSON.stringify(
  {
    background: "#ffffff",
    node_fill: "#e7f0f7",
    node_stroke: "#24566f",
    edge: "#2f5661",
    accent: "#0f766e",
    text: "#14212a",
    muted: "#64727c",
  },
  null,
  2,
);

const DOCUMENT_MARKDOWN = `# Release Evidence

| Control | Status |
|---|---|
| Traceability | PASS |
| Renderer policy | PASS |
| Provenance | PASS |`;

const CLIPART_ELEMENTS = JSON.stringify(
  [
    { kind: "rect", label: "Input", x: 70, y: 110, width: 170, height: 92, fill: "#e7f0f7", stroke: "#24566f" },
    { kind: "circle", label: "Policy", x: 330, y: 96, width: 112, height: 112, fill: "#dcfce7", stroke: "#166534" },
    { kind: "line", label: "", x: 240, y: 156, width: 90, height: 0, stroke: "#2f5661" },
    { kind: "text", label: "Governed render", x: 500, y: 142, width: 180, height: 40, fill: "#14212a" },
  ],
  null,
  2,
);

function parseObject(text: string, label: string): Record<string, unknown> {
  const parsed = text.trim() ? JSON.parse(text) : {};
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${label} must be a JSON object.`);
  }
  return parsed as Record<string, unknown>;
}

function parseArray(text: string, label: string): unknown[] {
  const parsed = text.trim() ? JSON.parse(text) : [];
  if (!Array.isArray(parsed)) throw new Error(`${label} must be a JSON array.`);
  return parsed;
}

function rendererForDiagram(kind: string): string {
  return ["blockdiag", "seqdiag", "actdiag", "nwdiag"].includes(kind) ? kind : "graph";
}

function RenderResultPanel(props: { result: Record<string, unknown> | null }) {
  const preview = props.result ? svgDataUri(props.result) : null;
  const assets = props.result && Array.isArray(props.result.assets) ? props.result.assets : [];
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Render Result</h2>
          {props.result ? <Badge variant="secondary">{assets.length} asset(s)</Badge> : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {preview ? (
          <div className="rounded border bg-background p-2">
            <img src={preview} alt="Visual rendering preview" className="max-h-96 w-full object-contain" />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No inline SVG preview.</p>
        )}
        {props.result ? <JsonExplorer data={props.result} title="Manifest" /> : null}
      </CardContent>
    </Card>
  );
}

function RendererBadge(props: { renderer: string; status: "allowed" | "blocked" | "unknown" }) {
  const variant = props.status === "allowed" ? "default" : props.status === "blocked" ? "destructive" : "secondary";
  return <Badge variant={variant}>{props.renderer}: {props.status}</Badge>;
}

function useRendererStatuses(rendererIds: string[]) {
  const { api } = useChartState();
  const [states, setStates] = React.useState<Record<string, "allowed" | "blocked" | "unknown">>({});
  const rendererKey = rendererIds.join("|");

  React.useEffect(() => {
    let cancelled = false;
    api.listRenderers()
      .then((status) => {
        if (cancelled) return;
        const next: Record<string, "allowed" | "blocked" | "unknown"> = {};
        for (const id of rendererKey.split("|").filter(Boolean)) {
          next[id] = status.allowed?.[id] ? "allowed" : status.blocked?.[id] ? "blocked" : "unknown";
        }
        setStates(next);
      })
      .catch(() => {
        if (!cancelled) setStates({});
      });
    return () => {
      cancelled = true;
    };
  }, [api, rendererKey]);

  return states;
}

function useRenderDiagramRunner() {
  const { api } = useChartState();
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<Record<string, unknown> | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<string | null>(null);

  const run = React.useCallback(async (payload: Record<string, unknown>) => {
    setBusy(true);
    setError(null);
    setStatus(null);
    setResult(null);
    try {
      const out = await api.renderDiagram(payload);
      setResult(out);
      const assets = Array.isArray(out.assets) ? out.assets.length : 0;
      setStatus(`Render completed (${assets} asset(s)).`);
    } catch (e) {
      setError(errMessage(e, "Render request failed."));
    } finally {
      setBusy(false);
    }
  }, [api]);

  return { busy, result, error, status, run, setResult, setError, setStatus };
}

export function DiagramPanelPage() {
  const { appVersion } = useChartState();
  const [kind, setKind] = React.useState("flow");
  const [direction, setDirection] = React.useState("LR");
  const [title, setTitle] = React.useState("Stream C diagram");
  const [source, setSource] = React.useState(DIAGRAM_SOURCE);
  const [stylesText, setStylesText] = React.useState(DIAGRAM_STYLES);
  const runner = useRenderDiagramRunner();
  const renderer = rendererForDiagram(kind);
  const rendererStates = useRendererStatuses([renderer]);

  const render = () => {
    try {
      const diagramStyles = parseObject(stylesText, "Diagram styles");
      void runner.run({
        diagram_spec: { kind, title, direction, source, diagram_styles: diagramStyles },
        diagram_styles: diagramStyles,
        renderer,
        output_formats: ["svg"],
        width: 900,
        height: 520,
      });
    } catch (e) {
      runner.setResult(null);
      runner.setStatus(null);
      runner.setError(errMessage(e, "Invalid diagram panel input."));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Diagram Panel" version={appVersion} description="Structured diagram rendering through render_diagram.">
        <Button size="sm" variant="secondary" onClick={() => setSource(DIAGRAM_SOURCE)}>
          <RotateCcw aria-hidden="true" className="mr-2 h-4 w-4" /> Reset
        </Button>
        <Button size="sm" disabled={runner.busy} onClick={render} data-testid="diagram-panel-render">
          <Play aria-hidden="true" className="mr-2 h-4 w-4" /> Render Diagram
        </Button>
      </PageHeader>
      <StatusLine loading={runner.busy} error={runner.error} status={runner.status} />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">Diagram Spec</h2>
              <RendererBadge renderer={renderer} status={rendererStates[renderer] ?? "unknown"} />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="diagram-kind">Kind</Label>
                <Select id="diagram-kind" value={kind} onChange={(e) => setKind(e.currentTarget.value)}>
                  {["flow", "arch", "dep", "state", "org", "tree", "mindmap", "er", "graph", "blockdiag", "seqdiag", "actdiag", "nwdiag"].map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="diagram-direction">Direction</Label>
                <Select id="diagram-direction" value={direction} onChange={(e) => setDirection(e.currentTarget.value)}>
                  <option value="LR">LR</option>
                  <option value="TB">TB</option>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="diagram-title">Title</Label>
              <Input id="diagram-title" value={title} onChange={(e) => setTitle(e.currentTarget.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="diagram-source">Source</Label>
              <Textarea
                id="diagram-source"
                data-testid="diagram-panel-source"
                rows={7}
                className="font-mono text-xs"
                value={source}
                onChange={(e) => setSource(e.currentTarget.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="diagram-styles">Diagram styles JSON</Label>
              <Textarea
                id="diagram-styles"
                rows={8}
                className="font-mono text-xs"
                value={stylesText}
                onChange={(e) => setStylesText(e.currentTarget.value)}
              />
            </div>
          </CardContent>
        </Card>
        <RenderResultPanel result={runner.result} />
      </div>
    </div>
  );
}

export function MathDocumentPanelPage() {
  const { appVersion } = useChartState();
  const [mode, setMode] = React.useState("mathtext");
  const [title, setTitle] = React.useState("Document render");
  const [math, setMath] = React.useState("E = mc^2");
  const [markdown, setMarkdown] = React.useState(DOCUMENT_MARKDOWN);
  const runner = useRenderDiagramRunner();
  const renderer = mode === "mathtext" ? "mathtext" : "doc_card";
  const rendererStates = useRendererStatuses([renderer]);

  const render = () => {
    const doc_spec = mode === "mathtext"
      ? { title, math }
      : { title, subtitle: "W28G-1039C", markdown };
    void runner.run({
      doc_spec,
      renderer,
      output_formats: ["svg"],
      width: 900,
      height: 520,
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Math / Document Panel" version={appVersion} description="Document-card and mathtext rendering through render_diagram.">
        <Button size="sm" disabled={runner.busy} onClick={render} data-testid="document-panel-render">
          <Play aria-hidden="true" className="mr-2 h-4 w-4" /> Render
        </Button>
      </PageHeader>
      <StatusLine loading={runner.busy} error={runner.error} status={runner.status} />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">Document Spec</h2>
              <RendererBadge renderer={renderer} status={rendererStates[renderer] ?? "unknown"} />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <Tabs value={mode} onValueChange={setMode}>
              <TabsList>
                <TabsTrigger value="mathtext">Math</TabsTrigger>
                <TabsTrigger value="doc_card">Document Card</TabsTrigger>
              </TabsList>
              <div className="mt-4 space-y-1">
                <Label htmlFor="document-title">Title</Label>
                <Input id="document-title" value={title} onChange={(e) => setTitle(e.currentTarget.value)} />
              </div>
              <TabsContent value="mathtext">
                <div className="space-y-1">
                  <Label htmlFor="mathtext-input">Mathtext</Label>
                  <Textarea
                    id="mathtext-input"
                    data-testid="document-panel-math"
                    rows={5}
                    className="font-mono text-xs"
                    value={math}
                    onChange={(e) => setMath(e.currentTarget.value)}
                  />
                </div>
              </TabsContent>
              <TabsContent value="doc_card">
                <div className="space-y-1">
                  <Label htmlFor="document-markdown">Markdown</Label>
                  <Textarea
                    id="document-markdown"
                    data-testid="document-panel-markdown"
                    rows={12}
                    className="font-mono text-xs"
                    value={markdown}
                    onChange={(e) => setMarkdown(e.currentTarget.value)}
                  />
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
        <RenderResultPanel result={runner.result} />
      </div>
    </div>
  );
}

export function ClipartThemingPanelPage() {
  const { appVersion } = useChartState();
  const [mode, setMode] = React.useState("clipart");
  const [title, setTitle] = React.useState("Clipart composition");
  const [background, setBackground] = React.useState("#ffffff");
  const [elementsText, setElementsText] = React.useState(CLIPART_ELEMENTS);
  const [stylesText, setStylesText] = React.useState(DIAGRAM_STYLES);
  const runner = useRenderDiagramRunner();
  const renderer = mode === "clipart" ? "clipart" : "graph";
  const rendererStates = useRendererStatuses([renderer]);

  const render = () => {
    try {
      if (mode === "clipart") {
        void runner.run({
          clipart_spec: { title, background, elements: parseArray(elementsText, "Clipart elements") },
          renderer: "clipart",
          output_formats: ["svg"],
          width: 900,
          height: 520,
        });
        return;
      }
      const diagramStyles = parseObject(stylesText, "Diagram styles");
      void runner.run({
        diagram_spec: {
          kind: "flow",
          title: "Theme preview",
          direction: "LR",
          source: "Draft -> Review; Review -> Release;",
          diagram_styles: diagramStyles,
        },
        diagram_styles: diagramStyles,
        renderer: "graph",
        output_formats: ["svg"],
        width: 900,
        height: 520,
      });
    } catch (e) {
      runner.setResult(null);
      runner.setStatus(null);
      runner.setError(errMessage(e, "Invalid clipart/theming input."));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Clipart / Theming Panel" version={appVersion} description="Clipart composition and diagram style rendering through render_diagram.">
        <Button size="sm" disabled={runner.busy} onClick={render} data-testid="clipart-panel-render">
          <Play aria-hidden="true" className="mr-2 h-4 w-4" /> Render
        </Button>
      </PageHeader>
      <StatusLine loading={runner.busy} error={runner.error} status={runner.status} />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">Visual Spec</h2>
              <RendererBadge renderer={renderer} status={rendererStates[renderer] ?? "unknown"} />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <Tabs value={mode} onValueChange={setMode}>
              <TabsList>
                <TabsTrigger value="clipart">Clipart</TabsTrigger>
                <TabsTrigger value="theme">Diagram Theme</TabsTrigger>
              </TabsList>
              <TabsContent value="clipart">
                <div className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label htmlFor="clipart-title">Title</Label>
                      <Input id="clipart-title" value={title} onChange={(e) => setTitle(e.currentTarget.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="clipart-background">Background</Label>
                      <Input
                        id="clipart-background"
                        value={background}
                        onChange={(e) => setBackground(e.currentTarget.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="clipart-elements">Elements JSON</Label>
                    <Textarea
                      id="clipart-elements"
                      data-testid="clipart-panel-elements"
                      rows={14}
                      className="font-mono text-xs"
                      value={elementsText}
                      onChange={(e) => setElementsText(e.currentTarget.value)}
                    />
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="theme">
                <div className="space-y-1">
                  <Label htmlFor="theme-styles">Diagram styles JSON</Label>
                  <Textarea
                    id="theme-styles"
                    data-testid="clipart-panel-theme"
                    rows={14}
                    className="font-mono text-xs"
                    value={stylesText}
                    onChange={(e) => setStylesText(e.currentTarget.value)}
                  />
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
        <RenderResultPanel result={runner.result} />
      </div>
    </div>
  );
}
