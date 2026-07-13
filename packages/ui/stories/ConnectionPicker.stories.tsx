import { ConnectionPicker } from "../src/connection-picker";

export default { title: "W28A-871/ConnectionPicker", component: ConnectionPicker };

export const Default = {
  args: {
    label: "Source connection",
    value: "w871_seed_pg",
    options: [
      { name: "w871_seed_pg", sourceType: "postgres", status: "healthy", description: "Preprod seed connection" },
      { name: "w871_seed_mongo", sourceType: "mongodb", status: "not_tested" },
    ],
    onChange: () => undefined,
    onTest: () => undefined,
    testResult: { ok: true, message: "Connected", latencyMs: 12, lastTestedAt: "just now" },
  },
};
