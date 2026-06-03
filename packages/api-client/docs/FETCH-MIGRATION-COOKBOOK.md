# Fetch migration cookbook

This cookbook helps migrate from ad-hoc `fetch()` usage to `@cloud-dog/api-client`.

## Recommended steps

1. Identify all `fetch()` callsites.
2. Define endpoint helpers (path, method, schema).
3. Replace one callsite at a time.
4. Add correlation IDs.
5. Add error mapping and retries where appropriate.

## Notes

- Use `createProxyClient()` for same-origin backends exposing a `/web/api` proxy.
- Keep `baseUrl` configuration in runtime config.
