import type { UserAccount } from '../../api/types';

export const PERMISSION_ADMIN_FILES_OWN = 'admin.files.own';
export const PERMISSION_ADMIN_FILES_ALL = 'admin.files.all';
export const PERMISSION_ADMIN_FILES_UPLOAD = 'admin.files.upload';
export const PERMISSION_ADMIN_FILES_EDIT = 'admin.files.edit';
export const PERMISSION_ADMIN_FILES_DELETE = 'admin.files.delete';
export const PERMISSION_ADMIN_DOWNLOADS_VIEW = 'admin.downloads.view';
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
export const PERMISSION_ADMIN_COMMUNITY_VIEW = 'admin.community.view';
export const PERMISSION_ADMIN_COMMUNITY_MODERATE = 'admin.community.moderate';
export const PERMISSION_ADMIN_SETTINGS = 'admin.settings';
export const PERMISSION_ADMIN_AUDIT = 'admin.audit';

export const PERMISSION_PUBLIC_FILES_VIEW = 'public.files.view';
export const PERMISSION_PUBLIC_FILES_DETAIL = 'public.files.detail';
export const PERMISSION_PUBLIC_FILES_DOWNLOAD = 'public.files.download';
export const PERMISSION_PUBLIC_FILES_FAVORITE = 'public.files.favorite';
export const PERMISSION_PUBLIC_COMMENTS_CREATE = 'public.comments.create';
export const PERMISSION_PUBLIC_COMMENTS_REPLY = 'public.comments.reply';
export const PERMISSION_PUBLIC_COMMENTS_VOTE = 'public.comments.vote';
export const PERMISSION_PUBLIC_COMMENTS_DELETE_OWN = 'public.comments.delete_own';
export const PERMISSION_PUBLIC_COMMUNITY_VIEW = 'public.community.view';
export const PERMISSION_PUBLIC_COMMUNITY_POST_CREATE = 'public.community.post.create';
export const PERMISSION_PUBLIC_COMMUNITY_POST_EDIT_OWN = 'public.community.post.edit_own';
export const PERMISSION_PUBLIC_COMMUNITY_POST_DELETE_OWN = 'public.community.post.delete_own';
export const PERMISSION_PUBLIC_COMMUNITY_REPLY_CREATE = 'public.community.reply.create';
export const PERMISSION_PUBLIC_COMMUNITY_REPLY_DELETE_OWN = 'public.community.reply.delete_own';
export const PERMISSION_PUBLIC_PROFILE_VIEW_OWN = 'public.profile.view_own';
export const PERMISSION_PUBLIC_PROFILE_EDIT_OWN = 'public.profile.edit_own';
export const PERMISSION_PUBLIC_PROFILE_VIEW_PUBLIC = 'public.profile.view_public';
export const PERMISSION_PUBLIC_NOTIFICATIONS_VIEW = 'public.notifications.view';

export const DEFAULT_USER_PERMISSION_TEMPLATE_KEY = 'default_user';

export const ALL_ADMIN_PERMISSIONS = [
  PERMISSION_ADMIN_FILES_OWN,
  PERMISSION_ADMIN_FILES_ALL,
  PERMISSION_ADMIN_FILES_UPLOAD,
  PERMISSION_ADMIN_FILES_EDIT,
  PERMISSION_ADMIN_FILES_DELETE,
  PERMISSION_ADMIN_DOWNLOADS_VIEW,
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
  PERMISSION_ADMIN_COMMUNITY_VIEW,
  PERMISSION_ADMIN_COMMUNITY_MODERATE,
  PERMISSION_ADMIN_SETTINGS,
  PERMISSION_ADMIN_AUDIT,
];

export const ALL_PUBLIC_PERMISSIONS = [
  PERMISSION_PUBLIC_FILES_VIEW,
  PERMISSION_PUBLIC_FILES_DETAIL,
  PERMISSION_PUBLIC_FILES_DOWNLOAD,
  PERMISSION_PUBLIC_FILES_FAVORITE,
  PERMISSION_PUBLIC_COMMENTS_CREATE,
  PERMISSION_PUBLIC_COMMENTS_REPLY,
  PERMISSION_PUBLIC_COMMENTS_VOTE,
  PERMISSION_PUBLIC_COMMENTS_DELETE_OWN,
  PERMISSION_PUBLIC_COMMUNITY_VIEW,
  PERMISSION_PUBLIC_COMMUNITY_POST_CREATE,
  PERMISSION_PUBLIC_COMMUNITY_POST_EDIT_OWN,
  PERMISSION_PUBLIC_COMMUNITY_POST_DELETE_OWN,
  PERMISSION_PUBLIC_COMMUNITY_REPLY_CREATE,
  PERMISSION_PUBLIC_COMMUNITY_REPLY_DELETE_OWN,
  PERMISSION_PUBLIC_PROFILE_VIEW_OWN,
  PERMISSION_PUBLIC_PROFILE_EDIT_OWN,
  PERMISSION_PUBLIC_PROFILE_VIEW_PUBLIC,
  PERMISSION_PUBLIC_NOTIFICATIONS_VIEW,
];

export function hasPermission(user: UserAccount | null | undefined, permission: string) {
  return Boolean(user?.permissions?.includes(permission));
}

export function canAccessAdmin(user: UserAccount | null | undefined) {
  return user?.role === 'admin' && ALL_ADMIN_PERMISSIONS.some((permission) => hasPermission(user, permission));
}

export function canAccessCommunity(user: UserAccount | null | undefined) {
  return hasPermission(user, PERMISSION_PUBLIC_COMMUNITY_VIEW);
}

export function canAccessAdminFiles(user: UserAccount | null | undefined) {
  return (
    hasPermission(user, PERMISSION_ADMIN_FILES_OWN) ||
    hasPermission(user, PERMISSION_ADMIN_FILES_ALL) ||
    hasPermission(user, PERMISSION_ADMIN_FILES_UPLOAD) ||
    hasPermission(user, PERMISSION_ADMIN_FILES_EDIT) ||
    hasPermission(user, PERMISSION_ADMIN_FILES_DELETE) ||
    hasPermission(user, PERMISSION_ADMIN_DOWNLOADS_VIEW)
  );
}

export function canAccessAdminDownloads(user: UserAccount | null | undefined) {
  return hasPermission(user, PERMISSION_ADMIN_DOWNLOADS_VIEW);
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
  if (canAccessAdminDownloads(user)) {
    return '/admin/downloads';
  }
  if (canAccessAdminCategories(user)) {
    return '/admin/categories';
  }
  if (canAccessAdminTags(user)) {
    return '/admin/tags';
  }
  if (hasPermission(user, PERMISSION_ADMIN_COMMUNITY_VIEW) || hasPermission(user, PERMISSION_ADMIN_COMMUNITY_MODERATE)) {
    return '/admin/community';
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
