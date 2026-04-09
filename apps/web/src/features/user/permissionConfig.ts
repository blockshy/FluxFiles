import type { AppLocale } from '../i18n/LocaleProvider';
import {
  PERMISSION_ADMIN_AUDIT,
  PERMISSION_ADMIN_FILES_ALL,
  PERMISSION_ADMIN_FILES_DELETE,
  PERMISSION_ADMIN_FILES_EDIT,
  PERMISSION_ADMIN_FILES_OWN,
  PERMISSION_ADMIN_FILES_UPLOAD,
  PERMISSION_ADMIN_SETTINGS,
  PERMISSION_ADMIN_USERS_CREATE,
  PERMISSION_ADMIN_USERS_EDIT,
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
    [PERMISSION_ADMIN_USERS_CREATE]: locale === 'zh-CN' ? '用户新建' : 'User create',
    [PERMISSION_ADMIN_USERS_EDIT]: locale === 'zh-CN' ? '用户编辑' : 'User edit',
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

  const errors: string[] = [];
  const warnings: string[] = [];

  if ((canEditFile || canDeleteFile) && !hasFileScope) {
    errors.push(locale === 'zh-CN'
      ? '勾选“文件编辑”或“文件删除”时，必须同时勾选“自己的文件范围”或“全部文件范围”。'
      : 'File edit/delete requires either own-file scope or all-file scope.');
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

  return { errors, warnings };
}
