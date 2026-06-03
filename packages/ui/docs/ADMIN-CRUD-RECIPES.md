# Admin CRUD recipes

This document provides reference layouts for operational admin consoles.

## CrudPage

Use `CrudPage` for standard admin datasets.

Features:
- Search toolbar
- Row selection
- Bulk actions
- Detail drawer (right-side sheet)

Example:

```tsx
import { CrudPage } from '@cloud-dog/ui';

<CrudPage
  title="Users"
  rows={users}
  getRowId={(u) => u.id}
  columns={[
    { id: 'email', header: 'Email', cell: (u) => u.email },
    { id: 'role', header: 'Role', cell: (u) => u.role },
  ]}
  bulkActions={[{ label: 'Disable', onRun: (ids) => disable(ids) }]}
  renderDetail={(u) => <div>{u.email}</div>}
/>
```
