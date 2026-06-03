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

// @cloud-dog/tokens — Public exports for Cloud-Dog design tokens.

export { preset } from "./preset";
export { lightColors, darkColors } from "./colors";
export { spacing } from "./spacing";
export { typography, fontFamily, fontSize } from "./typography";
export { radii, borderRadius } from "./radii";
export { shadows, boxShadow } from "./shadows";
export { brand, BRAND_NAME, BRAND_TAGLINE } from "./brand";
export { generateCSSVars } from "./css-variables";
export { generateCSSFile } from "./css-output";

export type {
  BrandConfig,
  TokenColours,
  TokenColourKey,
  TokenRadii,
  TokenShadows,
  TokenSpacing,
  TokenTheme,
  TokenTypography,
} from "./types";
