import { Navigate, Route, Routes } from 'react-router-dom';
import { AdminHomeRedirect } from '../components/AdminHomeRedirect';
import { AdminPermissionRoute } from '../components/AdminPermissionRoute';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { UserProtectedRoute } from '../components/UserProtectedRoute';
import {
  PERMISSION_ADMIN_FILES_ALL,
  PERMISSION_ADMIN_FILES_OWN,
  PERMISSION_ADMIN_FILES_UPLOAD,
  PERMISSION_ADMIN_FILES_EDIT,
  PERMISSION_ADMIN_FILES_DELETE,
  PERMISSION_ADMIN_AUDIT,
  PERMISSION_ADMIN_SETTINGS,
  PERMISSION_ADMIN_USERS_CREATE,
  PERMISSION_ADMIN_USERS_EDIT,
} from '../features/user/permissions';
import { AdminLayout } from '../layouts/AdminLayout';
import { PublicLayout } from '../layouts/PublicLayout';
import { AdminFilesPage } from '../pages/AdminFilesPage';
import { AdminLogsPage } from '../pages/AdminLogsPage';
import { AdminSettingsPage } from '../pages/AdminSettingsPage';
import { AdminUsersPage } from '../pages/AdminUsersPage';
import { PublicFilesPage } from '../pages/PublicFilesPage';
import { PublicUserProfilePage } from '../pages/PublicUserProfilePage';
import { UserCenterPage } from '../pages/UserCenterPage';
import { UserLoginPage } from '../pages/UserLoginPage';
import { UserRegisterPage } from '../pages/UserRegisterPage';

export function AppRouter() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <PublicLayout>
            <PublicFilesPage />
          </PublicLayout>
        }
      />
      <Route path="/login" element={<UserLoginPage />} />
      <Route path="/register" element={<UserRegisterPage />} />
      <Route
        path="/users/:username"
        element={
          <PublicLayout>
            <PublicUserProfilePage />
          </PublicLayout>
        }
      />
      <Route path="/admin/login" element={<Navigate to="/login" replace />} />
      <Route
        path="/me"
        element={
          <PublicLayout>
            <UserProtectedRoute>
              <UserCenterPage />
            </UserProtectedRoute>
          </PublicLayout>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminHomeRedirect />} />
        <Route
          path="files"
          element={
            <AdminPermissionRoute permission={[PERMISSION_ADMIN_FILES_OWN, PERMISSION_ADMIN_FILES_ALL, PERMISSION_ADMIN_FILES_UPLOAD, PERMISSION_ADMIN_FILES_EDIT, PERMISSION_ADMIN_FILES_DELETE]}>
              <AdminFilesPage />
            </AdminPermissionRoute>
          }
        />
        <Route
          path="users"
          element={
            <AdminPermissionRoute permission={[PERMISSION_ADMIN_USERS_CREATE, PERMISSION_ADMIN_USERS_EDIT]}>
              <AdminUsersPage />
            </AdminPermissionRoute>
          }
        />
        <Route
          path="settings"
          element={
            <AdminPermissionRoute permission={PERMISSION_ADMIN_SETTINGS}>
              <AdminSettingsPage />
            </AdminPermissionRoute>
          }
        />
        <Route
          path="logs"
          element={
            <AdminPermissionRoute permission={PERMISSION_ADMIN_AUDIT}>
              <AdminLogsPage />
            </AdminPermissionRoute>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
