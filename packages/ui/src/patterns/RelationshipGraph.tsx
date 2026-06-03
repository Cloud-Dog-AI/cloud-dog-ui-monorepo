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

// @cloud-dog/ui — RelationshipGraph pattern (cross-entity relationship widget).
//
// Closes W28A snag row 26-22 ("Object graph navigation") and supports the
// "Related tab" pattern from row 26-16 (cross-entity relationships between
// users → groups → rbac → api-keys → knowledge / experts / sessions / channels).
//
// Two complementary views are rendered (controlled by an internal Tabs):
//   - "Related" — entity-type-grouped tabs of neighbour rows; the user's stated
//     requirement per snag 26-16 was a Related-tab pattern, not a literal graph.
//   - "Graph"   — a small inline SVG visualisation of the centre node + its
//     immediate neighbours so users can see the topology at a glance.
//
// No external graph library is pulled in. Layout is a deterministic radial
// placement around the centre node — sufficient for the "object-graph
// navigation widget" intent on a dashboard or entity-detail surface.

import * as React from "react";
import { cn } from "../utils/cn";
import { Card, CardHeader, CardContent } from "../components/card/Card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/tabs/Tabs";
import { Badge } from "../components/layout/Badge";

export type RelationshipNode = Readonly<{
  id: string;
  label: string;
  type: string;
  meta?: Record<string, unknown>;
  testId?: string;
}>;

export type RelationshipEdge = Readonly<{
  source: string;
  target: string;
  type: string;
  label?: string;
}>;

export type RelationshipGraphDirection = "LR" | "TB";

export type RelationshipGraphProps = Readonly<{
  nodes: ReadonlyArray<RelationshipNode>;
  edges: ReadonlyArray<RelationshipEdge>;
  centerNodeId?: string;
  onNodeClick?: (id: string) => void;
  direction?: RelationshipGraphDirection;
  emptyMessage?: string;
  dataTestId?: string;
  className?: string;
}>;

type NeighbourEntry = Readonly<{
  node: RelationshipNode;
  edge: RelationshipEdge;
  /** "out" = centre is source, "in" = centre is target */
  direction: "out" | "in";
}>;

function nodeTestId(node: RelationshipNode): string {
  return node.testId ?? `relationship-node-${node.type}-${node.id}`;
}

function edgeTestId(edge: RelationshipEdge): string {
  return `relationship-edge-${edge.type}-${edge.source}-${edge.target}`;
}

/**
 * Compute the immediate neighbours of `centerNodeId`. If no centre is given
 * we fall back to the first node by stable input order so the widget still
 * renders something deterministic.
 */
function computeNeighbours(
  nodes: ReadonlyArray<RelationshipNode>,
  edges: ReadonlyArray<RelationshipEdge>,
  centerNodeId: string | undefined,
): {
  centre: RelationshipNode | null;
  neighbours: NeighbourEntry[];
  byType: Record<string, NeighbourEntry[]>;
} {
  if (nodes.length === 0) {
    return { centre: null, neighbours: [], byType: {} };
  }
  const byId = new Map(nodes.map((n) => [n.id, n] as const));
  const centre = (centerNodeId ? byId.get(centerNodeId) : undefined) ?? nodes[0];

  const neighbours: NeighbourEntry[] = [];
  for (const edge of edges) {
    if (edge.source === centre.id) {
      const t = byId.get(edge.target);
      if (t) neighbours.push({ node: t, edge, direction: "out" });
    } else if (edge.target === centre.id) {
      const s = byId.get(edge.source);
      if (s) neighbours.push({ node: s, edge, direction: "in" });
    }
  }

  const byType: Record<string, NeighbourEntry[]> = {};
  for (const n of neighbours) {
    const k = n.node.type;
    if (!byType[k]) byType[k] = [];
    byType[k].push(n);
  }
  return { centre, neighbours, byType };
}

