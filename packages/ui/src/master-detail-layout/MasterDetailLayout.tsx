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

// @cloud-dog/ui — W28A-871 MasterDetailLayout.

import * as React from "react";
import { cn } from "../utils/cn";

export type MasterDetailLayoutProps = Readonly<{
  master: React.ReactNode;
  detail: React.ReactNode;
  masterLabel?: string;
  detailLabel?: string;
  toolbar?: React.ReactNode;
  className?: string;
  masterClassName?: string;
  detailClassName?: string;
  "data-testid"?: string;
}>;

export function MasterDetailLayout({
  master,
  detail,
  masterLabel = "List",
  detailLabel = "Detail",
  toolbar,
  className,
  masterClassName,
  detailClassName,
  "data-testid": testId,
}: MasterDetailLayoutProps) {
  return (
    <section
      className={cn("flex min-h-0 w-full flex-col gap-3", className)}
      data-component="MasterDetailLayout"
      data-testid={testId}
    >
      {toolbar ? <div className="flex flex-wrap items-center justify-between gap-2">{toolbar}</div> : null}
      <div className="grid min-h-0 gap-3 lg:grid-cols-[minmax(280px,420px)_minmax(0,1fr)]">
        <div
          aria-label={masterLabel}
          className={cn("min-h-0 rounded-md border border-border bg-card", masterClassName)}
          role="region"
        >
          {master}
        </div>
        <div
          aria-label={detailLabel}
          className={cn("min-h-0 rounded-md border border-border bg-card", detailClassName)}
          role="region"
        >
          {detail}
        </div>
      </div>
    </section>
  );
}
