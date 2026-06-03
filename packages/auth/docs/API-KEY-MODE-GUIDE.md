# API key mode guide

This guide documents the lightweight API-key-only mode for services that do not require OIDC.

## When to use

- Small admin tools
- Chat clients that only need an API key
- File MCP consoles

## Adapter

Use the `createApiKeyAdapter()` adapter.

```ts
import { createApiKeyAdapter } from '@cloud-dog/auth';
```

The adapter stores the key in memory only and exposes it via `getAccessToken()` for header injection.

## UI prompt

Use `ApiKeyPrompt` for a simple sign-in form.

```tsx
import { ApiKeyPrompt } from '@cloud-dog/auth';

<ApiKeyPrompt />
```

## Security

- Do not store API keys in `localStorage` or `sessionStorage`.
- Prefer a short-lived service key and rotate on compromise.
