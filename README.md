# cloud-dog-ai-ui-monorepo

Shared Cloud-Dog UI platform monorepo for reusable frontend packages and deployable service UI apps.

## Platform alignment
- Common rules source: `../cloud-dog-ai-platform-standards/RULES.md`
- Local rule extensions: `RULES.md`
- Project catalogue: `../cloud-dog-ai-platform-standards/PROJECT-List.md`
- Standards baseline pin: `.platform-standards.yml`

## Repository layout
- `apps/*`: independently buildable/deployable service UIs (never published as shared code)
- `packages/*`: reusable `@cloud-dog/*` libraries with registry-neutral package metadata
- `docs/*`: architecture/UX/testing guidance
- `working/*`: active planning artefacts

## Shared packages
- `@cloud-dog/tokens`: design tokens and Tailwind preset
- `@cloud-dog/ui`: shared accessible primitives
- `@cloud-dog/shell`: canonical shell layout and navigation scaffolding
- `@cloud-dog/auth`: auth UI and provider interfaces
- `@cloud-dog/api-client`: typed API client conventions
- `@cloud-dog/config`: runtime config loading contract
- `@cloud-dog/testing`: Playwright and axe helpers

## Build environment (nvm)
This repository uses Node `20.20.0` via `.nvmrc`.

```bash
nvm install
nvm use
npm install
```

## Package registry
Configure the approved package registry in the release environment. Package
manifests deliberately contain no environment-specific registry or topology.

Apps in `apps/*` remain private and are deployed as application artefacts, not shared libraries.

## Workspace commands
```bash
npm run dev
npm run build
npm run typecheck
npm run lint
npm run test
npm run e2e
npm run a11y
```

## Test Integrity

**E2E and integration Playwright tests MUST execute against REAL running backends — no stubs, mocks, or fake data. See `RULES.md` § Absolute Test Integrity.**

## Delivery guidance
See `working/DELIVERY-PLAN.md` for the staged plan to make this repo release-ready and compliant.

## CI workflows
- `.github/workflows/ci-validate.yml`: build/typecheck/lint/test
- `.github/workflows/ci-e2e-a11y.yml`: Playwright E2E and axe checks
- `.github/workflows/standards-compliance.yml`: local baseline and boundary checks
- `.github/workflows/publish-packages.yml`: publishes `packages/*` to the release-selected registry on tag or manual dispatch

For publishing, configure `NPM_TOKEN` with access to the release-selected registry.

## Licence

Apache 2.0 — © 2026 Cloud-Dog, Viewdeck Engineering Limited

See [LICENCE](LICENCE) for full text.
