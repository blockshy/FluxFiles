import { DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Button, Card, Input, Popconfirm, Select, Space, Table, Tag, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useDeferredValue, useState } from 'react';
import {
  createAdminFile,
  deleteAdminFile,
  fetchAdminFiles,
  fetchAdminStats,
  prepareAdminUpload,
  updateAdminFile,
  uploadFileToOSS,
} from '../api/admin';
import type { FileRecord, UpdateFilePayload } from '../api/types';
import { FileFormModal } from '../features/admin/FileFormModal';
import { formatBytes, formatDate } from '../lib/format';

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

function extractErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.message;
    if (typeof message === 'string' && message.trim()) {
      return message;
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

export function AdminFilesPage() {
  const queryClient = useQueryClient();
  const [messageApi, contextHolder] = message.useMessage();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [modalState, setModalState] = useState<{
    open: boolean;
    mode: 'create' | 'edit';
    file?: FileRecord | null;
  }>({
    open: false,
    mode: 'create',
    file: null,
  });
  const deferredSearch = useDeferredValue(search.trim());

  const filesQuery = useQuery({
    queryKey: ['admin-files', page, pageSize, deferredSearch, sortBy, sortOrder],
    queryFn: () =>
      fetchAdminFiles({
        page,
        pageSize,
        search: deferredSearch || undefined,
        sortBy,
        sortOrder,
      }),
  });

  const statsQuery = useQuery({
    queryKey: ['admin-stats'],
    queryFn: fetchAdminStats,
  });

  const createMutation = useMutation({
    mutationFn: async (payload: SubmitPayload) => {
      if (!payload.file) {
        throw new Error('missing file');
      }

      const file = payload.file;
      const dotIndex = file.name.lastIndexOf('.');
      const extension = dotIndex >= 0 ? file.name.slice(dotIndex).toLowerCase() : '';
      const mimeType = file.type || mimeTypeByExtension[extension] || 'application/octet-stream';

      const prepared = await prepareAdminUpload({
        originalName: file.name,
        size: file.size,
        mimeType,
      });

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
      messageApi.success('文件已直传到 OSS 并完成入库。');
      setModalState({ open: false, mode: 'create', file: null });
      void queryClient.invalidateQueries({ queryKey: ['admin-files'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
    },
    onError: (error) => {
      messageApi.error(extractErrorMessage(error, '上传失败，请检查 OSS 配置、文件类型或浏览器控制台。'));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateFilePayload }) => updateAdminFile(id, payload),
    onSuccess: () => {
      messageApi.success('文件信息已更新。');
      setModalState({ open: false, mode: 'create', file: null });
      void queryClient.invalidateQueries({ queryKey: ['admin-files'] });
    },
    onError: (error) => {
      messageApi.error(extractErrorMessage(error, '文件更新失败。'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAdminFile,
    onSuccess: () => {
      messageApi.success('文件已删除。');
      void queryClient.invalidateQueries({ queryKey: ['admin-files'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
    },
    onError: (error) => {
      messageApi.error(extractErrorMessage(error, '文件删除失败。'));
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
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      width: 120,
      render: (value) => value || '-',
    },
    {
      title: '标签',
      dataIndex: 'tags',
      key: 'tags',
      width: 180,
      render: (value: string[]) => (
        <Space size={[4, 4]} wrap>
          {value?.length ? value.map((tag) => <Tag key={tag}>{tag}</Tag>) : '-'}
        </Space>
      ),
    },
    {
      title: '大小',
      dataIndex: 'size',
      key: 'size',
      width: 120,
      render: (value) => formatBytes(value),
    },
    {
      title: '可见性',
      dataIndex: 'isPublic',
      key: 'isPublic',
      width: 110,
      render: (value) => (value ? <Tag color="green">公开</Tag> : <Tag color="default">隐藏</Tag>),
    },
    {
      title: '下载次数',
      dataIndex: 'downloadCount',
      key: 'downloadCount',
      width: 110,
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 160,
      render: (value) => formatDate(value),
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => setModalState({ open: true, mode: 'edit', file: record })}
          >
            编辑
          </Button>
          <Popconfirm
            title="确认删除这个文件？"
            description="删除后会按当前配置决定是否同步删除 OSS 对象。"
            okText="删除"
            cancelText="取消"
            onConfirm={() => deleteMutation.mutate(record.id)}
          >
            <Button danger type="link" icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      {contextHolder}

      <div className="metric-grid">
        <div className="metric-card">
          <div className="metric-label">文件总数</div>
          <div className="metric-value">{statsQuery.data?.totalFiles ?? 0}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">公开文件</div>
          <div className="metric-value">{statsQuery.data?.publicFiles ?? 0}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">累计下载</div>
          <div className="metric-value">{statsQuery.data?.totalDownloads ?? 0}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">占用存储</div>
          <div className="metric-value">{formatBytes(statsQuery.data?.totalStorage ?? 0)}</div>
        </div>
      </div>

      <Card className="surface-card">
        <div className="toolbar-row">
          <div>
            <h2 className="section-title">文件管理</h2>
            <p className="section-subtitle">上传由浏览器直传 OSS，后端只负责签名与元数据入库。</p>
          </div>

          <div className="toolbar-controls">
            <Input
              allowClear
              placeholder="搜索展示名称、文件名称、描述、分类"
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
              options={[
                { label: '按上传时间', value: 'createdAt' },
                { label: '按展示名称', value: 'name' },
                { label: '按下载次数', value: 'downloadCount' },
              ]}
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
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setModalState({ open: true, mode: 'create', file: null })}
            >
              上传文件
            </Button>
          </div>
        </div>

        <Table<FileRecord>
          rowKey="id"
          columns={columns}
          dataSource={filesQuery.data?.items ?? []}
          loading={filesQuery.isLoading || statsQuery.isLoading}
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

      <FileFormModal
        open={modalState.open}
        mode={modalState.mode}
        initialValue={modalState.file}
        loading={createMutation.isPending || updateMutation.isPending}
        onCancel={() => setModalState({ open: false, mode: 'create', file: null })}
        onSubmit={async (payload) => {
          if (modalState.mode === 'create') {
            await createMutation.mutateAsync(payload);
            return;
          }

          if (!modalState.file) {
            return;
          }

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
    </>
  );
}
