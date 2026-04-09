import { DownloadOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button, Card, Input, Select, Space, Table, Tag, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useDeferredValue, useState } from 'react';
import { fetchPublicFiles, requestDownloadLink } from '../api/files';
import type { FileRecord } from '../api/types';
import { formatBytes, formatDate } from '../lib/format';

const sortOptions = [
  { label: '按上传时间', value: 'createdAt' },
  { label: '按展示名称', value: 'name' },
  { label: '按大小', value: 'size' },
];

export function PublicFilesPage() {
  const [messageApi, contextHolder] = message.useMessage();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const deferredSearch = useDeferredValue(search.trim());

  const filesQuery = useQuery({
    queryKey: ['public-files', page, pageSize, deferredSearch, sortBy, sortOrder],
    queryFn: () =>
      fetchPublicFiles({
        page,
        pageSize,
        search: deferredSearch || undefined,
        sortBy,
        sortOrder,
      }),
  });

  const downloadMutation = useMutation({
    mutationFn: requestDownloadLink,
    onSuccess: (payload) => {
      window.open(payload.url, '_blank', 'noopener,noreferrer');
    },
    onError: () => {
      messageApi.error('下载链接生成失败，请稍后重试。');
    },
  });

  const columns: ColumnsType<FileRecord> = [
    {
      title: '展示名称',
      dataIndex: 'name',
      key: 'name',
      width: 220,
      render: (value) => <Typography.Text strong>{value}</Typography.Text>,
    },
    {
      title: '文件名称',
      dataIndex: 'originalName',
      key: 'originalName',
      width: 260,
      render: (value) => <Typography.Text type="secondary">{value}</Typography.Text>,
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      width: 260,
      render: (value) => (
        <div className="table-text-ellipsis" title={value || '暂无描述'}>
          {value || '暂无描述'}
        </div>
      ),
    },
    {
      title: '标签',
      dataIndex: 'tags',
      key: 'tags',
      width: 180,
      render: (value: string[]) => (
        <Space size={[6, 6]} wrap>
          {value?.length ? value.map((tag) => <Tag key={tag}>{tag}</Tag>) : '-'}
        </Space>
      ),
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      width: 120,
      render: (value) => (value ? <Tag>{value}</Tag> : '-'),
    },
    {
      title: '大小',
      dataIndex: 'size',
      key: 'size',
      width: 120,
      render: (value) => formatBytes(value),
    },
    {
      title: '类型',
      dataIndex: 'mimeType',
      key: 'mimeType',
      width: 180,
      render: (value) => <Typography.Text type="secondary">{value || '-'}</Typography.Text>,
    },
    {
      title: '上传时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (value) => formatDate(value),
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_, record) => (
        <Button type="link" icon={<DownloadOutlined />} onClick={() => downloadMutation.mutate(record.id)}>
          下载
        </Button>
      ),
    },
  ];

  return (
    <>
      {contextHolder}
      <Card className="surface-card">
        <div className="toolbar-row">
          <div>
            <h2 className="section-title">公开文件列表</h2>
            <p className="section-subtitle">支持搜索、分页以及按上传时间、展示名称、大小排序。</p>
          </div>

          <div className="toolbar-controls">
            <Input
              allowClear
              placeholder="按展示名称、文件名称或描述搜索"
              prefix={<SearchOutlined />}
              style={{ width: 300 }}
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
            <Select
              style={{ width: 150 }}
              value={sortBy}
              options={sortOptions}
              onChange={(value) => {
                setSortBy(value);
                setPage(1);
              }}
            />
            <Select
              style={{ width: 110 }}
              value={sortOrder}
              options={[
                { label: '降序', value: 'desc' },
                { label: '升序', value: 'asc' },
              ]}
              onChange={(value) => {
                setSortOrder(value);
                setPage(1);
              }}
            />
            <Button icon={<ReloadOutlined />} onClick={() => filesQuery.refetch()}>
              刷新
            </Button>
          </div>
        </div>

        <Table<FileRecord>
          rowKey="id"
          columns={columns}
          dataSource={filesQuery.data?.items ?? []}
          loading={filesQuery.isLoading}
          pagination={{
            current: page,
            pageSize,
            total: filesQuery.data?.pagination.total ?? 0,
            onChange: (nextPage, nextPageSize) => {
              setPage(nextPage);
              setPageSize(nextPageSize);
            },
          }}
        />
      </Card>
    </>
  );
}
