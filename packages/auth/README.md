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
- `SessionTimeoutProvider`
- API key and cookie adapters

## Example

```tsx
import { AuthProvider, LoginPage, SessionTimeoutProvider } from '@cloud-dog/auth';

<AuthProvider config={{ mode: 'cookie', apiBaseUrl: '/api/' }}>
  <SessionTimeoutProvider timeoutMinutes={30} warningMinutes={5}>
    <LoginPage appName="Cloud-Dog" mode="cookie" />
  </SessionTimeoutProvider>
</AuthProvider>
```

`LoginPage` exposes stable `cloud-dog-login-*` test IDs by default. Pass
`testIdPrefix` only when embedding the component in an isolated fixture.
