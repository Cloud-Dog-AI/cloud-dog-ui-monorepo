// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
// Licensed under the Apache License 2.0

import * as React from "react";
import { useParams } from "react-router-dom";
import {
  Button,
  DataTable,
  SearchPanel,
  Select,
  StatusBadge,
  createDataTableActionColumn,
  type DataColumn,
} from "@cloud-dog/ui";
import { ShieldCheck } from "lucide-react";
import { useSbomState } from "../state/AppState";
import { PageHeader, errMessage } from "../lib/ui";
import type { FindingResponse } from "../lib/types";

const SEVERITIES = ["critical", "high", "medium", "low", "unknown"] as const;

function fieldText(row: FindingResponse): string {
  return [
    row.scan_id,
    row.source_tool,
    row.finding_key,
    row.package_name,
    row.package_version,
    row.vulnerability_id,
    row.severity,
    row.finding_status,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function FindingsPage() {
  const { scanId } = useParams<{ scanId?: string }>();
  const { api, appVersion } = useSbomState();
  const [rows, setRows] = React.useState<FindingResponse[]>([]);
  const [query, setQuery] = React.useState("");
  const [severity, setSeverity] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.listFindings({ scanId, limit: 200 });
      setRows(result.items);
    } catch (e) {
      setError(errMessage(e, "Failed to load findings."));
    } finally {
      setLoading(false);
    }
  }, [api, scanId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (severity && (row.severity ?? "unknown").toLowerCase() !== severity) return false;
      if (status && row.finding_status !== status) return false;
      return !q || fieldText(row).includes(q);
    });
  }, [query, rows, severity, status]);

  const columns: DataColumn<FindingResponse>[] = [
    {
      id: "finding_key",
      header: "Finding",
      sortable: true,
      sortValue: (r) => r.finding_key,
      cell: (r) => <span className="font-mono text-xs">{r.finding_key}</span>,
    },
    {
      id: "vulnerability_id",
      header: "Vulnerability",
      sortable: true,
      sortValue: (r) => r.vulnerability_id ?? "",
      cell: (r) => r.vulnerability_id ?? "—",
    },
    {
      id: "severity",
      header: "Severity",
      sortable: true,
      sortValue: (r) => r.severity ?? "",
      cell: (r) => <StatusBadge value={r.severity ?? "unknown"} />,
    },
    {
      id: "package_name",
      header: "Package",
      sortable: true,
      sortValue: (r) => r.package_name ?? "",
      cell: (r) => (
        <div>
          <div>{r.package_name ?? "—"}</div>
          <div className="text-xs text-muted-foreground">{r.package_version ?? ""}</div>
        </div>
      ),
    },
    {
      id: "source_tool",
      header: "Tool",
      sortable: true,
      sortValue: (r) => r.source_tool,
      cell: (r) => r.source_tool,
    },
    {
      id: "scan_id",
      header: "Scan",
      sortable: true,
      sortValue: (r) => r.scan_id,
      cell: (r) => <span className="font-mono text-xs">{r.scan_id}</span>,
    },
    {
      id: "finding_status",
      header: "State",
      sortable: true,
      sortValue: (r) => r.finding_status,
      cell: (r) => <StatusBadge value={r.finding_status} />,
    },
    createDataTableActionColumn<FindingResponse>((row) => [
      {
        id: "waive",
        label: "Create Waiver",
        icon: <ShieldCheck className="h-4 w-4" />,
        href: () =>
          `/waivers?finding=${encodeURIComponent(row.vulnerability_id ?? row.finding_key)}&scan=${encodeURIComponent(row.scan_id)}`,
      },
    ]),
  ];

  const statusOptions = [...new Set(rows.map((row) => row.finding_status))].sort();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Findings"
        version={appVersion}
        description={scanId ? `Normalised finding index for scan ${scanId}.` : "Normalised finding index across visible scans."}
      >
        <Button variant="secondary" size="sm" onClick={() => void load()}>
          Refresh
        </Button>
      </PageHeader>

      <SearchPanel
        title="Search"
        description={scanId ? `Normalised findings for scan ${scanId}.` : "Normalised findings across visible scans."}
        filters={[]}
        query={query}
        onQueryChange={setQuery}
        onSearch={(nextQuery) => setQuery(nextQuery)}
        onClear={() => {
          setQuery("");
          setSeverity("");
          setStatus("");
        }}
        queryLabel="Search"
        queryAriaLabel="Search findings"
        placeholder="Search package, CVE, finding key, scan..."
        loading={loading}
        error={error}
        status={`${filtered.length} findings visible`}
        resultsLabel="Search results"
        emptyMessage="No matches found."
        scopeControls={
          <div className="grid gap-3 md:grid-cols-2">
            <Select aria-label="Filter finding severity" value={severity} onChange={(event) => setSeverity(event.currentTarget.value)}>
              <option value="">Any severity</option>
              {SEVERITIES.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </Select>
            <Select aria-label="Filter finding state" value={status} onChange={(event) => setStatus(event.currentTarget.value)}>
              <option value="">Any state</option>
              {statusOptions.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </Select>
          </div>
        }
        results={
          <DataTable
            columns={columns}
            rows={filtered}
            getRowId={(r) => `${r.scan_id}:${r.source_tool}:${r.finding_key}`}
            getRowTestId={(r) => `finding-row-${r.finding_key}`}
            emptyMessage="No findings match the current filters."
            pageSize={25}
            columnPickerEnabled
            tableId={scanId ? "sbom-mcp-scan-findings" : "sbom-mcp-findings"}
          />
        }
      />
    </div>
  );
}
