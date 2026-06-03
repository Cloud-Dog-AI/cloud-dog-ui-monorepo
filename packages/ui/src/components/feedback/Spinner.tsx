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

// @cloud-dog/ui — Spinner component.

import * as React from "react";
import { cn } from "../../utils/cn";
import { useReducedMotion } from "../../hooks/useReducedMotion";

export function Spinner(props: { className?: string }) {
  const reduced = useReducedMotion();
  return (
    <span
      className={cn(
        "inline-block rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground",
        reduced ? "" : "animate-spin",
        props.className ?? "h-4 w-4"
      )}
      aria-hidden="true"
    />
  );
}
