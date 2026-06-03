# UI Monorepo Test Catalogue

## Scope
This file records test execution evidence for `cloud-dog-ai-ui-monorepo` and links package-level `TESTS.md` files.

## Executed validation run
Date: 2026-02-15

Commands executed from repo root:
- `npm run build` — PASS
- `npm run typecheck` — PASS
- `npm run lint` — PASS
- `npm run test` — PASS
- `npm run e2e` — PASS
- `npm run a11y` — PASS

## Package/app test documents
- `packages/tokens/TESTS.md`
- `packages/ui/TESTS.md`
- `packages/shell/TESTS.md`
- `packages/auth/TESTS.md`
- `packages/api-client/TESTS.md`
- `packages/config/TESTS.md`
- `packages/testing/TESTS.md`
- `apps/console/TESTS.md`

## Standards references
- `../cloud-dog-ai-platform-standards/packages/frontend/AGENT-INSTRUCTION.md`
- `../cloud-dog-ai-platform-standards/docs/standards/30-ui.md`
- `../cloud-dog-ai-platform-standards/docs/standards/95-testing.md`

## Current compliance position
- Quality gates and E2E/a11y checks are operational and green.
- Package-level UT/ST/SEC/A11Y/QT suites are implemented under `packages/*/tests` and run via `npm run test` (Turbo).
- Platform instruction documents target `0.0.3`, matching this repo.
