# Legacy colour map

This table maps common legacy custom property names (seen in existing Cloud-Dog services) to `@cloud-dog/tokens` CSS variables.

## Mapping table

| Legacy variable | Token variable |
|---|---|
| `--primary` | `--color-primary` |
| `--bg-primary` | `--color-background` |
| `--text-primary` | `--color-foreground` |
| `--border` | `--color-border` |
| `--danger` | `--color-destructive` |

## Script-friendly JSON

```json
{
  "--primary": "--color-primary",
  "--bg-primary": "--color-background",
  "--text-primary": "--color-foreground",
  "--border": "--color-border",
  "--danger": "--color-destructive"
}
```

## Notes

- `generateCSSFile()` emits both the canonical token variables (for example `--primary`) and alias variables (for example `--color-primary`) by default.
- Prefer migrating legacy usage to `--color-*` variables in templates and static pages.
