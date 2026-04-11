import { DeleteOutlined, EditOutlined, FileSearchOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Input, Modal, Popconfirm, Select, Space, Table, Tag, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useDeferredValue, useMemo, useState } from 'react';
import { createAdminFile, deleteAdminFile, fetchAdminCategoryOptions, fetchAdminFileDownloads, fetchAdminFiles, fetchAdminStats, fetchAdminTagCategoryOptions, fetchAdminTagOptions, fetchAdminUploadSettings, prepareAdminUpload, updateAdminFile, uploadFileToOSS } from '../api/admin';
import type { AdminDownloadRecord, FileRecord, TaxonomyRecord, UpdateFilePayload } from '../api/types';
import { FileFormModal } from '../features/admin/FileFormModal';
import { useI18n } from '../features/i18n/LocaleProvider';
import { useUserAuth } from '../features/user/AuthProvider';
import {
  hasPermission,
  PERMISSION_ADMIN_DOWNLOADS_VIEW,
  PERMISSION_ADMIN_FILES_ALL,
  PERMISSION_ADMIN_FILES_DELETE,
  PERMISSION_ADMIN_FILES_EDIT,
  PERMISSION_ADMIN_FILES_UPLOAD,
} from '../features/user/permissions';
import { formatBytes, formatDate } from '../lib/format';
import { buildDownloadRecordColumns } from './AdminDownloadsPage';
import { getApiErrorMessage } from '../lib/apiError';

interface SubmitPayload extends UpdateFilePayload {
  file?: File;
}

const mimeTypeByExtension: Record<string, string> = {
  '.zip': 'application/zip',
  '.rar': 'application/x-rar-compressed',
  '.7z': 'application/x-7z-compressed',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain',
  '.csv': 'text/csv',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xls': 'application/vnd.ms-excel',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.mp4': 'video/mp4',
  '.mp3': 'audio/mpeg',
};

interface TreeOptionNode {
  title: string;
  value: string;
  selectable?: boolean;
  disabled?: boolean;
  children?: TreeOptionNode[];
}

function sortTaxonomyItems<T extends { sortOrder: number; name: string }>(items: T[]) {
  return [...items].sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name, 'zh-Hans-CN'));
}

function buildCategoryTreeOptions(items: TaxonomyRecord[]) {
  const childrenByParent = new Map<number | null, TaxonomyRecord[]>();
  for (const item of items) {
    const key = item.parentId ?? null;
    const siblings = childrenByParent.get(key) ?? [];
    siblings.push(item);
    childrenByParent.set(key, siblings);
  }

  const build = (parentId: number | null): TreeOptionNode[] =>
    sortTaxonomyItems(childrenByParent.get(parentId) ?? []).map((item) => ({
      title: item.fullPath || item.name,
      value: item.name,
      children: build(item.id),
    }));

  return build(null);
}

function buildTagTreeOptions(categories: TaxonomyRecord[], tags: TaxonomyRecord[]) {
  const categoryChildrenByParent = new Map<number | null, TaxonomyRecord[]>();
  for (const item of categories) {
    const key = item.parentId ?? null;
    const siblings = categoryChildrenByParent.get(key) ?? [];
    siblings.push(item);
    categoryChildrenByParent.set(key, siblings);
  }

  const tagsByCategory = new Map<number, TaxonomyRecord[]>();
  for (const item of tags) {
    if (!item.categoryId) {
      continue;
    }
    const siblings = tagsByCategory.get(item.categoryId) ?? [];
    siblings.push(item);
    tagsByCategory.set(item.categoryId, siblings);
  }

  const build = (parentId: number | null): TreeOptionNode[] =>
    sortTaxonomyItems(categoryChildrenByParent.get(parentId) ?? []).map((category) => ({
      title: category.fullPath || category.name,
      value: `category-${category.id}`,
      selectable: false,
      disabled: true,
      children: [
        ...build(category.id),
        ...sortTaxonomyItems(tagsByCategory.get(category.id) ?? []).map((tag) => ({
          title: tag.fullPath || tag.name,
          value: tag.name,
        })),
      ],
    }));

  return build(null);
}

