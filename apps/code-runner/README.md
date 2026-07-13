---
template-id: T-APP-RME
template-version: 1.0
applies-to: apps/<name>/README.md
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

# code-runner

> **Template version:** T-APP-RME v1.0

## What it is
UI app for code-runner.

## Quick start
```bash
turbo dev --filter=code-runner
```

## Backend
Calls code-runner via `@cloud-dog/api-client`.

## Docs
- [CHANGELOG.md](CHANGELOG.md), [TESTS.md](TESTS.md)
