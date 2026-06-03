# @cloud-dog/ui — TESTS.md

## Standards sources
- `../cloud-dog-ai-platform-standards/packages/frontend/ui/TESTS.md`
- `../cloud-dog-ai-platform-standards/packages/frontend/ui/REQUIREMENTS.md`

## Implemented local checks
Date: 2026-02-15
- `npm run build` (root) — PASS
- `npm run typecheck` (root) — PASS
- `npm run test` (root; includes `@cloud-dog/ui` vitest suite) — PASS
- `npm run a11y` (root; E2E axe via app consumption) — PASS

## Notes
- Test suite lives under `packages/ui/tests/` (UT/ST/A11Y/QT) and is executed via `npm -w @cloud-dog/ui run test`.
