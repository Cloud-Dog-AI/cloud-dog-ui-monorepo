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

// @cloud-dog/api-client — Response parser (envelope unwrap + optional Zod validation).

import type { z } from "zod";

type OkEnvelope = {
  ok: true;
  data: unknown;
  meta?: Record<string, unknown>;
};

type ErrEnvelope = {
  ok: false;
  error: unknown;
  meta?: Record<string, unknown>;
};

function isOkEnvelope(body: unknown): body is OkEnvelope {
  return !!body && typeof body === "object" && (body as any).ok === true && "data" in (body as any);
}

export async function parseJsonResponse(resp: Response): Promise<unknown> {
  const text = await resp.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export function unwrapEnvelope(body: unknown): unknown {
  if (isOkEnvelope(body)) return body.data;
  return body;
}

export function validateResponse<T>(
  data: unknown,
  schema: z.ZodSchema<T> | undefined
): T {
  if (!schema) return data as T;
  return schema.parse(data);
}
