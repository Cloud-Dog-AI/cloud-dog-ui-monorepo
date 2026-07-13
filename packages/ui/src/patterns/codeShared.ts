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

import * as React from "react";
import { useMonaco } from "@monaco-editor/react";
type TokenTheme = "light" | "dark";

export type CodeLanguage = "json" | "yaml" | "sql" | "python" | "markdown" | "text";

const THEME_NAMES = {
  dark: "cloud-dog-monaco-dark",
  light: "cloud-dog-monaco-light",
} as const;

const LIGHT_FALLBACK = {
  background: "0 0% 100%",
  foreground: "222.2 84% 4.9%",
  card: "0 0% 100%",
  "card-foreground": "222.2 84% 4.9%",
  primary: "221.2 83.2% 53.3%",
  "primary-foreground": "210 40% 98%",
  secondary: "210 40% 96.1%",
  "secondary-foreground": "222.2 47.4% 11.2%",
  muted: "210 40% 96.1%",
  "muted-foreground": "215.4 16.3% 46.9%",
  accent: "210 40% 96.1%",
  "accent-foreground": "222.2 47.4% 11.2%",
  destructive: "0 84.2% 60.2%",
  "destructive-foreground": "210 40% 98%",
  border: "214.3 31.8% 91.4%",
  input: "214.3 31.8% 91.4%",
  ring: "221.2 83.2% 53.3%",
} as const;

const DARK_FALLBACK = {
  background: "222.2 84% 4.9%",
  foreground: "210 40% 98%",
  card: "222.2 84% 4.9%",
  "card-foreground": "210 40% 98%",
  primary: "217.2 91.2% 59.8%",
  "primary-foreground": "222.2 47.4% 11.2%",
  secondary: "217.2 32.6% 17.5%",
  "secondary-foreground": "210 40% 98%",
  muted: "217.2 32.6% 17.5%",
  "muted-foreground": "215 20.2% 65.1%",
  accent: "217.2 32.6% 17.5%",
  "accent-foreground": "210 40% 98%",
  destructive: "0 62.8% 30.6%",
  "destructive-foreground": "210 40% 98%",
  border: "217.2 32.6% 17.5%",
  input: "217.2 32.6% 17.5%",
  ring: "224.3 76.3% 48%",
} as const;

type MonacoApi = Exclude<ReturnType<typeof useMonaco>, null>;

