# Build Instructions

## @cloud-dog/auth

Authentication -- login page, session management, RBAC guards.

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
npm run build --workspace=packages/auth
```

### Build all packages
```bash
npm run build --workspaces --if-present
```

## Dependencies

| Dependency | Type | Purpose |
|-----------|------|---------|
| @cloud-dog/tokens | production | Design tokens for styled auth components |
| @cloud-dog/ui | production | Shared UI components (Button, Input, etc.) |
| react | production | React runtime for component rendering |
| zod | production | Schema validation for auth payloads |
| @cloud-dog/config | peer | Runtime configuration (auth endpoints) |
| react-router-dom | peer | Routing for login redirects and guards |

## Development
```bash
npm install  # from monorepo root
npx tsc --noEmit --project packages/auth/tsconfig.json
```

## Tests
```bash
npm run test --workspace=packages/auth
```

## Publish
```bash
npm run build --workspace=packages/auth
cd packages/auth
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
