# Build Instructions

## @cloud-dog/shell

Application shell with navigation rail, top bar, and layout.

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
npm run build --workspace=packages/shell
```

### Build all packages
```bash
npm run build --workspaces --if-present
```

## Dependencies

| Dependency | Type | Purpose |
|-----------|------|---------|
| @cloud-dog/ui | production | Shared UI components used in shell layout |
| @cloud-dog/tokens | production | Design tokens for shell styling |
| @cloud-dog/auth | production | Authentication state and RBAC for navigation |
| react | production | React runtime for component rendering |
| react-router-dom | peer | Routing for navigation rail and layout outlets |

## Development
```bash
npm install  # from monorepo root
npx tsc --noEmit --project packages/shell/tsconfig.json
```

## Tests
```bash
npm run test --workspace=packages/shell
```

## Publish
```bash
npm run build --workspace=packages/shell
cd packages/shell
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
