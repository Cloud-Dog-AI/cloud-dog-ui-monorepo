# W28K-1408 — Scheduler MCP WebUI / Platform Shell / Workflow Completion — DESIGN

Lane: **W28K-1408** (Phase 7, product completion: WebUI surfaces).
Branch: `w28k-1408-webui-completion` off `cloud-dog-ai-ui-monorepo` origin/main.
Consumes accepted **W28K-1407** backend (`/v1/runs`, approvals, chains, `/metrics`,
SQL IDAM, `/v1/auth/me` scopes) plus the **operator-authorized** W28K-1408 backend
addendum (run `retry`/`delete`/`dead_letter`; commit `170ed02` on
`scheduler-mcp-server` branch `w28k-1408-backend-jobsapi`). The operator lifted the
brief's "no backend edits" + "no preprod mutation" controls
("3. DELIVERY AND FIX all — manage around other projects … ensure all are merged to
main and deployed to latest and all functionality fixed"). All other controls hold
(STAY-IN-LANE to `apps/scheduler-mcp/` + `packages/idam/` + `scheduler-mcp-server/ui/dist/`;
Vault read-only; no silent waivers; 100% means 100%).

## Platform-resolution facts that shape the work

- `apps/scheduler-mcp/vite.config.ts` aliases **only** `@cloud-dog/ui` and
  `@cloud-dog/shell` to source. Every other `@cloud-dog/*` (incl. **idam**, auth,
  testing) resolves to the workspace package's built `dist/` (`main: dist/index.js`,
  `dist/` is gitignored). **F-1408-7 therefore requires rebuilding `packages/idam`
  (`tsc -p tsconfig.json`) before the scheduler app build/preview picks it up.**
- The `@cloud-dog/auth` **api_key** adapter (`packages/auth/src/adapters/api-key.ts`)
  builds `user` from static config only — it does **not** call `/v1/auth/me`. So
  `auth.user.permissions` is always empty in api_key mode. **Scope-aware CTA hide/show
  (F-1408-3) must fetch `/v1/auth/me` from the scheduler app** (AppState) and expose
  the real scopes. Backend `/v1/auth/me` → `{user:{api_key_id,username,scopes:[...]}}`.
- Backend RBAC: `Principal.has_scope` treats `schedules.admin` as a superuser (true for
  any scope). A genuine read-only principal carries only `schedules.read`. Minted SQL
  api-keys (POST `/v1/admin/api-keys` {scopes}) resolve with exactly their scopes →
  clean 401 (anon) / 403 (under-scoped) / 200 (admin). RBAC specs **self-seed** a
  read-only key via the admin api-keys endpoint; no pre-seeded fixtures needed.
- Canonical PS-76 reference: `apps/expert-agent/src/views/JobsPage.tsx` (722 lines).
  Adapted to the scheduler **run** model (`/v1/runs`, `ScheduleRunDto`) rather than a
  generic job queue. "Job" == schedule run.

## Deliverable → source → test traceability

| ID | Deliverable | Source edited | Tests |
|---|---|---|---|
| F-1408-1 | Jobs PS-76 Phase 4 (DataTable pagination 10/25/50/100, 7-tab detail dialog, Copy/Retry/Cancel/Delete row actions, Escape-close, dead-letter view, bulk Cancel/Retry/Delete w/ confirm, sort/filter/search) over `/v1/runs` | `src/views/JobsPage.tsx` (full rewrite), `src/lib/api.ts` (+retryRun/deleteRun/listRuns dead_letter/limit/status), `src/lib/types.ts` (+trigger_type/trigger_source_id/result_ref/error_summary) | `tests/17-jobs.spec.ts` (rewrite) |
| F-1408-2 | Schedules edit-mode dialog (EntityDialog mode="edit", pre-populate, `api.patchSchedule`, JSON spec round-trip) | `src/views/SchedulesPage.tsx` | `tests/02-schedules.spec.ts` (extend) |
| F-1408-3 | Negative-path RBAC: anon 401, read-only 403 on Create/Edit/Delete, scope-based CTA hide/show across Schedules/Chains/Runs/Context/Audit/Settings | `src/state/AppState.tsx` (+scopes via /v1/auth/me + `can()`), `src/views/{Schedules,Chains,Context}Page.tsx` (gate CTAs), `src/lib/rbac.ts` (helper) | `tests/{02,03,04,05,07,15}-*.spec.ts` (+RBAC UC), `tests/19-rbac-negative.spec.ts` (NEW backend-truth) |
| F-1408-4 | Full workflow E2E (login → create → trigger via UI → poll Runs → view results+audit → edit → delete) | — (spec only) | `tests/18-workflow-e2e.spec.ts` (NEW) |
| F-1408-5 | MCP/A2A console hardening: 10s SSE fetch timeout, ≤10-frame guard, malformed-JSON recovery (catch+display), adapter-failure error banner | `src/views/McpConsolePage.tsx`, `src/views/A2aConsolePage.tsx` | `tests/13-mcp-console.spec.ts`, `tests/14-a2a-console.spec.ts` (extend) |
| F-1408-6 | Settings reveal 403 spec (lacks settings.reveal/admin) | — (spec only) | `tests/15-settings.spec.ts` (+UC5) |
| F-1408-7 | IDAM API Keys owner string-id fix — owner ALWAYS string, never `Number(form.owner)` (shared `@cloud-dog/idam`) | `packages/idam/src/index.tsx` (rebuild dist) | `tests/10-idam-api-keys.spec.ts` (string-UUID round-trip) |
| F-1408-8 | Session timeout warning spec (30-min timeout + 5-min warning; provider already wired in App.tsx) | — (spec only) | `tests/conformance.spec.ts` (+UC4) |
| F-1408-9 | A11y suite — `@a11y` tagged, shell + 6 pages via `checkA11y` from `@cloud-dog/testing` | — (spec only) | `tests/a11y.spec.ts` (NEW) |
| F-1408-10 | dist-sync automation — `npm run sync-dist` → `../../../scheduler-mcp-server/ui/dist/`; README/CI hook; docker-build picks up current dist | `apps/scheduler-mcp/package.json`, `scripts/sync-dist.sh` (NEW), `README.md` | `dist-sync-replay.log` |
| NF-1408-1 | Inter-spec coverage report — route→spec→UC map, uncovered routes flagged | `scripts/coverage-report.sh` (NEW) | `coverage-report.md` |

