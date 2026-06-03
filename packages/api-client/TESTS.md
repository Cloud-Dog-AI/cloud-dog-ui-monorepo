# @cloud-dog/api-client — TESTS.md

## Standards sources
- `../cloud-dog-ai-platform-standards/packages/frontend/api-client/TESTS.md`
- `../cloud-dog-ai-platform-standards/packages/frontend/api-client/REQUIREMENTS.md`

## Implemented local checks
Date: 2026-02-15
- `npm run build` (root) — PASS
- `npm run typecheck` (root) — PASS
- `npm run test` (root; includes `@cloud-dog/api-client` vitest suite) — PASS
- `npm run e2e` (root; console app exercises request paths) — PASS

## Notes
- Test suite lives under `packages/api-client/tests/` (UT/ST/SEC/QT) and is executed via `npm -w @cloud-dog/api-client run test`.
