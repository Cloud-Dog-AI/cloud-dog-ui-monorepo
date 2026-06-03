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

// @cloud-dog/shell — ProfileDialog: signed-in user surface bound to useAuth().
//
// Per W28A #33 §3.B (Option b): a parallel dialog to AboutDialog that renders
// the canonical Profile contract from the signed-in user. Binds to the
// `@cloud-dog/auth` `useAuth()` hook so consuming services do not need to plumb
// user data through a config object. Renders ONLY identity data — never
// product metadata. The negative test in the local-proof asserts no `about-*`
// testids appear inside this dialog.

import * as React from "react";
import { cn, Dialog, Button, Input, Label } from "@cloud-dog/ui";
import { useAuth } from "@cloud-dog/auth";

export type ProfileDialogLink = Readonly<{
  label: string;
  description?: string;
  onSelect: () => void;
}>;

export interface ProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Optional override invoked when the user clicks "Sign out". Defaults to `useAuth().logout()`. */
  onLogout?: () => void | Promise<void>;
  links?: ProfileDialogLink[];
  onChangePassword?: (payload: { currentPassword: string; newPassword: string }) => Promise<void>;
  className?: string;
}

function formatLastLogin(value: string | undefined): string {
  if (!value) return "Never";
  const ts = Date.parse(value);
  if (Number.isNaN(ts)) return value;
  return new Date(ts).toLocaleString();
}

export function ProfileDialog(props: ProfileDialogProps) {
  const { open, onOpenChange, onLogout, links = [], onChangePassword, className } = props;
  const auth = useAuth();
  const user = auth.user;
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [passwordStatus, setPasswordStatus] = React.useState<string | null>(null);
  const [passwordError, setPasswordError] = React.useState<string | null>(null);
  const [savingPassword, setSavingPassword] = React.useState(false);

  React.useEffect(() => {
    if (open) return;
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPasswordStatus(null);
    setPasswordError(null);
    setSavingPassword(false);
  }, [open]);

  const handleLogout = React.useCallback(async () => {
    try {
      if (onLogout) {
        await onLogout();
      } else {
        await auth.logout();
      }
    } finally {
      onOpenChange(false);
    }
  }, [auth, onLogout, onOpenChange]);

  const handleChangePassword = React.useCallback(async () => {
    setPasswordStatus(null);
    setPasswordError(null);
    if (!onChangePassword) return;
    if (!currentPassword || !newPassword) {
      setPasswordError("Current and new password are required.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New password and confirmation must match.");
      return;
    }

    setSavingPassword(true);
    try {
      await onChangePassword({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordStatus("Password changed.");
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : "Password change failed.");
    } finally {
      setSavingPassword(false);
    }
  }, [confirmPassword, currentPassword, newPassword, onChangePassword]);

  const username = user?.username ?? user?.id ?? "";
  const displayName = user?.displayName ?? "";
  const email = user?.email ?? "";
  const groups = user?.groups ?? [];
  const roles = user?.roles ?? [];
  const lastLogin = formatLastLogin(user?.lastLogin);

  return (
    <Dialog open={open} onOpenChange={onOpenChange} label="Profile">
      <div className={cn("flex flex-col gap-4", className)}>
        <h2 className="text-lg font-semibold">Profile</h2>
        <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-muted-foreground">Username</dt>
          <dd data-testid="profile-username">{username}</dd>

          <dt className="text-muted-foreground">Display name</dt>
          <dd data-testid="profile-display-name">{displayName}</dd>

          <dt className="text-muted-foreground">Email</dt>
          <dd data-testid="profile-email">{email}</dd>

          <dt className="text-muted-foreground">Groups</dt>
          <dd>
            <ul
              role="list"
              aria-label="Groups"
              data-testid="profile-groups"
              className="flex flex-wrap gap-1"
            >
              {groups.length === 0 ? (
                <li className="text-muted-foreground">None</li>
              ) : (
                groups.map((g) => (
                  <li
                    key={g}
                    className="rounded bg-muted px-2 py-0.5 text-xs"
                  >
                    {g}
                  </li>
                ))
              )}
            </ul>
          </dd>

          <dt className="text-muted-foreground">Roles</dt>
          <dd>
            <ul
              role="list"
              aria-label="Roles"
              data-testid="profile-roles"
              className="flex flex-wrap gap-1"
            >
              {roles.length === 0 ? (
                <li className="text-muted-foreground">None</li>
              ) : (
                roles.map((r) => (
                  <li
                    key={r}
                    className="rounded bg-muted px-2 py-0.5 text-xs"
                  >
                    {r}
                  </li>
                ))
              )}
            </ul>
          </dd>

          <dt className="text-muted-foreground">Last login</dt>
          <dd data-testid="profile-last-login">{lastLogin}</dd>
        </dl>

        {links.length ? (
          <div className="space-y-2 rounded-md border p-3" data-testid="profile-links">
            <h3 className="text-sm font-semibold">Related workspaces</h3>
            <div className="grid gap-2 sm:grid-cols-3">
              {links.map((link) => (
                <Button
                  key={link.label}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-auto justify-start whitespace-normal text-left"
                  onClick={() => {
                    link.onSelect();
                    onOpenChange(false);
                  }}
                >
                  <span>
                    <span className="block font-medium">{link.label}</span>
                    {link.description ? <span className="block text-xs text-muted-foreground">{link.description}</span> : null}
                  </span>
                </Button>
              ))}
            </div>
          </div>
        ) : null}

        {onChangePassword ? (
          <form
            className="space-y-3 rounded-md border p-3"
            data-testid="profile-change-password"
            onSubmit={(event) => {
              event.preventDefault();
              void handleChangePassword();
            }}
          >
            <h3 className="text-sm font-semibold">Change password</h3>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="space-y-1">
                <Label htmlFor="profile-current-password">Current password</Label>
                <Input
                  id="profile-current-password"
                  data-testid="profile-current-password"
                  type="password"
                  value={currentPassword}
                  autoComplete="current-password"
                  onChange={(event) => setCurrentPassword(event.target.value)}
                />
              </label>
              <label className="space-y-1">
                <Label htmlFor="profile-new-password">New password</Label>
                <Input
                  id="profile-new-password"
                  data-testid="profile-new-password"
                  type="password"
                  value={newPassword}
                  autoComplete="new-password"
                  onChange={(event) => setNewPassword(event.target.value)}
                />
              </label>
              <label className="space-y-1">
                <Label htmlFor="profile-confirm-password">Confirm password</Label>
                <Input
                  id="profile-confirm-password"
                  data-testid="profile-confirm-password"
                  type="password"
                  value={confirmPassword}
                  autoComplete="new-password"
                  onChange={(event) => setConfirmPassword(event.target.value)}
                />
              </label>
            </div>
            {passwordError ? <p role="alert" className="text-sm text-destructive">{passwordError}</p> : null}
            {passwordStatus ? <p role="status" className="text-sm text-foreground/80">{passwordStatus}</p> : null}
            <div className="flex justify-end">
              <Button type="submit" size="sm" loading={savingPassword} data-testid="profile-change-password-submit">
                Change password
              </Button>
            </div>
          </form>
        ) : null}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            variant="destructive"
            size="sm"
            data-testid="profile-logout"
            onClick={() => void handleLogout()}
          >
            Sign out
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
