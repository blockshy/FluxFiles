import { DeleteOutlined, EditOutlined, FileSearchOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Form, Input, Modal, Popconfirm, Space, Table, Tag, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useDeferredValue, useMemo, useState } from 'react';
import type { Pagination, SaveTaxonomyPayload, TaxonomyLogRecord, TaxonomyQuery, TaxonomyRecord } from '../api/types';
import { formatDate } from '../lib/format';

interface TaxonomyAdminPageProps {
  title: string;
  subtitle: string;
  createLabel: string;
  deleteConfirm: string;
  deleteInUseHint: string;
  recordLabel: string;
  searchPlaceholder: string;
  listQueryKey: string;
  optionsQueryKey: string;
  logsQueryKey: string;
  fetchList: (query: TaxonomyQuery) => Promise<{ items: TaxonomyRecord[]; pagination: Pagination }>;
  createItem: (payload: SaveTaxonomyPayload) => Promise<TaxonomyRecord>;
  updateItem: (id: number, payload: SaveTaxonomyPayload) => Promise<TaxonomyRecord>;
  deleteItem: (id: number) => Promise<unknown>;
  fetchLogs: (id: number, query: TaxonomyQuery) => Promise<{ items: TaxonomyLogRecord[]; pagination: Pagination }>;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canViewLogs: boolean;
  locale: 'zh-CN' | 'en-US';
}

function parseLogPayload(text: string) {
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text) as Partial<TaxonomyRecord>;
  } catch {
    return null;
  }
}

