# Cookie proxy guide

This guide documents the cookie-session proxy pattern used by server-rendered backends.

## Endpoints

Typical endpoints exposed by the backend proxy:

- `POST /web/auth/login`
- `POST /web/auth/logout`
- `GET /web/auth/status`

## Cookie requirements

- `HttpOnly`: required
- `Secure`: required in production
- `SameSite`: prefer `Lax` unless cross-site

## Frontend adapter

Use `createCookieAdapter()` with `credentials: 'include'` so the browser sends cookies.