function normaliseChannel(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function hslTripletToHex(value: string) {
  const match = value.trim().match(/^(-?\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%$/);
  if (!match) {
    return null;
  }

  const hue = ((Number.parseFloat(match[1]) % 360) + 360) % 360;
  const saturation = Number.parseFloat(match[2]) / 100;
  const lightness = Number.parseFloat(match[3]) / 100;
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const huePrime = hue / 60;
  const secondComponent = chroma * (1 - Math.abs((huePrime % 2) - 1));
  const matchLightness = lightness - chroma / 2;

  let red = 0;
  let green = 0;
  let blue = 0;

  if (huePrime >= 0 && huePrime < 1) {
    red = chroma;
    green = secondComponent;
  } else if (huePrime < 2) {
    red = secondComponent;
    green = chroma;
  } else if (huePrime < 3) {
    green = chroma;
    blue = secondComponent;
  } else if (huePrime < 4) {
    green = secondComponent;
    blue = chroma;
  } else if (huePrime < 5) {
    red = secondComponent;
    blue = chroma;
  } else {
    red = chroma;
    blue = secondComponent;
  }

  return `#${[red, green, blue]
    .map((channel) => normaliseChannel((channel + matchLightness) * 255).toString(16).padStart(2, "0"))
    .join("")}`;
}

function tokenToMonacoColor(value: string) {
  if (value.startsWith("#") || value.startsWith("rgb(") || value.startsWith("rgba(")) {
    return value;
  }

  return hslTripletToHex(value) ?? value;
}

function resolveThemeColors(theme: TokenTheme) {
  const fallback = theme === "dark" ? DARK_FALLBACK : LIGHT_FALLBACK;
  if (typeof window === "undefined") {
    return fallback;
  }

  const styles = window.getComputedStyle(document.documentElement);
  return {
    ...fallback,
    background: styles.getPropertyValue("--background").trim() || fallback.background,
    foreground: styles.getPropertyValue("--foreground").trim() || fallback.foreground,
    card: styles.getPropertyValue("--card").trim() || fallback.card,
    "card-foreground": styles.getPropertyValue("--card-foreground").trim() || fallback["card-foreground"],
    primary: styles.getPropertyValue("--primary").trim() || fallback.primary,
    "primary-foreground":
      styles.getPropertyValue("--primary-foreground").trim() || fallback["primary-foreground"],
    secondary: styles.getPropertyValue("--secondary").trim() || fallback.secondary,
    "secondary-foreground":
      styles.getPropertyValue("--secondary-foreground").trim() || fallback["secondary-foreground"],
    muted: styles.getPropertyValue("--muted").trim() || fallback.muted,
    "muted-foreground":
      styles.getPropertyValue("--muted-foreground").trim() || fallback["muted-foreground"],
    accent: styles.getPropertyValue("--accent").trim() || fallback.accent,
    "accent-foreground":
      styles.getPropertyValue("--accent-foreground").trim() || fallback["accent-foreground"],
    destructive: styles.getPropertyValue("--destructive").trim() || fallback.destructive,
    "destructive-foreground":
      styles.getPropertyValue("--destructive-foreground").trim() || fallback["destructive-foreground"],
    border: styles.getPropertyValue("--border").trim() || fallback.border,
    input: styles.getPropertyValue("--input").trim() || fallback.input,
    ring: styles.getPropertyValue("--ring").trim() || fallback.ring,
  };
}

function defineTheme(monaco: MonacoApi, tokenTheme: TokenTheme) {
  const colors = resolveThemeColors(tokenTheme);
  const themeName = tokenTheme === "dark" ? THEME_NAMES.dark : THEME_NAMES.light;

  monaco.editor.defineTheme(themeName, {
    base: tokenTheme === "dark" ? "vs-dark" : "vs",
    inherit: true,
    // Syntax token colours are theme-aware so they meet WCAG 2.1 AA contrast
    // (>=4.5:1 for normal text) against the editor background in BOTH themes.
    // Light-theme tokens are darkened (the prior shared green #16A34A scored only
    // 3.29:1 on the white editor background — axe color-contrast failure on the
    // Templates/Examples code preview); dark-theme tokens keep their lighter hues.
    rules:
      tokenTheme === "dark"
        ? [
            { token: "comment", foreground: "9CA3AF", fontStyle: "italic" },
            { token: "keyword", foreground: "60A5FA" },
            { token: "number", foreground: "5EEAD4" },
            { token: "string", foreground: "4ADE80" },
            { token: "delimiter.bracket", foreground: "E5E7EB" },
          ]
        : [
            { token: "comment", foreground: "4B5563", fontStyle: "italic" },
            { token: "keyword", foreground: "1D4ED8" },
            { token: "number", foreground: "0F766E" },
            { token: "string", foreground: "166534" },
            { token: "delimiter.bracket", foreground: "111827" },
          ],
    colors: {
      "editor.background": tokenToMonacoColor(colors.background),
      "editor.foreground": tokenToMonacoColor(colors.foreground),
      "editorLineNumber.foreground": tokenToMonacoColor(colors["muted-foreground"]),
      "editorLineNumber.activeForeground": tokenToMonacoColor(colors.foreground),
      "editorCursor.foreground": tokenToMonacoColor(colors.primary),
      "editor.selectionBackground": tokenTheme === "dark" ? "rgba(96,165,250,0.24)" : "rgba(59,130,246,0.16)",
      "editor.inactiveSelectionBackground":
        tokenTheme === "dark" ? "rgba(71,85,105,0.28)" : "rgba(148,163,184,0.22)",
      "editorLineHighlightBackground":
        tokenTheme === "dark" ? "rgba(148,163,184,0.08)" : "rgba(15,23,42,0.04)",
      "editorGutter.background": tokenToMonacoColor(colors.card),
      "editorWidget.background": tokenToMonacoColor(colors.card),
      "editorWidget.border": tokenToMonacoColor(colors.border),
      "editorIndentGuide.background1": tokenToMonacoColor(colors.border),
      "editorIndentGuide.activeBackground1": tokenToMonacoColor(colors.ring),
      "input.background": tokenToMonacoColor(colors.input),
      "input.foreground": tokenToMonacoColor(colors.foreground),
      "input.border": tokenToMonacoColor(colors.border),
      "diffEditor.insertedTextBackground":
        tokenTheme === "dark" ? "rgba(34,197,94,0.18)" : "rgba(34,197,94,0.12)",
      "diffEditor.removedTextBackground":
        tokenTheme === "dark" ? "rgba(239,68,68,0.18)" : "rgba(239,68,68,0.12)",
      "diffEditor.insertedLineBackground":
        tokenTheme === "dark" ? "rgba(34,197,94,0.1)" : "rgba(34,197,94,0.08)",
      "diffEditor.removedLineBackground":
        tokenTheme === "dark" ? "rgba(239,68,68,0.1)" : "rgba(239,68,68,0.08)",
    },
  });
}

export function useCloudDogMonacoTheme() {
  const monaco = useMonaco();
  const [theme, setTheme] = React.useState<TokenTheme>(() => {
    if (typeof document === "undefined") {
      return "light";
    }
    return document.documentElement.classList.contains("dark") ? "dark" : "light";
  });

  React.useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const root = document.documentElement;
    const updateTheme = () => {
      setTheme(root.classList.contains("dark") ? "dark" : "light");
    };

    updateTheme();

    const observer = new MutationObserver(updateTheme);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
    if (!monaco) {
      return;
    }
    defineTheme(monaco, "light");
    defineTheme(monaco, "dark");
  }, [monaco, theme]);

  return theme === "dark" ? THEME_NAMES.dark : THEME_NAMES.light;
}

export function toMonacoLanguage(language: CodeLanguage): string {
  return language === "text" ? "plaintext" : language;
}

function withGlobalFlag(pattern: RegExp) {
  return pattern.flags.includes("g") ? pattern : new RegExp(pattern.source, `${pattern.flags}g`);
}

function maskMatch(match: string) {
  if (
    match.length >= 2 &&
    ((match.startsWith('"') && match.endsWith('"')) || (match.startsWith("'") && match.endsWith("'")))
  ) {
    return `${match[0]}***${match[match.length - 1]}`;
  }
  return "***";
}

export function maskText(value: string, maskPatterns?: RegExp[]) {
  if (!maskPatterns || maskPatterns.length === 0) {
    return value;
  }

  return maskPatterns.reduce((masked, pattern) => {
    return masked.replace(withGlobalFlag(pattern), (match) => maskMatch(match));
  }, value);
}

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
  }
}
