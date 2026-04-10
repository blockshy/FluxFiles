import type { UserAccount } from '../../api/types';

export const PERMISSION_ADMIN_FILES_OWN = 'admin.files.own';
export const PERMISSION_ADMIN_FILES_ALL = 'admin.files.all';
export const PERMISSION_ADMIN_FILES_UPLOAD = 'admin.files.upload';
export const PERMISSION_ADMIN_FILES_EDIT = 'admin.files.edit';
export const PERMISSION_ADMIN_FILES_DELETE = 'admin.files.delete';
export const PERMISSION_ADMIN_USERS_CREATE = 'admin.users.create';
export const PERMISSION_ADMIN_USERS_EDIT = 'admin.users.edit';
export const PERMISSION_ADMIN_CATEGORIES_VIEW = 'admin.categories.view';
export const PERMISSION_ADMIN_CATEGORIES_CREATE = 'admin.categories.create';
export const PERMISSION_ADMIN_CATEGORIES_EDIT = 'admin.categories.edit';
export const PERMISSION_ADMIN_CATEGORIES_DELETE = 'admin.categories.delete';
export const PERMISSION_ADMIN_CATEGORIES_LOGS = 'admin.categories.logs';
export const PERMISSION_ADMIN_TAGS_VIEW = 'admin.tags.view';
export const PERMISSION_ADMIN_TAGS_CREATE = 'admin.tags.create';
export const PERMISSION_ADMIN_TAGS_EDIT = 'admin.tags.edit';
export const PERMISSION_ADMIN_TAGS_DELETE = 'admin.tags.delete';
export const PERMISSION_ADMIN_TAGS_LOGS = 'admin.tags.logs';
export const PERMISSION_ADMIN_SETTINGS = 'admin.settings';
export const PERMISSION_ADMIN_AUDIT = 'admin.audit';

export const ALL_ADMIN_PERMISSIONS = [
  PERMISSION_ADMIN_FILES_OWN,
  PERMISSION_ADMIN_FILES_ALL,
  PERMISSION_ADMIN_FILES_UPLOAD,
  PERMISSION_ADMIN_FILES_EDIT,
  PERMISSION_ADMIN_FILES_DELETE,
  PERMISSION_ADMIN_USERS_CREATE,
  PERMISSION_ADMIN_USERS_EDIT,
  PERMISSION_ADMIN_CATEGORIES_VIEW,
  PERMISSION_ADMIN_CATEGORIES_CREATE,
  PERMISSION_ADMIN_CATEGORIES_EDIT,
  PERMISSION_ADMIN_CATEGORIES_DELETE,
  PERMISSION_ADMIN_CATEGORIES_LOGS,
  PERMISSION_ADMIN_TAGS_VIEW,
  PERMISSION_ADMIN_TAGS_CREATE,
  PERMISSION_ADMIN_TAGS_EDIT,
  PERMISSION_ADMIN_TAGS_DELETE,
  PERMISSION_ADMIN_TAGS_LOGS,
  PERMISSION_ADMIN_SETTINGS,
  PERMISSION_ADMIN_AUDIT,
];

export function hasPermission(user: UserAccount | null | undefined, permission: string) {
  return Boolean(user?.permissions?.includes(permission));
}

export function canAccessAdmin(user: UserAccount | null | undefined) {
  return user?.role === 'admin' && ALL_ADMIN_PERMISSIONS.some((permission) => hasPermission(user, permission));
}

export function canAccessAdminFiles(user: UserAccount | null | undefined) {
  return (
    hasPermission(user, PERMISSION_ADMIN_FILES_OWN) ||
    hasPermission(user, PERMISSION_ADMIN_FILES_ALL) ||
    hasPermission(user, PERMISSION_ADMIN_FILES_UPLOAD) ||
    hasPermission(user, PERMISSION_ADMIN_FILES_EDIT) ||
    hasPermission(user, PERMISSION_ADMIN_FILES_DELETE)
  );
}

export function canAccessAdminUsers(user: UserAccount | null | undefined) {
  return hasPermission(user, PERMISSION_ADMIN_USERS_CREATE) || hasPermission(user, PERMISSION_ADMIN_USERS_EDIT);
}

export function canAccessAdminCategories(user: UserAccount | null | undefined) {
  return (
    hasPermission(user, PERMISSION_ADMIN_CATEGORIES_VIEW) ||
    hasPermission(user, PERMISSION_ADMIN_CATEGORIES_CREATE) ||
    hasPermission(user, PERMISSION_ADMIN_CATEGORIES_EDIT) ||
    hasPermission(user, PERMISSION_ADMIN_CATEGORIES_DELETE) ||
    hasPermission(user, PERMISSION_ADMIN_CATEGORIES_LOGS)
  );
}

export function canAccessAdminTags(user: UserAccount | null | undefined) {
  return (
    hasPermission(user, PERMISSION_ADMIN_TAGS_VIEW) ||
    hasPermission(user, PERMISSION_ADMIN_TAGS_CREATE) ||
    hasPermission(user, PERMISSION_ADMIN_TAGS_EDIT) ||
    hasPermission(user, PERMISSION_ADMIN_TAGS_DELETE) ||
    hasPermission(user, PERMISSION_ADMIN_TAGS_LOGS)
  );
}

export function getAdminHomePath(user: UserAccount | null | undefined) {
  if (canAccessAdminFiles(user)) {
    return '/admin/files';
  }
  if (canAccessAdminCategories(user)) {
    return '/admin/categories';
  }
  if (canAccessAdminTags(user)) {
    return '/admin/tags';
  }
  if (canAccessAdminUsers(user)) {
    return '/admin/users';
  }
  if (hasPermission(user, PERMISSION_ADMIN_SETTINGS)) {
    return '/admin/settings';
  }
  if (hasPermission(user, PERMISSION_ADMIN_AUDIT)) {
    return '/admin/logs';
  }
  return '/';
}
