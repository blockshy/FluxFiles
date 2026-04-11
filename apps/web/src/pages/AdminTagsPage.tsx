import {
  createAdminTag,
  deleteAdminTag,
  fetchAdminTagLogs,
  fetchAdminTagOptions,
  moveAdminTag,
  updateAdminTag,
} from '../api/admin';
import { useI18n } from '../features/i18n/LocaleProvider';
import { useUserAuth } from '../features/user/AuthProvider';
import { hasPermission, PERMISSION_ADMIN_TAGS_CREATE, PERMISSION_ADMIN_TAGS_DELETE, PERMISSION_ADMIN_TAGS_EDIT, PERMISSION_ADMIN_TAGS_LOGS } from '../features/user/permissions';
import { TaxonomyAdminPage } from './TaxonomyAdminPage';

export function AdminTagsPage() {
  const { locale } = useI18n();
  const { user } = useUserAuth();

  return (
    <TaxonomyAdminPage
      kind="tag"
      title={locale === 'zh-CN' ? '标签管理' : 'Tag Management'}
      subtitle={locale === 'zh-CN' ? '按标签树统一维护层级标签，支持顶级标签、子标签、层级展开和同级排序。' : 'Manage hierarchical tags in a single expandable tag tree.'}
      createLabel={locale === 'zh-CN' ? '新建标签' : 'New tag'}
      createChildLabel={locale === 'zh-CN' ? '子标签' : 'Child tag'}
      deleteConfirm={locale === 'zh-CN' ? '确认删除这个标签？仅未被文件使用的标签可删除。' : 'Delete this tag? Only unused tags can be deleted.'}
      deleteInUseHint={locale === 'zh-CN' ? '标签仍被文件使用，无法删除。' : 'This tag is still used by files.'}
      recordLabel={locale === 'zh-CN' ? '标签名称' : 'Tag name'}
      searchPlaceholder={locale === 'zh-CN' ? '搜索标签名称' : 'Search tags'}
      treeQueryKey="admin-tags-tree"
      logsQueryKey="admin-tag-logs"
      extraInvalidateKeys={['admin-files', 'public-files']}
      fetchTreeItems={fetchAdminTagOptions}
      createItem={createAdminTag}
      updateItem={updateAdminTag}
      moveItem={moveAdminTag}
      deleteItem={deleteAdminTag}
      fetchLogs={fetchAdminTagLogs}
      canCreate={hasPermission(user, PERMISSION_ADMIN_TAGS_CREATE)}
      canEdit={hasPermission(user, PERMISSION_ADMIN_TAGS_EDIT)}
      canDelete={hasPermission(user, PERMISSION_ADMIN_TAGS_DELETE)}
      canViewLogs={hasPermission(user, PERMISSION_ADMIN_TAGS_LOGS)}
      locale={locale}
    />
  );
}
