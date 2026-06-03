import * as React from 'react';
import { useAuth } from '@cloud-dog/auth';

type AuthUserLike = Readonly<{
  id?: number | string | null;
  role?: string | null;
  roles?: string[] | null;
  permissions?: string[] | null;
}> | null | undefined;

export type AuthzState = Readonly<{
  isAdmin: boolean;
  roleSet: ReadonlySet<string>;
  permissionSet: ReadonlySet<string>;
  userId: number | null;
}>;

function normalizeUserId(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function deriveAuthzState(user: AuthUserLike): AuthzState {
  const roleSet = new Set(
    [user?.role, ...(user?.roles ?? [])]
      .filter((value): value is string => Boolean(value))
      .map((value) => value.trim().toLowerCase())
  );
  const permissionSet = new Set(
    (user?.permissions ?? [])
      .filter((value): value is string => Boolean(value))
      .map((value) => value.trim().toLowerCase())
  );

  return {
    isAdmin: roleSet.has('admin') || permissionSet.has('admin') || permissionSet.has('*'),
    roleSet,
    permissionSet,
    userId: normalizeUserId(user?.id),
  };
}

export function useAuthz(): AuthzState {
  const auth = useAuth();
  return React.useMemo(() => deriveAuthzState(auth.user), [auth.user]);
}
