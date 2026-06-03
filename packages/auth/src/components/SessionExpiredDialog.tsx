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

// @cloud-dog/auth — Session expiry notification.

import * as React from "react";
import { Dialog, Button } from "@cloud-dog/ui";
import { useAuth } from "../context/useAuth";

export function SessionExpiredDialog(props: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const auth = useAuth();
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Session expired</h2>
        <p className="text-sm text-muted-foreground">Please sign in again to continue.</p>
        <div className="flex gap-2">
          <Button onClick={() => auth.logout()}>Sign out</Button>
          <Button variant="secondary" onClick={() => props.onOpenChange(false)}>
            Close
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
