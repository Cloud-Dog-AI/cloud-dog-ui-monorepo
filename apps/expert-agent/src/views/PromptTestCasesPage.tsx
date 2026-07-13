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

// @cloud-dog/app-expert-agent — Prompt test-cases surface (EA-89, W28E-1863
// fix-wave-c).
//
// Generated prompt test cases used to render inline on /prompts. They now have a
// dedicated route. Generation still happens in the /prompts workbench (which has
// the template content + expert/channel/knowledge context); the last generated
// batch is lifted into shared AppState and rendered here. This page can also
// re-run generation against the stored prompt.

import * as React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@cloud-dog/ui';
import { useExpertAgentState } from '../state/AppState';
import { AppDataTable } from '../lib/data-table-adapter';
import { PageScaffold } from './shared';

export function PromptTestCasesPage() {
  const { api, latestFailure, captureFailure, clearFailure, promptTestCases, setPromptTestCases } = useExpertAgentState();
  const [status, setStatus] = React.useState<string | null>(null);
  const [regenerating, setRegenerating] = React.useState(false);

  const regenerate = React.useCallback(async () => {
    if (!promptTestCases) return;
    clearFailure();
    setRegenerating(true);
    try {
      const nextCases = await api.generatePromptTestCases(promptTestCases.prompt);
      setPromptTestCases({ ...promptTestCases, cases: nextCases, generatedAt: new Date().toISOString() });
      setStatus(`Regenerated ${nextCases.length} test case${nextCases.length === 1 ? '' : 's'}.`);
    } catch (error) {
      captureFailure(error);
    } finally {
      setRegenerating(false);
    }
  }, [api, captureFailure, clearFailure, promptTestCases, setPromptTestCases]);

  const cases = promptTestCases?.cases ?? [];

  return (
    <PageScaffold
      title="Prompt Test Cases"
      description="Test cases generated from the prompt workbench, presented on a dedicated surface."
      alert={latestFailure}
      status={status}
    >
      {promptTestCases ? (
        <div className="rounded-xl border bg-background p-4 text-sm" data-testid="test-cases-source">
          <p>
            Generated from prompt:{' '}
            <span className="font-mono text-xs">{promptTestCases.prompt.slice(0, 120)}{promptTestCases.prompt.length > 120 ? '…' : ''}</span>
          </p>
          {promptTestCases.expertLabel ? <p className="text-muted-foreground">Expert context: {promptTestCases.expertLabel}</p> : null}
          <p className="text-muted-foreground">Generated at {new Date(promptTestCases.generatedAt).toLocaleString('en-GB')}</p>
          <div className="mt-3 flex justify-end">
            <Button type="button" variant="secondary" onClick={() => void regenerate()} disabled={regenerating} data-testid="regenerate-test-cases-btn">
              {regenerating ? 'Regenerating…' : 'Regenerate'}
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border bg-background p-6 text-sm text-muted-foreground" data-testid="test-cases-empty">
          No test cases generated yet. Use{' '}
          <Link to="/prompts" className="text-primary underline" data-testid="prompts-page-link">Generate test cases</Link>{' '}
          in the prompt workbench to populate this page.
        </div>
      )}

      <AppDataTable
        title={`Generated test cases (${cases.length})`}
        rows={cases.map((testCase, index) => ({ ...testCase, _idx: index }))}
        getRowId={(row) => `case-${row._idx}`}
        emptyMessage="No test cases to display."
        itemLabel="test cases"
        searchText={(row) => [row.name ?? '', row.objective ?? '', row.category ?? '', row.input ?? ''].join(' ')}
        columns={[
          { id: 'name', header: 'Name', sortable: true, sortValue: (row) => row.name ?? '', cell: (row) => row.name ?? `Case ${row._idx + 1}` },
          { id: 'objective', header: 'Objective', cell: (row) => row.objective ?? 'No objective returned.' },
          { id: 'category', header: 'Category', sortable: true, sortValue: (row) => row.category ?? '', cell: (row) => row.category ?? 'N/A' },
          { id: 'input', header: 'Input', cell: (row) => row.input ? <span className="font-mono text-xs">{row.input}</span> : 'N/A' },
        ]}
      />
    </PageScaffold>
  );
}
