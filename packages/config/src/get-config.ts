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

// @cloud-dog/config — Non-React access to validated runtime config.

import type { z } from "zod";
import { readRuntimeConfig } from "./reader";
import { BaseRuntimeConfigSchema } from "./schema";
import { validateConfig } from "./validator";

let _cached: unknown | null = null;

export function getConfig<T = unknown>(schema?: z.ZodSchema<T>): T {
  if (_cached) return _cached as T;
  const raw = readRuntimeConfig();
  const parsed = validateConfig((schema ?? BaseRuntimeConfigSchema) as z.ZodSchema<T>, raw);
  _cached = parsed;
  return parsed;
}
