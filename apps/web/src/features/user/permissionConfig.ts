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
    [PERMISSION_ADMIN_TAGS_CREATE]: locale === 'zh-CN' ? '标签新建并绑定分类' : 'Tag create with category binding',
    [PERMISSION_ADMIN_TAGS_EDIT]: locale === 'zh-CN' ? '标签编辑及分类调整' : 'Tag edit and category reassignment',
    [PERMISSION_ADMIN_TAGS_DELETE]: locale === 'zh-CN' ? '标签删除' : 'Tag delete',
    [PERMISSION_ADMIN_TAGS_LOGS]: locale === 'zh-CN' ? '标签记录查看' : 'Tag logs',
    [PERMISSION_ADMIN_SETTINGS]: locale === 'zh-CN' ? '系统设置' : 'Settings',
    [PERMISSION_ADMIN_AUDIT]: locale === 'zh-CN' ? '审计日志' : 'Audit logs',
  };
}

export function getPermissionGroups(locale: AppLocale): PermissionGroup[] {
  return [
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

  return { errors, warnings };
}
