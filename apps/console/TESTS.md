# @cloud-dog/app-console — TESTS.md

## Scope
Application-level verification for the monorepo reference app consuming `@cloud-dog/*` packages.

## Implemented local checks
Date: 2026-02-15
- `npm run build` (root) — PASS
- `npm run typecheck` (root) — PASS
- `npm run lint` (root) — PASS
- `npm run test` (root; vitest command configured) — PASS
- `npm run e2e` (root) — PASS
- `npm run a11y` (root) — PASS

## E2E coverage currently present
- Navigation renders and Test Console run path executes.
- Accessibility scan for home view passes on desktop and mobile projects.

## Notes
- This app acts as the integration harness for shared package consumption.
