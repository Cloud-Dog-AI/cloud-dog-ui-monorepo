# Server-rendered usage (no bundler)

`@cloud-dog/tokens` can be adopted without React, TypeScript, Tailwind, or any build pipeline.

## Option A: Serve a static CSS file

1. Generate the CSS file once at build time and serve it as a static asset.
2. Link it from server-rendered templates.

Example (Jinja2):

```html
<link rel="stylesheet" href="/static/cloud-dog-tokens.css" />
```

## Option B: Inline a generated CSS payload

If you cannot serve static assets, you can embed a `<style>` tag.

```html
<style>
  /* paste generateCSSFile() output here */
</style>
```

## Option C: @import

```html
<style>
  @import url('/static/cloud-dog-tokens.css');
</style>
```

## Theme switching

Add or remove the `.dark` class on `<html>`:

```html
<html class="dark">
```
