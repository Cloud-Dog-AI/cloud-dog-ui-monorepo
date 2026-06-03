# Migration Checklist — <project-name>

## Pre-migration

- [ ] Map current UI pages/panels to target routes
- [ ] Document current auth flow (cookie/OIDC/key)
- [ ] Document current API endpoints used by UI
- [ ] Identify existing browser E2E tests as parity gates
- [ ] Create `runtime-config.js` endpoint on backend

## Phase A — Scaffold

- [ ] App created in monorepo
- [ ] Shell preset selected and configured
- [ ] Auth adapter configured
- [ ] Runtime config wired
- [ ] Smoke E2E passes
- [ ] Axe a11y scan passes

## Phase B — Core Migration

- [ ] Navigation routes match current panels
- [ ] Auth flow works (login/logout/session)
- [ ] API client configured with correct base URL
- [ ] First CRUD page ported and tested

## Phase C — Full Parity

- [ ] All pages/panels ported
- [ ] E2E parity with legacy UI tests
- [ ] Component tests for shared behaviours
- [ ] Accessibility checks on all routes
- [ ] Performance baseline established

## Phase D — Cutover

- [ ] Legacy UI disabled behind feature flag
- [ ] Production deployment validated
- [ ] Legacy UI code removed

