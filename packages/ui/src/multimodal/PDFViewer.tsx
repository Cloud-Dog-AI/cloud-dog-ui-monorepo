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

// @cloud-dog/ui — PDFViewer (W28F-948): first-N-pages inline PDF render.

import * as React from "react";
import { cn } from "../utils/cn";
import { Button } from "../components/button/Button";

export type PDFViewerProps = Readonly<{
  /** PDF source URL or artefact-ref. */
  src: string;
  /** Number of leading pages to expose for inline viewing. Defaults to 3. */
  pages?: number;
  /** Accessible title. */
  title?: string;
  /** Optional pre-rendered page image URLs (one per page); used when supplied. */
  pageImages?: ReadonlyArray<string>;
  dataTestId?: string;
  className?: string;
}>;

/**
 * Inline PDF viewer that exposes the first `pages` pages of a document. When the
 * caller supplies pre-rendered `pageImages` (e.g. produced server-side), those
 * are shown directly; otherwise the browser's native PDF renderer is embedded
 * via `<object>` with a `#page=N` fragment and prev/next navigation, bounded to
 * the first N pages per the §9.4.6 "first 3 pages render" gate. A download link
 * is always provided as the fallback.
 */
export function PDFViewer(props: PDFViewerProps) {
  const { src, pages = 3, title = "PDF result", pageImages, dataTestId = "mm-pdf-viewer", className } = props;
  const maxPages = Math.max(1, pages);
  const usingImages = !!pageImages && pageImages.length > 0;
  const total = usingImages ? Math.min(pageImages!.length, maxPages) : maxPages;
  const [page, setPage] = React.useState(1);
  const current = Math.min(Math.max(1, page), total);

  return (
    <div
      data-testid={dataTestId}
      className={cn("flex max-w-full flex-col gap-2 rounded-md border border-input bg-card p-2", className)}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-muted-foreground">{title}</span>
        <div className="flex items-center gap-1" role="group" aria-label="PDF page navigation">
          <Button
            size="sm"
            variant="outline"
            disabled={current <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            aria-label="Previous page"
            data-testid={`${dataTestId}-prev`}
          >
            Prev
          </Button>
          <span data-testid={`${dataTestId}-page-indicator`} className="px-1 text-xs text-foreground" aria-live="polite">
            Page {current} of {total}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={current >= total}
            onClick={() => setPage((p) => Math.min(total, p + 1))}
            aria-label="Next page"
            data-testid={`${dataTestId}-next`}
          >
            Next
          </Button>
        </div>
      </div>

      {usingImages ? (
        <img
          src={pageImages![current - 1]}
          alt={`${title} — page ${current}`}
          loading="lazy"
          data-testid={`${dataTestId}-page-image`}
          className="max-h-96 w-full rounded border border-input object-contain"
        />
      ) : (
        <object
          data={`${src}#page=${current}`}
          type="application/pdf"
          aria-label={`${title} — page ${current} of ${total}`}
          data-testid={`${dataTestId}-object`}
          className="h-96 w-full rounded border border-input"
        >
          <p className="p-2 text-xs text-muted-foreground">
            Inline preview unavailable.{" "}
            <a href={src} download className="font-medium text-primary underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              Download PDF
            </a>
          </p>
        </object>
      )}

      <a
        href={src}
        download
        data-testid={`${dataTestId}-download`}
        className="self-start rounded px-1 text-xs font-medium text-primary underline hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Download full PDF
      </a>
    </div>
  );
}
