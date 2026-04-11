import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  DeleteOutlined,
  EditOutlined,
  FileSearchOutlined,
  FolderAddOutlined,
  PlusOutlined,
  ReloadOutlined,
  TagOutlined,
} from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Empty, Flex, Form, Input, Modal, Popconfirm, Skeleton, Space, Tree, TreeSelect, Typography, message } from 'antd';
import type { DataNode } from 'antd/es/tree';
import type { Key, ReactNode } from 'react';
import { useDeferredValue, useMemo, useState } from 'react';
import type { MoveTaxonomyPayload, Pagination, SaveTaxonomyPayload, TaxonomyLogRecord, TaxonomyQuery, TaxonomyRecord } from '../api/types';
import { getApiErrorMessage } from '../lib/apiError';
import { formatDate } from '../lib/format';

interface TaxonomyAdminPageProps {
  kind: 'category' | 'tag';
  title: string;
  subtitle: string;
  createLabel: string;
  createChildLabel?: string;
  deleteConfirm: string;
  deleteInUseHint: string;
  recordLabel: string;
  searchPlaceholder: string;
  treeQueryKey: string;
  logsQueryKey: string;
  extraInvalidateKeys?: string[];
  fetchTreeItems: () => Promise<TaxonomyRecord[]>;
  createItem: (payload: SaveTaxonomyPayload) => Promise<TaxonomyRecord>;
  updateItem: (id: number, payload: SaveTaxonomyPayload) => Promise<TaxonomyRecord>;
  moveItem: (id: number, payload: MoveTaxonomyPayload) => Promise<TaxonomyRecord>;
  deleteItem: (id: number) => Promise<unknown>;
  fetchLogs: (id: number, query: TaxonomyQuery) => Promise<{ items: TaxonomyLogRecord[]; pagination: Pagination }>;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canViewLogs: boolean;
  locale: 'zh-CN' | 'en-US';
}

type TreeActionMode = 'create-root' | 'create-child' | 'edit';

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

function filterCategoryTree(items: TaxonomyRecord[], keyword: string) {
  if (!keyword) {
    return items;
  }
  const normalized = keyword.toLowerCase();
  const byId = new Map(items.map((item) => [item.id, item]));
  const keep = new Set<number>();
  for (const item of items) {
    const label = `${item.name} ${item.fullPath ?? ''}`.toLowerCase();
    if (!label.includes(normalized)) {
      continue;
    }
    keep.add(item.id);
    let cursor = item.parentId;
    while (cursor) {
      keep.add(cursor);
      cursor = byId.get(cursor)?.parentId;
    }
  }
  return items.filter((item) => keep.has(item.id));
}

function sortTaxonomyItems(items: TaxonomyRecord[]) {
  return [...items].sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name, 'zh-Hans-CN'));
}

function buildCategoryTreeData(items: TaxonomyRecord[], renderTitle: (item: TaxonomyRecord) => ReactNode): DataNode[] {
  const childrenByParent = new Map<number | null, TaxonomyRecord[]>();
  for (const item of items) {
    const key = item.parentId ?? null;
    const siblings = childrenByParent.get(key) ?? [];
    siblings.push(item);
    childrenByParent.set(key, siblings);
  }

  const build = (parentId: number | null): DataNode[] =>
    sortTaxonomyItems(childrenByParent.get(parentId) ?? []).map((item) => ({
      key: `category-${item.id}`,
      title: renderTitle(item),
      children: build(item.id),
    }));

  return build(null);
}

function buildCategorySelectTreeData(items: TaxonomyRecord[], excludedId?: number): DataNode[] {
  const filteredItems = excludedId ? items.filter((item) => item.id !== excludedId) : items;
  const childrenByParent = new Map<number | null, TaxonomyRecord[]>();
  for (const item of filteredItems) {
    const key = item.parentId ?? null;
    const siblings = childrenByParent.get(key) ?? [];
    siblings.push(item);
    childrenByParent.set(key, siblings);
  }

  const build = (parentId: number | null): DataNode[] =>
    sortTaxonomyItems(childrenByParent.get(parentId) ?? []).map((item) => ({
      key: item.id,
      value: item.id,
      title: item.name,
      children: build(item.id),
    }));

  return build(null);
}

