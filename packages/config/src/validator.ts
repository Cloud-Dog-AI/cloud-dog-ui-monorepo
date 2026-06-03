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

// @cloud-dog/config — Runtime config validation and secret warnings.

import type { z } from "zod";
import { ConfigError } from "./types";

function formatZodError(error: z.ZodError): string {
  const issues = error.issues.map((i) => {
    const path = i.path.length ? i.path.join(".") : "(root)";
    return `${path}: ${i.message}`;
  });
  return issues.join("; ");
}

export function warnIfSecrets(config: Record<string, unknown>): void {
  const suspicious = ["SECRET", "PASSWORD", "PRIVATE_KEY", "TOKEN", "KEY"];
  for (const [key, value] of Object.entries(config)) {
    if (typeof value !== "string") continue;
    const v = value.toUpperCase();
    if (suspicious.some((s) => v.includes(s))) {
      // Runtime config is public; do not block app startup, but warn loudly.
      // eslint-disable-next-line no-console
      console.warn(
        `[config] Key "${key}" may contain a secret — runtime config is public.`
      );
    }
  }
}

export function validateConfig<T>(schema: z.ZodSchema<T>, raw: unknown): T {
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new ConfigError(`Invalid runtime config: ${formatZodError(result.error)}`);
  }
  if (result.data && typeof result.data === "object") {
    warnIfSecrets(result.data as Record<string, unknown>);
  }
  return result.data;
}
