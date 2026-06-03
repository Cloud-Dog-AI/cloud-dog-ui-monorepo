# Monorepo UI Publishing Standards

This document defines the minimum publish-ready standard for `cloud-dog-ai-ui-monorepo` packages and applications.

## Packages

Every publishable package under `packages/*` must include:
- `README.md` with purpose, installation, exports, and usage examples
- `LICENCE` with Apache 2.0 text
- `CHANGELOG.md` with released and planned changes
- `package.json` with name, description, version, author, licence, repository, homepage, exports, and publish config
- source in `src/`
- tests in `tests/` or `__tests__/`
- build output restricted to `dist/`

## Apps

Every application under `apps/*` must include:
- `README.md` with purpose, local run, build, lint, typecheck, and test commands
- `package.json` with the required shared package dependencies
- `vite.config.ts`
- `playwright.config.ts`
- `tsconfig.json`
- end-to-end tests under `tests/`
- accessibility coverage in `tests/a11y.spec.ts` or an equivalent `tests/a11y/` path

## Required Shared Frontend Packages

Application dependencies must use:
- `@cloud-dog/tokens` for shared colour, spacing, and theme primitives
- `@cloud-dog/shell` for page shell and layout structure
- `@cloud-dog/api-client` for API, MCP, and A2A HTTP calls

Direct `fetch()` calls in app code are not permitted unless first encapsulated inside `@cloud-dog/api-client`.

## Publication Exclusions

Do not publish:
- internal server URLs not required by consumers
- API keys, cookies, credentials, or test secrets
- agent instructions, dispatch blocks, working logs, or temporary reports
- internal-only commercial architecture notes beyond package usage guidance

## Code and Documentation Standards

- Use UK English in user-facing text
- Document public exports and reusable components with TSDoc or equivalent concise comments
- Keep runtime configuration examples redacted and local-safe
- Keep package README examples aligned to the current exported API surface
- Ensure published artefacts do not depend on local-only paths or unpublished workspace packages

## Verification Gate

Before publishing any package or app artefact:
1. run package or app typecheck
2. run the relevant build
3. run lint
4. confirm required files are present
5. confirm no internal-only or sensitive content is included
