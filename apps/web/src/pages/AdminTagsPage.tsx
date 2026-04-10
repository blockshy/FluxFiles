import { createAdminTag, deleteAdminTag, fetchAdminTagLogs, fetchAdminTags, updateAdminTag } from '../api/admin';
import { useI18n } from '../features/i18n/LocaleProvider';
import { useUserAuth } from '../features/user/AuthProvider';
import { hasPermission, PERMISSION_ADMIN_TAGS_CREATE, PERMISSION_ADMIN_TAGS_DELETE, PERMISSION_ADMIN_TAGS_EDIT, PERMISSION_ADMIN_TAGS_LOGS } from '../features/user/permissions';
import { TaxonomyAdminPage } from './TaxonomyAdminPage';

export function AdminTagsPage() {
  const { locale } = useI18n();
  const { user } = useUserAuth();

  return (
    <TaxonomyAdminPage
      title={locale === 'zh-CN' ? '标签管理' : 'Tag Management'}
      subtitle={locale === 'zh-CN' ? '统一维护文件标签，并保留创建者、修改者和每次变更记录。' : 'Manage file tags with creator, updater, and change history.'}
      createLabel={locale === 'zh-CN' ? '新建标签' : 'New tag'}
      deleteConfirm={locale === 'zh-CN' ? '确认删除这个标签？仅未被文件使用的标签可删除。' : 'Delete this tag? Only unused tags can be deleted.'}
      deleteInUseHint={locale === 'zh-CN' ? '标签仍被文件使用，无法删除。' : 'This tag is still used by files.'}
      recordLabel={locale === 'zh-CN' ? '标签名称' : 'Tag name'}
      searchPlaceholder={locale === 'zh-CN' ? '搜索标签名称' : 'Search tags'}
      listQueryKey="admin-tags"
      optionsQueryKey="admin-tag-options"
      logsQueryKey="admin-tag-logs"
      fetchList={fetchAdminTags}
      createItem={createAdminTag}
      updateItem={updateAdminTag}
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
