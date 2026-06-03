# Changelog

## 0.2.0

- Extend `User` type with optional `username`, `groups[]`, and `lastLogin` fields
  to satisfy the `@cloud-dog/shell` `ProfileDialog` contract (W28A #33). Existing
  consumers are unaffected because all new fields are optional.
- Extend `AuthConfig.apiKey` with optional `username` and `groups` defaults so
  the api-key adapter can populate the new `User` fields without a server
  round-trip.
- `createApiKeyAdapter` now populates `username`, `groups[]`, and `lastLogin`
  (set to the login timestamp) on the returned `User`.

## 0.1.0

- Initial packaged release of @cloud-dog/auth
- Added publication metadata and required monorepo publishing files
