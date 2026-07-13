import * as React from "react";
import { Badge } from "../src/components/layout/Badge";
import { CrudPage } from "../src/patterns/CrudPage";
import type { CrudColumn } from "../src/patterns/CrudPage";

type ChannelRow = {
  id: string;
  name: string;
  status: "Active" | "Paused";
  owner: string;
};

const rows: ChannelRow[] = [
  { id: "email-default", name: "Email default", status: "Active", owner: "Notifications" },
  { id: "sms-ops", name: "SMS operations", status: "Paused", owner: "Operations" },
];

const columns: CrudColumn<ChannelRow>[] = [
  { id: "name", header: "Name", cell: (row) => row.name },
  { id: "status", header: "Status", cell: (row) => <Badge>{row.status}</Badge> },
  { id: "owner", header: "Owner", cell: (row) => row.owner },
];

export default { title: "Patterns/CrudPage", component: CrudPage };

export const Canonical = {
  render: () => (
    <CrudPage<ChannelRow>
      title="Channels"
      entityName="Channel"
      rows={rows}
      columns={columns}
      getRowId={(row) => row.id}
      bulkActions={[{ label: "Export", onRun: () => undefined }]}
      renderDetail={(row) => (
        <dl className="grid gap-2 text-sm">
          <div>
            <dt className="font-medium">Name</dt>
            <dd>{row.name}</dd>
          </div>
          <div>
            <dt className="font-medium">Owner</dt>
            <dd>{row.owner}</dd>
          </div>
        </dl>
      )}
      extensionSlot={<button type="button" className="text-sm underline">Import channels</button>}
    />
  ),
};
