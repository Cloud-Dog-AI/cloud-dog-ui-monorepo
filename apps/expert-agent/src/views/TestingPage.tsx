import * as React from 'react';
import { Button, Input, JsonBlock, Label, Textarea } from '@cloud-dog/ui';
import { useExpertAgentState } from '../state/AppState';
import type { ChannelRecord, ExpertSuiteResult } from '../lib/api';
import { LoadingNote, PageScaffold, SummaryGrid, formatCount } from './shared';


const defaultTestCases = '[]';

function formatResult(result: ExpertSuiteResult | null): string {
  if (!result) return '';
  return JSON.stringify(result, null, 2);
}

export function TestingPage() {
  const { api, latestFailure, captureFailure, clearFailure } = useExpertAgentState();
  const [channels, setChannels] = React.useState<ChannelRecord[]>([]);
  const [channelId, setChannelId] = React.useState('');
  const [testCasesJson, setTestCasesJson] = React.useState(defaultTestCases);
  const [result, setResult] = React.useState<ExpertSuiteResult | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [running, setRunning] = React.useState(false);
  const [status, setStatus] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    clearFailure();
    setLoading(true);
    try {
      const nextChannels = await api.listChannels();
      setChannels(nextChannels);
      setChannelId((current) => current || (nextChannels[0] ? String(nextChannels[0].id) : ''));
    } catch (error) {
      captureFailure(error);
    } finally {
      setLoading(false);
    }
  }, [api, captureFailure, clearFailure]);

  React.useEffect(() => { void refresh(); }, [refresh]);

  const runSuite = React.useCallback(async () => {
    const parsedChannelId = Number(channelId);
    if (!Number.isFinite(parsedChannelId) || parsedChannelId <= 0) {
      captureFailure('A valid channel id is required.');
      return;
    }

    let testCases: Array<Record<string, unknown>> | undefined;
    try {
      const parsed = JSON.parse(testCasesJson || '[]');
      if (Array.isArray(parsed)) {
        testCases = parsed as Array<Record<string, unknown>>;
      } else {
        captureFailure('Test cases must be a JSON array.');
        return;
      }
    } catch (error) {
      captureFailure(error);
      return;
    }

    setRunning(true);
    clearFailure();
    try {
      const nextResult = await api.runExpertTestSuite({
        channel_id: parsedChannelId,
        test_cases: testCases,
      });
      setResult(nextResult);
      setStatus(`Executed expert suite for channel ${parsedChannelId}.`);
    } catch (error) {
      captureFailure(error);
    } finally {
      setRunning(false);
    }
  }, [api, captureFailure, channelId, clearFailure, testCasesJson]);

  const selectedChannel = channels.find((channel) => String(channel.id) === channelId);

  return (
    <PageScaffold
      title="Testing"
      description="Run the backend expert-suite endpoint against a live channel without leaving the SPA."
      alert={latestFailure}
      status={status}
    >
      <LoadingNote loading={loading} />
      <SummaryGrid
        items={[
          { label: 'Channels', value: formatCount(channels.length) },
          { label: 'Last run cases', value: formatCount(Number(result?.test_cases_run ?? result?.results?.length ?? 0)) },
          { label: 'Passed', value: formatCount(Number(result?.test_cases_passed ?? 0)) },
        ]}
      />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section className="rounded-xl border bg-background p-4 space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Testing workbench</h2>
            <p className="text-sm text-muted-foreground">
              Choose a live channel id, optionally provide custom JSON test cases, then run the backend suite.
            </p>
          </div>
          <label className="block space-y-2">
            <Label htmlFor="testChannelId">Channel id</Label>
            <Input
              id="testChannelId"
              value={channelId}
              onChange={(event) => setChannelId(event.target.value)}
              placeholder="Enter a channel id"
            />
          </label>
          <label className="block space-y-2">
            <Label htmlFor="testCasesJson">Test cases JSON</Label>
            <Textarea
              id="testCasesJson"
              rows={8}
              value={testCasesJson}
              onChange={(event) => setTestCasesJson(event.target.value)}
            />
          </label>
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => void refresh()}>
              Refresh channels
            </Button>
            <Button id="runTestSuiteButton" type="button" onClick={() => void runSuite()} loading={running}>
              Run Test Suite
            </Button>
          </div>
        </section>
        <section className="rounded-xl border bg-background p-4 space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Selected channel</h2>
            <p className="text-sm text-muted-foreground">
              {selectedChannel ? `${selectedChannel.name} • ${selectedChannel.description ?? 'No description'}` : 'No matching channel loaded yet.'}
            </p>
          </div>
          <JsonBlock
            title="Channel snapshot"
            value={selectedChannel ?? { channel_id: channelId || null }}
            defaultCollapsed={false}
          />
        </section>
      </div>
      <section className="rounded-xl border bg-background p-4 space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Suite results</h2>
          <p className="text-sm text-muted-foreground">The raw backend response is rendered below for forensic review.</p>
        </div>
        <pre id="testResults" className="min-h-24 overflow-x-auto rounded border bg-muted/30 p-3 text-xs whitespace-pre-wrap">
          {formatResult(result)}
        </pre>
      </section>
    </PageScaffold>
  );
}
