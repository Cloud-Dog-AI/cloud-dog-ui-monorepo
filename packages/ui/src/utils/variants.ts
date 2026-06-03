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

// @cloud-dog/ui — Variant helpers.

export type VariantMap = Record<string, Record<string, string>>;

export function getVariantClass(
  variants: VariantMap,
  selection: Record<string, string | undefined>
): string {
  const out: string[] = [];
  for (const [group, choices] of Object.entries(variants)) {
    const key = selection[group];
    if (!key) continue;
    const cls = choices[key];
    if (cls) out.push(cls);
  }
  return out.join(" ");
}
