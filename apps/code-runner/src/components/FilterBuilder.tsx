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

import { Button, Input, Select } from "@cloud-dog/ui";
import { buildFilterPayload, emptyFilterCondition, FILTER_OPERATORS } from "../lib/filter";
import type { FilterGroupDraft } from "../lib/types";

type FilterBuilderProps = Readonly<{
  value: FilterGroupDraft;
  onChange: (value: FilterGroupDraft) => void;
}>;

export function FilterBuilder(props: FilterBuilderProps) {
  const addCondition = () => {
    props.onChange({
      ...props.value,
      conditions: [...props.value.conditions, emptyFilterCondition()],
    });
  };

  const updateCondition = (id: string, patch: Partial<FilterGroupDraft["conditions"][number]>) => {
    props.onChange({
      ...props.value,
      conditions: props.value.conditions.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    });
  };

  const removeCondition = (id: string) => {
    props.onChange({
      ...props.value,
      conditions: props.value.conditions.filter((item) => item.id !== id),
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="space-y-1">
          <label htmlFor="filter-op" className="text-sm font-medium">
            Group operator
          </label>
          <Select
            id="filter-op"
            value={props.value.op}
            onChange={(event) => props.onChange({ ...props.value, op: event.target.value as "and" | "or" })}
          >
            <option value="and">AND</option>
            <option value="or">OR</option>
          </Select>
        </div>
        <Button type="button" variant="secondary" onClick={addCondition} data-testid="filter-add-condition">
          Add condition
        </Button>
      </div>

      <div className="space-y-3">
        {props.value.conditions.map((condition) => (
          <div key={condition.id} className="grid grid-cols-1 gap-2 rounded-lg border p-3 md:grid-cols-[1.2fr_1fr_1fr_auto]">
            <Input
              aria-label={`Field ${condition.id}`}
              placeholder="field"
              value={condition.field}
              onChange={(event) => updateCondition(condition.id, { field: event.target.value })}
            />
            <Select
              aria-label={`Operator ${condition.id}`}
              value={condition.operator}
              onChange={(event) => updateCondition(condition.id, { operator: event.target.value })}
            >
              {FILTER_OPERATORS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </Select>
            <Input
              aria-label={`Value ${condition.id}`}
              placeholder='value or JSON, e.g. "active" or [1,2]'
              value={condition.value}
              onChange={(event) => updateCondition(condition.id, { value: event.target.value })}
            />
            <Button type="button" variant="destructive" onClick={() => removeCondition(condition.id)}>
              Remove
            </Button>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Filter JSON preview</h3>
        <pre data-testid="filter-json-preview" className="rounded-lg border bg-muted/30 p-3 text-xs leading-6">
          {JSON.stringify(buildFilterPayload(props.value), null, 2)}
        </pre>
      </div>
    </div>
  );
}
