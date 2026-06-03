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

// @cloud-dog/ui — statusColumn: factory for standard KEY-5 status columns.

import * as React from "react";
import type { DataColumn } from "./DataTable";
import { StatusBadge, detectTone, toneSortWeight } from "../layout/StatusBadge";

/** Options for creating a standard status column. */
export type StatusColumnOptions<T> = Readonly<{
  /** Column id. Defaults to "status". */
  id?: string;
  /** Column header. Defaults to "Status". */
  header?: string;
  /** Extract the status string from a row. */
  getValue: (row: T) => string;
}>;

/**
 * Create a standard status column for DataTable.
 *
 * KEY-5 convention:
 * - Sortable by tone weight (ok < warning < neutral < error), then alphabetical.
 * - Uses StatusBadge for consistent colour, icon, and accessible text.
 * - Column id defaults to "status" so apps place it consistently.
 */
export function statusColumn<T>(options: StatusColumnOptions<T>): DataColumn<T> {
  const { id = "status", header = "Status", getValue } = options;
  return {
    id,
    header,
    cell: (row) => React.createElement(StatusBadge, { value: getValue(row) }),
    sortable: true,
    sortValue: (row) => {
      const val = getValue(row);
      const weight = toneSortWeight(detectTone(val));
      // Pad weight to sort by tone first, then alphabetically within tone.
      return `${weight}-${val.toLowerCase()}`;
    },
  };
}
