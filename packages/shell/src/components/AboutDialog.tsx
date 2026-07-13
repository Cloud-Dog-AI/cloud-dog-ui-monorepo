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

// @cloud-dog/shell — About surface (UI-R7).
// AboutContent is the single shared About body (logo, product name, version,
// description, company, website). AboutDialog wraps it in a modal; services
// also render AboutContent directly as the navigable `/about` route body
// (PS-77 addendum-b §2 / L4 R2 — a modal WITHOUT a rendered /about route is
// non-conformant).

import * as React from "react";
import { cn, Dialog, Button } from "@cloud-dog/ui";
import { brand } from "@cloud-dog/tokens";

export interface AboutContentProps {
  productName?: string;
  description?: string;
  companyName?: string;
  websiteUrl?: string;
  version?: string;
  className?: string;
}

/**
 * Shared About body. Renders the same content used by both the AboutDialog
 * modal and the navigable `/about` route page across all services. Carries the
 * canonical `about-*` data-testids so conformance assertions are identical
 * whether About is shown as a page or a modal.
 */
export function AboutContent(props: AboutContentProps) {
  const {
    productName = brand.name,
    description,
    companyName = "Viewdeck Engineering Limited",
    websiteUrl,
    version,
    className,
  } = props;

  return (
    <div className={cn("flex flex-col items-center gap-4 text-center", className)} data-testid="about-content">
      <img src={brand.logoPath} alt="" className="h-16 w-16" />
      <div className="space-y-1">
        <h2 className="text-lg font-semibold" data-testid="about-product-name">
          {productName}
        </h2>
        {version ? (
          <p className="text-sm text-muted-foreground" data-testid="about-version">
            v{version}
          </p>
        ) : null}
      </div>
      {description ? (
        <p className="text-sm text-muted-foreground max-w-sm" data-testid="about-description">
          {description}
        </p>
      ) : null}
      <p className="text-xs text-muted-foreground" data-testid="about-company">
        {companyName}
      </p>
      {websiteUrl ? (
        <a
          href={websiteUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-primary underline"
          data-testid="about-website"
        >
          {websiteUrl}
        </a>
      ) : null}
    </div>
  );
}

export interface AboutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productName?: string;
  description?: string;
  companyName?: string;
  websiteUrl?: string;
  version?: string;
  className?: string;
}

export function AboutDialog(props: AboutDialogProps) {
  const {
    open,
    onOpenChange,
    productName = brand.name,
    description,
    companyName,
    websiteUrl,
    version,
    className,
  } = props;

  return (
    <Dialog open={open} onOpenChange={onOpenChange} label={`About ${productName}`}>
      <div className={cn("flex flex-col items-center gap-4", className)}>
        <AboutContent
          productName={productName}
          description={description}
          companyName={companyName}
          websiteUrl={websiteUrl}
          version={version}
        />
        <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
      </div>
    </Dialog>
  );
}
