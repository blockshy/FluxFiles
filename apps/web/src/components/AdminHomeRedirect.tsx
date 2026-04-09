import { Navigate } from 'react-router-dom';
import { getAdminHomePath } from '../features/user/permissions';
import { useUserAuth } from '../features/user/AuthProvider';

export function AdminHomeRedirect() {
  const { user } = useUserAuth();
  return <Navigate to={getAdminHomePath(user)} replace />;
}
