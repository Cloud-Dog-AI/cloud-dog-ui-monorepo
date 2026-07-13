// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
import * as React from "react";
import { SessionsHistoryPanel } from "@cloud-dog/ui";

export function SessionsPage() {
  return (
    <SessionsHistoryPanel
      title="Sessions"
      description="Interactive code-runner sessions."
      rows={[]}
      emptyMessage="No active sessions."
      canonicalRoute="/sessions"
      tableId="code-runner-sessions-view"
    />
  );
}
