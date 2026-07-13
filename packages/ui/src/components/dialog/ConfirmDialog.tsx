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

// @cloud-dog/ui — PFW-3 ConfirmDialog for destructive actions.

import * as React from "react";
import { Dialog } from "./Dialog";
import { Button } from "../button/Button";

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  /** Name of the target being acted on (displayed prominently). */
  targetName?: string;
  /** Show an irreversible warning. Defaults to true. */
  irreversible?: boolean;
  /** Label for the confirm button. Defaults to "Delete". */
  confirmLabel?: string;
  /** Variant for the confirm button. Defaults to "destructive". */
  confirmVariant?: "destructive" | "default" | "secondary";
  /** Whether the action is in progress. Shows loading state. */
  loading?: boolean;
  /** Error message from a failed action. */
  error?: string | null;
  /** Called when the user confirms the action. */
  onConfirm: () => void;
}

export function ConfirmDialog(props: ConfirmDialogProps) {
  const {
    open,
    onOpenChange,
    title,
    description,
    targetName,
    irreversible = true,
    confirmLabel = "Delete",
    confirmVariant = "destructive",
    loading = false,
    error = null,
    onConfirm,
  } = props;

  const confirmRef = React.useRef<HTMLButtonElement>(null);
  const cancelRef = React.useRef<HTMLButtonElement>(null);

  // Focus cancel button on open (safer default for destructive actions)
  React.useEffect(() => {
    if (open) {
      requestAnimationFrame(() => cancelRef.current?.focus());
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange} label={title}>
      {/* PS-77 CW-F6 — confirmation dialog for destructive actions. */}
      <div className="space-y-4" data-testid="CW-F6">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
        {targetName && (
          <p className="text-sm font-medium" data-testid="confirm-target-name">
            {targetName}
          </p>
        )}
        {irreversible && (
          <p
            className="text-sm text-destructive font-medium"
            data-testid="confirm-irreversible-warning"
          >
            This action cannot be undone.
          </p>
        )}
        {error && (
          <p
            role="alert"
            className="text-sm text-destructive"
            data-testid="confirm-error"
          >
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button
            ref={cancelRef}
            variant="secondary"
            size="sm"
            disabled={loading}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            ref={confirmRef}
            variant={confirmVariant}
            size="sm"
            disabled={loading}
            onClick={onConfirm}
            aria-busy={loading}
          >
            {loading ? "Processing…" : confirmLabel}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
