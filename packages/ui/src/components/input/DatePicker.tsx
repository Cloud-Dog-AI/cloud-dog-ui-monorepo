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

// @cloud-dog/ui — DatePicker: accessible single-date input (W28J-1303 §4).
//
// Built on the native, accessible, keyboard-navigable `<input type="date">`
// (no extra calendar dependency). Values round-trip through `Date`; the wire
// format is ISO-8601 `YYYY-MM-DD` interpreted on the local calendar day.

import * as React from "react";
import { cn } from "../../utils/cn";

export type DatePickerProps = Readonly<{
  value: Date | null;
  onChange: (next: Date | null) => void;
  label?: string;
  placeholder?: string;
  min?: Date;
  max?: Date;
  disabled?: boolean;
  required?: boolean;
  id?: string;
  "aria-label"?: string;
  className?: string;
}>;

/** Format a Date as `YYYY-MM-DD` on its local calendar day (no UTC shift). */
export function toISODate(date: Date | null | undefined): string {
  if (!date || Number.isNaN(date.getTime())) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Parse a `YYYY-MM-DD` string into a local-midnight Date, or null. */
export function fromISODate(value: string): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function DatePicker(props: DatePickerProps) {
  const { value, onChange, label, placeholder, min, max, disabled = false, required = false, id, className } = props;
  const reactId = React.useId();
  const inputId = id ?? reactId;

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {label ? (
        <label htmlFor={inputId} className="text-sm font-medium text-foreground">
          {label}
          {required ? <span className="ml-0.5 text-destructive">*</span> : null}
        </label>
      ) : null}
      <input
        id={inputId}
        type="date"
        value={toISODate(value)}
        placeholder={placeholder}
        min={min ? toISODate(min) : undefined}
        max={max ? toISODate(max) : undefined}
        disabled={disabled}
        required={required}
        aria-label={props["aria-label"] ?? label}
        onChange={(e) => onChange(fromISODate(e.target.value))}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
          "ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "disabled:cursor-not-allowed disabled:opacity-50",
        )}
      />
    </div>
  );
}
