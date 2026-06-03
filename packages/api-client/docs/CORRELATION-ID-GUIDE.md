# Correlation ID guide

The API client automatically generates an `X-Request-Id` for each request.

To propagate a cross-service correlation ID, pass `correlationId` in request options.

```ts
client.get('/health', { correlationId: '...' })
```

Backends should log this value so browser-to-backend tracing is possible.
