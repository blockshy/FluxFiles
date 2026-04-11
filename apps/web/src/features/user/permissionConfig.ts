import type { AppLocale } from '../i18n/LocaleProvider';
import {
  PERMISSION_ADMIN_AUDIT,
  PERMISSION_ADMIN_FILES_ALL,
  PERMISSION_ADMIN_FILES_DELETE,
  PERMISSION_ADMIN_FILES_EDIT,
  PERMISSION_ADMIN_FILES_OWN,
  PERMISSION_ADMIN_FILES_UPLOAD,
  PERMISSION_ADMIN_DOWNLOADS_VIEW,
  PERMISSION_ADMIN_SETTINGS,
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
} from './permissions';

export interface PermissionGroup {
  key: string;
  title: string;
  options: string[];
}

export interface PermissionCombinationFeedback {
  errors: string[];
  warnings: string[];
}

export function getPermissionLabels(locale: AppLocale): Record<string, string> {
  return {
    [PERMISSION_ADMIN_FILES_OWN]: locale === 'zh-CN' ? '自己的文件范围' : 'Own file scope',
    [PERMISSION_ADMIN_FILES_ALL]: locale === 'zh-CN' ? '全部文件范围' : 'All file scope',
    [PERMISSION_ADMIN_FILES_UPLOAD]: locale === 'zh-CN' ? '文件上传' : 'File upload',
    [PERMISSION_ADMIN_FILES_EDIT]: locale === 'zh-CN' ? '文件编辑' : 'File edit',
    [PERMISSION_ADMIN_FILES_DELETE]: locale === 'zh-CN' ? '文件删除' : 'File delete',
    [PERMISSION_ADMIN_DOWNLOADS_VIEW]: locale === 'zh-CN' ? '下载记录查看' : 'Download record view',
    [PERMISSION_ADMIN_USERS_CREATE]: locale === 'zh-CN' ? '用户新建' : 'User create',
    [PERMISSION_ADMIN_USERS_EDIT]: locale === 'zh-CN' ? '用户编辑' : 'User edit',
    [PERMISSION_ADMIN_CATEGORIES_VIEW]: locale === 'zh-CN' ? '分类树查看' : 'Category tree view',
    [PERMISSION_ADMIN_CATEGORIES_CREATE]: locale === 'zh-CN' ? '分类新建' : 'Category create',
    [PERMISSION_ADMIN_CATEGORIES_EDIT]: locale === 'zh-CN' ? '分类编辑' : 'Category edit',
    [PERMISSION_ADMIN_CATEGORIES_DELETE]: locale === 'zh-CN' ? '分类删除' : 'Category delete',
    [PERMISSION_ADMIN_CATEGORIES_LOGS]: locale === 'zh-CN' ? '分类记录查看' : 'Category logs',
    [PERMISSION_ADMIN_TAGS_VIEW]: locale === 'zh-CN' ? '标签查看' : 'Tag view',
    [PERMISSION_ADMIN_TAGS_CREATE]: locale === 'zh-CN' ? '标签新建' : 'Tag create',
    [PERMISSION_ADMIN_TAGS_EDIT]: locale === 'zh-CN' ? '标签编辑及层级调整' : 'Tag edit and hierarchy change',
    [PERMISSION_ADMIN_TAGS_DELETE]: locale === 'zh-CN' ? '标签删除' : 'Tag delete',
    [PERMISSION_ADMIN_TAGS_LOGS]: locale === 'zh-CN' ? '标签记录查看' : 'Tag logs',
    [PERMISSION_ADMIN_COMMUNITY_VIEW]: locale === 'zh-CN' ? '社区帖子查看' : 'Community post view',
    [PERMISSION_ADMIN_COMMUNITY_MODERATE]: locale === 'zh-CN' ? '社区帖子置顶/锁定/删除' : 'Community post moderation',
    [PERMISSION_ADMIN_SETTINGS]: locale === 'zh-CN' ? '系统设置' : 'Settings',
    [PERMISSION_ADMIN_AUDIT]: locale === 'zh-CN' ? '审计日志' : 'Audit logs',
    [PERMISSION_PUBLIC_FILES_VIEW]: locale === 'zh-CN' ? '前台文件列表查看' : 'Public file list view',
    [PERMISSION_PUBLIC_FILES_DETAIL]: locale === 'zh-CN' ? '前台文件详情查看' : 'Public file detail view',
    [PERMISSION_PUBLIC_FILES_DOWNLOAD]: locale === 'zh-CN' ? '前台文件下载' : 'Public file download',
    [PERMISSION_PUBLIC_FILES_FAVORITE]: locale === 'zh-CN' ? '前台文件收藏' : 'Public file favorite',
    [PERMISSION_PUBLIC_COMMENTS_CREATE]: locale === 'zh-CN' ? '文件评论发布' : 'File comment create',
    [PERMISSION_PUBLIC_COMMENTS_REPLY]: locale === 'zh-CN' ? '文件评论回复' : 'File comment reply',
    [PERMISSION_PUBLIC_COMMENTS_VOTE]: locale === 'zh-CN' ? '文件评论点赞/点踩' : 'File comment vote',
    [PERMISSION_PUBLIC_COMMENTS_DELETE_OWN]: locale === 'zh-CN' ? '删除自己的文件评论' : 'Delete own file comments',
    [PERMISSION_PUBLIC_COMMUNITY_VIEW]: locale === 'zh-CN' ? '社区查看' : 'Community view',
    [PERMISSION_PUBLIC_COMMUNITY_POST_CREATE]: locale === 'zh-CN' ? '社区发帖' : 'Community post create',
    [PERMISSION_PUBLIC_COMMUNITY_POST_EDIT_OWN]: locale === 'zh-CN' ? '编辑自己的帖子' : 'Edit own community posts',
    [PERMISSION_PUBLIC_COMMUNITY_POST_DELETE_OWN]: locale === 'zh-CN' ? '删除自己的帖子' : 'Delete own community posts',
    [PERMISSION_PUBLIC_COMMUNITY_REPLY_CREATE]: locale === 'zh-CN' ? '社区回复' : 'Community reply create',
    [PERMISSION_PUBLIC_COMMUNITY_REPLY_DELETE_OWN]: locale === 'zh-CN' ? '删除自己的社区回复' : 'Delete own community replies',
    [PERMISSION_PUBLIC_PROFILE_VIEW_OWN]: locale === 'zh-CN' ? '个人中心查看' : 'Own profile view',
    [PERMISSION_PUBLIC_PROFILE_EDIT_OWN]: locale === 'zh-CN' ? '个人资料编辑' : 'Own profile edit',
    [PERMISSION_PUBLIC_PROFILE_VIEW_PUBLIC]: locale === 'zh-CN' ? '用户公开主页查看' : 'Public user profile view',
    [PERMISSION_PUBLIC_NOTIFICATIONS_VIEW]: locale === 'zh-CN' ? '消息通知与互动记录' : 'Notifications and interaction records',
  };
}

