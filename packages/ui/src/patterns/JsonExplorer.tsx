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

// @cloud-dog/ui — JsonExplorer pattern (searchable JSON tree inspector).
//
// PS-81 v2 / PS-73 v2: when an optional `sources` map is supplied, every leaf
// node carries a source-attribution badge (default/config/env/vault), secrets
// are masked, and a per-node source-history pop-over is available. The
// PS-73 v2 conformance contract (data-testid hooks) is emitted unconditionally
// and is backward-compatible — callers that do not pass `sources` keep the
// original display-only behaviour with the new test hooks added.

import * as React from "react";
import { Badge } from "../components/layout/Badge";
import { Button } from "../components/button/Button";
import { Input } from "../components/input/Input";
import { cn } from "../utils/cn";

type JsonExplorerNodeKind = "object" | "array" | "string" | "number" | "boolean" | "null" | "undefined";

/** PS-73 v2 SW8 source attribution metadata for a single config leaf. */
export type JsonExplorerSource = Readonly<{
  /** Winning source layer. */
  source: "default" | "config" | "env" | "vault" | string;
  /** Whether the value is a secret (masked by default — PS-73 v2 SW4). */
  secret?: boolean;
  /** Server tab(s) the leaf applies to (PS-73 v2 SW9). */
  servers?: readonly string[];
}>;

/** Map of dot-path (no "root" prefix; arrays as `[i]`) -> source metadata. */
export type JsonExplorerSourceMap = Readonly<Record<string, JsonExplorerSource>>;

/** PS-73 v2 SW4 default mask token (eight hyphens). */
const DEFAULT_MASK_TOKEN = "--------";

type JsonExplorerNodeProps = Readonly<{
  label: string;
  value: unknown;
  path: string;
  depth: number;
  maxDepth: number;
  searchTerm: string;
  expandedPaths: ReadonlySet<string>;
  sources?: JsonExplorerSourceMap;
  maskToken: string;
  revealedSecrets: ReadonlySet<string>;
  onToggle: (path: string) => void;
  onPathActivate: (path: string) => void;
  onCopyLeaf: (keyPath: string, value: unknown) => void;
  onCopySubtree: (keyPath: string, value: unknown) => void;
}>;

export type JsonExplorerProps = Readonly<{
  data: unknown;
  title?: string;
  maxDepth?: number;
  defaultExpanded?: boolean;
  onPathSelect?: (path: string) => void;
  className?: string;
  /** PS-73 v2: per-leaf source attribution. When present, badges + masking render. */
  sources?: JsonExplorerSourceMap;
  /** PS-73 v2 SW4 mask token (default: eight hyphens). */
  maskToken?: string;
  /** Controlled search term (page-level search wrapper — PS-73 v2 SW11). */
  searchTerm?: string;
  /** Set of dot-paths whose secret value is currently revealed (admin-only — SW4B). */
  revealedSecrets?: ReadonlySet<string>;
  /** Hide the widget-internal search box (when a page-level search drives it). */
  hideInternalSearch?: boolean;
  /** CX-140: rendering mode. "table" (default for new consumers) shows Path/Type/Value columns and drops the `root` wrapper level. "tree" keeps legacy outline. */
  viewMode?: "tree" | "table";
  /** DM-SET-01: horizontal alignment of the table-mode Value column. Default "left". */
  alignValues?: "left" | "right";
  /**
   * Root section data-testid. Defaults to "ps81-json-explorer" (the canonical
   * PS-81 handle). Override it when a page renders MORE THAN ONE JsonExplorer so
   * each instance is uniquely addressable and does not trip Playwright strict
   * mode (e.g. a settings page with a primary config tree plus separate
   * build/diagnostics/runtime cards).
   */
  testId?: string;
}>;

