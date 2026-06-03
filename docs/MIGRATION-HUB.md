# Migration Hub

This document is the central index of migration guides for adopting `@cloud-dog/*` packages and the app scaffolds in this monorepo.

## Package migration guides

- `@cloud-dog/tokens`
  - `packages/tokens/docs/MIGRATION-FROM-INLINE-CSS.md`
  - `packages/tokens/docs/SERVER-RENDERED-USAGE.md`
  - `packages/tokens/docs/LEGACY-COLOUR-MAP.md`
- `@cloud-dog/ui`
  - `packages/ui/docs/MIGRATION-FROM-VANILLA-JS.md`
  - `packages/ui/docs/ADMIN-CRUD-RECIPES.md`
- `@cloud-dog/config`
  - `packages/config/docs/MIGRATION-FROM-API-CONFIG.md`
  - `packages/config/docs/SENSITIVE-CONFIG-HANDLING.md`
- `@cloud-dog/api-client`
  - `packages/api-client/docs/FETCH-MIGRATION-COOKBOOK.md`
  - `packages/api-client/docs/CORRELATION-ID-GUIDE.md`
- `@cloud-dog/auth`
  - `packages/auth/docs/COOKIE-PROXY-GUIDE.md`
  - `packages/auth/docs/API-KEY-MODE-GUIDE.md`
  - `packages/auth/docs/MIXED-AUTH-MIGRATION.md`
  - `packages/auth/docs/IDAM-INTEGRATION.md`
- `@cloud-dog/shell`
  - `packages/shell/docs/PANEL-TO-ROUTE-MIGRATION.md`
- `@cloud-dog/testing`
  - `packages/testing/docs/PYTHON-MIGRATION-GUIDE.md`
  - `packages/testing/docs/MCP-PANEL-TESTING.md`
  - `packages/testing/docs/PARITY-CHECK-PATTERNS.md`

## Project scaffolds

Each scaffold is a starting point only. Projects should follow the checklist template before beginning migration.

- `apps/expert-agent/` (cookie proxy, operational console preset)
- `apps/sql-agent/` (cookie proxy, operational console preset)
- `apps/notification-agent/` (cookie proxy or OIDC, operational console preset)
- `apps/chat-client/` (API key, chat layout preset)
- `apps/file-mcp/` (API key, minimal shell preset)

## Checklist template

- `docs/migration/PROJECT-CHECKLIST.md`

