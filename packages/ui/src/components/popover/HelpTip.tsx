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

// @cloud-dog/ui — HelpTip: a shared, accessible help affordance for obscure
// fields/sections. A small help-circle icon that reveals explanatory text on
// hover (via Tooltip) and carries a native `title` + `aria-label` fallback for
// keyboard/screen-reader users. Consumers pass `help` text and an optional
// `label` naming the field it explains.

import * as React from "react";
import { HelpCircle } from "lucide-react";
import { Tooltip } from "./Tooltip";

export type HelpTipProps = Readonly<{
  /** Explanatory text or node shown in the tooltip. */
  help: React.ReactNode;
  /** Optional name of the field/section this help explains (used for aria-label). */
  label?: string;
  className?: string;
  "data-testid"?: string;
}>;

export function HelpTip(props: HelpTipProps) {
  const ariaLabel = props.label ? `Help: ${props.label}` : "Help";
  const nativeTitle = typeof props.help === "string" ? props.help : undefined;
  return (
    <Tooltip content={props.help}>
      <span
        role="note"
        tabIndex={0}
        aria-label={ariaLabel}
        title={nativeTitle}
        data-testid={props["data-testid"]}
        className={[
          "inline-flex cursor-help items-center align-middle text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-full",
          props.className ?? "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
    </Tooltip>
  );
}
