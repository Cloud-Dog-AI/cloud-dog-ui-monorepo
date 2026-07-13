# Scheduler MCP UI App

`apps/scheduler-mcp` is the React frontend for `scheduler-mcp-server` — schedules,
chains, runs, jobs, context, registry, audit, IDAM admin, MCP/A2A consoles and
settings, built entirely on the shared `@cloud-dog/*` packages (PS-72/73/76/77).

## Development

From the monorepo root:

```bash
npm run dev -- --filter=@cloud-dog/app-scheduler-mcp
```

Default app URL: `http://127.0.0.1:5174`

The app reads runtime values from `public/runtime-config.js`. For service-integrated
local runs Vite proxies `/runtime-config.js` and the `/api`, `/mcp`, `/a2a`, `/auth`,
`/.well-known` surfaces to the backend (`SCHEDULER_MCP_API_PROXY_TARGET`, default
`http://127.0.0.1:18080`).

## Runtime configuration

`window.__RUNTIME_CONFIG__` must include `ENV`, `API_BASE_URL`, `AUTH_MODE`
(use `api_key`), and the MCP/A2A base URLs. Example defaults:

- `apps/scheduler-mcp/public/runtime-config.js`
- `apps/scheduler-mcp/public/runtime-config.example.js`

## Build / lint / typecheck

```bash
npm run build     -w @cloud-dog/app-scheduler-mcp
npm run lint      -w @cloud-dog/app-scheduler-mcp
npm run typecheck -w @cloud-dog/app-scheduler-mcp
```

## Tests

```bash
npm run e2e  -w @cloud-dog/app-scheduler-mcp     # full Playwright suite
npm run a11y -w @cloud-dog/app-scheduler-mcp     # @a11y axe-core suite
```

Playwright targets `E2E_BASE_URL` (default `http://127.0.0.1:8080`) which must
front a running `scheduler-mcp-server` (the Vite preview proxy at `:5174` →
backend `:18080` is the canonical local wiring). Sign-in uses an api-key
(`E2E_API_KEY`, default `smoke-token`) seeded as the backend bootstrap admin
token. RBAC negative specs self-mint read-only keys via `/v1/admin/api-keys`.

## Embedded SPA / dist sync (F-1408-10)

The backend embeds this SPA bundle (`scheduler-mcp-server/Dockerfile`: `COPY ui /app/ui`).
After building the app, mirror `dist/` into the backend and regenerate the
checksum manifest:

```bash
npm run sync-dist -w @cloud-dog/app-scheduler-mcp
# or, for an isolated checkout / worktree:
SCHEDULER_MCP_SERVER_DIR=/abs/path/scheduler-mcp-server \
  npm run sync-dist -w @cloud-dog/app-scheduler-mcp
```

`sync-dist` builds the app, mirrors `dist/` → `scheduler-mcp-server/ui/dist/`,
regenerates `MANIFEST.sha256`, and replay-verifies it. It is the monorepo-side
mirror of the backend's canonical `scheduler-mcp-server/scripts/sync-ui-dist.sh`
and produces a byte-identical `ui/dist`.

**CI hook.** In the UI pipeline, run `npm run sync-dist` immediately after the app
build and **before** the backend image build, then commit `scheduler-mcp-server/ui/dist`
so the image embeds the current WebUI:

```
build:ui      -> npm run build -w @cloud-dog/app-scheduler-mcp
sync:ui-dist  -> npm run sync-dist -w @cloud-dog/app-scheduler-mcp   # mirrors + manifests
commit:ui     -> git -C scheduler-mcp-server add ui/dist && commit
build:image   -> scheduler-mcp-server: docker-build.sh latest --variant dev
```

## Inter-spec coverage (NF-1408-1)

```bash
npm run coverage-report -w @cloud-dog/app-scheduler-mcp -- coverage-report.md
```

Emits a route → spec → UC map and flags any routed page with no covering spec.

## Pages

Dashboard · Schedules · Chains · Runs · Context · Registry · Audit log ·
IDAM (Users/Groups/API Keys/Roles/RBAC) · API Docs · MCP Console · A2A Console ·
Jobs · Settings · About
