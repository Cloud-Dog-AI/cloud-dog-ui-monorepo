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

// FR1.40 page kind: Locale Selector. Role-visibility: any-authed.
// Pick locale + number / date format conventions for the workflow.

import * as React from "react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  Label,
  Select,
  JsonExplorer,
} from "@cloud-dog/ui";
import { useChartState } from "../state/AppState";
import { PageHeader, StatusLine, errMessage } from "../lib/ui";
import { useChartWorkflow } from "../state/ChartWorkflow";

const LOCALES = [
  { id: "en-GB", label: "English (United Kingdom)" },
  { id: "en-US", label: "English (United States)" },
  { id: "en-AU", label: "English (Australia)" },
  { id: "de-DE", label: "Deutsch (Deutschland)" },
  { id: "fr-FR", label: "Français (France)" },
  { id: "es-ES", label: "Español (España)" },
  { id: "ja-JP", label: "日本語 (日本)" },
  { id: "zh-CN", label: "中文 (简体)" },
];

const NUMBER_FORMATS = ["1,234.56", "1.234,56", "1 234,56", "1234.56"];
const DATE_FORMATS = ["YYYY-MM-DD", "DD/MM/YYYY", "MM/DD/YYYY", "DD MMM YYYY"];

export function LocaleSelectorPage() {
  const { api, appVersion } = useChartState();
  const workflow = useChartWorkflow();
  const [locale, setLocale] = React.useState<string>(workflow.locale.locale ?? "en-GB");
  const [numberFormat, setNumberFormat] = React.useState<string>(workflow.locale.numberFormat ?? NUMBER_FORMATS[0]);
  const [dateFormat, setDateFormat] = React.useState<string>(workflow.locale.dateFormat ?? DATE_FORMATS[0]);
  const [serviceLocale, setServiceLocale] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    api.config()
      .then((cfg) => {
        if (cancelled) return;
        const loc = (cfg.default_locale ?? cfg.locale) as string | undefined;
        if (loc) setServiceLocale(loc);
      })
      .catch((e) => {
        if (!cancelled) setError(errMessage(e, "Could not read service config."));
      });
    return () => {
      cancelled = true;
    };
  }, [api]);

  const apply = () => {
    workflow.setLocale({ locale, numberFormat, dateFormat });
    setStatus(`Locale "${locale}" applied to workflow.`);
  };

  const sampleNumber = React.useMemo(() => {
    try {
      return new Intl.NumberFormat(locale).format(1234567.89);
    } catch {
      return "1,234,567.89";
    }
  }, [locale]);

  const sampleDate = React.useMemo(() => {
    try {
      return new Intl.DateTimeFormat(locale).format(new Date("2026-06-15T12:00:00Z"));
    } catch {
      return "2026-06-15";
    }
  }, [locale]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Locale Selector"
        version={appVersion}
        description="Set locale and number / date format conventions for the active workflow."
      >
        <Button size="sm" onClick={apply} data-testid="locale-apply">
          Save Locale
        </Button>
      </PageHeader>

      <StatusLine error={error} status={status} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Selection</h2>
            {serviceLocale ? (
              <p className="text-sm text-muted-foreground">Service default: <Badge variant="secondary">{serviceLocale}</Badge></p>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="loc-locale">Locale</Label>
              <Select id="loc-locale" value={locale} onChange={(e) => setLocale(e.target.value)}>
                {LOCALES.map((l) => (
                  <option key={l.id} value={l.id}>{l.id} — {l.label}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="loc-number">Number format</Label>
              <Select id="loc-number" value={numberFormat} onChange={(e) => setNumberFormat(e.target.value)}>
                {NUMBER_FORMATS.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="loc-date">Date format</Label>
              <Select id="loc-date" value={dateFormat} onChange={(e) => setDateFormat(e.target.value)}>
                {DATE_FORMATS.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </Select>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Preview</h2>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              Number: <Badge variant="secondary">{sampleNumber}</Badge>
            </p>
            <p>
              Date: <Badge variant="secondary">{sampleDate}</Badge>
            </p>
            <JsonExplorer
              data={{ locale, number_format: numberFormat, date_format: dateFormat }}
              title="Workflow locale draft"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
