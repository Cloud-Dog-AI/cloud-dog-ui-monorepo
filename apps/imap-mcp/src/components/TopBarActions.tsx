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

// @cloud-dog/app-imap-mcp — App-level top bar actions.
//
// IMAP-010: the top-right About button is removed by request; About is
// reached only via the left sidebar entry (which opens AboutDialog from
// App.tsx). This component retains a top-right Logout because the user
// menu's logout is not always visible in the responsive shell.

import * as React from "react";
import { Button } from "@cloud-dog/ui";

export type TopBarActionsProps = Readonly<{
  /** Currently unused; kept for API stability (App.tsx still passes it). */
  version?: string;
  onLogout: () => void | Promise<void>;
}>;

export function TopBarActions(props: TopBarActionsProps) {
  return (
    <div className="fixed right-20 top-2 z-30 hidden items-center gap-2 xl:flex">
      <Button size="sm" variant="destructive" onClick={() => void props.onLogout()}>
        Logout
      </Button>
    </div>
  );
}
