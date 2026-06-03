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

// @cloud-dog/ui — Hook: keyboard navigation handlers.

import * as React from "react";

export type KeyboardNavOptions = Readonly<{
  onEscape?: () => void;
  onArrowUp?: () => void;
  onArrowDown?: () => void;
  onArrowLeft?: () => void;
  onArrowRight?: () => void;
  onEnter?: () => void;
}>;

export function useKeyboardNav(options: KeyboardNavOptions) {
  return React.useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case "Escape":
          options.onEscape?.();
          break;
        case "ArrowUp":
          options.onArrowUp?.();
          break;
        case "ArrowDown":
          options.onArrowDown?.();
          break;
        case "ArrowLeft":
          options.onArrowLeft?.();
          break;
        case "ArrowRight":
          options.onArrowRight?.();
          break;
        case "Enter":
          options.onEnter?.();
          break;
        default:
          break;
      }
    },
    [options]
  );
}
