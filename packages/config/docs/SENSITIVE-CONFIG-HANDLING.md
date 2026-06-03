# Sensitive config handling

Runtime config is visible to any user who can load the UI.

## Rules

- Do not expose secrets in `runtime-config.js`.
- Backend-only values remain in Vault and are never sent to browsers.

## warnIfSecrets()

Use `warnIfSecrets()` during development to detect accidental exposure.

## Admin UI patterns

- Display sensitive keys as masked values.
- Separate "view" vs "edit" mode.
- Avoid printing runtime config in logs.
