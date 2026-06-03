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

// @cloud-dog/api-client — 401 refresh interceptor (refresh then retry once).

import { ApiError } from "../errors/api-error";

export async function withRefreshOn401<T>(opts: {
  fn: () => Promise<T>;
  refreshAccessToken?: () => Promise<void>;
  isUnauthorised: (e: unknown) => boolean;
}): Promise<T> {
  try {
    return await opts.fn();
  } catch (e) {
    if (!opts.refreshAccessToken || !opts.isUnauthorised(e)) throw e;
    await opts.refreshAccessToken();
    return await opts.fn();
  }
}

export function isUnauthorisedError(e: unknown): boolean {
  return e instanceof ApiError && e.options.status === 401;
}
