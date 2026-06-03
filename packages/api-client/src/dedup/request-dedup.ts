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

// @cloud-dog/api-client — In-flight GET request de-duplication.

export class RequestDedup {
  private inflight = new Map<string, Promise<Response>>();

  async dedupe(key: string, fn: () => Promise<Response>): Promise<Response> {
    const existing = this.inflight.get(key);
    if (existing) return existing.then((response) => response.clone());

    const promise = fn().finally(() => {
      this.inflight.delete(key);
    });
    this.inflight.set(key, promise);
    return promise.then((response) => response.clone());
  }
}
