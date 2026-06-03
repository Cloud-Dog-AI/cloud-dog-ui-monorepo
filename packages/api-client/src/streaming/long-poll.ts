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

// @cloud-dog/api-client — Long-poll helper for long-running operations.

export type LongPollState = "pending" | "running" | "done" | "error";

export type LongPollStatus<T> = Readonly<{
  state: LongPollState;
  progress?: number;
  result?: T;
  error?: string;
}>;

export type LongPollEvent<T> =
  | Readonly<{ type: "submitted"; jobId: string }>
  | Readonly<{ type: "progress"; jobId: string; progress?: number }>
  | Readonly<{ type: "completed"; jobId: string; result: T }>
  | Readonly<{ type: "error"; jobId: string; error: string }>;

export type LongPollOptions<T> = Readonly<{
  submit: () => Promise<{ jobId: string }>;
  poll: (jobId: string) => Promise<LongPollStatus<T>>;
  intervalMs?: number;
  timeoutMs?: number;
  onEvent?: (event: LongPollEvent<T>) => void;
}>;

export function createLongPollStream<T>(options: LongPollOptions<T>): {
  start: () => Promise<T>;
  cancel: () => void;
} {
  const intervalMs = options.intervalMs ?? 1000;
  const timeoutMs = options.timeoutMs ?? 60_000;
  let cancelled = false;

  const cancel = () => {
    cancelled = true;
  };

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const start = async (): Promise<T> => {
    const startedAt = Date.now();
    const { jobId } = await options.submit();
    options.onEvent?.({ type: "submitted", jobId });

    while (true) {
      if (cancelled) throw new Error("Long-poll cancelled.");
      if (Date.now() - startedAt > timeoutMs) throw new Error("Long-poll timed out.");

      const status = await options.poll(jobId);
      if (status.state === "pending" || status.state === "running") {
        options.onEvent?.({ type: "progress", jobId, progress: status.progress });
        await sleep(intervalMs);
        continue;
      }

      if (status.state === "error") {
        const msg = status.error ?? "Long-poll failed.";
        options.onEvent?.({ type: "error", jobId, error: msg });
        throw new Error(msg);
      }

      if (status.result === undefined) {
        throw new Error("Long-poll completed without a result.");
      }

      options.onEvent?.({ type: "completed", jobId, result: status.result });
      return status.result;
    }
  };

  return { start, cancel };
}
