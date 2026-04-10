import { CommentOutlined, DownloadOutlined, ReloadOutlined, SearchOutlined, StarFilled, StarOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Avatar, Button, Card, Input, Select, Space, Table, Tag, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useDeferredValue, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchPublicFiles, requestDownloadLink } from '../api/files';
import { addFavoriteFile, fetchFavoriteFiles, removeFavoriteFile } from '../api/user';
import type { FileRecord } from '../api/types';
import { useI18n } from '../features/i18n/LocaleProvider';
import { useUserAuth } from '../features/user/AuthProvider';
import { formatBytes, formatDate } from '../lib/format';

export function PublicFilesPage() {
  const queryClient = useQueryClient();
  const [messageApi, contextHolder] = message.useMessage();
  const { token } = useUserAuth();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const deferredSearch = useDeferredValue(search.trim());
  const { t, locale } = useI18n();

  const filesQuery = useQuery({ queryKey: ['public-files', page, pageSize, deferredSearch, sortBy, sortOrder], queryFn: () => fetchPublicFiles({ page, pageSize, search: deferredSearch || undefined, sortBy, sortOrder }) });
  const favoritesQuery = useQuery({ queryKey: ['user-favorites'], queryFn: fetchFavoriteFiles, enabled: Boolean(token) });
  const favoriteIds = useMemo(() => new Set((favoritesQuery.data ?? []).map((item) => item.id)), [favoritesQuery.data]);

  const downloadMutation = useMutation({
    mutationFn: requestDownloadLink,
    onSuccess: (payload) => {
      const anchor = document.createElement('a');
      anchor.href = payload.url;
      anchor.rel = 'noopener noreferrer';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      void queryClient.invalidateQueries({ queryKey: ['user-downloads'] });
    },
    onError: () => messageApi.error(t('publicFiles.downloadError')),
  });

  const favoriteMutation = useMutation({
    mutationFn: async ({ fileId, active }: { fileId: number; active: boolean }) => (active ? removeFavoriteFile(fileId) : addFavoriteFile(fileId)),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['user-favorites'] }),
    onError: () => messageApi.error(t('publicFiles.favoriteError')),
  });

  const columns: ColumnsType<FileRecord> = [
    {
      title: locale === 'zh-CN' ? '展示名称' : 'Name',
      dataIndex: 'name',
      key: 'name',
      width: 280,
      render: (value, record) => (
        <Link to={`/files/${record.id}`} className="file-entry-link">
          <Typography.Text strong>{value}</Typography.Text>
          <Typography.Text type="secondary" className="file-entry-hint">
            {locale === 'zh-CN' ? '点击查看文件详情、评论与互动' : 'Open details, comments, and interactions'}
          </Typography.Text>
        </Link>
      ),
    },
    { title: locale === 'zh-CN' ? '原文件名' : 'Original name', dataIndex: 'originalName', key: 'originalName', width: 260, render: (value) => <Typography.Text type="secondary">{value}</Typography.Text> },
    { title: locale === 'zh-CN' ? '描述' : 'Description', dataIndex: 'description', key: 'description', width: 260, render: (value) => <div className="table-text-ellipsis" title={value || '-'}>{value || '-'}</div> },
    { title: locale === 'zh-CN' ? '标签' : 'Tags', dataIndex: 'tags', key: 'tags', width: 180, render: (value: string[]) => <Space size={[6, 6]} wrap>{value?.length ? value.map((tag) => <Tag key={tag}>{tag}</Tag>) : '-'}</Space> },
    { title: locale === 'zh-CN' ? '分类' : 'Category', dataIndex: 'category', key: 'category', width: 120, render: (value) => (value ? <Tag>{value}</Tag> : '-') },
    {
      title: locale === 'zh-CN' ? '上传者' : 'Uploader',
      key: 'uploader',
      width: 180,
      render: (_, record) => {
        if (!record.createdByUsername) {
          return '-';
        }
        const label = record.createdByDisplayName || record.createdByUsername;
        return (
          <Link to={`/users/${record.createdByUsername}`} className="uploader-link">
            <Avatar src={record.createdByAvatarUrl} size={28}>{label.slice(0, 1).toUpperCase()}</Avatar>
            <span>{label}</span>
          </Link>
        );
      },
    },
    { title: locale === 'zh-CN' ? '大小' : 'Size', dataIndex: 'size', key: 'size', width: 120, render: (value) => formatBytes(value) },
    { title: locale === 'zh-CN' ? '类型' : 'MIME', dataIndex: 'mimeType', key: 'mimeType', width: 180, render: (value) => <Typography.Text type="secondary">{value || '-'}</Typography.Text> },
    { title: locale === 'zh-CN' ? '上传时间' : 'Created at', dataIndex: 'createdAt', key: 'createdAt', width: 180, render: (value) => formatDate(value) },
    { title: locale === 'zh-CN' ? '收藏' : 'Favorite', key: 'favorite', width: 90, render: (_, record) => token ? <Button type="text" icon={favoriteIds.has(record.id) ? <StarFilled /> : <StarOutlined />} onClick={() => favoriteMutation.mutate({ fileId: record.id, active: favoriteIds.has(record.id) })} /> : '-' },
    {
      title: locale === 'zh-CN' ? '操作' : 'Action',
      key: 'action',
      width: 220,
      fixed: 'right',
      render: (_, record) => (
        <div className="table-action-cell align-right">
          <Space size={4} className="file-action-group" wrap={false}>
            <Link to={`/files/${record.id}`} className="table-link-action file-action-button">
              <CommentOutlined />
              <span>{locale === 'zh-CN' ? '详情与评论' : 'Details & comments'}</span>
            </Link>
            <Button type="link" icon={<DownloadOutlined />} className="file-action-button stable-action-button" onClick={() => downloadMutation.mutate(record.id)}>{t('publicFiles.download')}</Button>
          </Space>
        </div>
      ),
    },
  ];

  return (
    <>
      {contextHolder}
      <Card className="surface-card">
        <div className="toolbar-row">
          <div>
            <h2 className="section-title">{t('publicFiles.title')}</h2>
            <p className="section-subtitle">{t('publicFiles.subtitle')}</p>
          </div>

          <div className="toolbar-controls">
            <Input allowClear placeholder={t('publicFiles.search')} prefix={<SearchOutlined />} style={{ width: 320 }} value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
            <Select style={{ width: 150 }} value={sortBy} options={[{ label: locale === 'zh-CN' ? '按上传时间' : 'Created at', value: 'createdAt' }, { label: locale === 'zh-CN' ? '按名称' : 'Name', value: 'name' }, { label: locale === 'zh-CN' ? '按大小' : 'Size', value: 'size' }]} onChange={(value) => { setSortBy(value); setPage(1); }} />
            <Select style={{ width: 110 }} value={sortOrder} options={[{ label: locale === 'zh-CN' ? '降序' : 'Desc', value: 'desc' }, { label: locale === 'zh-CN' ? '升序' : 'Asc', value: 'asc' }]} onChange={(value) => { setSortOrder(value); setPage(1); }} />
            <Button icon={<ReloadOutlined />} onClick={() => filesQuery.refetch()}>{t('files.refresh')}</Button>
          </div>
        </div>

        <Table<FileRecord>
          rowKey="id"
          scroll={{ x: 1800 }}
          columns={columns}
          dataSource={filesQuery.data?.items ?? []}
          loading={filesQuery.isLoading}
          pagination={{ current: page, pageSize, total: filesQuery.data?.pagination.total ?? 0, onChange: (nextPage, nextPageSize) => { setPage(nextPage); setPageSize(nextPageSize); } }}
        />
      </Card>
    </>
  );
}