export function TaxonomyAdminPage(props: TaxonomyAdminPageProps) {
  const queryClient = useQueryClient();
  const [messageApi, contextHolder] = message.useMessage();
  const [search, setSearch] = useState('');
  const [expandedKeys, setExpandedKeys] = useState<Key[]>([]);
  const [actionState, setActionState] = useState<{ open: boolean; mode: TreeActionMode; target: TaxonomyRecord | null }>({
    open: false,
    mode: 'create-root',
    target: null,
  });
  const [logsTarget, setLogsTarget] = useState<TaxonomyRecord | null>(null);
  const [logsPage] = useState(1);
  const [logsPageSize] = useState(20);
  const [form] = Form.useForm<SaveTaxonomyPayload>();
  const deferredSearch = useDeferredValue(search.trim());
  const [movingKey, setMovingKey] = useState<string | null>(null);

  const treeQuery = useQuery({
    queryKey: [props.treeQueryKey],
    queryFn: props.fetchTreeItems,
  });
  const logsQuery = useQuery({
    queryKey: ['taxonomy-logs', props.kind, logsTarget?.id, logsPage, logsPageSize],
    queryFn: () => props.fetchLogs(logsTarget!.id, { page: logsPage, pageSize: logsPageSize }),
    enabled: Boolean(logsTarget && props.canViewLogs),
  });

  const invalidateRelated = async () => {
    await queryClient.invalidateQueries({ queryKey: [props.treeQueryKey] });
    if (props.kind === 'category') {
      await queryClient.invalidateQueries({ queryKey: ['admin-tags-tree'] });
      await queryClient.invalidateQueries({ queryKey: ['admin-tag-options'] });
    }
    if (props.extraInvalidateKeys) {
      for (const key of props.extraInvalidateKeys) {
        await queryClient.invalidateQueries({ queryKey: [key] });
      }
    }
    if (logsTarget) {
      await queryClient.invalidateQueries({ queryKey: ['taxonomy-logs', props.kind, logsTarget.id] });
    }
  };

  const createMutation = useMutation({
    mutationFn: (payload: SaveTaxonomyPayload) => props.createItem(payload),
    onSuccess: async () => {
      messageApi.success(props.locale === 'zh-CN' ? '已创建。' : 'Created.');
      setActionState({ open: false, mode: 'create-root', target: null });
      form.resetFields();
      await invalidateRelated();
    },
    onError: (error) => messageApi.error(getApiErrorMessage(error, props.locale === 'zh-CN' ? '创建失败，请检查名称或层级。' : 'Create failed. Please check the name or hierarchy.', props.locale)),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: SaveTaxonomyPayload }) => props.updateItem(id, payload),
    onSuccess: async () => {
      messageApi.success(props.locale === 'zh-CN' ? '已更新。' : 'Updated.');
      setActionState({ open: false, mode: 'create-root', target: null });
      form.resetFields();
      await invalidateRelated();
    },
    onError: (error) => messageApi.error(getApiErrorMessage(error, props.locale === 'zh-CN' ? '更新失败，请检查名称或层级。' : 'Update failed. Please check the name or hierarchy.', props.locale)),
  });

  const moveMutation = useMutation({
    mutationFn: ({ id, direction }: { id: number; direction: 'up' | 'down' }) => props.moveItem(id, { direction }),
    onSuccess: async () => {
      setMovingKey(null);
      await invalidateRelated();
    },
    onError: (error) => {
      setMovingKey(null);
      messageApi.error(getApiErrorMessage(error, props.locale === 'zh-CN' ? '移动失败，请刷新后重试。' : 'Move failed. Please refresh and try again.', props.locale));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => props.deleteItem(id),
    onSuccess: async () => {
      messageApi.success(props.locale === 'zh-CN' ? '已删除。' : 'Deleted.');
      await invalidateRelated();
    },
    onError: (error) => messageApi.error(getApiErrorMessage(error, props.deleteInUseHint, props.locale)),
  });

  const treeItems = useMemo(() => treeQuery.data ?? [], [treeQuery.data]);

  const filteredCategoryItems = useMemo(
    () => filterCategoryTree(treeItems, deferredSearch),
    [deferredSearch, treeItems],
  );

  const categorySelectTreeData = useMemo(
    () => buildCategorySelectTreeData(treeItems, actionState.mode === 'edit' ? actionState.target?.id : undefined),
    [actionState.mode, actionState.target?.id, treeItems],
  );

  const defaultExpandedKeys = useMemo(() => filteredCategoryItems.map((item) => `category-${item.id}`), [filteredCategoryItems]);

  const effectiveExpandedKeys = expandedKeys.length > 0 ? expandedKeys : defaultExpandedKeys;

  const openCreateModal = (mode: TreeActionMode, target: TaxonomyRecord | null = null) => {
    setActionState({ open: true, mode, target });
    if (mode === 'edit' && target) {
      form.setFieldsValue({
        name: target.name,
        parentId: target.parentId,
      });
      return;
    }
    form.setFieldsValue({
      name: '',
      parentId: mode === 'create-child' ? target?.id : undefined,
    });
  };

  const renderMoveButtons = (record: TaxonomyRecord) => (
    <Space size={0}>
      <Button type="text" size="small" icon={<ArrowUpOutlined />} loading={movingKey === `${props.kind}-${record.id}-up`} onClick={(event) => {
        event.stopPropagation();
        setMovingKey(`${props.kind}-${record.id}-up`);
        moveMutation.mutate({ id: record.id, direction: 'up' });
      }} />
      <Button type="text" size="small" icon={<ArrowDownOutlined />} loading={movingKey === `${props.kind}-${record.id}-down`} onClick={(event) => {
        event.stopPropagation();
        setMovingKey(`${props.kind}-${record.id}-down`);
        moveMutation.mutate({ id: record.id, direction: 'down' });
      }} />
    </Space>
  );

  const renderCategoryTitle = (record: TaxonomyRecord) => (
    <Flex align="center" justify="space-between" gap={12} className="taxonomy-tree-row">
      <div className="taxonomy-tree-main">
        <Typography.Text strong>{record.name}</Typography.Text>
        <Typography.Text type="secondary">
          {props.kind === 'category'
            ? (props.locale === 'zh-CN'
              ? `子分类 ${record.childCount ?? 0} · 使用 ${record.usageCount}`
              : `Children ${record.childCount ?? 0} · Usage ${record.usageCount}`)
            : (props.locale === 'zh-CN'
              ? `子标签 ${record.childCount ?? 0} · 使用 ${record.usageCount}`
              : `Children ${record.childCount ?? 0} · Usage ${record.usageCount}`)}
        </Typography.Text>
      </div>
      <Space size={4} wrap>
        {renderMoveButtons(record)}
        {props.canCreate ? (
          <Button type="text" size="small" icon={<FolderAddOutlined />} onClick={(event) => {
            event.stopPropagation();
            openCreateModal('create-child', record);
          }}>
            {props.createChildLabel ?? (props.locale === 'zh-CN' ? '子级' : 'Child')}
          </Button>
        ) : null}
        {props.canEdit ? (
          <Button type="text" size="small" icon={<EditOutlined />} onClick={(event) => {
            event.stopPropagation();
            openCreateModal('edit', record);
          }}>
            {props.locale === 'zh-CN' ? '编辑' : 'Edit'}
          </Button>
        ) : null}
        {props.canViewLogs ? (
          <Button type="text" size="small" icon={<FileSearchOutlined />} onClick={(event) => {
            event.stopPropagation();
            setLogsTarget(record);
          }}>
            {props.locale === 'zh-CN' ? '记录' : 'Logs'}
          </Button>
        ) : null}
        {props.canDelete ? (
          <Popconfirm title={props.deleteConfirm} onConfirm={() => deleteMutation.mutate(record.id)}>
            <Button danger type="text" size="small" icon={<DeleteOutlined />} onClick={(event) => event.stopPropagation()}>
              {props.locale === 'zh-CN' ? '删除' : 'Delete'}
            </Button>
          </Popconfirm>
        ) : null}
      </Space>
    </Flex>
  );

  const treeData = useMemo(
    () => buildCategoryTreeData(filteredCategoryItems, (item) => renderCategoryTitle(item)),
    [filteredCategoryItems, props.kind, movingKey],
  );

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
            <Input allowClear placeholder={props.searchPlaceholder} style={{ width: 300 }} value={search} onChange={(event) => setSearch(event.target.value)} />
            <Button icon={<ReloadOutlined />} loading={treeQuery.isFetching} onClick={() => treeQuery.refetch()}>{props.locale === 'zh-CN' ? '刷新' : 'Refresh'}</Button>
            {props.canCreate ? (
              <Button type="primary" icon={<PlusOutlined />} onClick={() => openCreateModal('create-root')}>
                {props.createLabel}
              </Button>
            ) : null}
          </div>
        </div>

        {treeQuery.isLoading ? (
          <Skeleton active paragraph={{ rows: 10 }} />
        ) : treeData.length === 0 ? (
          <Empty description={props.locale === 'zh-CN' ? '暂无内容' : 'No items'} />
        ) : (
          <Tree
            blockNode
            showLine
            selectable={false}
            expandedKeys={effectiveExpandedKeys}
            onExpand={(keys) => setExpandedKeys(keys)}
            treeData={treeData}
            className="taxonomy-tree"
          />
        )}
      </Card>

      <Modal
        open={actionState.open}
        title={actionState.mode === 'edit'
          ? (props.locale === 'zh-CN' ? '编辑' : 'Edit')
          : props.createLabel}
        onCancel={() => {
          setActionState({ open: false, mode: 'create-root', target: null });
          form.resetFields();
        }}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
        onOk={() => form.submit()}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={(values) => {
            if (actionState.mode === 'edit' && actionState.target) {
              updateMutation.mutate({ id: actionState.target.id, payload: values });
              return;
            }
            createMutation.mutate(values);
          }}
        >
          <Form.Item
            name="name"
            label={props.recordLabel}
            rules={[{ required: true }]}
          >
            <Input maxLength={128} />
          </Form.Item>

          <Form.Item
            name="parentId"
            label={props.kind === 'category' ? (props.locale === 'zh-CN' ? '父分类' : 'Parent category') : (props.locale === 'zh-CN' ? '父标签' : 'Parent tag')}
          >
            <TreeSelect
              allowClear
              treeDefaultExpandAll
              showSearch
              treeNodeFilterProp="title"
              treeData={categorySelectTreeData}
              placeholder={props.kind === 'category'
                ? (props.locale === 'zh-CN' ? '留空表示顶级分类' : 'Leave empty for top-level category')
                : (props.locale === 'zh-CN' ? '留空表示顶级标签' : 'Leave empty for top-level tag')}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={Boolean(logsTarget)}
        title={logsTarget ? `${props.recordLabel}: ${logsTarget.fullPath || logsTarget.name}` : props.recordLabel}
        footer={null}
        width={920}
        onCancel={() => setLogsTarget(null)}
      >
        {logsQuery.isLoading ? (
          <Skeleton active paragraph={{ rows: 6 }} />
        ) : (
          <div className="taxonomy-log-list">
            {(logsQuery.data?.items ?? []).map((record) => {
              const before = parseLogPayload(record.beforeData);
              const after = parseLogPayload(record.afterData);
              return (
                <Card key={record.id} size="small" className="taxonomy-log-card">
                  <Flex justify="space-between" gap={16}>
                    <div>
                      <Typography.Text strong>{record.action}</Typography.Text>
                      <div><Typography.Text type="secondary">{record.adminUsername || '-'}</Typography.Text></div>
                    </div>
                    <Typography.Text type="secondary">{formatDate(record.createdAt)}</Typography.Text>
                  </Flex>
                  <div className="taxonomy-log-payload">
                    <Typography.Text type="secondary">
                      {props.locale === 'zh-CN' ? '之前' : 'Before'}: {before?.fullPath ?? before?.name ?? '-'}
                    </Typography.Text>
                    <Typography.Text type="secondary">
                      {props.locale === 'zh-CN' ? '之后' : 'After'}: {after?.fullPath ?? after?.name ?? '-'}
                    </Typography.Text>
                  </div>
                </Card>
              );
            })}
            {(logsQuery.data?.items ?? []).length === 0 ? <Empty description={props.locale === 'zh-CN' ? '暂无记录' : 'No logs'} /> : null}
          </div>
        )}
      </Modal>
    </>
  );
}
