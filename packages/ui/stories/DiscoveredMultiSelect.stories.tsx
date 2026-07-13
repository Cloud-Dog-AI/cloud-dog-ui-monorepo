import { DiscoveredMultiSelect } from "../src/discovered-multi-select";

export default { title: "W28A-871/DiscoveredMultiSelect", component: DiscoveredMultiSelect };

export const WithStaleValue = {
  args: {
    label: "Fields",
    allowWildcard: true,
    values: ["*", "email", "legacy_field"],
    staleValues: ["legacy_field"],
    options: [
      { value: "id", label: "id" },
      { value: "email", label: "email" },
      { value: "created_at", label: "created_at" },
    ],
    onChange: () => undefined,
    onRefresh: () => undefined,
  },
};
