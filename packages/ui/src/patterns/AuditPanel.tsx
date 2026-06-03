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

// @cloud-dog/ui — AuditPanel pattern (audit/monitoring dashboard).

import * as React from "react";
import { cn } from "../utils/cn";
import { Button } from "../components/button/Button";
import { Input } from "../components/input/Input";
import { Select } from "../components/input/Select";
import { Switch } from "../components/input/Switch";
import { Label } from "../components/input/Label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/tabs/Tabs";
import { LogStream } from "./LogStream";
import type { LogEntry } from "./LogStream";

export type AuditPanelProps = Readonly<{
  logTypes: string[];
  activeType: string;
  onTypeChange: (type: string) => void;
  logs: LogEntry[];
  onFilter?: (level: string, search: string) => void;
  onRefresh?: () => void;
  autoFollow?: boolean;
  onAutoFollowChange?: (follow: boolean) => void;
  className?: string;
}>;

export function AuditPanel(props: AuditPanelProps) {
  const [levelFilter, setLevelFilter] = React.useState("");
  const [searchFilter, setSearchFilter] = React.useState("");
  const autoFollow = props.autoFollow ?? true;

  const handleFilterChange = (level: string, search: string) => {
    setLevelFilter(level);
    setSearchFilter(search);
    props.onFilter?.(level, search);
  };

  return (
    <section className={cn("space-y-4 rounded-md border bg-background p-4", props.className)} aria-label="Audit panel">
      <Tabs value={props.activeType} onValueChange={props.onTypeChange}>
        <div className="flex items-center gap-3">
          <TabsList>
            {props.logTypes.map((t) => (
              <TabsTrigger key={t} value={t}>{t}</TabsTrigger>
            ))}
          </TabsList>

          <div className="ml-auto flex items-center gap-2">
            {props.onRefresh ? (
              <Button variant="ghost" size="sm" onClick={props.onRefresh}>Refresh</Button>
            ) : null}
            {props.onAutoFollowChange ? (
              <div className="flex items-center gap-1">
                <Label className="text-xs">Follow</Label>
                <Switch
                  checked={autoFollow}
                  onCheckedChange={props.onAutoFollowChange}
                  aria-label="Auto-follow logs"
                />
              </div>
            ) : null}
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex items-center gap-2 pt-2">
          <Select
            value={levelFilter}
            onChange={(e) => handleFilterChange(e.target.value, searchFilter)}
            className="w-32"
            aria-label="Filter by level"
          >
            <option value="">All levels</option>
            <option value="error">Error</option>
            <option value="warn">Warn</option>
            <option value="info">Info</option>
            <option value="debug">Debug</option>
          </Select>
          <Input
            value={searchFilter}
            onChange={(e) => handleFilterChange(levelFilter, e.target.value)}
            placeholder="Search logs"
            aria-label="Search logs"
            className="flex-1"
          />
        </div>

        {props.logTypes.map((t) => (
          <TabsContent key={t} value={t}>
            <LogStream
              entries={props.logs}
              autoFollow={autoFollow}
              levelFilter={levelFilter}
              searchFilter={searchFilter}
            />
          </TabsContent>
        ))}
      </Tabs>
    </section>
  );
}
