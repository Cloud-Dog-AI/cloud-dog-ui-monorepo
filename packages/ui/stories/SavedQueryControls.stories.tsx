import { SavedQueryControls } from "../src/saved-query-controls";

export default { title: "W28A-871/SavedQueryControls", component: SavedQueryControls };

export const Default = {
  args: {
    draftName: "Paid orders",
    selectedId: "q1",
    queries: [
      { id: "q1", name: "Failed orders" },
      { id: "q2", name: "Paid orders", shared: true },
    ],
    onDraftNameChange: () => undefined,
    onSelect: () => undefined,
    onSave: () => undefined,
    onDelete: () => undefined,
  },
};
