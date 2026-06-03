# @cloud-dog/shell — TESTS.md

## Standards sources
- `../cloud-dog-ai-platform-standards/packages/frontend/shell/TESTS.md`
- `../cloud-dog-ai-platform-standards/packages/frontend/shell/REQUIREMENTS.md`

## Implemented local checks
Date: 2026-02-15
- `npm run build` (root) — PASS
- `npm run typecheck` (root) — PASS
- `npm run test` (root; includes `@cloud-dog/shell` vitest suite) — PASS
- `npm run e2e` (root, shell used in app) — PASS
- `npm run a11y` (root, shell used in app) — PASS

## Notes
- Test suite lives under `packages/shell/tests/` (UT/ST/A11Y/QT) and is executed via `npm -w @cloud-dog/shell run test`.
