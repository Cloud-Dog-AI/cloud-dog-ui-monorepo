# @cloud-dog/config

Runtime configuration loader and validator.

## Primary entry point (non-React)

Use `getConfig()` to read `window.__RUNTIME_CONFIG__` and validate it with Zod.

```ts
import { getConfig, BaseRuntimeConfigSchema } from '@cloud-dog/config';

const cfg = getConfig(BaseRuntimeConfigSchema);
```

## React usage

If you want React context, wrap your app with `ConfigProvider` and use `useConfig()`.

```tsx
import { ConfigProvider } from '@cloud-dog/config';

<ConfigProvider>
  <App />
</ConfigProvider>
```

## Guides

- `docs/MIGRATION-FROM-API-CONFIG.md`
- `docs/SENSITIVE-CONFIG-HANDLING.md`
