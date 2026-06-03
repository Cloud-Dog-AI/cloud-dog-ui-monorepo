# Migration from /api/config to /runtime-config.js

This guide documents the recommended staged migration.

## Goal

Move from a runtime `fetch('/api/config')` call to a static bootstrap script:

- `/runtime-config.js` returns `window.__RUNTIME_CONFIG__ = {...}`

## Staged plan

1. Keep your existing `/api/config` endpoint.
2. Add `/runtime-config.js` serving `window.__RUNTIME_CONFIG__`.
3. Include the script tag in server-rendered templates:

```html
<script src="/runtime-config.js"></script>
```

4. Migrate consumers to `getConfig()`.
5. Remove `/api/config` once all consumers are migrated.

## Notes

- Runtime config must not include secrets.
- Secrets remain backend-only and are loaded from Vault.