/**
 * Deterministic radial layout. `direction === "TB"` biases the spread to a
 * top-bottom column; "LR" biases to a left-right row. Without an external
 * layout engine this is intentionally simple and readable rather than
 * minimum-edge-crossing.
 */
function layoutPositions(
  count: number,
  direction: RelationshipGraphDirection,
  width: number,
  height: number,
): Array<{ x: number; y: number }> {
  if (count === 0) return [];
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) / 2 - 40;
  const positions: Array<{ x: number; y: number }> = [];
  if (count === 1) {
    if (direction === "LR") return [{ x: width - 40, y: cy }];
    return [{ x: cx, y: height - 40 }];
  }
  // Spread neighbours over a half-circle facing the dominant axis.
  // LR: from -90deg .. 90deg (right semicircle). TB: from 0deg .. 180deg (bottom semicircle).
  const start = direction === "LR" ? -Math.PI / 2 : 0;
  const end = direction === "LR" ? Math.PI / 2 : Math.PI;
  const span = end - start;
  for (let i = 0; i < count; i += 1) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    const a = start + t * span;
    positions.push({ x: cx + Math.cos(a) * radius, y: cy + Math.sin(a) * radius });
  }
  return positions;
}

function NeighbourRow(props: {
  entry: NeighbourEntry;
  onNodeClick?: (id: string) => void;
}) {
  const { entry, onNodeClick } = props;
  const tid = nodeTestId(entry.node);
  const eid = edgeTestId(entry.edge);
  const clickable = Boolean(onNodeClick);
  return (
    <li
      className="flex items-center justify-between gap-3 py-2 border-b border-border last:border-0"
      data-testid={`${tid}-row`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <Badge variant="secondary" data-testid={`${tid}-type`}>
          {entry.node.type}
        </Badge>
        {clickable ? (
          <button
            type="button"
            data-testid={tid}
            onClick={() => onNodeClick?.(entry.node.id)}
            className="text-sm text-primary underline-offset-4 hover:underline truncate text-left"
          >
            {entry.node.label}
          </button>
        ) : (
          <span data-testid={tid} className="text-sm truncate">
            {entry.node.label}
          </span>
        )}
      </div>
      <span
        className="text-xs text-muted-foreground whitespace-nowrap"
        data-testid={eid}
        data-edge-direction={entry.direction}
      >
        {entry.direction === "out" ? "→ " : "← "}
        {entry.edge.label ?? entry.edge.type}
      </span>
    </li>
  );
}

function GraphSvg(props: {
  centre: RelationshipNode;
  neighbours: NeighbourEntry[];
  direction: RelationshipGraphDirection;
  onNodeClick?: (id: string) => void;
}) {
  const { centre, neighbours, direction, onNodeClick } = props;
  const width = 440;
  const height = 260;
  const cx = width / 2;
  const cy = height / 2;
  const positions = layoutPositions(neighbours.length, direction, width, height);
  const centreTid = nodeTestId(centre);

  return (
    <svg
      role="img"
      aria-label={`Relationship graph for ${centre.label}`}
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-auto max-h-[280px] border border-border rounded-md bg-background"
      data-testid="relationship-graph-svg"
    >
      {/* Edges first so nodes paint over them */}
      {neighbours.map((n, i) => {
        const p = positions[i];
        return (
          <line
            key={edgeTestId(n.edge)}
            x1={cx}
            y1={cy}
            x2={p.x}
            y2={p.y}
            stroke="currentColor"
            strokeOpacity={0.35}
            strokeWidth={1.5}
            data-testid={`${edgeTestId(n.edge)}-line`}
          />
        );
      })}

      {/* Centre node */}
      <g data-testid={`${centreTid}-svg`}>
        <circle cx={cx} cy={cy} r={26} fill="currentColor" fillOpacity={0.12} stroke="currentColor" />
        <text
          x={cx}
          y={cy + 4}
          textAnchor="middle"
          fontSize={11}
          fontWeight={600}
          fill="currentColor"
        >
          {centre.label.length > 14 ? `${centre.label.slice(0, 13)}…` : centre.label}
        </text>
      </g>

      {/* Neighbour nodes */}
      {neighbours.map((n, i) => {
        const p = positions[i];
        const tid = nodeTestId(n.node);
        return (
          <g
            key={tid}
            data-testid={`${tid}-svg`}
            style={onNodeClick ? { cursor: "pointer" } : undefined}
            onClick={onNodeClick ? () => onNodeClick(n.node.id) : undefined}
          >
            <circle cx={p.x} cy={p.y} r={20} fill="currentColor" fillOpacity={0.06} stroke="currentColor" strokeOpacity={0.6} />
            <text
              x={p.x}
              y={p.y - 26}
              textAnchor="middle"
              fontSize={10}
              fill="currentColor"
              fillOpacity={0.7}
            >
              {n.node.type}
            </text>
            <text
              x={p.x}
              y={p.y + 4}
              textAnchor="middle"
              fontSize={11}
              fill="currentColor"
            >
              {n.node.label.length > 12 ? `${n.node.label.slice(0, 11)}…` : n.node.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function RelationshipGraph(props: RelationshipGraphProps) {
  const direction: RelationshipGraphDirection = props.direction ?? "LR";
  const { centre, neighbours, byType } = React.useMemo(
    () => computeNeighbours(props.nodes, props.edges, props.centerNodeId),
    [props.nodes, props.edges, props.centerNodeId],
  );

  const types = React.useMemo(() => Object.keys(byType).sort(), [byType]);
  // The first tab is the SVG view; remaining tabs are one per neighbour type.
  const allTabs = React.useMemo(() => ["graph", ...types], [types]);
  const [tab, setTab] = React.useState<string>(() => allTabs[0] ?? "graph");

  // If the active tab disappeared because props changed, fall back to the
  // first available tab.
  React.useEffect(() => {
    if (!allTabs.includes(tab)) setTab(allTabs[0] ?? "graph");
  }, [allTabs, tab]);

  const containerTid = props.dataTestId ?? "relationship-graph";

  if (!centre) {
    return (
      <Card className={cn("overflow-hidden", props.className)} data-testid={containerTid}>
        <CardContent className="py-6">
          <p className="text-sm text-muted-foreground" data-testid={`${containerTid}-empty`}>
            {props.emptyMessage ?? "No relationships to display."}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className={cn("overflow-hidden", props.className)}
      data-testid={containerTid}
      data-direction={direction}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              {centre.type}
            </div>
            <div
              className="text-sm font-semibold truncate"
              data-testid={`${containerTid}-centre-label`}
            >
              {centre.label}
            </div>
          </div>
          <Badge data-testid={`${containerTid}-edge-count`}>
            {neighbours.length} edge{neighbours.length === 1 ? "" : "s"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList aria-label="Relationship views" data-testid={`${containerTid}-tablist`}>
            <TabsTrigger value="graph">Graph</TabsTrigger>
            {types.map((t) => (
              <TabsTrigger key={t} value={t}>
                {t} ({byType[t].length})
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value="graph">
            <GraphSvg
              centre={centre}
              neighbours={neighbours}
              direction={direction}
              onNodeClick={props.onNodeClick}
            />
          </TabsContent>
          {types.map((t) => (
            <TabsContent key={t} value={t}>
              <ul
                className="divide-y divide-border"
                aria-label={`Related ${t}`}
                data-testid={`${containerTid}-list-${t}`}
              >
                {byType[t].map((entry) => (
                  <NeighbourRow
                    key={`${entry.edge.source}-${entry.edge.target}-${entry.edge.type}`}
                    entry={entry}
                    onNodeClick={props.onNodeClick}
                  />
                ))}
              </ul>
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
