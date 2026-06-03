# Build Instructions

## @cloud-dog/api-client

Type-safe HTTP API client with error handling.

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
npm run build --workspace=packages/api-client
```

### Build all packages
```bash
npm run build --workspaces --if-present
```

## Dependencies

| Dependency | Type | Purpose |
|-----------|------|---------|
| zod | production | Runtime schema validation for API responses |
| @cloud-dog/auth | peer | Authentication tokens and session context |
| @cloud-dog/config | peer | Runtime configuration (API base URLs) |
| react | peer | React runtime (provided by consuming application) |

## Development
```bash
npm install  # from monorepo root
npx tsc --noEmit --project packages/api-client/tsconfig.json
```

## Tests
```bash
npm run test --workspace=packages/api-client
```

## Publish
```bash
npm run build --workspace=packages/api-client
cd packages/api-client
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