/** Flatten a JSON tree into table rows {path, type, value}. Skips the root wrapper level per CX-140. */
function flattenToRows(value: unknown, parentPath = ""): Array<Readonly<{ path: string; type: JsonExplorerNodeKind; value: unknown; depth: number; expandable: boolean }>> {
  const out: Array<Readonly<{ path: string; type: JsonExplorerNodeKind; value: unknown; depth: number; expandable: boolean }>> = [];
  const kind = getNodeKind(value);
  if (kind === "object") {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const path = parentPath ? `${parentPath}.${k}` : k;
      const vk = getNodeKind(v);
      out.push({ path, type: vk, value: v, depth: path.split(/\.|\[/).length - 1, expandable: isExpandable(v) });
      if (isExpandable(v)) {
        for (const child of flattenToRows(v, path)) out.push(child);
      }
    }
  } else if (kind === "array") {
    (value as unknown[]).forEach((v, i) => {
      const path = `${parentPath}[${i}]`;
      const vk = getNodeKind(v);
      out.push({ path, type: vk, value: v, depth: path.split(/\.|\[/).length - 1, expandable: isExpandable(v) });
      if (isExpandable(v)) {
        for (const child of flattenToRows(v, path)) out.push(child);
      }
    });
  }
  return out;
}

function parentPathOf(path: string): string {
  const bracket = path.match(/^(.*)\[[^\]]+\]$/);
  if (bracket) return bracket[1];
  const dot = path.lastIndexOf(".");
  return dot === -1 ? "" : path.slice(0, dot);
}

function internalPathFor(path: string): string {
  return path ? `root.${path}` : "root";
}

/** Display value cell — masks secrets, truncates long strings. */
function tableLeafDisplay(value: unknown, isSecret: boolean, revealed: boolean, maskToken: string): string {
  if (isSecret && !revealed) return maskToken;
  const kind = getNodeKind(value);
  if (kind === "object") return `{${Object.keys(value as Record<string, unknown>).length}}`;
  if (kind === "array") return `[${(value as unknown[]).length}]`;
  if (kind === "string") {
    const s = String(value);
    return s.length > 200 ? s.slice(0, 200) + "…" : s;
  }
  if (kind === "null") return "null";
  if (kind === "undefined") return "—";
  return String(value);
}

/** Resolves the display kind for a JSON node. */
function getNodeKind(value: unknown): JsonExplorerNodeKind {
  if (value === null) {
    return "null";
  }
  if (Array.isArray(value)) {
    return "array";
  }
  if (typeof value === "object") {
    return "object";
  }
  if (typeof value === "string") {
    return "string";
  }
  if (typeof value === "number") {
    return "number";
  }
  if (typeof value === "boolean") {
    return "boolean";
  }
  return "undefined";
}

/** Returns whether a node is expandable in the JSON tree. */
function isExpandable(value: unknown): boolean {
  return Array.isArray(value) || (typeof value === "object" && value !== null);
}

/** Builds a dot-and-index JSON path string for child nodes. */
function buildChildPath(parentPath: string, childLabel: string, useIndex: boolean): string {
  return useIndex ? `${parentPath}[${childLabel}]` : `${parentPath}.${childLabel}`;
}

/** Converts the internal "root"-prefixed path to the public dot-key-path. */
function toKeyPath(path: string): string {
  if (path === "root") {
    return "";
  }
  return path.startsWith("root.") ? path.slice("root.".length) : path;
}

/** Produces a short preview for collapsed JSON values. */
function formatPreview(value: unknown): string {
  const kind = getNodeKind(value);
  if (kind === "array") {
    return `[${(value as unknown[]).length}]`;
  }
  if (kind === "object") {
    return `{${Object.keys(value as Record<string, unknown>).length}}`;
  }
  if (kind === "string") {
    return JSON.stringify(value);
  }
  if (kind === "null") {
    return "null";
  }
  if (kind === "undefined") {
    return "undefined";
  }
  return String(value);
}

/** Collects all expandable paths so the tree can be fully expanded. */
function collectExpandablePaths(value: unknown, path: string, depth: number, maxDepth: number): string[] {
  if (!isExpandable(value) || depth >= maxDepth) {
    return [];
  }
  const children = Array.isArray(value)
    ? value.map((item, index) => [String(index), item] as const)
    : Object.entries(value as Record<string, unknown>);
  const nested = children.flatMap(([childKey, childValue]) =>
    collectExpandablePaths(childValue, buildChildPath(path, childKey, Array.isArray(value)), depth + 1, maxDepth)
  );
  return [path, ...nested];
}

/** Whether a node's OWN label/path/value matches the search term (for highlight). */
function selfMatches(value: unknown, label: string, path: string, searchTerm: string): boolean {
  if (!searchTerm) {
    return false;
  }
  if (isExpandable(value)) {
    return `${label} ${path}`.toLowerCase().includes(searchTerm);
  }
  return `${label} ${path} ${formatPreview(value)}`.toLowerCase().includes(searchTerm);
}

