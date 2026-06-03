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

// @cloud-dog/shell — VersionInfo: Version/build display (UI-R7).

import * as React from "react";
import { cn } from "@cloud-dog/ui";

export interface VersionInfoProps {
  version?: string;
  buildDate?: string;
  commitHash?: string;
  className?: string;
}

export function VersionInfo(props: VersionInfoProps) {
  const { version, buildDate, commitHash, className } = props;

  if (!version && !buildDate && !commitHash) {
    return <span className={cn("text-xs text-muted-foreground", className)}>Version unknown</span>;
  }

  const parts: string[] = [];
  if (version) parts.push(`v${version}`);
  if (buildDate) parts.push(buildDate);
  if (commitHash) parts.push(commitHash.slice(0, 7));

  return (
    <span className={cn("text-xs text-muted-foreground", className)}>
      {parts.join(" \u00b7 ")}
    </span>
  );
}
