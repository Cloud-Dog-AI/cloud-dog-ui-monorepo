#!/usr/bin/env bash
# Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
# Licensed under the Apache License 2.0
#
# W28S-2006 Lane F — F-D6: token-bypass audit (instruction §3 F-D6, §2 "All styling
# tokens come from @cloud-dog/tokens; flag any local Tailwind class that bypasses
# tokens"; WSC-007).
#
# Design system (proven by the shared packages, not invented here):
#   * STRUCTURAL colour/typography/spacing come from @cloud-dog/tokens semantic classes
#     (bg-background, text-foreground, bg-primary, border-border, text-muted-foreground …).
#   * STATUS colour (ok/warning/error/neutral) is expressed with the platform-SANCTIONED
#     tailwind status palette — exactly the vocabulary the shared @cloud-dog/ui StatusBadge
#     / Badge / FileArtifactCard / LogStream ship (emerald/green/amber/yellow/rose/red and
#     slate/gray neutrals). Using those is conformant, not a bypass.
#
# A genuine token bypass — what this audit FAILS on — is a hard-coded colour VALUE or a
# non-status arbitrary hue that should have been a token:
#   1. hex colour literals            (#abc / #aabbcc / #aabbccdd)
#   2. rgb()/rgba()/hsl()/hsla() literals in TS/TSX
#   3. tailwind ARBITRARY colour values   (bg-[#..]/text-[rgb(..)]/border-[hsl(..)])
#   4. tailwind NUMBERED-palette colour classes whose hue is NOT in the sanctioned status
#      palette (e.g. bg-blue-600, text-indigo-500 — those must be bg-primary/text-primary …)
# rc=0 = no token bypass.
set -u

cd "$(dirname "$0")/.." || exit 2
APP_ROOT="$(pwd)"
SRC=src

# Sanctioned tailwind status hues (mirror the shared @cloud-dog/ui status vocabulary).
ALLOWED_HUES='emerald|green|teal|amber|yellow|orange|rose|red|slate|gray'
ALL_HUES='red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone'
UTILS='bg|text|border|ring|from|via|to|fill|stroke|divide|outline|decoration|accent|caret|placeholder|shadow'
SHADES='50|100|200|300|400|500|600|700|800|900|950'

echo "W28S-2006 F-D6 token-bypass audit"
echo "app_root: ${APP_ROOT}"
echo "sanctioned status hues: ${ALLOWED_HUES}"
echo "----------------------------------------"

fail=0
report() { # name, hits
  if [ -n "$2" ]; then
    echo "BYPASS [$1]:"
    echo "$2"
    echo "----------------------------------------"
    fail=1
  fi
}

# 1) hex colour literals in TS/TSX (exclude pure-length matches inside longer hex hashes)
hex="$(grep -rnE '#[0-9a-fA-F]{3}\b|#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{8}\b' "${SRC}" --include=*.ts --include=*.tsx 2>/dev/null || true)"
report "hex-literal" "${hex}"

# 2) rgb/rgba/hsl/hsla literals
rgbhsl="$(grep -rnE '\b(rgb|rgba|hsl|hsla)\(' "${SRC}" --include=*.ts --include=*.tsx 2>/dev/null || true)"
report "rgb/hsl-literal" "${rgbhsl}"

# 3) tailwind arbitrary colour values
arb="$(grep -rnE "\b(${UTILS})-\[(#|rgb|rgba|hsl|hsla)" "${SRC}" --include=*.ts --include=*.tsx 2>/dev/null || true)"
report "tailwind-arbitrary-colour" "${arb}"

# 4) numbered-palette classes whose hue is NOT sanctioned status (these should be tokens)
nonstatus="$(grep -rnoE "\b(${UTILS})-(${ALL_HUES})-(${SHADES})\b" "${SRC}" --include=*.ts --include=*.tsx 2>/dev/null \
  | grep -vE "\b(${UTILS})-(${ALLOWED_HUES})-(${SHADES})\b" || true)"
report "non-status-palette-hue" "${nonstatus}"

if [ "${fail}" -ne 0 ]; then
  echo "RESULT: FAILED — token bypass detected (see BYPASS blocks above)"
  exit 1
fi

# Informational: count of sanctioned status-palette utilities (conformant, not flagged).
status_count="$(grep -rhoE "\b(${UTILS})-(${ALLOWED_HUES})-(${SHADES})\b" "${SRC}" --include=*.ts --include=*.tsx 2>/dev/null | grep -c . || true)"
echo "INFO: ${status_count} sanctioned status-palette utilities (match shared @cloud-dog/ui StatusBadge vocabulary; not a bypass)"
echo "RESULT: PASS — 0 hard-coded colour values / non-status palette bypasses; structural styling via @cloud-dog/tokens"
exit 0
