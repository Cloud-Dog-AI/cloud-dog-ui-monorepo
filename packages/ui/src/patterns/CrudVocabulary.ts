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

// @cloud-dog/ui - PS-77 F15 common CRUD vocabulary.

export type CrudActionMode = "add" | "edit" | "view" | "delete";

export const CRUD_ACTION_LABELS = {
  add: "Add",
  edit: "Edit",
  view: "View",
  delete: "Delete",
  save: "Save",
  cancel: "Cancel",
  create: "Create",
  update: "Save changes",
  confirmDelete: "Delete",
} as const;

export const CRUD_TABLE_MESSAGES = {
  empty: "No items found.",
  loading: "Loading items...",
  error: "Unable to load items.",
  noSearchResults: "No items match the current filters.",
} as const;

export const CRUD_EXTENSION_SLOT_TEST_ID = "crud-extension-slot";

export function singularizeEntityName(label: string): string {
  const trimmed = label.trim();
  if (!trimmed) return "item";
  return trimmed.endsWith("s") && trimmed.length > 1 ? trimmed.slice(0, -1) : trimmed;
}

export function crudDialogTitle(entityName: string, mode: CrudActionMode): string {
  const entity = singularizeEntityName(entityName);
  if (mode === "add") return `Add ${entity}`;
  if (mode === "edit") return `Edit ${entity}`;
  if (mode === "delete") return `Delete ${entity}`;
  return `View ${entity}`;
}

export function crudRequiredMessage(fieldLabel: string): string {
  return `${fieldLabel} is required.`;
}

export function crudDeleteConfirmation(targetName: string): string {
  return `Delete ${targetName}? This action cannot be undone.`;
}
