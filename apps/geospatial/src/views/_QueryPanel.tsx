// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
//
// Licensed under the Apache License, Version 2.0.

import * as React from "react";
import { Input, JsonExplorer, Label, SearchPanel } from "@cloud-dog/ui";
import { PageHeader, errMessage } from "../lib/ui";
import { useGeoState } from "../state/AppState";
import { isForbidden } from "../lib/api";
import type { GeoApi } from "../lib/api";

export type QueryField = Readonly<{
  name: string;
  label: string;
  placeholder?: string;
  type?: "text" | "number";
  defaultValue?: string;
}>;

function initialValues(fields: readonly QueryField[]): Record<string, string> {
  return Object.fromEntries(fields.map((f) => [f.name, f.defaultValue ?? ""]));
}

/** A geospatial domain action form: collects inputs, runs an API op, shows the
 * result via JsonExplorer, and renders an explicit inline 403 (reader-cannot)
 * — never the app shell with privileged data. Uses shared @cloud-dog/ui only. */
export function QueryPanel(props: {
  title: string;
  description: string;
  submitLabel: string;
  testId: string;
  fields: readonly QueryField[];
  run: (api: GeoApi, values: Record<string, string>) => Promise<unknown>;
}) {
  const { api, appVersion } = useGeoState();
  const [values, setValues] = React.useState<Record<string, string>>(() => initialValues(props.fields));
  const [result, setResult] = React.useState<unknown>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [forbidden, setForbidden] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const queryField = props.fields.find((f) => f.name === "query") ?? props.fields[0];
  const scopedFields = props.fields.filter((f) => f.name !== queryField?.name);

  const submit = async (nextValues = values) => {
    setLoading(true);
    setError(null);
    setForbidden(false);
    setResult(null);
    try {
      setResult(await props.run(api, values));
    } catch (e) {
      if (isForbidden(e)) setForbidden(true);
      else setError(errMessage(e, "Request failed."));
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setValues(initialValues(props.fields));
    setError(null);
    setForbidden(false);
    setResult(null);
  };

  return (
    <div className="space-y-6" data-testid={`page-${props.testId}`}>
      <PageHeader title={props.title} version={appVersion} description={props.description} />
      <SearchPanel
        title="Search"
        description={props.description}
        filters={[]}
        query={queryField ? values[queryField.name] : ""}
        onQueryChange={(nextQuery) => {
          if (queryField) {
            setValues((current) => ({ ...current, [queryField.name]: nextQuery }));
          }
        }}
        onSearch={(nextQuery) => {
          const nextValues = queryField ? { ...values, [queryField.name]: nextQuery } : values;
          setValues(nextValues);
          void submit(nextValues);
        }}
        onClear={reset}
        queryInputId={`${props.testId}-${queryField?.name ?? "query"}`}
        queryLabel={queryField?.label ?? "Search"}
        queryAriaLabel={queryField?.label ?? "Search query"}
        placeholder={queryField?.placeholder ?? "Search"}
        searchButtonLabel={props.submitLabel}
        searchButtonTestId={`${props.testId}-submit`}
        loading={loading}
        loadingLabel="Searching"
        error={forbidden ? "You do not have permission to run this operation (403 permission_denied)." : error}
        scopeControls={
          scopedFields.length ? (
            <div className="grid gap-3 md:grid-cols-3">
              {scopedFields.map((f) => (
                <div key={f.name} className="space-y-1">
                  <Label htmlFor={`${props.testId}-${f.name}`}>{f.label}</Label>
                  <Input
                    id={`${props.testId}-${f.name}`}
                    data-testid={`${props.testId}-${f.name}`}
                    type={f.type === "number" ? "number" : "text"}
                    value={values[f.name]}
                    placeholder={f.placeholder}
                    onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
          ) : null
        }
        resultsLabel="Search results"
        emptyMessage="No records found."
        hasResults={result != null}
        results={
          result != null ? (
            <div data-testid={`${props.testId}-result`}>
              <JsonExplorer data={result} />
            </div>
          ) : null
        }
      />
    </div>
  );
}
