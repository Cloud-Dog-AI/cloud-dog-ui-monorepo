// @cloud-dog/ui — WatchJournalTable (W28E-1870-F, PS-102 §5.2/§10).
// Bounded-batch event journal with ack / recover / re-enquire controls,
// built on the shared DataTable (no bespoke table).

import { DataTable, type DataColumn } from "../components/table/DataTable";
import type { WatchEventRow } from "./types";

export type WatchJournalTableProps = Readonly<{
  events: readonly WatchEventRow[];
  /** Ack the delivered batch up to the latest cursor. */
  onAck?: (cursor: string) => void;
  /** Recover from a cursor-expired / gap condition. */
  onRecover?: () => void;
  /** Re-enquire (fetch the next bounded batch). */
  onReenquire?: () => void;
  emptyMessage?: string;
  className?: string;
}>;

const columns: DataColumn<WatchEventRow>[] = [
  { id: "seq", header: "Seq", cell: (r) => r.seq, sortable: true, sortValue: (r) => r.seq },
  { id: "action", header: "Action", cell: (r) => r.action, sortable: true, sortValue: (r) => r.action },
  { id: "object", header: "Object", cell: (r) => r.objectRef },
  { id: "time", header: "Event Time", cell: (r) => r.eventTime, sortable: true, sortValue: (r) => r.eventTime },
  { id: "summary", header: "Summary", cell: (r) => r.summary ?? "" },
];

export function WatchJournalTable({
  events,
  onAck,
  onRecover,
  onReenquire,
  emptyMessage,
  className,
}: WatchJournalTableProps) {
  const lastCursor = events.length > 0 ? events[events.length - 1].cursor : "";
  return (
    <div className={className}>
      <div role="toolbar" aria-label="Journal controls">
        <button type="button" onClick={() => onAck?.(lastCursor)} disabled={!onAck || lastCursor === ""}>
          Ack batch
        </button>
        <button type="button" onClick={() => onReenquire?.()} disabled={!onReenquire}>
          Re-enquire
        </button>
        <button type="button" onClick={() => onRecover?.()} disabled={!onRecover}>
          Recover
        </button>
      </div>
      <DataTable<WatchEventRow>
        columns={columns}
        rows={[...events]}
        getRowId={(r) => (r.cursor !== "" ? r.cursor : String(r.seq))}
        ariaLabel="Change event journal"
        emptyMessage={emptyMessage ?? "No events yet"}
      />
    </div>
  );
}
