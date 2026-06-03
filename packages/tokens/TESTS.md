# @cloud-dog/tokens — TESTS.md

## Standards sources
- `../cloud-dog-ai-platform-standards/packages/frontend/tokens/TESTS.md`
- `../cloud-dog-ai-platform-standards/packages/frontend/tokens/REQUIREMENTS.md`

## Implemented local checks
Date: 2026-02-15
- `npm run build` (root) — PASS
- `npm run typecheck` (root) — PASS
- `npm run test` (root; includes `@cloud-dog/tokens` vitest suite) — PASS

## Notes
- Test suite lives under `packages/tokens/tests/` (UT/ST/QT) and is executed via `npm -w @cloud-dog/tokens run test`.
