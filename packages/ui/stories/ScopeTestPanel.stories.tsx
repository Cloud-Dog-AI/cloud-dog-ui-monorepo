import { ScopeTestPanel } from "../src/scope-test-panel";

export default { title: "W28A-871/ScopeTestPanel", component: ScopeTestPanel };

export const Warn = {
  args: {
    result: {
      status: "WARN",
      latencyMs: 42,
      accessible: [{ namespace: "w28a871", entity: "users" }, { namespace: "w28a871", entity: "orders" }],
      warnings: ["legacy_field is stale"],
    },
    onRun: () => undefined,
  },
};