export function AdminFilesPage() {
  const queryClient = useQueryClient();
  const [messageApi, contextHolder] = message.useMessage();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [modalState, setModalState] = useState<{ open: boolean; mode: 'create' | 'edit'; file?: FileRecord | null }>({ open: false, mode: 'create', file: null });
  const [downloadFile, setDownloadFile] = useState<FileRecord | null>(null);
  const [downloadPage, setDownloadPage] = useState(1);
  const [downloadPageSize, setDownloadPageSize] = useState(10);
  const deferredSearch = useDeferredValue(search.trim());
  const { t, locale } = useI18n();
  const { user } = useUserAuth();

  const canManageAll = hasPermission(user, PERMISSION_ADMIN_FILES_ALL);
  const canUpload = hasPermission(user, PERMISSION_ADMIN_FILES_UPLOAD);
  const canEdit = hasPermission(user, PERMISSION_ADMIN_FILES_EDIT);
  const canDelete = hasPermission(user, PERMISSION_ADMIN_FILES_DELETE);
  const canViewDownloads = hasPermission(user, PERMISSION_ADMIN_DOWNLOADS_VIEW);

  const filesQuery = useQuery({
    queryKey: ['admin-files', page, pageSize, deferredSearch, sortBy, sortOrder],
    queryFn: () => fetchAdminFiles({ page, pageSize, search: deferredSearch || undefined, sortBy, sortOrder }),
  });
  const statsQuery = useQuery({ queryKey: ['admin-stats'], queryFn: fetchAdminStats });
  const uploadSettingsQuery = useQuery({ queryKey: ['admin-upload-settings'], queryFn: fetchAdminUploadSettings, enabled: canUpload });
  const categoryOptionsQuery = useQuery({ queryKey: ['admin-category-options'], queryFn: fetchAdminCategoryOptions });
  const tagCategoryOptionsQuery = useQuery({ queryKey: ['admin-tag-category-options'], queryFn: fetchAdminTagCategoryOptions });
  const tagOptionsQuery = useQuery({ queryKey: ['admin-tag-options'], queryFn: fetchAdminTagOptions });
  const fileDownloadsQuery = useQuery({
    queryKey: ['admin-file-downloads', downloadFile?.id, downloadPage, downloadPageSize],
    queryFn: () => fetchAdminFileDownloads(downloadFile?.id ?? 0, { page: downloadPage, pageSize: downloadPageSize }),
    enabled: Boolean(downloadFile),
  });

  const createMutation = useMutation({
    mutationFn: async (payload: SubmitPayload) => {
      if (!payload.file) throw new Error('missing file');
      const file = payload.file;
      const dotIndex = file.name.lastIndexOf('.');
      const extension = dotIndex >= 0 ? file.name.slice(dotIndex).toLowerCase() : '';
      const mimeType = file.type || mimeTypeByExtension[extension] || 'application/octet-stream';
      const prepared = await prepareAdminUpload({ originalName: file.name, size: file.size, mimeType });
      await uploadFileToOSS(prepared.uploadUrl, file, prepared.headers);
      return createAdminFile({
        objectKey: prepared.objectKey,
        originalName: file.name,
        name: payload.name,
        description: payload.description,
        category: payload.category,
        tags: payload.tags,
        isPublic: payload.isPublic,
      });
    },
    onSuccess: () => {
      messageApi.success(t('files.uploadSuccess'));
      setModalState({ open: false, mode: 'create', file: null });
      void queryClient.invalidateQueries({ queryKey: ['admin-files'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-logs'] });
    },
    onError: (error) => messageApi.error(getApiErrorMessage(error, locale === 'zh-CN' ? '文件上传失败，请检查文件和表单内容。' : 'File upload failed. Please check the file and form.', locale)),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateFilePayload }) => updateAdminFile(id, payload),
    onSuccess: () => {
      messageApi.success(t('files.updateSuccess'));
      setModalState({ open: false, mode: 'create', file: null });
      void queryClient.invalidateQueries({ queryKey: ['admin-files'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-logs'] });
    },
    onError: (error) => messageApi.error(getApiErrorMessage(error, locale === 'zh-CN' ? '文件更新失败，请检查表单内容。' : 'File update failed. Please check the form.', locale)),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAdminFile,
    onSuccess: () => {
      messageApi.success(t('files.deleteSuccess'));
      void queryClient.invalidateQueries({ queryKey: ['admin-files'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-logs'] });
    },
    onError: (error) => messageApi.error(getApiErrorMessage(error, locale === 'zh-CN' ? '文件删除失败，请稍后再试。' : 'File deletion failed. Please try again later.', locale)),
  });

  const categoryTreeData = useMemo(
    () => buildCategoryTreeOptions(categoryOptionsQuery.data ?? []),
    [categoryOptionsQuery.data],
  );
  const tagTreeData = useMemo(
    () => buildTagTreeOptions(tagCategoryOptionsQuery.data ?? [], tagOptionsQuery.data ?? []),
    [tagCategoryOptionsQuery.data, tagOptionsQuery.data],
  );

  const columns = useMemo<ColumnsType<FileRecord>>(() => {
    const baseColumns: ColumnsType<FileRecord> = [
      { title: locale === 'zh-CN' ? '显示名称' : 'Name', dataIndex: 'name', key: 'name', width: 220, render: (value) => <Typography.Text strong>{value}</Typography.Text> },
      { title: locale === 'zh-CN' ? '原文件名' : 'Original name', dataIndex: 'originalName', key: 'originalName', width: 240, render: (value) => <Typography.Text type="secondary">{value}</Typography.Text> },
      { title: locale === 'zh-CN' ? '描述' : 'Description', dataIndex: 'description', key: 'description', width: 220, render: (value) => <div className="table-text-ellipsis" title={value || '-'}>{value || '-'}</div> },
      { title: locale === 'zh-CN' ? '分类' : 'Category', dataIndex: 'categoryPath', key: 'categoryPath', width: 220, render: (value, record) => value || record.category || '-' },
      { title: locale === 'zh-CN' ? '标签' : 'Tags', dataIndex: 'tagPaths', key: 'tagPaths', width: 260, render: (value: string[] | undefined, record) => <Space size={[4, 4]} wrap>{(value?.length ? value : record.tags)?.length ? (value?.length ? value : record.tags).map((tag) => <Tag key={tag}>{tag}</Tag>) : '-'}</Space> },
      { title: locale === 'zh-CN' ? '大小' : 'Size', dataIndex: 'size', key: 'size', width: 110, render: (value) => formatBytes(value) },
      { title: locale === 'zh-CN' ? '公开' : 'Public', dataIndex: 'isPublic', key: 'isPublic', width: 100, render: (value) => (value ? <Tag color="green">{locale === 'zh-CN' ? '公开' : 'Public'}</Tag> : <Tag>{locale === 'zh-CN' ? '隐藏' : 'Hidden'}</Tag>) },
      { title: locale === 'zh-CN' ? '下载量' : 'Downloads', dataIndex: 'downloadCount', key: 'downloadCount', width: 110 },
      { title: locale === 'zh-CN' ? '上传用户' : 'Uploader', key: 'createdByUser', width: 180, render: (_, record) => record.createdByDisplayName || record.createdByUsername || '-' },
      { title: locale === 'zh-CN' ? '更新时间' : 'Updated at', dataIndex: 'updatedAt', key: 'updatedAt', width: 160, render: (value) => formatDate(value) },
    ];

    if (canViewDownloads || canEdit || canDelete) {
      baseColumns.push({
        title: locale === 'zh-CN' ? '操作' : 'Action',
        key: 'action',
        width: [canViewDownloads, canEdit, canDelete].filter(Boolean).length >= 3 ? 300 : [canViewDownloads, canEdit, canDelete].filter(Boolean).length === 2 ? 220 : 120,
        fixed: 'right',
        render: (_, record) => (
          <div className="table-action-cell align-right">
            <Space size={8} wrap={false}>
              {canViewDownloads ? (
                <Button
                  icon={<FileSearchOutlined />}
                  className="stable-action-button table-action-button"
                  onClick={() => {
                    setDownloadFile(record);
                    setDownloadPage(1);
                  }}
                >
                  {locale === 'zh-CN' ? '下载记录' : 'Records'}
                </Button>
              ) : null}
              {canEdit ? <Button icon={<EditOutlined />} className="stable-action-button table-action-button" onClick={() => setModalState({ open: true, mode: 'edit', file: record })}>{t('files.edit')}</Button> : null}
              {canDelete ? (
                <Popconfirm title={t('files.deleteConfirm')} description={t('files.deleteDesc')} okText={t('files.delete')} cancelText={t('common.cancel')} onConfirm={() => deleteMutation.mutate(record.id)}>
                  <Button danger icon={<DeleteOutlined />} className="stable-action-button table-action-button">{t('files.delete')}</Button>
                </Popconfirm>
              ) : null}
            </Space>
          </div>
        ),
      });
    }

    return baseColumns;
  }, [canDelete, canEdit, canViewDownloads, deleteMutation, locale, t]);

  const scrollX = canViewDownloads || canEdit || canDelete ? 2180 : 1880;
  const downloadColumns = useMemo(() => buildDownloadRecordColumns(locale), [locale]);

  return (
    <>
      {contextHolder}
      <div className="metric-grid">
        <div className="metric-card"><div className="metric-label">{t('files.dashboard.total')}</div><div className="metric-value">{statsQuery.data?.totalFiles ?? 0}</div></div>
        <div className="metric-card"><div className="metric-label">{t('files.dashboard.public')}</div><div className="metric-value">{statsQuery.data?.publicFiles ?? 0}</div></div>
        <div className="metric-card"><div className="metric-label">{t('files.dashboard.downloads')}</div><div className="metric-value">{statsQuery.data?.totalDownloads ?? 0}</div></div>
        <div className="metric-card"><div className="metric-label">{t('files.dashboard.storage')}</div><div className="metric-value">{formatBytes(statsQuery.data?.totalStorage ?? 0)}</div></div>
      </div>

      <Card className="surface-card">
        <div className="toolbar-row">
          <div>
            <h2 className="section-title">{t('files.title')}</h2>
            <p className="section-subtitle">
              {canManageAll
                ? (locale === 'zh-CN' ? '可管理全部文件，并查看上传用户。' : 'Manage all files and review uploader information.')
                : (locale === 'zh-CN' ? '当前仅可处理自己上传的文件。' : 'You can act only on files uploaded by yourself.')}
            </p>
          </div>
          <div className="toolbar-controls">
            <Input allowClear placeholder={t('files.search')} style={{ width: 320 }} value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
            <Select style={{ width: 160 }} value={sortBy} options={[{ label: locale === 'zh-CN' ? '按上传时间' : 'Created at', value: 'createdAt' }, { label: locale === 'zh-CN' ? '按名称' : 'Name', value: 'name' }, { label: locale === 'zh-CN' ? '按下载量' : 'Downloads', value: 'downloadCount' }]} onChange={(value) => { setSortBy(value); setPage(1); }} />
            <Select style={{ width: 120 }} value={sortOrder} options={[{ label: locale === 'zh-CN' ? '降序' : 'Desc', value: 'desc' }, { label: locale === 'zh-CN' ? '升序' : 'Asc', value: 'asc' }]} onChange={(value) => { setSortOrder(value); setPage(1); }} />
            <Button icon={<ReloadOutlined />} onClick={() => filesQuery.refetch()}>{t('files.refresh')}</Button>
            {canUpload ? (
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalState({ open: true, mode: 'create', file: null })}>
                {canManageAll ? t('files.upload') : (locale === 'zh-CN' ? '上传我的文件' : 'Upload my file')}
              </Button>
            ) : null}
          </div>
        </div>

        <Table<FileRecord>
          rowKey="id"
          columns={columns}
          scroll={{ x: scrollX }}
          dataSource={filesQuery.data?.items ?? []}
          loading={filesQuery.isLoading || statsQuery.isLoading}
          pagination={{ current: page, pageSize, total: filesQuery.data?.pagination.total ?? 0, onChange: (nextPage, nextPageSize) => { setPage(nextPage); setPageSize(nextPageSize); } }}
        />
      </Card>

      <FileFormModal
        open={modalState.open}
        mode={modalState.mode}
        initialValue={modalState.file}
        loading={createMutation.isPending || updateMutation.isPending}
        uploadSettings={uploadSettingsQuery.data}
        taxonomyLoading={categoryOptionsQuery.isLoading || tagCategoryOptionsQuery.isLoading || tagOptionsQuery.isLoading}
        categoryTreeData={categoryTreeData}
        tagTreeData={tagTreeData}
        onCancel={() => setModalState({ open: false, mode: 'create', file: null })}
        onSubmit={async (payload) => {
          if (modalState.mode === 'create') {
            await createMutation.mutateAsync(payload);
            return;
          }
          if (!modalState.file) return;
          await updateMutation.mutateAsync({
            id: modalState.file.id,
            payload: {
              name: payload.name,
              description: payload.description,
              category: payload.category,
              tags: payload.tags,
              isPublic: payload.isPublic,
            },
          });
        }}
      />
      <Modal
        open={Boolean(downloadFile)}
        title={downloadFile ? `${locale === 'zh-CN' ? '下载记录' : 'Download records'}：${downloadFile.name}` : ''}
        width={1180}
        footer={null}
        onCancel={() => setDownloadFile(null)}
      >
        <Table<AdminDownloadRecord>
          rowKey="id"
          columns={downloadColumns}
          dataSource={fileDownloadsQuery.data?.items ?? []}
          loading={fileDownloadsQuery.isLoading || fileDownloadsQuery.isFetching}
          scroll={{ x: 1690 }}
          pagination={{
            current: downloadPage,
            pageSize: downloadPageSize,
            total: fileDownloadsQuery.data?.pagination.total ?? 0,
            showSizeChanger: true,
            onChange: (nextPage, nextPageSize) => {
              setDownloadPage(nextPage);
              setDownloadPageSize(nextPageSize);
            },
          }}
        />
      </Modal>
    </>
  );
}
