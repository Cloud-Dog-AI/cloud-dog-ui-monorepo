# Testing standards

## Required suites
- Unit tests for shared packages
- E2E Playwright for each app:
  - auth (or test auth)
  - navigation
  - at least one CRUD journey
  - test console run
- Accessibility automation:
  - axe scans on key pages + dialogs + error states

## Determinism
- E2E must not depend on real external services.
- Use MSW mocks in dev/test, and Playwright route interception in E2E.
