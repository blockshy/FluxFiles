import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { canAccessAdmin } from '../features/user/permissions';
import { useUserAuth } from '../features/user/AuthProvider';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { ready, token, user } = useUserAuth();
  const location = useLocation();

  if (!ready) {
    return null;
  }

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (!canAccessAdmin(user)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
