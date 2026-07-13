// @cloud-dog/ui — ChangeWatchPanel (W28E-1870-F, PS-102 §10).
// Watch list + lifecycle actions + status badges, on the shared DataTable.
// Consumed identically by the five service apps (file/imap/git/index/db).

import {
  DataTable,
  createDataTableActionColumn,
  type DataColumn,
  type DataTableAction,
} from "../components/table/DataTable";
import { WatchStatusBadge, watchStateTone } from "./WatchStatusBadge";
import { toneSortWeight } from "../components/layout/StatusBadge";
import type { WatchRow } from "./types";

export type ChangeWatchPanelProps = Readonly<{
  watches: readonly WatchRow[];
  onCreate?: () => void;
  onPause?: (watchId: string) => void;
  onResume?: (watchId: string) => void;
  onDelete?: (watchId: string) => void;
  onOpenJournal?: (watchId: string) => void;
  onTestEvent?: (watchId: string) => void;
  emptyMessage?: string;
  className?: string;
}>;

export function ChangeWatchPanel({
  watches,
  onCreate,
  onPause,
  onResume,
  onDelete,
  onOpenJournal,
  onTestEvent,
  emptyMessage,
  className,
}: ChangeWatchPanelProps) {
  const actionsFor = (): readonly DataTableAction<WatchRow>[] => [
    { id: "journal", label: "Journal", onClick: (r) => onOpenJournal?.(r.watchId) },
    { id: "pause", label: "Pause", onClick: (r) => onPause?.(r.watchId), disabled: (r) => r.state === "paused" },
    { id: "resume", label: "Resume", onClick: (r) => onResume?.(r.watchId), disabled: (r) => r.state !== "paused" },
    { id: "test", label: "Test event", onClick: (r) => onTestEvent?.(r.watchId) },
    { id: "delete", label: "Delete", destructive: true, onClick: (r) => onDelete?.(r.watchId) },
  ];

  const columns: DataColumn<WatchRow>[] = [
    { id: "watch", header: "Watch", cell: (r) => r.watchId, sortable: true, sortValue: (r) => r.watchId },
    { id: "service", header: "Service", cell: (r) => r.serviceId, sortable: true, sortValue: (r) => r.serviceId },
    { id: "profile", header: "Profile", cell: (r) => r.profileId },
    {
      id: "state",
      header: "State",
      cell: (r) => <WatchStatusBadge state={r.state} />,
      sortable: true,
      sortValue: (r) => toneSortWeight(watchStateTone(r.state)),
    },
    { id: "depth", header: "Journal", cell: (r) => r.depth, sortable: true, sortValue: (r) => r.depth },
    { id: "inflight", header: "In-flight", cell: (r) => r.inflight, sortable: true, sortValue: (r) => r.inflight },
    createDataTableActionColumn<WatchRow>(actionsFor),
  ];

  return (
    <section className={className} aria-label="Change watches">
      <div role="toolbar" aria-label="Watch actions">
        <button type="button" onClick={() => onCreate?.()} disabled={!onCreate}>
          Create watch
        </button>
      </div>
      <DataTable<WatchRow>
        columns={columns}
        rows={[...watches]}
        getRowId={(r) => r.watchId}
        getRowName={(r) => `watch ${r.watchId}`}
        ariaLabel="Change watches"
        emptyMessage={emptyMessage ?? "No watches configured"}
      />
    </section>
  );
}
