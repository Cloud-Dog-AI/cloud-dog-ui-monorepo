# Build Instructions

## @cloud-dog/config

Runtime configuration provider (reads window.__RUNTIME_CONFIG__).

This package is part of the [Cloud-Dog AI UI Monorepo](https://github.com/Cloud-Dog-AI/cloud-dog-ui-monorepo).

## Prerequisites

- Node.js 20+
- npm 10+

## Build

### From the monorepo (recommended)
```bash
git clone https://github.com/Cloud-Dog-AI/cloud-dog-ui-monorepo.git
cd cloud-dog-ui-monorepo
npm install
npm run build --workspace=packages/config
```

### Build all packages
```bash
npm run build --workspaces --if-present
```

## Dependencies

| Dependency | Type | Purpose |
|-----------|------|---------|
| zod | production | Schema validation for configuration values |
| react | peer | React runtime (provided by consuming application) |
| react-dom | peer | React DOM renderer (provided by consuming application) |

## Development
```bash
npm install  # from monorepo root
npx tsc --noEmit --project packages/config/tsconfig.json
```

## Tests
```bash
npm run test --workspace=packages/config
```

## Publish
```bash
npm run build --workspace=packages/config
cd packages/config
npm publish
```

## Related Packages

| Package | Description |
|---------|-------------|
| @cloud-dog/tokens | Design tokens and theme |
| @cloud-dog/ui | Shared UI components |
| @cloud-dog/shell | Application shell and navigation |
| @cloud-dog/auth | Authentication (login, session, RBAC) |
| @cloud-dog/api-client | HTTP API client |
| @cloud-dog/config | Runtime configuration |
| @cloud-dog/testing | Test utilities (Playwright, axe) |

---

Copyright 2026 [Cloud-Dog](https://www.cloud-dog.ai), Viewdeck Engineering Limited
