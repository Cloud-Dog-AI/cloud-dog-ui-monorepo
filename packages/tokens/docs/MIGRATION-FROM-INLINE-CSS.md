# Migration from inline CSS variables

This guide helps you migrate from inline CSS custom properties to consuming `@cloud-dog/tokens`.

## Goal

Move from per-page inline token definitions (for example `<style>:root { --primary: ... }</style>`) to an externally generated CSS file that can be linked by server-rendered and no-bundler pages.

## Recommended approach

1. Generate a CSS file using `generateCSSFile()`.
2. Serve it from your backend as a static asset.
3. Remove inline token overrides, replacing them with scoped overrides only where truly necessary.

## Example

```ts
import { generateCSSFile } from '@cloud-dog/tokens';

const css = generateCSSFile();
```

Then write `css` to `/static/cloud-dog-tokens.css` and include it in pages.

## Notes

- Do not embed secrets in CSS variables.
- Prefer a single shared token file for the whole service.
