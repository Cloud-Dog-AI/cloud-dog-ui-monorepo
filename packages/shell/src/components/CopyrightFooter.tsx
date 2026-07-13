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

// @cloud-dog/shell — CopyrightFooter: Fixed copyright notice (UI-R7) + live version banner (XC-001).

import * as React from "react";
import { cn } from "@cloud-dog/ui";

export interface CopyrightFooterProps {
  className?: string;
  /** Override URL for the version probe (default: relative `/version`). */
  versionUrl?: string;
  /** Disable the live version probe (for tests / offline contexts). */
  disableVersionProbe?: boolean;
  testId?: string;
}

/** XC-001: live version fetched from <service>/version on mount. */
function useLiveVersion(versionUrl: string, disabled?: boolean): string {
  const [version, setVersion] = React.useState<string>("");
  React.useEffect(() => {
    if (disabled) return;
    let cancelled = false;
    fetch(versionUrl, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        const v = String((data as Record<string, unknown>).version ?? (data as Record<string, unknown>).app_version ?? "");
        if (v) setVersion(v);
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [versionUrl, disabled]);
  return version;
}

export function CopyrightFooter(props: CopyrightFooterProps) {
  const year = new Date().getFullYear();
  const version = useLiveVersion(props.versionUrl ?? "/version", props.disableVersionProbe);

  return (
    <footer
      className={cn("py-2 px-3 text-xs text-muted-foreground flex flex-wrap items-center gap-2", props.className)}
      data-testid={props.testId ?? "cloud-dog-footer"}
    >
      <span>Copyright {year} Cloud-Dog, Viewdeck Engineering Limited</span>
      {version ? <span aria-label="Service version">· v{version}</span> : null}
    </footer>
  );
}
