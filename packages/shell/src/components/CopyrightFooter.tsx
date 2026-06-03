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

// @cloud-dog/shell — CopyrightFooter: Fixed copyright notice (UI-R7).

import * as React from "react";
import { cn } from "@cloud-dog/ui";

export interface CopyrightFooterProps {
  className?: string;
}

export function CopyrightFooter(props: CopyrightFooterProps) {
  const year = new Date().getFullYear();

  return (
    <footer className={cn("py-2 px-3 text-xs text-muted-foreground", props.className)}>
      Copyright {year} Cloud-Dog, Viewdeck Engineering Limited
    </footer>
  );
}