/** Searches the JSON tree and keeps a node visible when it or any descendant matches. */
function matchesSearch(value: unknown, label: string, path: string, searchTerm: string, depth: number, maxDepth: number): boolean {
  if (!searchTerm) {
    return true;
  }
  const haystack = `${label} ${path} ${formatPreview(value)}`.toLowerCase();
  if (haystack.includes(searchTerm)) {
    return true;
  }
  if (!isExpandable(value) || depth >= maxDepth) {
    return false;
  }
  if (Array.isArray(value)) {
    return value.some((item, index) =>
      matchesSearch(item, `[${index}]`, buildChildPath(path, String(index), true), searchTerm, depth + 1, maxDepth)
    );
  }
  return Object.entries(value as Record<string, unknown>).some(([key, item]) =>
    matchesSearch(item, key, buildChildPath(path, key, false), searchTerm, depth + 1, maxDepth)
  );
}

/** Copies text using the browser clipboard when available, with a legacy fallback. */
async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the legacy fallback.
  }
  try {
    if (typeof document === "undefined") {
      return false;
    }
    const el = document.createElement("textarea");
    el.value = text;
    el.style.position = "fixed";
    el.style.left = "-9999px";
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}

/** Renders the PS-73 v2 SW8 source-attribution badge + source-history pop-over. */
function SourceBadge(props: Readonly<{ keyPath: string; meta: JsonExplorerSource }>) {
  const [open, setOpen] = React.useState(false);
  const variant: "default" | "secondary" | "destructive" =
    props.meta.source === "vault"
      ? "destructive"
      : props.meta.source === "config"
        ? "default"
        : "secondary";
  const servers = props.meta.servers && props.meta.servers.length > 0 ? props.meta.servers.join(", ") : "shared";
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        data-testid="ps81-source-badge"
        data-source={props.meta.source}
        title={`Source history — effective: ${props.meta.source}; servers: ${servers}`}
        aria-label="Config source badge"
        onClick={() => setOpen((v) => !v)}
        className="rounded focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <Badge variant={variant}>{props.meta.source}</Badge>
      </button>
      {open ? (
        <span
          data-testid="ps81-source-history"
          role="dialog"
          className="absolute left-0 top-full z-20 mt-1 w-64 rounded-md border bg-background p-2 text-xs shadow-md"
        >
          <span className="block font-semibold">Source history</span>
          <span className="block">Effective source: <strong>{props.meta.source}</strong></span>
          <span className="block">Server scope: {servers}</span>
          <span className="block text-muted-foreground">
            Precedence: os.environ &gt; env-files &gt; config.yaml &gt; defaults.yaml (PS-80 CM1)
          </span>
        </span>
      ) : null}
    </span>
  );
}

