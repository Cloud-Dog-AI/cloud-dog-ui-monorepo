# Build Instructions

## @cloud-dog/tokens

Design tokens, colour palette, typography, and Tailwind CSS preset.

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
npm run build --workspace=packages/tokens
```

### Build all packages
```bash
npm run build --workspaces --if-present
```

## Dependencies

| Dependency | Type | Purpose |
|-----------|------|---------|
| tailwindcss | production | Utility-first CSS framework for token generation |

## Development
```bash
npm install  # from monorepo root
npx tsc --noEmit --project packages/tokens/tsconfig.json
```

## Tests
```bash
npm run test --workspace=packages/tokens
```

## Publish
```bash
npm run build --workspace=packages/tokens
cd packages/tokens
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
