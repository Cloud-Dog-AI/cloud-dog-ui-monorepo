# @cloud-dog/shell

Shared application shell layouts, navigation, and framing for Cloud-Dog web applications.

## Install

```bash
npm install @cloud-dog/shell
```

## Example

```tsx
import { CopyrightFooter, ShellLayout } from '@cloud-dog/shell';

<ShellLayout
  appName="Cloud-Dog"
  navItems={[]}
  footer={<CopyrightFooter disableVersionProbe />}
>
  <section>Dashboard</section>
</ShellLayout>
```

`ShellLayout` exposes stable `cloud-dog-shell-*` test IDs by default. The
`footer` slot is for the shared `CopyrightFooter` or a service wrapper that keeps
the same copyright/version contract.
