---
template-id: T-APP-TST
template-version: 1.0
applies-to: apps/<name>/TESTS.md
registry: ui-monorepo
required: must-have
when-applicable: ""
template-last-updated: 2026-06-12
template-owner: platform-standards

project: code-runner
doc-last-updated: 2026-06-12
doc-git-commit: no-git
doc-git-branch: main
doc-source-shas: []
doc-age-policy: 90d
doc-conformance-stamp: 2026-06-12T12:00:00Z
---

# code-runner — TESTS

> **Template version:** T-APP-TST v1.0

## 1. Suites
Vitest / playwright suites and what they cover.

## 2. Running
```bash
turbo test --filter=code-runner
```

## 3. Cross-references
- backend `docs/TESTS.md` for E2E pairs
