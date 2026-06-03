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

// @cloud-dog/config — Base Zod schema for runtime config.

import { z } from "zod";

export const BaseRuntimeConfigSchema = z.object({
  ENV: z.enum(["dev", "staging", "production"]).default("dev"),
  API_BASE_URL: z.string().url(),
  OIDC_ISSUER: z.string().url().optional(),
  OIDC_CLIENT_ID: z.string().optional(),
  AUTH_MODE: z.enum(["cookie", "oidc"]).default("cookie"),
});

export type BaseRuntimeConfig = z.infer<typeof BaseRuntimeConfigSchema>;
