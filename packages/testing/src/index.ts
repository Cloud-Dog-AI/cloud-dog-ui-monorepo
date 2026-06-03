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

// @cloud-dog/testing — Public exports.

export { checkA11y, type A11yOptions } from "./a11y/check-a11y";
export { checkComponentA11y } from "./a11y/check-component-a11y";

export { login } from "./auth/login";
export { saveAuthState, loadAuthState } from "./auth/auth-state";

export { getByRole } from "./selectors/role";
export { getByTestId } from "./selectors/test-id";
export { waitForElement } from "./selectors/wait";

export { BasePage } from "./pages/base-page";

export { assertNavItemActive, assertDrawerOpen, assertDrawerClosed } from "./shell/nav-assertions";
export { viewports } from "./shell/viewports";

export { playwrightPreset } from "./config/playwright-preset";

export { test as authenticatedPage } from "./fixtures/authenticated-page";
export { test as proxyAuthPage } from "./fixtures/proxy-auth-page";

export { embeddedPageRecipe } from "./recipes/embedded-page";

export type { Credentials } from "./types";
