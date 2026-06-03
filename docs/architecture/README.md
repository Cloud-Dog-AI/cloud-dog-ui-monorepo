# Architecture

## Packages
- `@cloud-dog/tokens`: Design tokens + Tailwind preset (light/dark).
- `@cloud-dog/ui`: Shared component library (tokens + accessibility baked in).
- `@cloud-dog/shell`: App shell layout, navigation rail, top bar, command palette hook.
- `@cloud-dog/auth`: Auth UI and provider adapters (OIDC/OAuth2, PKCE).
- `@cloud-dog/api-client`: Typed client, correlation IDs, error mapping, retries.
- `@cloud-dog/config`: Runtime config loader (env/tenant aware).
- `@cloud-dog/testing`: Playwright fixtures + axe helpers + MSW helpers.

## App integration contract
Each app must export:
- `routes`: route definitions + nav metadata
- `mount(container, options)`: for embedding into a consolidator host
- `AppRoot`: standalone root

The shell consumes route metadata and renders consistent layout.
