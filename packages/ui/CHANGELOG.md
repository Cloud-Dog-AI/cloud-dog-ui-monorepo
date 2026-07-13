# Changelog

## 0.4.0 (2026-06-07)

### Features (additive — no breaking changes to v0.3.x consumers)

- **SelectionCriteriaPanel** (`patterns/`): single reusable Profile / Workspace / Ref-type / Ref-name / Path / Author / Since / Until / Stash selector. Cascading async `sources`, iconography, `inline`/`card`/`compact` variants, derived read-only Repo Source, `sessionStorage` selection persistence (`loadPersistedSelection(appName)`), and an "View audit for this selection" hook. Replaces the per-page-rebuilt selector proto across service WebUIs (W28J-1303).
- **DatePicker** + **DateRangePicker** (`components/input/`): accessible native-`<input type="date">`-based pickers with ISO `YYYY-MM-DD` round-trip (`toISODate`/`fromISODate`), `min`/`max`, and cross-constrained range. No new runtime dependency.
- **useAuditLink** (`hooks/`): builds relative `/audit?…` deep links (`linkToCorrelation`/`linkToEntity`/`linkToUser`/`linkToWorkspace`/`linkToProfile`/`linkToJob`) for the cross-page audit-linkage pattern (W28J-1304).

### Tests

- 31 new unit tests (vitest + @testing-library/react): SelectionCriteriaPanel ×12, DatePicker ×9, DateRangePicker ×4, useAuditLink ×6. Full package suite green (229 passed).

## 0.3.1 (2026-05-06)

### Bug Fixes

- **ApiDocsPanel:** Lazy-load `redoc` via `React.lazy()` with a Rollup-opaque dynamic import so that `mobx` and `styled-components` (transitive dependencies of redoc) are not resolved at build time. Apps using `mode="swagger"` or `mode="iframe"` no longer require redoc's dependency tree to be installed. Fixes monorepo build failures in `app-console`, `app-chat-client`, and other apps that import from `@cloud-dog/ui`.

## 0.3.0

- Prior release (ApiDocsPanel with tabs, MCP Tools, A2A Skills, README surfaces)
