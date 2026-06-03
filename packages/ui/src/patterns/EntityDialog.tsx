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

// @cloud-dog/ui — EntityDialog pattern (modal wrapper around EntityForm).

import * as React from "react";
import { Dialog } from "../components/dialog/Dialog";
import { EntityForm } from "./EntityForm";
import type { EntityFormProps } from "./EntityForm";
import { RelatedItemsPanel } from "./RelatedItemsPanel";
import type { RelatedItem } from "./RelatedItemsPanel";

export type EntityDialogRelatedPanel = Readonly<{
  title: string;
  items: RelatedItem[];
  emptyMessage?: string;
}>;

type EntityDialogBaseProps = Readonly<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  relatedPanels?: EntityDialogRelatedPanel[];
  extra?: React.ReactNode;
}>;

export type EntityDialogFormProps = EntityDialogBaseProps &
  EntityFormProps &
  Readonly<{
    body?: never;
  }>;

export type EntityDialogBodyProps = EntityDialogBaseProps &
  Readonly<{
    body: React.ReactNode;
  }>;

export type EntityDialogProps = EntityDialogFormProps | EntityDialogBodyProps;

function isBodyDialog(props: EntityDialogProps): props is EntityDialogBodyProps {
  return "body" in props;
}

export function EntityDialog(props: EntityDialogProps) {
  const body = isBodyDialog(props) ? (
    props.body
  ) : (
    <EntityForm
      fields={props.fields}
      values={props.values}
      onChange={props.onChange}
      onSubmit={props.onSubmit}
      onCancel={props.onCancel}
      mode={props.mode}
      errors={props.errors}
      className={props.className}
      submitLabel={props.submitLabel}
      idPrefix={props.idPrefix}
      extra={props.extra}
    />
  );

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange} label={props.title}>
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">{props.title}</h2>
        {body}
        {isBodyDialog(props) ? props.extra : null}
        {props.relatedPanels?.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {props.relatedPanels.map((panel) => (
              <RelatedItemsPanel
                key={panel.title}
                title={panel.title}
                items={panel.items}
                emptyMessage={panel.emptyMessage}
              />
            ))}
          </div>
        ) : null}
      </div>
    </Dialog>
  );
}
