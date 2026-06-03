# @cloud-dog/auth

Reusable authentication primitives for Cloud-Dog web applications.

## Install

```bash
npm install @cloud-dog/auth
```

## Exports

- `AuthProvider`
- `useAuth`
- `LoginPage`
- `RequireAuth`
- API key and cookie adapters

## Example

```tsx
import { AuthProvider, LoginPage } from '@cloud-dog/auth';

<AuthProvider config={{ mode: 'cookie', apiBaseUrl: '/api/' }}>
  <LoginPage appName="Cloud-Dog" mode="cookie" />
</AuthProvider>
```
