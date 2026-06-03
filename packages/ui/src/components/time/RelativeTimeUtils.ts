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

// @cloud-dog/ui — Relative time formatting utility.

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

export function formatRelative(date: Date): string {
  const now = Date.now();
  const diff = now - date.getTime();

  if (diff < 10 * SECOND) return "just now";
  if (diff < MINUTE) return `${Math.floor(diff / SECOND)} seconds ago`;
  if (diff < HOUR) {
    const m = Math.floor(diff / MINUTE);
    return `${m} ${m === 1 ? "minute" : "minutes"} ago`;
  }
  if (diff < DAY) {
    const h = Math.floor(diff / HOUR);
    return `${h} ${h === 1 ? "hour" : "hours"} ago`;
  }
  if (diff < WEEK) {
    const d = Math.floor(diff / DAY);
    return `${d} ${d === 1 ? "day" : "days"} ago`;
  }
  const w = Math.floor(diff / WEEK);
  return `${w} ${w === 1 ? "week" : "weeks"} ago`;
}
