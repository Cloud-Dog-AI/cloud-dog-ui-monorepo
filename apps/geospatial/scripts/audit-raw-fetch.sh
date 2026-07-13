#!/usr/bin/env bash
# GE-DEF-012 / CSR-001: the geospatial app must NOT call the raw fetch() API in
# its views/routes — all transport goes through @cloud-dog/api-client (lib/api.ts
# surfaceGet/surfacePost/mcpCall/a2aTask/serviceHealth). rc=0 means zero raw fetch.
set -euo pipefail
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Match a real fetch( call (window.fetch / bare fetch), excluding property access
# like ".fetch(" (e.g. node-fetch wrappers, none here) and comments referencing it.
hits=$(grep -rnE '(^|[^.[:alnum:]_])fetch\(' \
  "$APP_DIR/src/views" "$APP_DIR/src/routes" "$APP_DIR/src/components" "$APP_DIR/src/lib" "$APP_DIR/src/state" \
  2>/dev/null | grep -vE '//.*fetch\(|\*.*fetch\(' || true)

if [[ -n "$hits" ]]; then
  echo "FAIL: raw fetch() found in geospatial app source (use @cloud-dog/api-client):"
  echo "$hits"
  exit 1
fi
echo "PASS: 0 raw fetch() calls in apps/geospatial/src (GE-DEF-012 / CSR-001)"
exit 0
