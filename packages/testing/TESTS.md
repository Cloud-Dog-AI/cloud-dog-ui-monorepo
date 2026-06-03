# @cloud-dog/testing — TESTS.md

## Standards sources
- `../cloud-dog-ai-platform-standards/packages/frontend/testing/TESTS.md`
- `../cloud-dog-ai-platform-standards/packages/frontend/testing/REQUIREMENTS.md`

## Implemented local checks
Date: 2026-02-15
- `npm run build` (root) — PASS
- `npm run typecheck` (root) — PASS
- `npm run test` (root; includes `@cloud-dog/testing` vitest + Playwright system suite) — PASS
- `npm run e2e` (root; package helpers used by app tests) — PASS
- `npm run a11y` (root; `checkA11y` wrapper used) — PASS

## Notes
- Test suite lives under `packages/testing/tests/` and is executed via `npm -w @cloud-dog/testing run test`.
