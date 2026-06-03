// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// @cloud-dog/config — Runtime config reader for window.__RUNTIME_CONFIG__.

import { ConfigError } from "./types";

export function readRuntimeConfig(): Record<string, unknown> {
  const raw = (globalThis as unknown as { __RUNTIME_CONFIG__?: unknown })
    .__RUNTIME_CONFIG__;

  if (!raw || typeof raw !== "object") {
    throw new ConfigError(
      "window.__RUNTIME_CONFIG__ not found. Is /runtime-config.js loaded?"
    );
  }

  return raw as Record<string, unknown>;
}
