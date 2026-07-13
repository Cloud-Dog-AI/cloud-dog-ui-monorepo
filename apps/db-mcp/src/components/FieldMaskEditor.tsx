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

import * as React from "react";
import { Button, Input, Label, Select } from "@cloud-dog/ui";
import type { DiscoveredOption } from "@cloud-dog/ui";

type FieldMaskEditorProps = Readonly<{
  value: Record<string, string>;
  options: readonly DiscoveredOption[];
  disabled?: boolean;
  onChange: (value: Record<string, string>) => void;
}>;

export function FieldMaskEditor({ value, options, disabled = false, onChange }: FieldMaskEditorProps) {
  const entries = Object.entries(value);
  const optionValues = new Set(options.map((option) => option.value));

  function updateField(previousField: string, nextField: string) {
    const next = { ...value };
    const mask = next[previousField] ?? "";
    delete next[previousField];
    if (nextField.trim()) next[nextField.trim()] = mask;
    onChange(next);
  }

  function updateMask(field: string, mask: string) {
    onChange({ ...value, [field]: mask });
  }

  function removeField(field: string) {
    const next = { ...value };
    delete next[field];
    onChange(next);
  }

  function addField() {
    const nextField = options.find((option) => !value[option.value])?.value ?? "";
    if (!nextField) return;
    onChange({ ...value, [nextField]: "****" });
  }

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label>Field masks</Label>
        <Button disabled={disabled || options.length === 0} onClick={addField} size="sm" type="button" variant="secondary">
          Add Field
        </Button>
      </div>
      <div className="space-y-2">
        {entries.length === 0 ? <p className="text-sm text-muted-foreground">No field masks configured.</p> : null}
        {entries.map(([field, mask]) => {
          const stale = !optionValues.has(field);
          return (
            <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(140px,220px)_auto]" data-stale={stale ? "true" : undefined} key={field}>
              <Select
                aria-label={`Masked field ${field}`}
                className={stale ? "text-muted-foreground" : undefined}
                disabled={disabled}
                value={field}
                onChange={(event) => updateField(field, event.target.value)}
              >
                {stale ? <option value={field}>{field} (stale)</option> : null}
                {options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label ?? option.value}
                  </option>
                ))}
              </Select>
              <Input
                aria-label={`Mask value for ${field}`}
                disabled={disabled}
                value={mask}
                onChange={(event) => updateMask(field, event.target.value)}
              />
              <Button disabled={disabled} onClick={() => removeField(field)} size="sm" type="button" variant="secondary">
                Remove
              </Button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
