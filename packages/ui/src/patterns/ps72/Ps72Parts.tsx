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

// @cloud-dog/ui — PS-72 v2 shared console parts (promoted from W28A-774 sql-agent
// wrapper to the shared package under W28A-773 coordinator authorization).
// API-key field (§2), result widget + meta panel (§5), lifecycle/health badges (§7).

import * as React from "react";
import { Input } from "../../components/input/Input";
import { JsonExplorer } from "../JsonExplorer";
import {
  formatDuration,
  lifecycleTone,
  type Ps72HealthState,
  type Ps72Meta,
} from "./metaTypes";

const HEALTH_TONE: Record<Ps72HealthState, string> = {
  healthy: "border-emerald-300 bg-emerald-50 text-emerald-800",
  degraded: "border-amber-300 bg-amber-50 text-amber-800",
  unhealthy: "border-rose-300 bg-rose-50 text-rose-800",
  unknown: "border-slate-300 bg-slate-50 text-slate-700",
};

const LIFECYCLE_TONE_CLASS: Record<ReturnType<typeof lifecycleTone>, string> = {
  ok: "border-emerald-300 bg-emerald-50 text-emerald-800",
  warning: "border-amber-300 bg-amber-50 text-amber-800",
  error: "border-rose-300 bg-rose-50 text-rose-800",
  neutral: "border-slate-300 bg-slate-50 text-slate-700",
};

function jobHref(base: string | undefined, jobId: string): string {
  const href = base ?? "/jobs";
  const separator = href.includes("?") ? "&" : "?";
  return `${href}${separator}job_id=${encodeURIComponent(jobId)}`;
}

