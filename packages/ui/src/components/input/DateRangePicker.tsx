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

// @cloud-dog/ui — DateRangePicker: start/end date range (W28J-1303 §4).
//
// Composes two DatePickers and cross-constrains them: end cannot precede start,
// start cannot follow end. Used by the Commits "Since / Until" selector.

import * as React from "react";
import { cn } from "../../utils/cn";
import { DatePicker } from "./DatePicker";

export type DateRange = Readonly<{ start: Date | null; end: Date | null }>;

export type DateRangePickerProps = Readonly<{
  value: DateRange;
  onChange: (next: DateRange) => void;
  labelStart?: string;
  labelEnd?: string;
  min?: Date;
  max?: Date;
  disabled?: boolean;
  className?: string;
}>;

export function DateRangePicker(props: DateRangePickerProps) {
  const { value, onChange, labelStart = "Since", labelEnd = "Until", min, max, disabled = false, className } = props;

  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4", className)}>
      <DatePicker
        label={labelStart}
        value={value.start}
        min={min}
        max={value.end ?? max}
        disabled={disabled}
        onChange={(start) => onChange({ start, end: value.end })}
        className="flex-1"
      />
      <DatePicker
        label={labelEnd}
        value={value.end}
        min={value.start ?? min}
        max={max}
        disabled={disabled}
        onChange={(end) => onChange({ start: value.start, end })}
        className="flex-1"
      />
    </div>
  );
}
