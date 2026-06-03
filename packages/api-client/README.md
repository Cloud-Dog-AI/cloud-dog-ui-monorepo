# @cloud-dog/api-client

Shared HTTP, streaming, and MCP client primitives for Cloud-Dog web applications.

## Install

```bash
npm install @cloud-dog/api-client
```

## Exports

- `createApiClient`
- `createProxyClient`
- `ApiError`
- request correlation and streaming helpers

## Example

```ts
import { createApiClient } from '@cloud-dog/api-client';

const client = createApiClient({ baseUrl: '/api/', credentials: 'include' });
const health = await client.get('/health');
```
