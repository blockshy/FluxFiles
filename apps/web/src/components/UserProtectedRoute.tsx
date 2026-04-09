import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useUserAuth } from '../features/user/AuthProvider';

export function UserProtectedRoute({ children }: { children: ReactNode }) {
  const { ready, token } = useUserAuth();
  const location = useLocation();

  if (!ready) {
    return null;
  }

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
