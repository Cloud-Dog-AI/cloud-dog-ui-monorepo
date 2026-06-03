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

// @cloud-dog/ui — SettingsPanel pattern (structured settings page).

import * as React from "react";
import { cn } from "../utils/cn";
import { Button } from "../components/button/Button";
import { SettingGroup } from "./SettingGroup";
import type { SettingDef } from "./SettingControl";

export type SettingGroupDef = Readonly<{
  id: string;
  label: string;
  settings: SettingDef[];
}>;

export type SettingsPanelProps = Readonly<{
  groups: SettingGroupDef[];
  onSave: (key: string, value: unknown) => void;
  onExport?: () => void;
  onImport?: () => void;
  className?: string;
}>;

export function SettingsPanel(props: SettingsPanelProps) {
  const [activeGroup, setActiveGroup] = React.useState(props.groups[0]?.id ?? "");

  return (
    <div className={cn("flex rounded-md border bg-background", props.className)}>
      {/* Left nav */}
      <nav className="w-48 shrink-0 border-r p-3 space-y-1" aria-label="Settings groups">
        {props.groups.map((g) => (
          <button
            key={g.id}
            type="button"
            className={cn(
              "w-full text-left text-sm rounded-md px-2 py-1.5 hover:bg-muted/50",
              g.id === activeGroup ? "bg-primary/10 font-medium" : "",
            )}
            onClick={() => setActiveGroup(g.id)}
            aria-label={`${g.label} settings group`}
          >
            {g.label}
          </button>
        ))}

        {(props.onExport || props.onImport) ? (
          <div className="pt-3 space-y-1">
            {props.onExport ? (
              <Button variant="secondary" size="sm" className="w-full" onClick={props.onExport}>
                Export
              </Button>
            ) : null}
            {props.onImport ? (
              <Button variant="secondary" size="sm" className="w-full" onClick={props.onImport}>
                Import
              </Button>
            ) : null}
          </div>
        ) : null}
      </nav>

      {/* Right panel */}
      <div className="flex-1 min-w-0 p-4 space-y-4">
        {props.groups
          .filter((g) => g.id === activeGroup)
          .map((g) => (
            <SettingGroup
              key={g.id}
              label={g.label}
              settings={g.settings}
              onChange={props.onSave}
              defaultExpanded
            />
          ))}
      </div>
    </div>
  );
}
