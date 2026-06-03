# Panel-to-route migration

This guide helps migrate existing UIs that use imperative panel switching (for example `switchPanel('jobs')`) to route-based navigation using `react-router-dom` and `@cloud-dog/shell`.

## Target pattern

1. Define routes in the app.
2. Define nav items that link to those routes.
3. Use `ShellLayout` to render the canonical left navigation and top bar.

## Example

```tsx
import { ShellLayout } from '@cloud-dog/shell';

const navItems = [
  { label: 'Jobs', path: '/jobs', icon: <span>J</span> },
  { label: 'Users', path: '/users', icon: <span>U</span> },
];

<ShellLayout appName="Console" navItems={navItems}>
  <Routes>
    <Route path="/jobs" element={<JobsPage />} />
    <Route path="/users" element={<UsersPage />} />
  </Routes>
</ShellLayout>
```

## Mapping template

- `switchPanel('jobs')` -> `navigate('/jobs')`
- `switchPanel('settings')` -> `navigate('/settings')`

## Notes

- Keep routing logic inside the app, not inside shared packages.
- Use permission filtering via `requiredPermission` on nav items.