export function TaxonomyAdminPage(props: TaxonomyAdminPageProps) {
  const queryClient = useQueryClient();
  const [messageApi, contextHolder] = message.useMessage();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TaxonomyRecord | null>(null);
  const [logsTarget, setLogsTarget] = useState<TaxonomyRecord | null>(null);
  const [logsPage, setLogsPage] = useState(1);
  const [logsPageSize, setLogsPageSize] = useState(10);
  const [form] = Form.useForm<SaveTaxonomyPayload>();
  const deferredSearch = useDeferredValue(search.trim());

  const listQuery = useQuery({
    queryKey: [props.listQueryKey, page, pageSize, deferredSearch],
    queryFn: () => props.fetchList({ page, pageSize, search: deferredSearch || undefined }),
  });
  const logsQuery = useQuery({
    queryKey: [props.logsQueryKey, logsTarget?.id, logsPage, logsPageSize],
    queryFn: () => props.fetchLogs(logsTarget!.id, { page: logsPage, pageSize: logsPageSize }),
    enabled: Boolean(logsTarget && props.canViewLogs),
  });

  const createMutation = useMutation({
    mutationFn: props.createItem,
    onSuccess: () => {
      messageApi.success(props.locale === 'zh-CN' ? '已创建。' : 'Created.');
      setModalOpen(false);
      form.resetFields();
      void queryClient.invalidateQueries({ queryKey: [props.listQueryKey] });
      void queryClient.invalidateQueries({ queryKey: [props.optionsQueryKey] });
    },
    onError: (error) => messageApi.error(error instanceof Error ? error.message : 'Create failed.'),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: SaveTaxonomyPayload }) => props.updateItem(id, payload),
    onSuccess: () => {
      messageApi.success(props.locale === 'zh-CN' ? '已更新。' : 'Updated.');
      setModalOpen(false);
      setEditing(null);
      form.resetFields();
      void queryClient.invalidateQueries({ queryKey: [props.listQueryKey] });
      void queryClient.invalidateQueries({ queryKey: [props.optionsQueryKey] });
      if (logsTarget) {
        void queryClient.invalidateQueries({ queryKey: [props.logsQueryKey, logsTarget.id] });
      }
    },
    onError: (error) => messageApi.error(error instanceof Error ? error.message : 'Update failed.'),
  });
  const deleteMutation = useMutation({
    mutationFn: props.deleteItem,
    onSuccess: () => {
      messageApi.success(props.locale === 'zh-CN' ? '已删除。' : 'Deleted.');
      void queryClient.invalidateQueries({ queryKey: [props.listQueryKey] });
      void queryClient.invalidateQueries({ queryKey: [props.optionsQueryKey] });
    },
    onError: (error) => messageApi.error(error instanceof Error ? error.message : props.deleteInUseHint),
  });

  const columns = useMemo<ColumnsType<TaxonomyRecord>>(() => {
    const result: ColumnsType<TaxonomyRecord> = [
      { title: props.recordLabel, dataIndex: 'name', key: 'name', render: (value) => <Typography.Text strong>{value}</Typography.Text> },
      { title: props.locale === 'zh-CN' ? '使用次数' : 'Usage', dataIndex: 'usageCount', key: 'usageCount', width: 100, render: (value) => <Tag>{value}</Tag> },
      { title: props.locale === 'zh-CN' ? '创建者' : 'Created by', dataIndex: 'createdByUsername', key: 'createdByUsername', width: 140, render: (value) => value || '-' },
      { title: props.locale === 'zh-CN' ? '最后修改者' : 'Updated by', dataIndex: 'updatedByUsername', key: 'updatedByUsername', width: 140, render: (value) => value || '-' },
      { title: props.locale === 'zh-CN' ? '更新时间' : 'Updated at', dataIndex: 'updatedAt', key: 'updatedAt', width: 180, render: (value) => formatDate(value) },
    ];

    if (props.canEdit || props.canDelete || props.canViewLogs) {
      result.push({
        title: props.locale === 'zh-CN' ? '操作' : 'Action',
        key: 'action',
        width: 260,
        render: (_, record) => (
          <Space size={8}>
            {props.canEdit ? (
              <Button
                type="link"
                icon={<EditOutlined />}
                onClick={() => {
                  setEditing(record);
                  setModalOpen(true);
                  form.setFieldsValue({ name: record.name });
                }}
              >
                {props.locale === 'zh-CN' ? '编辑' : 'Edit'}
              </Button>
            ) : null}
            {props.canViewLogs ? (
              <Button
                type="link"
                icon={<FileSearchOutlined />}
                onClick={() => {
                  setLogsTarget(record);
                  setLogsPage(1);
                }}
              >
                {props.locale === 'zh-CN' ? '记录' : 'Logs'}
              </Button>
            ) : null}
            {props.canDelete ? (
              <Popconfirm title={props.deleteConfirm} onConfirm={() => deleteMutation.mutate(record.id)}>
                <Button danger type="link" icon={<DeleteOutlined />}>
                  {props.locale === 'zh-CN' ? '删除' : 'Delete'}
                </Button>
              </Popconfirm>
            ) : null}
          </Space>
        ),
      });
    }

    return result;
  }, [deleteMutation, form, props]);

  return (
    <>
      {contextHolder}
      <Card className="surface-card">
        <div className="toolbar-row">
          <div>
            <h2 className="section-title">{props.title}</h2>
            <p className="section-subtitle">{props.subtitle}</p>
          </div>
          <div className="toolbar-controls">
            <Input allowClear placeholder={props.searchPlaceholder} style={{ width: 300 }} value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
            <Button icon={<ReloadOutlined />} onClick={() => listQuery.refetch()}>{props.locale === 'zh-CN' ? '刷新' : 'Refresh'}</Button>
            {props.canCreate ? (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => {
                  setEditing(null);
                  setModalOpen(true);
                  form.setFieldsValue({ name: '' });
                }}
              >
                {props.createLabel}
              </Button>
            ) : null}
          </div>
        </div>

        <Table<TaxonomyRecord>
          rowKey="id"
          columns={columns}
          dataSource={listQuery.data?.items ?? []}
          loading={listQuery.isLoading}
          pagination={{
            current: page,
            pageSize,
            total: listQuery.data?.pagination.total ?? 0,
            onChange: (nextPage, nextPageSize) => {
              setPage(nextPage);
              setPageSize(nextPageSize);
            },
          }}
        />
      </Card>

      <Modal
        open={modalOpen}
        title={editing ? (props.locale === 'zh-CN' ? '编辑' : 'Edit') : props.createLabel}
        onCancel={() => {
          setModalOpen(false);
          setEditing(null);
          form.resetFields();
        }}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
        onOk={() => form.submit()}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={(values) => {
            if (editing) {
              updateMutation.mutate({ id: editing.id, payload: values });
              return;
            }
            createMutation.mutate(values);
          }}
        >
          <Form.Item name="name" label={props.recordLabel} rules={[{ required: true }]}>
            <Input maxLength={128} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={Boolean(logsTarget)}
        title={logsTarget ? `${props.recordLabel}: ${logsTarget.name}` : props.recordLabel}
        footer={null}
        width={920}
        onCancel={() => setLogsTarget(null)}
      >
        <Table<TaxonomyLogRecord>
          rowKey="id"
          size="small"
          dataSource={logsQuery.data?.items ?? []}
          loading={logsQuery.isLoading}
          pagination={{
            current: logsPage,
            pageSize: logsPageSize,
            total: logsQuery.data?.pagination.total ?? 0,
            onChange: (nextPage, nextPageSize) => {
              setLogsPage(nextPage);
              setLogsPageSize(nextPageSize);
            },
          }}
          columns={[
            { title: props.locale === 'zh-CN' ? '动作' : 'Action', dataIndex: 'action', key: 'action', width: 120 },
            { title: props.locale === 'zh-CN' ? '操作者' : 'Operator', dataIndex: 'adminUsername', key: 'adminUsername', width: 140, render: (value) => value || '-' },
            {
              title: props.locale === 'zh-CN' ? '变更内容' : 'Changes',
              key: 'changes',
              render: (_, record) => {
                const before = parseLogPayload(record.beforeData);
                const after = parseLogPayload(record.afterData);
                return (
                  <Space direction="vertical" size={2}>
                    <Typography.Text type="secondary">
                      {props.locale === 'zh-CN' ? '之前' : 'Before'}: {before?.name ?? '-'}
                    </Typography.Text>
                    <Typography.Text type="secondary">
                      {props.locale === 'zh-CN' ? '之后' : 'After'}: {after?.name ?? '-'}
                    </Typography.Text>
                  </Space>
                );
              },
            },
            { title: props.locale === 'zh-CN' ? '时间' : 'Time', dataIndex: 'createdAt', key: 'createdAt', width: 180, render: (value) => formatDate(value) },
          ]}
        />
      </Modal>
    </>
  );
}
