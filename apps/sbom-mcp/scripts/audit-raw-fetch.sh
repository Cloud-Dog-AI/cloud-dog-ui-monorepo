#!/usr/bin/env bash
# Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
# Licensed under the Apache License 2.0
#
# W28S-2006 Lane F — F-D5: raw-fetch audit (instruction §3 F-D5; DEF-003 / DEF-006 /
# WSC-008 / CSR-016). The sbom-mcp WebUI MUST route transport through the shared
# @cloud-dog/api-client, never a bare window.fetch() in view or state code. This script
# asserts there is ZERO direct `fetch(` in src/views/ and src/state/ (method calls like
# `client.fetch(` are excluded by the leading-boundary class, matching the gap-report
# reproducer). rc=0 = clean.
set -u

# Run from the app root regardless of caller cwd.
cd "$(dirname "$0")/.." || exit 2
APP_ROOT="$(pwd)"

PATTERN='(^|[^.])fetch\('
TARGETS=(src/views src/state)

echo "W28S-2006 F-D5 raw-fetch audit"
echo "app_root: ${APP_ROOT}"
echo "pattern : ${PATTERN}"
echo "targets : ${TARGETS[*]}"
echo "----------------------------------------"

hits="$(grep -rnE "${PATTERN}" "${TARGETS[@]}" 2>/dev/null || true)"

if [ -n "${hits}" ]; then
  echo "RAW_FETCH_HITS:"
  echo "${hits}"
  count="$(printf '%s\n' "${hits}" | grep -c . )"
  echo "----------------------------------------"
  echo "RESULT: FAILED — ${count} raw fetch( call(s) in src/views/ + src/state/ (use @cloud-dog/api-client)"
  exit 1
fi

echo "RESULT: PASS — 0 raw fetch( calls in src/views/ + src/state/ (transport via @cloud-dog/api-client)"
exit 0
