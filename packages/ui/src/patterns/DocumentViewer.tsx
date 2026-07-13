// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
// Licensed under the Apache License, Version 2.0

/**
 * DocumentViewer — PS-74 DW2 compliant document viewer.
 *
 * Auto-detects format (JSON/Markdown/Text), renders inline with
 * scroll, download, and copy-to-clipboard support.
 */

import * as React from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Card, CardContent, CardHeader } from "../components/card";
import { Button } from "../components/button/Button";
import { JsonBlock } from "./JsonBlock";

type Format = "auto" | "markdown" | "json" | "text";

export interface DocumentViewerProps {
  /** Raw content string to render. */
  content: string;
  /** Explicit format override; defaults to 'auto'. */
  format?: Format;
  /** Optional title above the viewer. */
  title?: string;
  /** If set, shows a download button. */
  downloadFilename?: string;
  /** Max height of the scrollable container. */
  maxHeight?: string;
  /** Start collapsed (for JSON mode). */
  defaultCollapsed?: boolean;
}

/** Detect format from content heuristics. */
function detectFormat(content: string): Exclude<Format, "auto"> {
  const trimmed = content.trim();
  // JSON: starts with { or [ and parses
  if ((trimmed.startsWith("{") || trimmed.startsWith("[")) && trimmed.length > 1) {
    try {
      JSON.parse(trimmed);
      return "json";
    } catch {
      // not valid JSON
    }
  }
  // Markdown indicators
  if (
    /^#{1,6}\s/m.test(trimmed) ||
    /^```/m.test(trimmed) ||
    /\*\*[^*]+\*\*/m.test(trimmed) ||
    /^\s*[-*]\s/m.test(trimmed) ||
    /\[.+\]\(.+\)/m.test(trimmed)
  ) {
    return "markdown";
  }
  return "text";
}

function downloadFile(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Fallback for insecure contexts
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
  }
}

export function DocumentViewer({
  content,
  format = "auto",
  title,
  downloadFilename,
  maxHeight = "600px",
  defaultCollapsed = false,
}: DocumentViewerProps) {
  const resolved = format === "auto" ? detectFormat(content) : format;
  const [copied, setCopied] = React.useState(false);

  const handleCopy = React.useCallback(() => {
    void copyToClipboard(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [content]);

  return (
    <Card>
      {title ? (
        <CardHeader>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">{title}</h3>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={handleCopy}>
                {copied ? "Copied!" : "Copy"}
              </Button>
              {downloadFilename ? (
                <Button variant="ghost" size="sm" onClick={() => downloadFile(downloadFilename, content)}>
                  Download
                </Button>
              ) : null}
            </div>
          </div>
        </CardHeader>
      ) : null}
      <CardContent>
        <div
          aria-label={title ? `${title} content` : "Document content"}
          className="overflow-y-auto rounded border bg-muted/30 p-4"
          style={{ maxHeight }}
          tabIndex={0}
        >
          {resolved === "json" ? (
            <JsonBlock title="" value={JSON.parse(content)} defaultCollapsed={defaultCollapsed} />
          ) : resolved === "markdown" ? (
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <Markdown remarkPlugins={[remarkGfm]}>{content}</Markdown>
            </div>
          ) : (
            <pre className="whitespace-pre-wrap break-words font-mono text-sm">{content}</pre>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
