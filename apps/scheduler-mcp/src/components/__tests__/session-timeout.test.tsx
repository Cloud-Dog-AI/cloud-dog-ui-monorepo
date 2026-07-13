// @vitest-environment jsdom
// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
// Licensed under the Apache License, Version 2.0
//
// W28K-1408 F-1408-8 — session timeout warning machinery. Renders the real shared
// SessionTimeoutProvider (the component the scheduler app wires at 30-min/5-min)
// with a STABLE authenticated principal, and proves: after the idle threshold the
// warning dialog appears, and "Stay signed in" rearms the timer + dismisses it.
//
// useAuth is mocked to a stable object on purpose: the provider's idle timer is
// rearmed whenever its `auth` dependency changes identity, so a stable principal
// is required to observe the timer firing deterministically. Compressed durations
// keep it fast under real timers. The app's literal 30/5 wiring is asserted by
// conformance.spec.ts UC4 ("Session timeout: 30 min" surfaced in the live shell)
// + App.tsx <SessionTimeoutProvider timeoutMinutes={30} warningMinutes={5}>.

import * as React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SessionTimeoutProvider } from "@cloud-dog/auth";

// Mock the provider's internal useAuth (dist/context/useAuth) to a stable
// authenticated principal. node_modules/@cloud-dog/auth symlinks to packages/auth,
// so SessionTimeoutProvider's `import "../context/useAuth"` resolves to this same
// realpath — the mock intercepts it, giving a re-render-stable `auth`.
const stableAuth = { isAuthenticated: true, isLoading: false, user: { username: "admin" }, logout: vi.fn(async () => {}) };
vi.mock("../../../../../packages/auth/dist/context/useAuth.js", () => ({ useAuth: () => stableAuth }));

describe("F-1408-8 session timeout warning machinery", () => {
  it("shows the warning after the idle threshold, then 'Stay signed in' dismisses it", async () => {
    // idleMs = (timeout - warning) * 60s; (0.05 - 0.02) min = 1.8 s.
    render(
      <SessionTimeoutProvider timeoutMinutes={0.05} warningMinutes={0.02}>
        <div data-testid="app-body">scheduler</div>
      </SessionTimeoutProvider>,
    );
    expect(screen.getByTestId("app-body")).toBeTruthy();
    expect(screen.queryByText(/session expiring soon/i)).toBeNull();

    await waitFor(() => expect(screen.getByText(/session expiring soon/i)).toBeTruthy(), { timeout: 6000 });
    expect(screen.getByText(/your session will expire in/i)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /stay signed in/i }));
    await waitFor(() => expect(screen.queryByText(/session expiring soon/i)).toBeNull(), { timeout: 3000 });
  }, 15_000);
});
