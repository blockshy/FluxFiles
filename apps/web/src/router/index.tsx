import { Navigate, Route, Routes } from 'react-router-dom';
import { AdminHomeRedirect } from '../components/AdminHomeRedirect';
import { AdminPermissionRoute } from '../components/AdminPermissionRoute';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { UserProtectedRoute } from '../components/UserProtectedRoute';
import { UserPermissionRoute } from '../components/UserPermissionRoute';
import {
  PERMISSION_ADMIN_FILES_ALL,
  PERMISSION_ADMIN_FILES_OWN,
  PERMISSION_ADMIN_FILES_UPLOAD,
  PERMISSION_ADMIN_FILES_EDIT,
  PERMISSION_ADMIN_FILES_DELETE,
  PERMISSION_ADMIN_DOWNLOADS_VIEW,
  PERMISSION_ADMIN_AUDIT,
  PERMISSION_ADMIN_CATEGORIES_CREATE,
  PERMISSION_ADMIN_CATEGORIES_DELETE,
  PERMISSION_ADMIN_CATEGORIES_EDIT,
  PERMISSION_ADMIN_CATEGORIES_LOGS,
  PERMISSION_ADMIN_CATEGORIES_VIEW,
  PERMISSION_ADMIN_SETTINGS,
  PERMISSION_ADMIN_TAGS_CREATE,
  PERMISSION_ADMIN_TAGS_DELETE,
  PERMISSION_ADMIN_TAGS_EDIT,
  PERMISSION_ADMIN_TAGS_LOGS,
  PERMISSION_ADMIN_TAGS_VIEW,
  PERMISSION_ADMIN_COMMUNITY_VIEW,
  PERMISSION_ADMIN_COMMUNITY_MODERATE,
  PERMISSION_ADMIN_USERS_CREATE,
  PERMISSION_ADMIN_USERS_EDIT,
  PERMISSION_PUBLIC_COMMUNITY_POST_CREATE,
  PERMISSION_PUBLIC_COMMUNITY_POST_EDIT_OWN,
  PERMISSION_PUBLIC_COMMUNITY_VIEW,
  PERMISSION_PUBLIC_NOTIFICATIONS_VIEW,
  PERMISSION_PUBLIC_PROFILE_VIEW_OWN,
  PERMISSION_PUBLIC_PROFILE_VIEW_PUBLIC,
} from '../features/user/permissions';
import { AdminCommunityPage } from '../pages/AdminCommunityPage';
import { AdminCategoriesPage } from '../pages/AdminCategoriesPage';
import { AdminLayout } from '../layouts/AdminLayout';
import { AdminTagsPage } from '../pages/AdminTagsPage';
import { PublicLayout } from '../layouts/PublicLayout';
import { AdminFilesPage } from '../pages/AdminFilesPage';
import { AdminDownloadsPage } from '../pages/AdminDownloadsPage';
import { AdminLogsPage } from '../pages/AdminLogsPage';
import { AdminSettingsPage } from '../pages/AdminSettingsPage';
import { AdminUsersPage } from '../pages/AdminUsersPage';
import { PublicFilesPage } from '../pages/PublicFilesPage';
import { PublicFileDetailPage } from '../pages/PublicFileDetailPage';
import { PublicUserProfilePage } from '../pages/PublicUserProfilePage';
import { CommunityPage } from '../pages/CommunityPage';
import { CommunityPostDetailPage } from '../pages/CommunityPostDetailPage';
import { CommunityPostEditorPage } from '../pages/CommunityPostEditorPage';
import { NotificationsPage } from '../pages/NotificationsPage';
import { AboutPage } from '../pages/AboutPage';
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
      <Route
        path="/files/:id"
        element={
          <PublicLayout>
            <PublicFileDetailPage />
          </PublicLayout>
        }
      />
      <Route
        path="/about"
        element={
          <PublicLayout>
            <AboutPage />
          </PublicLayout>
        }
      />
      <Route
        path="/community"
        element={
          <PublicLayout>
            <UserProtectedRoute>
              <UserPermissionRoute permission={PERMISSION_PUBLIC_COMMUNITY_VIEW}>
                <CommunityPage />
              </UserPermissionRoute>
            </UserProtectedRoute>
          </PublicLayout>
        }
      />
      <Route
        path="/community/new"
        element={
          <PublicLayout>
            <UserProtectedRoute>
              <UserPermissionRoute permission={PERMISSION_PUBLIC_COMMUNITY_POST_CREATE}>
                <CommunityPostEditorPage />
              </UserPermissionRoute>
            </UserProtectedRoute>
          </PublicLayout>
        }
      />
      <Route
        path="/community/:id"
        element={
          <PublicLayout>
            <UserProtectedRoute>
              <UserPermissionRoute permission={PERMISSION_PUBLIC_COMMUNITY_VIEW}>
                <CommunityPostDetailPage />
              </UserPermissionRoute>
            </UserProtectedRoute>
          </PublicLayout>
        }
      />
      <Route
        path="/community/:id/edit"
        element={
          <PublicLayout>
            <UserProtectedRoute>
              <UserPermissionRoute permission={PERMISSION_PUBLIC_COMMUNITY_POST_EDIT_OWN}>
                <CommunityPostEditorPage />
              </UserPermissionRoute>
            </UserProtectedRoute>
          </PublicLayout>
        }
      />
      <Route path="/login" element={<UserLoginPage />} />
      <Route path="/register" element={<UserRegisterPage />} />
      <Route
        path="/users/:username"
        element={
          <PublicLayout>
            <UserProtectedRoute>
              <UserPermissionRoute permission={PERMISSION_PUBLIC_PROFILE_VIEW_PUBLIC}>
                <PublicUserProfilePage />
              </UserPermissionRoute>
            </UserProtectedRoute>
          </PublicLayout>
        }
      />
      <Route path="/admin/login" element={<Navigate to="/login" replace />} />
      <Route
        path="/me"
        element={
          <PublicLayout>
            <UserProtectedRoute>
              <UserPermissionRoute permission={PERMISSION_PUBLIC_PROFILE_VIEW_OWN}>
                <UserCenterPage />
              </UserPermissionRoute>
            </UserProtectedRoute>
          </PublicLayout>
        }
      />
      <Route
        path="/notifications"
        element={
          <PublicLayout>
            <UserProtectedRoute>
              <UserPermissionRoute permission={PERMISSION_PUBLIC_NOTIFICATIONS_VIEW}>
                <NotificationsPage />
              </UserPermissionRoute>
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
          path="downloads"
          element={
            <AdminPermissionRoute permission={PERMISSION_ADMIN_DOWNLOADS_VIEW}>
              <AdminDownloadsPage />
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
          path="categories"
          element={
            <AdminPermissionRoute permission={[PERMISSION_ADMIN_CATEGORIES_VIEW, PERMISSION_ADMIN_CATEGORIES_CREATE, PERMISSION_ADMIN_CATEGORIES_EDIT, PERMISSION_ADMIN_CATEGORIES_DELETE, PERMISSION_ADMIN_CATEGORIES_LOGS]}>
              <AdminCategoriesPage />
            </AdminPermissionRoute>
          }
        />
        <Route
          path="tags"
          element={
            <AdminPermissionRoute permission={[PERMISSION_ADMIN_TAGS_VIEW, PERMISSION_ADMIN_TAGS_CREATE, PERMISSION_ADMIN_TAGS_EDIT, PERMISSION_ADMIN_TAGS_DELETE, PERMISSION_ADMIN_TAGS_LOGS]}>
              <AdminTagsPage />
            </AdminPermissionRoute>
          }
        />
        <Route
          path="community"
          element={
            <AdminPermissionRoute permission={[PERMISSION_ADMIN_COMMUNITY_VIEW, PERMISSION_ADMIN_COMMUNITY_MODERATE]}>
              <AdminCommunityPage />
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
