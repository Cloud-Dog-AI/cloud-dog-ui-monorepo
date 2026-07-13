#!/usr/bin/env bash
# Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
# Licensed under the Apache License, Version 2.0
#
# W28K-1408 F-1408-10 — dist sync automation (frontend side).
#
# Builds the scheduler-mcp SPA and mirrors its dist/ into the backend's embedded
# SPA root (scheduler-mcp-server/ui/dist), regenerating + replay-verifying
# MANIFEST.sha256. The backend Dockerfile `COPY ui /app/ui` ships this bundle, so
# running this before the backend image build guarantees the image embeds the
# current WebUI. runtime-config.js is emitted from public/ by vite, so the
# deployed runtime config travels with the bundle.
#
# This is the monorepo-side mirror of the canonical backend script
# scheduler-mcp-server/scripts/sync-ui-dist.sh and produces a byte-identical
# ui/dist + MANIFEST.sha256.
#
# Usage:
#   npm run sync-dist                                   # build + sync
#   SKIP_BUILD=1 npm run sync-dist                      # sync existing dist/
#   SCHEDULER_MCP_SERVER_DIR=/abs/path npm run sync-dist # explicit backend dir
#
# CI hook: in the UI pipeline run `npm run sync-dist` after the app build, then
# commit scheduler-mcp-server/ui/dist before the backend image build
# (see README.md "Embedded SPA / dist sync").
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
DIST_DIR="${APP_DIR}/dist"

# Default: the sibling scheduler-mcp-server checkout (…/cloud-dog-ai/scheduler-mcp-server).
# Overridable for isolated worktrees / CI via SCHEDULER_MCP_SERVER_DIR.
BACKEND_DIR="${SCHEDULER_MCP_SERVER_DIR:-$(cd "${APP_DIR}/../../../scheduler-mcp-server" 2>/dev/null && pwd || true)}"

if [[ -z "${BACKEND_DIR}" || ! -d "${BACKEND_DIR}" ]]; then
  echo "ERROR: scheduler-mcp-server dir not found. Set SCHEDULER_MCP_SERVER_DIR=/abs/path." >&2
  exit 2
fi

TARGET_DIR="${BACKEND_DIR}/ui/dist"

if [[ "${SKIP_BUILD:-0}" != "1" ]]; then
  echo "[sync-dist] building scheduler-mcp SPA…"
  ( cd "${APP_DIR}" && npm run build )
fi

if [[ ! -f "${DIST_DIR}/index.html" ]]; then
  echo "ERROR: build did not produce ${DIST_DIR}/index.html — run the build first." >&2
  exit 3
fi

echo "[sync-dist] mirroring ${DIST_DIR}/ -> ${TARGET_DIR}/"
rm -rf "${TARGET_DIR}"
mkdir -p "$(dirname "${TARGET_DIR}")"
cp -r "${DIST_DIR}" "${TARGET_DIR}"

echo "[sync-dist] generating MANIFEST.sha256…"
(
  cd "${TARGET_DIR}"
  rm -f MANIFEST.sha256
  find . -type f \( -name '*.html' -o -name '*.js' -o -name '*.css' -o -name '*.svg' \
                     -o -name '*.ico' -o -name '*.png' -o -name '*.json' \) -print0 \
    | sort -z \
    | xargs -0 sha256sum > MANIFEST.sha256
)

echo "[sync-dist] verifying replay from MANIFEST.sha256…"
( cd "${TARGET_DIR}" && sha256sum -c MANIFEST.sha256 >/dev/null )

echo "[sync-dist] OK"
echo "  index.html:  $(sha256sum "${TARGET_DIR}/index.html" | cut -c1-12)"
echo "  runtime-cfg: $([[ -f "${TARGET_DIR}/runtime-config.js" ]] && echo present || echo MISSING)"
echo "  manifest:    $(wc -l < "${TARGET_DIR}/MANIFEST.sha256") files tracked"
echo "  dist size:   $(du -sh "${TARGET_DIR}" | cut -f1)"
echo "[sync-dist] DONE -> ${TARGET_DIR}"
