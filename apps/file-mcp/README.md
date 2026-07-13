# File MCP UI App

`apps/file-mcp` is the React frontend for `file-mcp-server`.

## Development

From the monorepo root:

```bash
npm run dev -- --filter=@cloud-dog/app-file-mcp
```

Default app URL: `http://127.0.0.1:5174`

The app reads runtime values from `public/runtime-config.js`.
For service-integrated local runs, Vite proxies `/runtime-config.js` to the backend
(`FILE_MCP_RUNTIME_CONFIG_PROXY=true` by default).

## Runtime configuration

`window.__RUNTIME_CONFIG__` must include:

- `ENV`
- `API_BASE_URL`
- `AUTH_MODE` (use `api_key`)
- `AUDIT_LOG_PATH`
- `DEFAULT_BROWSE_PATH`
- `PROFILE_STORE_PATH`

Example defaults are in:

- `apps/file-mcp/public/runtime-config.js`
- `apps/file-mcp/public/runtime-config.example.js`

## Backend requirements

Run `file-mcp-server` with streamable HTTP enabled and the MCP endpoint available at `/mcp`.

Example used by Playwright:

```bash
cd file-mcp-server
./server_control.sh --env tests/env-ST serve
```

## Build

From the monorepo root:

```bash
npm run build -- --filter=@cloud-dog/app-file-mcp
```

## Lint and typecheck

From the monorepo root:

```bash
npm run lint -- --filter=@cloud-dog/app-file-mcp
npm run typecheck -- --filter=@cloud-dog/app-file-mcp
```

## Tests

From the monorepo root:

```bash
npm run e2e -- --filter=@cloud-dog/app-file-mcp
npm run a11y -- --filter=@cloud-dog/app-file-mcp
```

Playwright starts:

1. `file-mcp-server` via `server_control.sh --env tests/env-ST serve`
2. Vite dev server for `apps/file-mcp`

## Pages

- Dashboard
- File Browser
- Search
- Storage Profiles
- Audit Log
- Settings