/** Renders a single searchable JSON tree node. */
function JsonExplorerNode(props: JsonExplorerNodeProps) {
  if (!matchesSearch(props.value, props.label, props.path, props.searchTerm, props.depth, props.maxDepth)) {
    return null;
  }

  const kind = getNodeKind(props.value);
  const expandable = isExpandable(props.value);
  const atDepthLimit = props.depth >= props.maxDepth;
  const expanded = props.searchTerm ? true : props.expandedPaths.has(props.path) || Array.isArray(props.value);
  const keyPath = toKeyPath(props.path);
  const meta = props.sources ? props.sources[keyPath] : undefined;
  const isSecret = Boolean(meta?.secret);
  const revealed = props.revealedSecrets.has(keyPath);
  const highlighted = selfMatches(props.value, props.label, props.path, props.searchTerm);
  const childEntries = Array.isArray(props.value)
    ? props.value.map((item, index) => [String(index), item] as const)
    : expandable
      ? Object.entries(props.value as Record<string, unknown>)
      : [];

  const displayLeaf = isSecret && !revealed ? props.maskToken : formatPreview(props.value);

  return (
    <div className="space-y-1">
      <div
        data-testid={expandable ? "ps81-branch" : "ps81-node"}
        data-key-path={keyPath}
        data-highlighted={highlighted ? "true" : undefined}
        className={cn(
          "flex min-w-0 items-start gap-2 rounded-sm px-2 py-1 hover:bg-muted/30",
          highlighted ? "bg-yellow-100 ring-1 ring-yellow-400" : "",
        )}
        style={{ paddingLeft: `${props.depth * 16 + 8}px` }}
      >
        {expandable && !atDepthLimit ? (
          <button
            type="button"
            className="mt-0.5 w-5 shrink-0 rounded text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            aria-label={expanded ? `Collapse ${props.path}` : `Expand ${props.path}`}
            onClick={() => props.onToggle(props.path)}
          >
            {expanded ? "▾" : "▸"}
          </button>
        ) : (
          <span className="mt-0.5 w-5 shrink-0 text-center text-muted-foreground">•</span>
        )}

        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="font-mono text-sm text-foreground">{props.label}</span>
            <Badge variant="secondary" className="capitalize">
              {kind}
            </Badge>
            {meta ? <SourceBadge keyPath={keyPath} meta={meta} /> : null}
            <button
              type="button"
              className="min-w-0 truncate rounded-sm font-mono text-xs text-muted-foreground underline-offset-4 hover:underline focus:outline-none focus:ring-2 focus:ring-ring"
              onClick={() => props.onPathActivate(props.path)}
              title={props.path}
            >
              {props.path}
            </button>
            {expandable ? (
              <button
                type="button"
                data-testid="ps81-copy-subtree"
                data-key-path={keyPath}
                className="rounded-sm text-xs text-muted-foreground hover:underline focus:outline-none focus:ring-2 focus:ring-ring"
                onClick={() => props.onCopySubtree(keyPath, props.value)}
                aria-label="Copy subtree"
              >
                copy subtree
              </button>
            ) : (
              <button
                type="button"
                data-testid="ps81-copy-leaf"
                data-key-path={keyPath}
                className="rounded-sm text-xs text-muted-foreground hover:underline focus:outline-none focus:ring-2 focus:ring-ring"
                onClick={() => props.onCopyLeaf(keyPath, isSecret ? "[redacted]" : props.value)}
                aria-label="Copy setting value"
              >
                copy
              </button>
            )}
          </div>

          {!expandable ? (
            <div
              data-testid="ps81-value"
              data-key-path={keyPath}
              data-secret={isSecret ? "true" : undefined}
              className={cn("font-mono text-sm", kind === "string" && !isSecret ? "text-emerald-700" : "")}
            >
              <span className={cn(kind === "number" && !isSecret ? "text-sky-700" : "")}>{displayLeaf}</span>
            </div>
          ) : (
            <div className="font-mono text-xs text-muted-foreground">
              {atDepthLimit ? "Max depth reached" : formatPreview(props.value)}
            </div>
          )}
        </div>
      </div>

      {expandable && !atDepthLimit && expanded ? (
        <div className="space-y-1">
          {childEntries.map(([childKey, childValue]) => (
            <JsonExplorerNode
              key={buildChildPath(props.path, childKey, Array.isArray(props.value))}
              label={Array.isArray(props.value) ? `[${childKey}]` : childKey}
              value={childValue}
              path={buildChildPath(props.path, childKey, Array.isArray(props.value))}
              depth={props.depth + 1}
              maxDepth={props.maxDepth}
              searchTerm={props.searchTerm}
              expandedPaths={props.expandedPaths}
              sources={props.sources}
              maskToken={props.maskToken}
              revealedSecrets={props.revealedSecrets}
              onToggle={props.onToggle}
              onPathActivate={props.onPathActivate}
              onCopyLeaf={props.onCopyLeaf}
              onCopySubtree={props.onCopySubtree}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Redacts secret leaves inside a subtree before copy/export (PS-73 v2 SW4A). */
function redactSubtree(value: unknown, path: string, sources?: JsonExplorerSourceMap): unknown {
  if (Array.isArray(value)) {
    return value.map((item, index) => redactSubtree(item, `${path}[${index}]`, sources));
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      out[key] = redactSubtree(child, path ? `${path}.${key}` : key, sources);
    }
    return out;
  }
  if (sources?.[path]?.secret) {
    return "[redacted]";
  }
  return value;
}

/** JsonExplorer renders a searchable, expandable JSON inspection tree. */
export function JsonExplorer(props: JsonExplorerProps) {
  const maxDepth = props.maxDepth ?? 8;
  const maskToken = props.maskToken ?? DEFAULT_MASK_TOKEN;
  const [internalSearch, setInternalSearch] = React.useState("");
  const [copiedPath, setCopiedPath] = React.useState("");
  const emptyRevealed = React.useMemo(() => new Set<string>(), []);
  const revealedSecrets = props.revealedSecrets ?? emptyRevealed;
  const [expandedPaths, setExpandedPaths] = React.useState<Set<string>>(() => {
    return new Set(props.defaultExpanded ? collectExpandablePaths(props.data, "root", 0, maxDepth) : ["root"]);
  });

  React.useEffect(() => {
    setExpandedPaths(new Set(props.defaultExpanded ? collectExpandablePaths(props.data, "root", 0, maxDepth) : ["root"]));
  }, [maxDepth, props.data, props.defaultExpanded]);

  const searchTerm = (props.searchTerm !== undefined ? props.searchTerm : internalSearch).trim().toLowerCase();

  const onToggle = React.useCallback((path: string) => {
    setExpandedPaths((current) => {
      const next = new Set(current);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const onExpandAll = React.useCallback(() => {
    setExpandedPaths(new Set(collectExpandablePaths(props.data, "root", 0, maxDepth)));
  }, [maxDepth, props.data]);

  const onCollapseAll = React.useCallback(() => {
    setExpandedPaths(new Set());
  }, []);

  const flashCopy = React.useCallback((label: string, ok: boolean) => {
    setCopiedPath(ok ? label : `${label}:failed`);
    if (typeof window !== "undefined") {
      window.setTimeout(() => setCopiedPath(""), 1200);
    }
  }, []);

  const onPathActivate = React.useCallback(
    async (path: string) => {
      props.onPathSelect?.(toKeyPath(path));
      const ok = await copyText(toKeyPath(path) || "root");
      flashCopy(toKeyPath(path) || "root", ok);
    },
    [flashCopy, props]
  );

  const onCopyLeaf = React.useCallback(
    async (keyPath: string, value: unknown) => {
      const ok = await copyText(`${keyPath} = ${typeof value === "string" ? value : JSON.stringify(value)}`);
      flashCopy(keyPath, ok);
    },
    [flashCopy]
  );

  const onCopySubtree = React.useCallback(
    async (keyPath: string, value: unknown) => {
      const redacted = redactSubtree(value, keyPath, props.sources);
      const ok = await copyText(JSON.stringify(redacted, null, 2));
      flashCopy(`${keyPath || "root"} (subtree)`, ok);
    },
    [flashCopy, props.sources]
  );

  const tableRows = React.useMemo(() => {
    return flattenToRows(props.data).filter((row) => {
      const parentPath = parentPathOf(row.path);
      if (!expandedPaths.has(internalPathFor(parentPath))) return false;
      if (!searchTerm) return true;
      const hay = `${row.path} ${row.type} ${tableLeafDisplay(row.value, false, false, maskToken)}`.toLowerCase();
      return hay.includes(searchTerm);
    });
  }, [expandedPaths, maskToken, props.data, searchTerm]);

  return (
    <section
      data-testid={props.testId ?? "ps81-json-explorer"}
      className={cn("space-y-4 rounded-md border bg-background p-4", props.className)}
      aria-label="JSON explorer"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold">{props.title ?? "JSON Explorer"}</h3>
          <p className="text-sm text-muted-foreground">
            Browse structured JSON, filter visible paths, and copy exact property breadcrumbs.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Copy feedback must render regardless of hideInternalSearch so
              consumers that suppress the tree filter (e.g. the settings page)
              still surface the shared copy-confirmation affordance. */}
          {copiedPath ? (
            <Badge variant={copiedPath.endsWith(":failed") ? "destructive" : "default"}>
              {copiedPath.endsWith(":failed") ? "Copy failed" : "Copied"}
            </Badge>
          ) : null}
          <Button data-testid="ps81-expand-all" variant="secondary" size="sm" onClick={onExpandAll}>
            Expand all
          </Button>
          <Button data-testid="ps81-collapse-all" variant="secondary" size="sm" onClick={onCollapseAll}>
            Collapse all
          </Button>
        </div>
      </div>

      {props.hideInternalSearch ? null : (
        <div className="flex flex-col gap-3 lg:flex-row">
          <Input
            data-testid="ps81-search"
            value={internalSearch}
            onChange={(event) => setInternalSearch(event.target.value)}
            placeholder="Filter tree by key, path, or value"
            aria-label="Filter JSON tree"
            className="flex-1"
          />
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="secondary">max depth {maxDepth}</Badge>
          </div>
        </div>
      )}

      <div className="max-h-[36rem] overflow-auto rounded-md border bg-muted/10">
        {props.viewMode === "table" ? (
          <table className="w-full text-sm" data-testid="ps81-table-view">
            <thead className="bg-muted/40 sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Path</th>
                <th className="px-3 py-2 text-left font-medium">Type</th>
                <th className={cn("px-3 py-2 font-medium", props.alignValues === "right" ? "text-right" : "text-left")}>Value</th>
              </tr>
            </thead>
	            <tbody>
	              {tableRows.map((row) => {
	                const meta = props.sources ? props.sources[row.path] : undefined;
	                const isSecret = Boolean(meta?.secret);
	                const revealed = revealedSecrets.has(row.path);
	                const highlighted =
	                  Boolean(searchTerm) &&
	                  `${row.path} ${row.type} ${tableLeafDisplay(row.value, false, false, maskToken)}`
	                    .toLowerCase()
	                    .includes(searchTerm);
	                return (
	                  <tr
	                    key={row.path}
	                    className={cn("border-t hover:bg-muted/20", highlighted ? "bg-yellow-100 ring-1 ring-yellow-400" : "")}
	                    data-testid={row.expandable ? "ps81-branch" : "ps81-node"}
	                    data-key-path={row.path}
	                    data-highlighted={highlighted ? "true" : undefined}
	                  >
	                    <td className="px-3 py-1 font-mono text-xs" style={{ paddingLeft: `${row.depth * 14 + 12}px` }}>
	                      <span className="mr-2">{row.path}</span>
	                      {meta ? <SourceBadge keyPath={row.path} meta={meta} /> : null}
	                      {row.expandable ? (
	                        <button
	                          type="button"
	                          data-testid="ps81-copy-subtree"
	                          data-key-path={row.path}
	                          className="ml-2 rounded-sm text-xs text-muted-foreground hover:underline focus:outline-none focus:ring-2 focus:ring-ring"
	                          onClick={() => onCopySubtree(row.path, row.value)}
	                          aria-label="Copy subtree"
	                        >
	                          copy subtree
	                        </button>
	                      ) : (
	                        <button
	                          type="button"
	                          data-testid="ps81-copy-leaf"
	                          data-key-path={row.path}
	                          className="ml-2 rounded-sm text-xs text-muted-foreground hover:underline focus:outline-none focus:ring-2 focus:ring-ring"
	                          onClick={() => onCopyLeaf(row.path, isSecret ? "[redacted]" : row.value)}
	                          aria-label="Copy setting value"
	                        >
	                          copy
	                        </button>
	                      )}
	                    </td>
	                    <td className="px-3 py-1 text-xs text-muted-foreground">{row.type}</td>
	                    <td
	                      className={cn("px-3 py-1 font-mono text-xs break-all", props.alignValues === "right" ? "text-right" : "")}
	                      data-testid={row.expandable ? undefined : "ps81-value"}
	                      data-key-path={row.expandable ? undefined : row.path}
	                      data-secret={isSecret ? "true" : undefined}
	                    >
	                      {tableLeafDisplay(row.value, isSecret, revealed, maskToken)}
	                    </td>
	                  </tr>
	                );
	              })}
            </tbody>
          </table>
        ) : (
          <div className="py-2">
            <JsonExplorerNode
              label="root"
              value={props.data}
              path="root"
              depth={0}
              maxDepth={maxDepth}
              searchTerm={searchTerm}
              expandedPaths={expandedPaths}
              sources={props.sources}
              maskToken={maskToken}
              revealedSecrets={revealedSecrets}
              onToggle={onToggle}
              onPathActivate={onPathActivate}
              onCopyLeaf={onCopyLeaf}
              onCopySubtree={onCopySubtree}
            />
          </div>
        )}
      </div>
    </section>
  );
}
