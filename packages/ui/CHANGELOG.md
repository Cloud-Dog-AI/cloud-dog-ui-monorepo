# Changelog

## 0.3.1 (2026-05-06)

### Bug Fixes

- **ApiDocsPanel:** Lazy-load `redoc` via `React.lazy()` with a Rollup-opaque dynamic import so that `mobx` and `styled-components` (transitive dependencies of redoc) are not resolved at build time. Apps using `mode="swagger"` or `mode="iframe"` no longer require redoc's dependency tree to be installed. Fixes monorepo build failures in `app-console`, `app-chat-client`, and other apps that import from `@cloud-dog/ui`.

## 0.3.0

- Prior release (ApiDocsPanel with tabs, MCP Tools, A2A Skills, README surfaces)