export function getPermissionGroups(locale: AppLocale): PermissionGroup[] {
  return [
    {
      key: 'public-files',
      title: locale === 'zh-CN' ? '前台文件权限' : 'Public file permissions',
      options: [
        PERMISSION_PUBLIC_FILES_VIEW,
        PERMISSION_PUBLIC_FILES_DETAIL,
        PERMISSION_PUBLIC_FILES_DOWNLOAD,
        PERMISSION_PUBLIC_FILES_FAVORITE,
        PERMISSION_PUBLIC_COMMENTS_CREATE,
        PERMISSION_PUBLIC_COMMENTS_REPLY,
        PERMISSION_PUBLIC_COMMENTS_VOTE,
        PERMISSION_PUBLIC_COMMENTS_DELETE_OWN,
      ],
    },
    {
      key: 'public-community',
      title: locale === 'zh-CN' ? '前台社区权限' : 'Public community permissions',
      options: [
        PERMISSION_PUBLIC_COMMUNITY_VIEW,
        PERMISSION_PUBLIC_COMMUNITY_POST_CREATE,
        PERMISSION_PUBLIC_COMMUNITY_POST_EDIT_OWN,
        PERMISSION_PUBLIC_COMMUNITY_POST_DELETE_OWN,
        PERMISSION_PUBLIC_COMMUNITY_REPLY_CREATE,
        PERMISSION_PUBLIC_COMMUNITY_REPLY_DELETE_OWN,
      ],
    },
    {
      key: 'public-account',
      title: locale === 'zh-CN' ? '前台账号权限' : 'Public account permissions',
      options: [
        PERMISSION_PUBLIC_PROFILE_VIEW_OWN,
        PERMISSION_PUBLIC_PROFILE_EDIT_OWN,
        PERMISSION_PUBLIC_PROFILE_VIEW_PUBLIC,
        PERMISSION_PUBLIC_NOTIFICATIONS_VIEW,
      ],
    },
    {
      key: 'files',
      title: locale === 'zh-CN' ? '文件权限' : 'File permissions',
      options: [
        PERMISSION_ADMIN_FILES_OWN,
        PERMISSION_ADMIN_FILES_ALL,
        PERMISSION_ADMIN_FILES_UPLOAD,
        PERMISSION_ADMIN_FILES_EDIT,
        PERMISSION_ADMIN_FILES_DELETE,
        PERMISSION_ADMIN_DOWNLOADS_VIEW,
      ],
    },
    {
      key: 'users',
      title: locale === 'zh-CN' ? '用户权限' : 'User permissions',
      options: [
        PERMISSION_ADMIN_USERS_CREATE,
        PERMISSION_ADMIN_USERS_EDIT,
      ],
    },
    {
      key: 'categories',
      title: locale === 'zh-CN' ? '分类权限' : 'Category permissions',
      options: [
        PERMISSION_ADMIN_CATEGORIES_VIEW,
        PERMISSION_ADMIN_CATEGORIES_CREATE,
        PERMISSION_ADMIN_CATEGORIES_EDIT,
        PERMISSION_ADMIN_CATEGORIES_DELETE,
        PERMISSION_ADMIN_CATEGORIES_LOGS,
      ],
    },
    {
      key: 'tags',
      title: locale === 'zh-CN' ? '标签权限' : 'Tag permissions',
      options: [
        PERMISSION_ADMIN_TAGS_VIEW,
        PERMISSION_ADMIN_TAGS_CREATE,
        PERMISSION_ADMIN_TAGS_EDIT,
        PERMISSION_ADMIN_TAGS_DELETE,
        PERMISSION_ADMIN_TAGS_LOGS,
      ],
    },
    {
      key: 'community',
      title: locale === 'zh-CN' ? '社区权限' : 'Community permissions',
      options: [
        PERMISSION_ADMIN_COMMUNITY_VIEW,
        PERMISSION_ADMIN_COMMUNITY_MODERATE,
      ],
    },
    {
      key: 'system',
      title: locale === 'zh-CN' ? '系统权限' : 'System permissions',
      options: [
        PERMISSION_ADMIN_SETTINGS,
        PERMISSION_ADMIN_AUDIT,
      ],
    },
  ];
}

