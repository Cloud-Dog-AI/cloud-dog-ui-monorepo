# Mixed auth migration

This guide documents a staged migration from cookie proxy auth to OIDC without a big-bang cutover.

## Recommended staged plan

1. Keep cookie proxy auth as the default.
2. Add OIDC configuration behind a feature flag.
3. Run both harnesses in parallel in dev and staging.
4. Validate parity (routes, permissions, session expiry).
5. Switch the default to OIDC.
6. Remove the cookie proxy fallback once all consumers are migrated.
