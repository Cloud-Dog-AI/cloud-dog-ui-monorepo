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

import type { FilterConditionDraft, FilterGroupDraft } from "./types";

export const FILTER_OPERATORS = [
  "eq",
  "neq",
  "gt",
  "gte",
  "lt",
  "lte",
  "in",
  "not_in",
  "contains",
  "starts_with",
  "ends_with",
  "exists",
  "not_exists",
  "regex",
  "is_null",
  "is_not_null",
] as const;

export function emptyFilterCondition(): FilterConditionDraft {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    field: "",
    operator: "eq",
    value: "",
  };
}

function parseScalar(raw: string): unknown {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (trimmed === "null") return null;
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
  if ((trimmed.startsWith("[") && trimmed.endsWith("]")) || (trimmed.startsWith("{") && trimmed.endsWith("}"))) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed;
    }
  }
  return trimmed;
}

export function buildFilterPayload(filter: FilterGroupDraft): Record<string, unknown> {
  const conditions = filter.conditions
    .filter((item) => item.field.trim())
    .map((item) => {
      const operator = item.operator.trim();
      const condition: Record<string, unknown> = {
        field: item.field.trim(),
        operator,
      };
      if (!["exists", "not_exists", "is_null", "is_not_null"].includes(operator)) {
        condition.value = parseScalar(item.value);
      }
      return condition;
    });

  return {
    op: filter.op,
    conditions,
  };
}
