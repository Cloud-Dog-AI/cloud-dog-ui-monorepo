# Migration from vanilla JS to @cloud-dog/ui

This cookbook documents practical conversions from imperative DOM manipulation to React components using `@cloud-dog/ui`.

## Inline `onclick` to React handler

Before:

```html
<button onclick="saveUser()">Save</button>
```

After:

```tsx
import { Button } from '@cloud-dog/ui';

<Button onClick={saveUser}>Save</Button>
```

## String templates to JSX

Before:

```js
div.innerHTML = `<div class="row">${name}</div>`;
```

After:

```tsx
<div className="row">{name}</div>
```

## `document.getElementById` to state

Before:

```js
const v = document.getElementById('q').value;
```

After:

```tsx
const [q, setQ] = useState('');
<Input value={q} onChange={(e) => setQ(e.target.value)} />
```

## Notes

- Do not use `dangerouslySetInnerHTML` for rendering markdown or logs.
- Use the shell for layout and navigation; avoid bespoke app-level nav.
