import { DataTable, SavedQueryControls } from "../src";
import { SearchPanel } from "../src/patterns";
import type { DataColumn } from "../src";

type Row = {
  id: string;
  title: string;
  kind: string;
  score: number;
};

const rows: Row[] = [
  { id: "r-1", title: "Customer contract", kind: "Document", score: 0.98 },
  { id: "r-2", title: "Catalogue profile", kind: "Entity", score: 0.87 },
];

const columns: DataColumn<Row>[] = [
  { id: "title", header: "Title", cell: (row) => row.title, sortable: true },
  { id: "kind", header: "Kind", cell: (row) => row.kind, sortable: true },
  { id: "score", header: "Score", cell: (row) => row.score, sortable: true },
];

export default { title: "W28E-1849/SearchPanel", component: SearchPanel };

export const SearchCatalogueBrowser = {
  render: () => (
    <SearchPanel
      title="Search"
      description="Search catalogue records with saved queries and domain facets."
      headerActions={<button type="button">Export selected</button>}
      scopeControls={<label className="text-sm">Profile <select aria-label="Profile"><option>Default</option></select></label>}
      savedQueryControls={
        <SavedQueryControls
          draftName="Recent contracts"
          queries={[{ id: "q-1", name: "Recent contracts" }]}
          selectedId="q-1"
          onDraftNameChange={() => undefined}
          onSelect={() => undefined}
          onSave={() => undefined}
          onDelete={() => undefined}
        />
      }
      facetPanel={<label className="text-sm"><input type="checkbox" /> Namespace</label>}
      filters={[
        {
          name: "kind",
          label: "Kind",
          type: "select",
          options: [
            { label: "Document", value: "document" },
            { label: "Entity", value: "entity" },
          ],
        },
      ]}
      results={
        <DataTable<Row>
          rows={rows}
          columns={columns}
          getRowId={(row) => row.id}
          selectable
          columnPickerEnabled
          tableId="search-panel-story"
        />
      }
      resultsLabel="Search results"
      resultsDescription="2 matches"
      onSearch={() => undefined}
    />
  ),
};
