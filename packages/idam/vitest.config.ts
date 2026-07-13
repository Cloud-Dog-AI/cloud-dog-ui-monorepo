// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
// SPDX-License-Identifier: Apache-2.0
//
// @cloud-dog/idam — Vitest configuration (W28A-876-R2).
// Component/unit suite only; the Playwright conformance + render specs under
// tests/conformance and tests/render are excluded from Vitest discovery.

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    include: ["tests/component/**/*.{test,spec}.{ts,tsx}"],
    setupFiles: ["./tests/setup.ts"],
  },
});
