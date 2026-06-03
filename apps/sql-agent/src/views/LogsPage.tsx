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

// @cloud-dog/app-sql-agent — Log viewer panel.

// Covers: FR-59

import { useConfig } from '@cloud-dog/config';
import { PageFrame, PanelCard } from '../lib/sqlAgentApi';
import { LogExplorer } from '../components/LogExplorer';

type AppRuntimeConfig = {
  API_BASE_URL: string;
};

export function LogsPage() {
  const cfg = useConfig<AppRuntimeConfig>();

  return (
    <PageFrame
      eyebrow="FR-59"
      title="Logs"
      description="Review audit and server log entries through the authenticated Web proxy with full table controls, source switching, and NIST-aligned columns."
    >
      <PanelCard id="panelLogs" title="Log explorer" subtitle="Full log and audit review via `/api/v1/logs` with source-aware filtering.">
        <LogExplorer apiBaseUrl={cfg.API_BASE_URL} defaultSource="audit" tableId="sql-agent-log-explorer" />
      </PanelCard>
    </PageFrame>
  );
}
