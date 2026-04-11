import { ReloadOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { Button, Card, DatePicker, Input, Select, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { Dayjs } from 'dayjs';
import { useDeferredValue, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchAdminDownloads } from '../api/admin';
import type { AdminDownloadRecord } from '../api/types';
import { useI18n } from '../features/i18n/LocaleProvider';
import { formatBytes, formatDate } from '../lib/format';

const { RangePicker } = DatePicker;

export function buildDownloadRecordColumns(locale: string): ColumnsType<AdminDownloadRecord> {
  return [
    {
      title: locale === 'zh-CN' ? '文件' : 'File',
      key: 'file',
      width: 260,
      render: (_, record) => (
        <Space direction="vertical" size={2} className="table-entity">
          <Link to={`/files/${record.fileId}`}>
            <Typography.Text strong>{record.fileName || record.originalName || `#${record.fileId}`}</Typography.Text>
          </Link>
          <Typography.Text type="secondary" className="table-text-ellipsis" title={record.originalName}>
            {record.originalName}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: locale === 'zh-CN' ? '下载用户' : 'Downloader',
      key: 'user',
      width: 180,
      render: (_, record) => record.userId ? (
        <Space direction="vertical" size={2} className="table-entity">
          <Typography.Text>{record.userDisplayName || record.userUsername || `#${record.userId}`}</Typography.Text>
          <Typography.Text type="secondary">@{record.userUsername || record.userId}</Typography.Text>
        </Space>
      ) : <Tag className="data-pill">{locale === 'zh-CN' ? '游客' : 'Guest'}</Tag>,
    },
    { title: 'IP', dataIndex: 'ip', key: 'ip', width: 150, render: (value) => value ? <span className="table-mono-text">{value}</span> : <span className="table-empty-text">-</span> },
    {
      title: locale === 'zh-CN' ? '客户端' : 'User agent',
      dataIndex: 'userAgent',
      key: 'userAgent',
      width: 260,
      render: (value) => <div className="table-text-ellipsis" title={value || '-'}>{value || '-'}</div>,
    },
    {
      title: locale === 'zh-CN' ? '分类/标签' : 'Category / tags',
      key: 'taxonomy',
      width: 280,
      render: (_, record) => (
        <Space direction="vertical" size={4} className="table-taxonomy-cell">
          <Typography.Text>{record.category || <span className="table-empty-text">-</span>}</Typography.Text>
          <Space size={[4, 4]} wrap className="taxonomy-pill-list">
            {record.tags?.length ? record.tags.map((tag) => <Tag className="data-pill" key={tag}>{tag}</Tag>) : <Typography.Text type="secondary">-</Typography.Text>}
          </Space>
        </Space>
      ),
    },
    { title: locale === 'zh-CN' ? '大小' : 'Size', dataIndex: 'size', key: 'size', width: 110, render: (value) => <span className="table-mono-text">{formatBytes(value)}</span> },
    { title: locale === 'zh-CN' ? '文件下载量' : 'File downloads', dataIndex: 'downloadCount', key: 'downloadCount', width: 120, render: (value) => <span className="table-mono-text">{value}</span> },
    {
      title: locale === 'zh-CN' ? '上传者' : 'Uploader',
      key: 'uploader',
      width: 160,
      render: (_, record) => record.fileCreatedByDisplayName || record.fileCreatedByUsername || <span className="table-empty-text">-</span>,
    },
    { title: locale === 'zh-CN' ? '下载时间' : 'Downloaded at', dataIndex: 'downloadedAt', key: 'downloadedAt', width: 170, fixed: 'right', render: (value) => <span className="table-muted-text">{formatDate(value)}</span> },
  ];
}

export function AdminDownloadsPage() {
  const { locale } = useI18n();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [ip, setIP] = useState('');
  const [authStatus, setAuthStatus] = useState<'all' | 'guest' | 'user'>('all');
  const [range, setRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const deferredSearch = useDeferredValue(search.trim());
  const deferredUserSearch = useDeferredValue(userSearch.trim());
  const deferredIP = useDeferredValue(ip.trim());

  const downloadsQuery = useQuery({
    queryKey: ['admin-downloads', page, pageSize, deferredSearch, deferredUserSearch, deferredIP, authStatus, range?.[0]?.toISOString(), range?.[1]?.toISOString()],
    queryFn: () => fetchAdminDownloads({
      page,
      pageSize,
      search: deferredSearch || undefined,
      userSearch: deferredUserSearch || undefined,
      ip: deferredIP || undefined,
      authStatus,
      startAt: range?.[0]?.startOf('day').toISOString(),
      endAt: range?.[1]?.endOf('day').toISOString(),
    }),
  });

  const columns = useMemo(() => buildDownloadRecordColumns(locale), [locale]);

  return (
    <Card className="surface-card">
      <div className="toolbar-row">
        <div>
          <h2 className="section-title">{locale === 'zh-CN' ? '下载记录' : 'Download Records'}</h2>
          <p className="section-subtitle">
            {locale === 'zh-CN' ? '查看全部可见文件的下载记录，包含游客与已登录用户。' : 'Review download records for visible files, including guests and signed-in users.'}
          </p>
        </div>
        <Button icon={<ReloadOutlined />} loading={downloadsQuery.isFetching} onClick={() => downloadsQuery.refetch()}>
          {locale === 'zh-CN' ? '刷新' : 'Refresh'}
        </Button>
      </div>

      <div className="toolbar-controls toolbar-controls-spaced">
        <Input className="toolbar-search-input compact" allowClear placeholder={locale === 'zh-CN' ? '搜索文件、用户、IP、分类或标签' : 'Search file, user, IP, category, or tag'} value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
        <Input className="toolbar-search-input slim" allowClear placeholder={locale === 'zh-CN' ? '下载用户' : 'Downloader'} value={userSearch} onChange={(event) => { setUserSearch(event.target.value); setPage(1); }} />
        <Input className="toolbar-search-input mini" allowClear placeholder="IP" value={ip} onChange={(event) => { setIP(event.target.value); setPage(1); }} />
        <Select
          className="toolbar-select medium"
          value={authStatus}
          options={[
            { label: locale === 'zh-CN' ? '全部身份' : 'All identities', value: 'all' },
            { label: locale === 'zh-CN' ? '游客' : 'Guest', value: 'guest' },
            { label: locale === 'zh-CN' ? '已登录用户' : 'Signed-in', value: 'user' },
          ]}
          onChange={(value) => { setAuthStatus(value); setPage(1); }}
        />
        <RangePicker value={range} onChange={(value) => { setRange(value); setPage(1); }} />
      </div>

      <Table<AdminDownloadRecord>
        rowKey="id"
        columns={columns}
        dataSource={downloadsQuery.data?.items ?? []}
        loading={downloadsQuery.isLoading || downloadsQuery.isFetching}
        scroll={{ x: 1690 }}
        pagination={{
          current: page,
          pageSize,
          total: downloadsQuery.data?.pagination.total ?? 0,
          showSizeChanger: true,
          onChange: (nextPage, nextPageSize) => {
            setPage(nextPage);
            setPageSize(nextPageSize);
          },
        }}
      />
    </Card>
  );
}
