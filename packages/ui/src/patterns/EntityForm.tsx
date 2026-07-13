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

// @cloud-dog/ui — EntityForm pattern (add/edit/view form with validation).

import * as React from "react";
import { cn } from "../utils/cn";
import { Button } from "../components/button/Button";
import { Input } from "../components/input/Input";
import { Label } from "../components/input/Label";
import { Select } from "../components/input/Select";
import { Switch } from "../components/input/Switch";
import { MultiSelect } from "../components/input/MultiSelect";

export type EntityFieldDef = Readonly<{
  name: string;
  label: string;
  type: "text" | "number" | "boolean" | "select" | "multiselect" | "textarea";
  required?: boolean;
  options?: string[];
  readOnly?: boolean;
  /** Minimum rows for textarea fields (default: 4). */
  rows?: number;
  /** Placeholder text for text/textarea fields. */
  placeholder?: string;
}>;

export type EntityFormMode = "add" | "edit" | "view";

export type EntityFormProps = Readonly<{
  fields: EntityFieldDef[];
  values: Record<string, unknown>;
  onChange: (name: string, value: unknown) => void;
  onSubmit: () => void;
  onCancel: () => void;
  mode: EntityFormMode;
  errors?: Record<string, string>;
  className?: string;
  /** Override the submit button label (default: "Save"). */
  submitLabel?: string;
  /** Prefix for field IDs to avoid conflicts when multiple forms exist on the same page. */
  idPrefix?: string;
}>;

export function EntityForm(props: EntityFormProps) {
  const isView = props.mode === "view";

  return (
    <form
      className={cn("space-y-4", props.className)}
      onSubmit={(e) => {
        e.preventDefault();
        props.onSubmit();
      }}
      aria-label="Entity form"
    >
      {props.fields.map((field) => {
        const fieldId = `${props.idPrefix ?? 'ef'}-${field.name}`;
        const error = props.errors?.[field.name];
        const disabled = isView || field.readOnly;

        return (
          // PS-77 CW-F2 — field wrapper (one EntityFieldDef rendered).
          // In view/read-only mode the same wrapper additionally carries CW-F5 (display-only field).
          <div key={field.name} className="space-y-1" data-testid="CW-F2" data-cw-display={isView || field.readOnly ? "CW-F5" : undefined} data-cw-field={field.name}>
            <Label htmlFor={fieldId}>
              {field.label}
              {field.required ? <span aria-hidden="true" data-testid="CW-F3" className="text-destructive ml-1">*</span> : null}
            </Label>

            {field.type === "boolean" ? (
              <div className="pt-1">
                <Switch
                  id={fieldId}
                  checked={Boolean(props.values[field.name])}
                  onCheckedChange={(v) => props.onChange(field.name, v)}
                  disabled={disabled}
                  aria-label={field.label}
                />
              </div>
            ) : field.type === "multiselect" ? (
              <MultiSelect
                id={fieldId}
                options={(field.options ?? []).map((o) => ({ value: o, label: o }))}
                values={Array.isArray(props.values[field.name]) ? (props.values[field.name] as string[]) : String(props.values[field.name] ?? "").split(",").filter(Boolean)}
                onChange={(vals) => props.onChange(field.name, vals)}
                disabled={disabled}
                aria-label={field.label}
                error={error}
              />
            ) : field.type === "textarea" ? (
              <textarea
                id={fieldId}
                className={cn(
                  "flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
                  "ring-offset-background placeholder:text-muted-foreground",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  "disabled:cursor-not-allowed disabled:opacity-50",
                  "font-mono",
                  error ? "border-destructive" : "",
                )}
                value={String(props.values[field.name] ?? "")}
                onChange={(e) => props.onChange(field.name, e.target.value)}
                disabled={disabled}
                rows={field.rows ?? 4}
                placeholder={field.placeholder}
                aria-label={field.label}
                aria-invalid={!!error}
              />
            ) : field.type === "select" ? (
              <Select
                id={fieldId}
                value={String(props.values[field.name] ?? "")}
                onChange={(e) => props.onChange(field.name, e.target.value)}
                disabled={disabled}
                aria-label={field.label}
                aria-invalid={!!error}
              >
                <option value="">-- select --</option>
                {(field.options ?? []).map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </Select>
            ) : (
              <Input
                id={fieldId}
                type={field.type === "number" ? "number" : "text"}
                value={String(props.values[field.name] ?? "")}
                onChange={(e) =>
                  props.onChange(
                    field.name,
                    field.type === "number" ? Number(e.target.value) : e.target.value,
                  )
                }
                disabled={disabled}
                aria-label={field.label}
                aria-invalid={!!error}
              />
            )}

            {error ? (
              <p className="text-xs text-destructive" role="alert">{error}</p>
            ) : null}
          </div>
        );
      })}

      {/* PS-77 CW-F4 — Save (primary) / Cancel (secondary) footer. */}
      <div className="flex items-center gap-2 pt-2" data-testid="CW-F4">
        {!isView ? (
          <button
            type="submit"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {props.submitLabel ?? "Save"}
          </button>
        ) : null}
        <Button type="button" variant="secondary" onClick={props.onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