export function getPermissionCombinationFeedback(locale: AppLocale, permissions: string[] | undefined): PermissionCombinationFeedback {
  const selected = new Set(permissions ?? []);
  const hasOwnScope = selected.has(PERMISSION_ADMIN_FILES_OWN);
  const hasAllScope = selected.has(PERMISSION_ADMIN_FILES_ALL);
  const hasFileScope = hasOwnScope || hasAllScope;
  const canEditFile = selected.has(PERMISSION_ADMIN_FILES_EDIT);
  const canDeleteFile = selected.has(PERMISSION_ADMIN_FILES_DELETE);
  const canUploadFile = selected.has(PERMISSION_ADMIN_FILES_UPLOAD);
  const canViewDownloads = selected.has(PERMISSION_ADMIN_DOWNLOADS_VIEW);
  const categoryView = selected.has(PERMISSION_ADMIN_CATEGORIES_VIEW);
  const tagView = selected.has(PERMISSION_ADMIN_TAGS_VIEW);
  const communityView = selected.has(PERMISSION_ADMIN_COMMUNITY_VIEW);
  const publicFilesView = selected.has(PERMISSION_PUBLIC_FILES_VIEW);
  const publicFilesDetail = selected.has(PERMISSION_PUBLIC_FILES_DETAIL);
  const publicCommunityView = selected.has(PERMISSION_PUBLIC_COMMUNITY_VIEW);

  const errors: string[] = [];
  const warnings: string[] = [];

  if ((canEditFile || canDeleteFile) && !hasFileScope) {
    errors.push(locale === 'zh-CN'
      ? '勾选“文件编辑”或“文件删除”时，必须同时勾选“自己的文件范围”或“全部文件范围”。'
      : 'File edit/delete requires either own-file scope or all-file scope.');
  }

  if (canViewDownloads && !hasFileScope) {
    errors.push(locale === 'zh-CN'
      ? '勾选“下载记录查看”时，必须同时勾选“自己的文件范围”或“全部文件范围”。'
      : 'Download record view requires either own-file scope or all-file scope.');
  }

  if (hasOwnScope && hasAllScope) {
    warnings.push(locale === 'zh-CN'
      ? '“全部文件范围”已经覆盖“自己的文件范围”，同时勾选通常是冗余的。'
      : 'All-file scope already covers own-file scope, so selecting both is usually redundant.');
  }

  if (hasFileScope && !canUploadFile && !canEditFile && !canDeleteFile) {
    warnings.push(locale === 'zh-CN'
      ? '当前只授予了文件范围，没有授予上传、编辑或删除动作，这将表现为只读访问。'
      : 'A file scope without upload/edit/delete results in read-only access.');
  }

  if (canUploadFile && !hasFileScope && !canEditFile && !canDeleteFile) {
    warnings.push(locale === 'zh-CN'
      ? '当前仅授予文件上传，不授予文件编辑或删除，用户将只能上传新文件。'
      : 'Upload-only permission allows creating new files, but not editing or deleting existing ones.');
  }

  if (
    (selected.has(PERMISSION_ADMIN_CATEGORIES_CREATE) ||
      selected.has(PERMISSION_ADMIN_CATEGORIES_EDIT) ||
      selected.has(PERMISSION_ADMIN_CATEGORIES_DELETE) ||
      selected.has(PERMISSION_ADMIN_CATEGORIES_LOGS)) &&
    !categoryView
  ) {
    errors.push(locale === 'zh-CN'
      ? '分类的新建、编辑、删除、记录查看权限依赖“分类查看”。'
      : 'Category create/edit/delete/logs require category view.');
  }

  if (
    (selected.has(PERMISSION_ADMIN_TAGS_CREATE) ||
      selected.has(PERMISSION_ADMIN_TAGS_EDIT) ||
      selected.has(PERMISSION_ADMIN_TAGS_DELETE) ||
      selected.has(PERMISSION_ADMIN_TAGS_LOGS)) &&
    !tagView
  ) {
    errors.push(locale === 'zh-CN'
      ? '标签的新建、编辑、删除、记录查看权限依赖“标签查看”。'
      : 'Tag create/edit/delete/logs require tag view.');
  }

  if (selected.has(PERMISSION_ADMIN_COMMUNITY_MODERATE) && !communityView) {
    errors.push(locale === 'zh-CN'
      ? '社区置顶、锁定、删除权限依赖“社区帖子查看”。'
      : 'Community moderation requires community post view.');
  }

  if (
    (selected.has(PERMISSION_PUBLIC_FILES_DETAIL) ||
      selected.has(PERMISSION_PUBLIC_FILES_DOWNLOAD) ||
      selected.has(PERMISSION_PUBLIC_FILES_FAVORITE) ||
      selected.has(PERMISSION_PUBLIC_COMMENTS_CREATE) ||
      selected.has(PERMISSION_PUBLIC_COMMENTS_REPLY) ||
      selected.has(PERMISSION_PUBLIC_COMMENTS_VOTE) ||
      selected.has(PERMISSION_PUBLIC_COMMENTS_DELETE_OWN)) &&
    !publicFilesView
  ) {
    errors.push(locale === 'zh-CN'
      ? '前台文件详情、下载、收藏和评论权限依赖“前台文件列表查看”。'
      : 'Public file actions require public file list view.');
  }

  if (
    (selected.has(PERMISSION_PUBLIC_FILES_DOWNLOAD) ||
      selected.has(PERMISSION_PUBLIC_FILES_FAVORITE) ||
      selected.has(PERMISSION_PUBLIC_COMMENTS_CREATE) ||
      selected.has(PERMISSION_PUBLIC_COMMENTS_REPLY) ||
      selected.has(PERMISSION_PUBLIC_COMMENTS_VOTE) ||
      selected.has(PERMISSION_PUBLIC_COMMENTS_DELETE_OWN)) &&
    !publicFilesDetail
  ) {
    errors.push(locale === 'zh-CN'
      ? '前台文件下载、收藏和评论权限依赖“前台文件详情查看”。'
      : 'Public file interactions require public file detail view.');
  }

  if (selected.has(PERMISSION_PUBLIC_COMMENTS_REPLY) && !selected.has(PERMISSION_PUBLIC_COMMENTS_CREATE)) {
    errors.push(locale === 'zh-CN'
      ? '文件评论回复权限依赖“文件评论发布”。'
      : 'File comment reply requires file comment create.');
  }

  if (
    (selected.has(PERMISSION_PUBLIC_COMMUNITY_POST_CREATE) ||
      selected.has(PERMISSION_PUBLIC_COMMUNITY_POST_EDIT_OWN) ||
      selected.has(PERMISSION_PUBLIC_COMMUNITY_POST_DELETE_OWN) ||
      selected.has(PERMISSION_PUBLIC_COMMUNITY_REPLY_CREATE) ||
      selected.has(PERMISSION_PUBLIC_COMMUNITY_REPLY_DELETE_OWN)) &&
    !publicCommunityView
  ) {
    errors.push(locale === 'zh-CN'
      ? '社区发帖、编辑、删除和回复权限依赖“社区查看”。'
      : 'Community actions require community view.');
  }

  if (
    (selected.has(PERMISSION_PUBLIC_COMMUNITY_POST_EDIT_OWN) ||
      selected.has(PERMISSION_PUBLIC_COMMUNITY_POST_DELETE_OWN)) &&
    !selected.has(PERMISSION_PUBLIC_COMMUNITY_POST_CREATE)
  ) {
    errors.push(locale === 'zh-CN'
      ? '编辑或删除自己的帖子权限依赖“社区发帖”。'
      : 'Editing/deleting own posts requires community post create.');
  }

  if (selected.has(PERMISSION_PUBLIC_COMMUNITY_REPLY_DELETE_OWN) && !selected.has(PERMISSION_PUBLIC_COMMUNITY_REPLY_CREATE)) {
    errors.push(locale === 'zh-CN'
      ? '删除自己的社区回复权限依赖“社区回复”。'
      : 'Deleting own community replies requires community reply create.');
  }

  if (selected.has(PERMISSION_PUBLIC_PROFILE_EDIT_OWN) && !selected.has(PERMISSION_PUBLIC_PROFILE_VIEW_OWN)) {
    errors.push(locale === 'zh-CN'
      ? '个人资料编辑权限依赖“个人中心查看”。'
      : 'Own profile edit requires own profile view.');
  }

  return { errors, warnings };
}
