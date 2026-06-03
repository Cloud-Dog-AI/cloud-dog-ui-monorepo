# Accessibility Evidence Log

Use this document to record manual accessibility evidence that complements automated axe checks.

## Scope
- Repository: `cloud-dog-ai-ui-monorepo`
- WCAG target: 2.x AA
- Automated checks: Playwright + axe (`npm run a11y`)

## Evidence Template

### Date
- YYYY-MM-DD

### App / Route
- App: `apps/<name>`
- Route: `<path>`
- State: `<default|error|dialog-open|mobile|desktop>`

### Keyboard checks
- Tab order correct: PASS/FAIL
- Visible focus indicators: PASS/FAIL
- No keyboard trap: PASS/FAIL
- Skip links/landmarks (if applicable): PASS/FAIL

### Screen reader checks
- Page title and headings are meaningful: PASS/FAIL
- Form labels and descriptions announced: PASS/FAIL
- Error messages announced and discoverable: PASS/FAIL
- Live regions for async updates announced: PASS/FAIL

### Colour and motion checks
- Contrast meets AA in light theme: PASS/FAIL
- Contrast meets AA in dark theme: PASS/FAIL
- `prefers-reduced-motion` respected: PASS/FAIL

### Notes
- Any deviations, defects, or follow-up tasks.

## Latest run summary
- `npm run a11y`: PASS/FAIL
- `npm run e2e`: PASS/FAIL
- Reviewer: `<name>`
