import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useUserAuth } from '../features/user/AuthProvider';
import { canAccessAdmin, hasPermission } from '../features/user/permissions';

export function AdminPermissionRoute({
  permission,
  children,
}: {
  permission: string | string[];
  children: ReactNode;
}) {
  const { user } = useUserAuth();

  if (!canAccessAdmin(user)) {
    return <Navigate to="/" replace />;
  }
  const requiredPermissions = Array.isArray(permission) ? permission : [permission];
  if (!requiredPermissions.some((item) => hasPermission(user, item))) {
    return <Navigate to="/admin" replace />;
  }

  return <>{children}</>;
}
