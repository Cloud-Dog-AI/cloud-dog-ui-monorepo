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

// @cloud-dog/auth — Idle timeout detection.

export class IdleTimer {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private readonly handler = () => this.reset();

  constructor(
    private readonly timeoutMs: number,
    private readonly onIdle: () => void
  ) {}

  start(): void {
    this.stop();
    this.reset();
    for (const ev of ["mousemove", "keydown", "scroll", "click", "touchstart"]) {
      window.addEventListener(ev, this.handler, { passive: true });
    }
  }

  stop(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    for (const ev of ["mousemove", "keydown", "scroll", "click", "touchstart"]) {
      window.removeEventListener(ev, this.handler);
    }
  }

  reset(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.onIdle(), this.timeoutMs);
  }
}
