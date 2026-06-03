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

// @cloud-dog/ui — Avatar component.

import * as React from "react";
import { cn } from "../../utils/cn";

export function Avatar(props: { src?: string; alt: string; fallback: string; className?: string }) {
  return (
    <span className={cn("inline-flex h-8 w-8 items-center justify-center rounded-full bg-muted overflow-hidden", props.className)}>
      {props.src ? (
        <img src={props.src} alt={props.alt} className="h-full w-full object-cover" />
      ) : (
        <span className="text-xs font-semibold text-muted-foreground" aria-hidden="true">
          {props.fallback}
        </span>
      )}
    </span>
  );
}
