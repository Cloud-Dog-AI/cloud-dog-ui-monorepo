# Chat Client (React UI)

React frontend for the Cloud-Dog chat client backend.

## Features
- API key sign-in (session storage persistence)
- Persistent session sidebar and session management
- Streaming chat responses (JSON Lines stream)
- MCP server health and per-session selection
- MCP tool browser with JSON argument execution
- Settings page with redacted global config view
- Right-side activity drawer (health + tool execution history)

## Runtime Configuration
`public/runtime-config.js` supplies runtime values:

```js
window.__RUNTIME_CONFIG__ = {
  ENV: 'dev',
  API_BASE_URL: 'http://localhost:5175/api/',
  AUTH_MODE: 'api_key',
  API_KEY_HEADER: 'X-API-Key',
  APP_VERSION: 'dev'
};
```

`API_BASE_URL` points to the Vite proxy path. The Vite server proxies `/api/*` to the backend API target.

## Local Development
1. Start backend API (from `chat-client` repo):

```bash
cd <your-workspace>/chat-client
PYTHONPATH=src python3 -m cloud_dog_chat_client.cli api --env private/env-at1-14-search-news-hungarian-bridge
```

2. Start UI app (from monorepo root):

```bash
cd <your-workspace>/cloud-dog-ui-monorepo
CHAT_CLIENT_API_PROXY_TARGET=http://127.0.0.1:8090 npm run dev --workspace @cloud-dog/app-chat-client
```

3. Open `http://localhost:5175`.

## Validation Commands
From `cloud-dog-ai-ui-monorepo`:

```bash
npm run lint --workspace @cloud-dog/app-chat-client
npm run typecheck --workspace @cloud-dog/app-chat-client
npm run build --workspace @cloud-dog/app-chat-client
npm run e2e --workspace @cloud-dog/app-chat-client
```

Optional E2E overrides:

```bash
E2E_API_BASE_URL=http://localhost:5175/api/ E2E_API_KEY=dev-key npm run e2e --workspace @cloud-dog/app-chat-client
```

## Pages
- `/chat` — chat timeline, stream send, MCP selection
- `/sessions` — create/list/switch/delete sessions
- `/mcp-servers` — health check and session activation
- `/tools` — list tools and execute via MCP
- `/settings` — API key, theme, model preference, global config tree
