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

// @cloud-dog/shell — AboutPage: the canonical navigable `/system/about` page body
// (PS-WEBUI-URL-CANONICAL v1.6 §11 / W28E-1845-STD-F10).
//
// Single shared About PAGE surface for every service WebUI. Composes the shared
// `AboutContent` body + `VersionInfo` inside the shared `@cloud-dog/ui` `Card`
// layout so the navigable About route and the supplementary `AboutDialog` modal
// render the same canonical content with identical `about-*` data-testids.
//
// Service-specific profile copy, documentation links, and backend/capability
// summaries are PRESERVED through props + the `serviceProfile` / `docLinks` /
// `extra` / `children` extension slots (the §11.4 uncommon-functionality
// extension point) — services consume this component, they do NOT fork it
// (RULES §1.4 / §1.6).

import * as React from "react";
import { cn, Card, CardHeader, CardContent } from "@cloud-dog/ui";
import { AboutContent } from "./AboutDialog.js";
import { VersionInfo } from "./VersionInfo.js";

export interface AboutPageProps {
  /** Product name (defaults to brand name inside AboutContent). */
  productName?: string;
  /** Short product/service description. */
  description?: string;
  /** Company name (defaults to "Viewdeck Engineering Limited"). */
  companyName?: string;
  /** Website URL. */
  websiteUrl?: string;
  /** Service version (runtime-resolved; e.g. live GET /version → __version__/config). */
  version?: string;
  /** Build date string (runtime-resolved). */
  buildDate?: string;
  /** Commit / source reference (runtime-resolved). */
  commitHash?: string;
  /**
   * Service-profile section: role + platform packages/backends the service
   * consumes (§11.2). Rendered under the shared body with `about-service-profile`.
   */
  serviceProfile?: React.ReactNode;
  /** Documentation links node, e.g. the shared `DocLinks` component (§11.4). */
  docLinks?: React.ReactNode;
  /** Extension slot for any additional service-specific About content (no-loss). */
  extra?: React.ReactNode;
  /** Additional children rendered after the extension slot. */
  children?: React.ReactNode;
  /** Page title (canonical "About"). */
  title?: string;
  className?: string;
}

/**
 * Canonical navigable About page. Mount at the canonical `/system/about` route;
 * serve the legacy `/about` route as a 308 / in-router redirect to it
 * (PS-WEBUI-URL-CANONICAL §11).
 */
export function AboutPage(props: AboutPageProps): React.ReactElement {
  const {
    productName,
    description,
    companyName,
    websiteUrl,
    version,
    buildDate,
    commitHash,
    serviceProfile,
    docLinks,
    extra,
    children,
    title = "About",
    className,
  } = props;

  const hasVersionLine = Boolean(version || buildDate || commitHash);

  return (
    <div className={cn("p-6", className)} data-testid="about-page">
      <Card>
        <CardHeader>
          <h1 className="text-lg font-semibold" data-testid="about-page-title">
            {title}
          </h1>
        </CardHeader>
        <CardContent className="space-y-4">
          <AboutContent
            productName={productName}
            description={description}
            companyName={companyName}
            websiteUrl={websiteUrl}
            version={version}
          />
          {hasVersionLine ? (
            <div className="flex justify-center" data-testid="about-version-info">
              <VersionInfo version={version} buildDate={buildDate} commitHash={commitHash} />
            </div>
          ) : null}
          {serviceProfile ? (
            <div className="text-sm text-muted-foreground" data-testid="about-service-profile">
              {serviceProfile}
            </div>
          ) : null}
          {docLinks ? (
            <div data-testid="about-doc-links">{docLinks}</div>
          ) : null}
          {extra}
          {children}
        </CardContent>
      </Card>
    </div>
  );
}
