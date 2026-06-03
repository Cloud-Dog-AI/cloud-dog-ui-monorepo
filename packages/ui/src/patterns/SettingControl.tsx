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

// @cloud-dog/ui — SettingControl pattern (individual setting editor).

import * as React from "react";
import { cn } from "../utils/cn";
import { Input } from "../components/input/Input";
import { Label } from "../components/input/Label";
import { Select } from "../components/input/Select";
import { Switch } from "../components/input/Switch";

export type SettingDef = Readonly<{
  key: string;
  label: string;
  type: "text" | "number" | "boolean" | "select";
  value: unknown;
  readOnly?: boolean;
  options?: string[];
  description?: string;
}>;

export type SettingControlProps = Readonly<{
  setting: SettingDef;
  onChange: (value: unknown) => void;
  className?: string;
}>;

export function SettingControl(props: SettingControlProps) {
  const { setting, onChange } = props;
  const fieldId = `sc-${setting.key}`;

  return (
    <div className={cn("flex items-start gap-4 py-3", props.className)}>
      <div className="flex-1 min-w-0 space-y-0.5">
        <Label htmlFor={fieldId} className="flex items-center gap-1">
          {setting.readOnly ? (
            <span className="text-muted-foreground" aria-label="Read-only" title="Read-only">
              &#128274;
            </span>
          ) : null}
          {setting.label}
        </Label>
        {setting.description ? (
          <p className="text-xs text-muted-foreground">{setting.description}</p>
        ) : null}
      </div>

      <div className="w-56 shrink-0">
        {setting.type === "boolean" ? (
          <Switch
            id={fieldId}
            checked={Boolean(setting.value)}
            onCheckedChange={onChange}
            disabled={setting.readOnly}
          />
        ) : setting.type === "select" ? (
          <Select
            id={fieldId}
            value={String(setting.value ?? "")}
            onChange={(e) => onChange(e.target.value)}
            disabled={setting.readOnly}
          >
            {(setting.options ?? []).map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </Select>
        ) : (
          <Input
            id={fieldId}
            type={setting.type === "number" ? "number" : "text"}
            value={String(setting.value ?? "")}
            onChange={(e) =>
              onChange(setting.type === "number" ? Number(e.target.value) : e.target.value)
            }
            disabled={setting.readOnly}
          />
        )}
      </div>
    </div>
  );
}
