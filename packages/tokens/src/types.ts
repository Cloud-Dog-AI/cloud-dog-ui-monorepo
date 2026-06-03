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

// @cloud-dog/tokens — Type definitions for design tokens.

export type TokenTheme = "light" | "dark";

export type TokenColourKey =
  | "background"
  | "foreground"
  | "card"
  | "card-foreground"
  | "primary"
  | "primary-foreground"
  | "secondary"
  | "secondary-foreground"
  | "muted"
  | "muted-foreground"
  | "accent"
  | "accent-foreground"
  | "destructive"
  | "destructive-foreground"
  | "border"
  | "input"
  | "ring";

export type TokenColours = Record<TokenColourKey, string>;

export type TokenSpacing = Record<string, string>;

export type TokenRadii = Record<
  "none" | "sm" | "md" | "lg" | "xl" | "2xl" | "full",
  string
>;

export type TokenShadows = Record<"sm" | "md" | "lg" | "xl" | "2xl", string>;

export type TokenTypography = {
  fontFamily: Record<"sans" | "mono", string[]>;
  fontSize: Record<
    "xs" | "sm" | "base" | "lg" | "xl" | "2xl" | "3xl" | "4xl",
    [string, { lineHeight: string }]
  >;
};

export type BrandConfig = Readonly<{
  name: string;
  tagline: string;
  logoPath: string;
  faviconPath: string;
  appleTouchIconPath: string;
}>;
