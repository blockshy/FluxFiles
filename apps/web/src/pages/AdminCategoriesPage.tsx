import { fetchAdminCategories, createAdminCategory, updateAdminCategory, deleteAdminCategory, fetchAdminCategoryLogs } from '../api/admin';
import { useI18n } from '../features/i18n/LocaleProvider';
import { useUserAuth } from '../features/user/AuthProvider';
import { hasPermission, PERMISSION_ADMIN_CATEGORIES_CREATE, PERMISSION_ADMIN_CATEGORIES_DELETE, PERMISSION_ADMIN_CATEGORIES_EDIT, PERMISSION_ADMIN_CATEGORIES_LOGS } from '../features/user/permissions';
import { TaxonomyAdminPage } from './TaxonomyAdminPage';

export function AdminCategoriesPage() {
  const { locale } = useI18n();
  const { user } = useUserAuth();

  return (
    <TaxonomyAdminPage
      title={locale === 'zh-CN' ? '分类管理' : 'Category Management'}
      subtitle={locale === 'zh-CN' ? '统一维护文件分类，并保留创建者、修改者和每次变更记录。' : 'Manage file categories with creator, updater, and change history.'}
      createLabel={locale === 'zh-CN' ? '新建分类' : 'New category'}
      deleteConfirm={locale === 'zh-CN' ? '确认删除这个分类？仅未被文件使用的分类可删除。' : 'Delete this category? Only unused categories can be deleted.'}
      deleteInUseHint={locale === 'zh-CN' ? '分类仍被文件使用，无法删除。' : 'This category is still used by files.'}
      recordLabel={locale === 'zh-CN' ? '分类名称' : 'Category name'}
      searchPlaceholder={locale === 'zh-CN' ? '搜索分类名称' : 'Search categories'}
      listQueryKey="admin-categories"
      optionsQueryKey="admin-category-options"
      logsQueryKey="admin-category-logs"
      fetchList={fetchAdminCategories}
      createItem={createAdminCategory}
      updateItem={updateAdminCategory}
      deleteItem={deleteAdminCategory}
      fetchLogs={fetchAdminCategoryLogs}
      canCreate={hasPermission(user, PERMISSION_ADMIN_CATEGORIES_CREATE)}
      canEdit={hasPermission(user, PERMISSION_ADMIN_CATEGORIES_EDIT)}
      canDelete={hasPermission(user, PERMISSION_ADMIN_CATEGORIES_DELETE)}
      canViewLogs={hasPermission(user, PERMISSION_ADMIN_CATEGORIES_LOGS)}
      locale={locale}
    />
  );
}