/** PS-72 v2 §1 top-of-page status badge (healthy/degraded/unhealthy/unknown only). */
export function Ps72HealthBadge(props: { state: Ps72HealthState; testId: string }) {
  return (
    <span
      data-testid={props.testId}
      className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${HEALTH_TONE[props.state]}`}
    >
      {props.state}
    </span>
  );
}

/**
 * PS-72 v2 §2 API-key field. Defaults to the logged-in user's bound identity.
 * The admin override is masked (type=password) and the value is only sent on the
 * API call, never logged client-side (§2.4).
 */
export function Ps72ApiKeyField(props: {
  testIdPrefix: string;
  boundLabel: string;
  hasBoundKey: boolean;
  overrideValue: string;
  onOverrideChange: (value: string) => void;
}) {
  const overrideMaskAttrs = { type: "password" } as Record<string, string>;
  const helper = props.hasBoundKey
    ? "Defaults to your bound key. Override only if you need to test as a different identity."
    : "You have no API key bound. Ask an administrator to bind a key, or enter an admin override below.";
  return (
    <div data-testid={`${props.testIdPrefix}-apikey-field`} className="min-w-0 space-y-2 rounded-md border bg-slate-50 p-3">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">API key</span>
        <span className="min-w-0 max-w-full break-words font-mono text-xs text-slate-700">{props.boundLabel}</span>
      </div>
      <p data-testid={`${props.testIdPrefix}-apikey-helper`} className="text-xs text-slate-500">
        {helper}
      </p>
      <label
        {...overrideMaskAttrs}
        data-testid={`${props.testIdPrefix}-apikey-override`}
        className="block text-xs font-medium text-slate-600"
        htmlFor={`${props.testIdPrefix}-apikey-override-input`}
      >
        Admin override key
        <Input
          id={`${props.testIdPrefix}-apikey-override-input`}
          type="password"
          autoComplete="off"
          value={props.overrideValue}
          onChange={(event) => props.onOverrideChange(event.target.value)}
          placeholder="Leave blank to use your bound key"
          aria-label="Admin override key"
          className="mt-1"
        />
      </label>
    </div>
  );
}

/** DM-MC-07: serialise a tool result for copy/download. */
function stringifyResult(result: unknown): string {
  try {
    return JSON.stringify(result, null, 2);
  } catch {
    return String(result);
  }
}

function copyResultJson(result: unknown): void {
  void navigator.clipboard?.writeText(stringifyResult(result));
}

function downloadResultJson(result: unknown, prefix: string): void {
  const blob = new Blob([stringifyResult(result)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${prefix}-result.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/**
 * PS-72 v2 §5 result widget + meta panel. The meta panel is a horizontal row of
 * labelled chips directly below the result widget. correlation_id / request_id
 * are NEVER N/A (client-generated fallback is flagged per §5.1).
 */
export function Ps72ResultMeta(props: {
  testIdPrefix: string;
  result: unknown | null;
  meta: Ps72Meta | null;
  denied: boolean;
  jobId?: string | null;
  jobsHref?: string;
}) {
  const tone = props.meta ? LIFECYCLE_TONE_CLASS[lifecycleTone(props.meta.status)] : LIFECYCLE_TONE_CLASS.neutral;
  return (
    <div className="space-y-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">Result</div>
      <div
        data-testid={`${props.testIdPrefix}-result`}
        className={`rounded-md border p-3 ${props.denied ? "border-rose-300 bg-rose-50" : "border-slate-200 bg-white"}`}
      >
        {props.result === null ? (
          <p className="text-sm text-slate-500">No result yet. Select a tool and submit a request.</p>
        ) : (
          <div className="space-y-2">
            {/* DM-MC-07: copy/download the full response as JSON. */}
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                data-testid={`${props.testIdPrefix}-result-copy`}
                onClick={() => copyResultJson(props.result)}
                className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Copy JSON
              </button>
              <button
                type="button"
                data-testid={`${props.testIdPrefix}-result-download`}
                onClick={() => downloadResultJson(props.result, props.testIdPrefix)}
                className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Download JSON
              </button>
            </div>
            <JsonExplorer data={props.result} defaultExpanded title="Result" viewMode="tree" />
          </div>
        )}
        {props.jobId ? (
          <p className="mt-2 text-sm">
            Async job{" "}
            <a
              data-testid={`${props.testIdPrefix}-job-link`}
              href={jobHref(props.jobsHref, props.jobId)}
              className="font-mono font-semibold text-sky-700 hover:underline"
            >
              {props.jobId}
            </a>{" "}
            — track on the Jobs page.
          </p>
        ) : null}
      </div>

      <div data-testid={`${props.testIdPrefix}-meta`} className="flex min-w-0 flex-wrap items-center gap-2">
        {props.meta ? (
          <>
          <MetaChip
            testId={`${props.testIdPrefix}-meta-correlation-id`}
            label="correlation_id"
            value={props.meta.correlationId}
            suffix={props.meta.clientGenerated ? " (client-generated)" : ""}
          />
          <MetaChip
            testId={`${props.testIdPrefix}-meta-request-id`}
            label="request_id"
            value={props.meta.requestId}
            suffix={props.meta.clientGenerated ? " (client-generated)" : ""}
          />
          <MetaChip
            testId={`${props.testIdPrefix}-meta-duration`}
            label="duration"
            value={formatDuration(props.meta.durationMs)}
          />
          <span
            data-testid={`${props.testIdPrefix}-meta-status`}
            className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${tone}`}
          >
            {props.meta.status}
          </span>
          </>
        ) : (
          <span className="text-xs text-slate-500">Submit a request to populate metadata.</span>
        )}
      </div>
    </div>
  );
}

function MetaChip(props: { testId: string; label: string; value: string; suffix?: string }) {
  return (
    <span
      data-testid={props.testId}
      className="inline-flex max-w-full min-w-0 items-center gap-1 rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-xs"
    >
      <span className="font-semibold text-slate-500">{props.label}:</span>
      <span className="min-w-0 overflow-hidden text-ellipsis font-mono text-slate-800">
        {props.value}
        {props.suffix}
      </span>
    </span>
  );
}
