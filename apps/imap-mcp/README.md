# IMAP MCP UI App

`apps/imap-mcp` is the React frontend for `imap-mcp-server`.

## Development

From the monorepo root:

```bash
npm run dev -- --filter=@cloud-dog/app-imap-mcp
```

Default app URL: `http://127.0.0.1:5174`

The app reads runtime values from `public/runtime-config.js`.

## Runtime configuration

`window.__RUNTIME_CONFIG__` must include:

- `ENV`
- `API_BASE_URL`
- `AUTH_MODE` (use `api_key`)
- `UI_BASE_PATH` (use `/ui`)

Example defaults are in:

- `apps/imap-mcp/public/runtime-config.js`
- `apps/imap-mcp/public/runtime-config.example.js`

## Backend requirements

Run `imap-mcp-server` with the API endpoint available at `/api/v1` and MCP at `/mcp`.

Example used by Playwright:

```bash
cd <your-workspace>/imap-mcp-server
./server_control.sh --env tests/env-ST serve
```

## Build

From the monorepo root:

```bash
npm run build -- --filter=@cloud-dog/app-imap-mcp
```

## Lint and typecheck

From the monorepo root:

```bash
npm run lint -- --filter=@cloud-dog/app-imap-mcp
npm run typecheck -- --filter=@cloud-dog/app-imap-mcp
```

## Tests

From the monorepo root:

```bash
npm run e2e -- --filter=@cloud-dog/app-imap-mcp
npm run a11y -- --filter=@cloud-dog/app-imap-mcp
```

Playwright starts:

1. `imap-mcp-server` via `server_control.sh --env tests/env-ST serve`
2. Vite dev server for `apps/imap-mcp`

## Pages

- Dashboard
- File Browser
- Search
- Storage Profiles
- Audit Log
- Settings
