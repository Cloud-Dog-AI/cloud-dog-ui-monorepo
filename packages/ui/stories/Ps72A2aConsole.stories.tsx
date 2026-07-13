// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// W28E-1844 — Ps72A2aConsole demo, incl. the §11.3 initialAction/initialRequest
// extension point (service domain panels can pre-select a skill without forking).

import { Ps72A2aConsole } from "../src";
import type { Ps72ExecuteResult } from "../src";

const agentCard = {
  name: "Demo Agent",
  version: "1.0.0",
  skills: [{ id: "root" }, { id: "health" }, { id: "search" }],
};

const onSend = async (action: string, payload: unknown): Promise<Ps72ExecuteResult> => ({
  body: { action, payload, ok: true },
  correlationId: "corr-demo-1",
  requestId: "req-demo-1",
  httpStatus: 200,
  denied: false,
});

const baseArgs = {
  endpointUrl: "https://demo.cloud-dog.net/weba2a",
  agentCard,
  skills: ["root", "health", "search"],
  health: "healthy" as const,
  hasBoundKey: true,
  boundLabel: "admin",
  docsHref: "/developer/api-docs",
  jobsHref: "/system/jobs",
  onSend,
};

export default { title: "W28E-1844/Ps72A2aConsole", component: Ps72A2aConsole };

export const Default = { args: baseArgs };

// §11.3 extension point: a service domain panel (e.g. notification-agent CX-131)
// pre-selects a skill and seeds the request without forking the console.
export const WithInitialAction = {
  args: { ...baseArgs, initialAction: "search", initialRequest: { query: "preprod", limit: 10 } },
};

export const Unhealthy = {
  args: { ...baseArgs, agentCard: null, health: "unhealthy" as const, skills: [] },
};
