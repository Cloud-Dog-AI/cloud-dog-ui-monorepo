# Python Playwright migration guide

This guide helps migrate pytest+Playwright suites to the TypeScript Playwright harness in `@cloud-dog/testing`.

## Recommended approach

1. Map existing Python tests to route/workflow coverage.
2. Recreate fixtures using `@cloud-dog/testing` exports.
3. Run both harnesses in parallel during the transition.
4. Retire Python tests once parity is proven.