## Component contracts used (from @cloud-dog/ui, source-aliased)

- `DataTable<T>`: `selectable`, `bulkActions: BulkAction[]`, `onBulkAction(action, ids)`,
  `getRowId`, `getRowName`, `getSelectionLabel`, `page/pageSize/pageSizeOptions/onPageChange/onPageSizeChange`,
  `columnPickerEnabled`, `tableId`, `emptyMessage`, `selectionColumnPosition`. `DataColumn<T>`
  = `{id, header, cell, sortable?, sortValue?}`. `BulkAction` = `{label, action}`.
- `EntityDialog` form mode: `{open,onOpenChange,title,fields,values,onChange,onSubmit,onCancel,mode,submitLabel}`.
  `EntityFieldDef` = `{name,label,type:"text"|"number"|"boolean"|"select"|"multiselect"|"textarea",required?,options?,readOnly?,rows?,placeholder?}`.
  `EntityFormMode` = `"add"|"edit"|"view"`.
- `Dialog` (generic modal, `{open,onOpenChange,label,children}`), `Tabs/TabsList/TabsTrigger/TabsContent`,
  `JsonBlock` (`{title,value,defaultCollapsed,copyAriaLabel}`), `MetricCard`, `Badge`, `StatusBadge`,
  `RelativeTime`, `Input`, `Select`, `Button`, `Spinner`, `Card/CardHeader/CardContent`.
- `checkA11y(page, {disableRules?})` from `@cloud-dog/testing` (wraps @axe-core/playwright).
- `@cloud-dog/auth`: `SessionTimeoutProvider(timeoutMinutes,warningMinutes)` renders a
  `role="alertdialog"` "Session expiring soon" / "Your session will expire in MM:SS." +
  "Stay signed in" button. `useAuth()` → `{isAuthenticated,isLoading,login,logout,getAccessToken,user,error}`.

## Backend endpoints consumed

- `GET /v1/runs?schedule_id&status&dead_letter&limit&offset` (1407 + 1408 dead_letter/limit/status)
- `GET /v1/runs/{id}` ; `POST /v1/runs` (trigger, scope run_now) ; `POST /v1/runs/{id}/cancel` (scope write)
- `POST /v1/runs/{id}/retry` (1408, scope run_now) ; `DELETE /v1/runs/{id}` (1408, scope admin)
- `/v1/schedules` CRUD ; `/v1/auth/me` (scopes) ; `/v1/admin/api-keys` (mint scoped keys for RBAC specs)

## Implementation order (brief Phase B→C→D→E→F)

B: F-1408-7 → F-1408-2 → F-1408-1 → F-1408-5 → F-1408-10/NF-1408-1.
C: F-1408-3 → F-1408-6 → F-1408-8 → F-1408-9 → F-1408-4.
D: build idam dist → build scheduler app → vite preview (proxy → local docker scheduler-mcp-server :latest on 18080) → full Playwright green, only accepted anon /auth/me 401 baseline.
E: §0A pack + lane validator + platform validator, both PASS=0, clean-clone replay.
F: `npm run sync-dist` → backend `ui/dist/`; docker-build picks up bundle.

## Self-assurance stop conditions

Per brief table: any unmapped row, any consumer-app PW break after F-1408-7, any spec
FAIL on local docker, any unexpected console error (beyond accepted anon `/auth/me` 401),
any validator non-PASS → STOP, do not return YES.
