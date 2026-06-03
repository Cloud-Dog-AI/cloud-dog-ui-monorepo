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

// @cloud-dog/ui — Progress bar.

import * as React from "react";
import { cn } from "../../utils/cn";

export function Progress(props: { value: number; className?: string }) {
  const clamped = Math.max(0, Math.min(100, props.value));
  return (
    <div className={cn("h-2 w-full rounded-full bg-muted overflow-hidden", props.className)} role="progressbar" aria-valuenow={clamped} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full bg-primary" style={{ width: `${clamped}%` }} />
    </div>
  );
}
