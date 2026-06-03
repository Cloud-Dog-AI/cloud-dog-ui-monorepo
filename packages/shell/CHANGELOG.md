# Changelog

## 0.2.0

- `AboutDialog`: add five `data-testid` attributes (`about-product-name`,
  `about-version`, `about-description`, `about-company`, `about-website`) to
  satisfy the W28A #22 §3 / #23 contract assertions. API surface, defaults,
  and rendered DOM otherwise unchanged.
- Add new `ProfileDialog` component bound to `@cloud-dog/auth` `useAuth()`.
  Renders the canonical Profile contract: `username`, `displayName`, `email`,
  `groups[]` (list-aria), `roles[]` (list-aria), `lastLogin`, and a "Sign out"
  button. Seven `data-testid` attributes: `profile-username`,
  `profile-display-name`, `profile-email`, `profile-groups`, `profile-roles`,
  `profile-last-login`, `profile-logout`. Renders NO `about-*` testids.
- Bump dependency `@cloud-dog/auth` peer to `^0.2.0` (which adds optional
  `username`, `groups[]`, `lastLogin` to `User`).
- Decision recorded in W28A-#33 report: `AboutDialog` modal is the canonical
  About surface. Per-service route-page About implementations (e.g.
  `apps/expert-agent/src/views/AboutPage.tsx`) are to be removed in a follow-on
  per-service instruction (NOT in this package release).

## 0.1.0

- Initial packaged release of @cloud-dog/shell
- Added publication metadata and required monorepo publishing files
