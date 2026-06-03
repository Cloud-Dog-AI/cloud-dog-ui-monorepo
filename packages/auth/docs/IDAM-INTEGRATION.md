# IDAM integration

This guide documents how frontend permission checks map to the backend `cloud_dog_idam` model.

## Permissions

Use `resource:action` permission strings, for example:

- `users:read`
- `users:write`
- `groups:read`
- `groups:write`
- `admin:all`

## Frontend guard

Use `RequirePermission` to protect routes.

```tsx
<RequirePermission permission="users:write">
  <UsersAdmin />
</RequirePermission>
```
