# @cloud-dog/auth — TESTS.md

## Standards sources
- `../cloud-dog-ai-platform-standards/packages/frontend/auth/TESTS.md`
- `../cloud-dog-ai-platform-standards/packages/frontend/auth/REQUIREMENTS.md`

## Implemented local checks
Date: 2026-02-15
- `npm run build` (root) — PASS
- `npm run typecheck` (root) — PASS
- `npm run test` (root; includes `@cloud-dog/auth` vitest suite) — PASS
- `npm run e2e` (root; auth entry actions present in app shell) — PASS

## Notes
- Test suite lives under `packages/auth/tests/` (UT/ST/SEC/A11Y/QT) and is executed via `npm -w @cloud-dog/auth run test`.
