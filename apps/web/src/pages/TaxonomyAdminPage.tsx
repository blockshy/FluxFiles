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
  deleteConfirm: string;
  deleteInUseHint: string;
  recordLabel: string;
  searchPlaceholder: string;
  treeQueryKey: string;
  categoryOptionsQueryKey?: string;
  logsQueryKey: string;
  extraInvalidateKeys?: string[];
  fetchTreeItems: () => Promise<TaxonomyRecord[]>;
  fetchCategoryOptions?: () => Promise<TaxonomyRecord[]>;
  createItem: (payload: SaveTaxonomyPayload) => Promise<TaxonomyRecord>;
  updateItem: (id: number, payload: SaveTaxonomyPayload) => Promise<TaxonomyRecord>;
  moveItem: (id: number, payload: MoveTaxonomyPayload) => Promise<TaxonomyRecord>;
  deleteItem: (id: number) => Promise<unknown>;
  fetchLogs: (id: number, query: TaxonomyQuery) => Promise<{ items: TaxonomyLogRecord[]; pagination: Pagination }>;
  categoryActions?: {
    createItem: (payload: SaveTaxonomyPayload) => Promise<TaxonomyRecord>;
    updateItem: (id: number, payload: SaveTaxonomyPayload) => Promise<TaxonomyRecord>;
    moveItem: (id: number, payload: MoveTaxonomyPayload) => Promise<TaxonomyRecord>;
    deleteItem: (id: number) => Promise<unknown>;
    fetchLogs: (id: number, query: TaxonomyQuery) => Promise<{ items: TaxonomyLogRecord[]; pagination: Pagination }>;
  };
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canViewLogs: boolean;
  locale: 'zh-CN' | 'en-US';
}

type TreeActionMode = 'create-root' | 'create-child' | 'create-tag' | 'edit';
type TaxonomySubject = 'category' | 'tag';

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

function filterTagTree(categories: TaxonomyRecord[], tags: TaxonomyRecord[], keyword: string) {
  if (!keyword) {
    return { categories, tags };
  }
  const normalized = keyword.toLowerCase();
  const keepCategoryIds = new Set<number>();
  const filteredTags = tags.filter((item) => {
    const label = `${item.name} ${item.fullPath ?? ''} ${item.categoryPath ?? ''}`.toLowerCase();
    if (!label.includes(normalized)) {
      return false;
    }
    if (item.categoryId) {
      keepCategoryIds.add(item.categoryId);
    }
    return true;
  });

  const byId = new Map(categories.map((item) => [item.id, item]));
  for (const categoryId of Array.from(keepCategoryIds)) {
    let cursor: number | undefined = categoryId;
    while (cursor) {
      keepCategoryIds.add(cursor);
      cursor = byId.get(cursor)?.parentId;
    }
  }

  return {
    categories: categories.filter((item) => keepCategoryIds.has(item.id)),
    tags: filteredTags,
  };
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

function buildTagTreeData(
  categories: TaxonomyRecord[],
  tags: TaxonomyRecord[],
  renderCategoryTitle: (item: TaxonomyRecord) => ReactNode,
  renderTagTitle: (item: TaxonomyRecord) => ReactNode,
): DataNode[] {
  const tagsByCategory = new Map<number, TaxonomyRecord[]>();
  for (const tag of tags) {
    if (!tag.categoryId) {
      continue;
    }
    const siblings = tagsByCategory.get(tag.categoryId) ?? [];
    siblings.push(tag);
    tagsByCategory.set(tag.categoryId, siblings);
  }

  const childrenByParent = new Map<number | null, TaxonomyRecord[]>();
  for (const item of categories) {
    const key = item.parentId ?? null;
    const siblings = childrenByParent.get(key) ?? [];
    siblings.push(item);
    childrenByParent.set(key, siblings);
  }

  const build = (parentId: number | null): DataNode[] =>
    sortTaxonomyItems(childrenByParent.get(parentId) ?? []).map((category) => ({
      key: `category-${category.id}`,
      title: renderCategoryTitle(category),
      children: [
        ...build(category.id),
        ...sortTaxonomyItems(tagsByCategory.get(category.id) ?? []).map((tag) => ({
          key: `tag-${tag.id}`,
          isLeaf: true,
          title: renderTagTitle(tag),
        })),
      ],
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
      title: item.fullPath || item.name,
      children: build(item.id),
    }));

  return build(null);
}

export function TaxonomyAdminPage(props: TaxonomyAdminPageProps) {
  const queryClient = useQueryClient();
  const [messageApi, contextHolder] = message.useMessage();
  const [search, setSearch] = useState('');
  const [expandedKeys, setExpandedKeys] = useState<Key[]>([]);
  const [actionState, setActionState] = useState<{ open: boolean; mode: TreeActionMode; subject: TaxonomySubject; target: TaxonomyRecord | null }>({
    open: false,
    mode: 'create-root',
    subject: props.kind,
    target: null,
  });
  const [logsTarget, setLogsTarget] = useState<TaxonomyRecord | null>(null);
  const [logsSubject, setLogsSubject] = useState<TaxonomySubject>(props.kind);
  const [logsPage] = useState(1);
  const [logsPageSize] = useState(20);
  const [form] = Form.useForm<SaveTaxonomyPayload>();
  const deferredSearch = useDeferredValue(search.trim());
  const [movingKey, setMovingKey] = useState<string | null>(null);

  const treeQuery = useQuery({
    queryKey: [props.treeQueryKey],
    queryFn: props.fetchTreeItems,
  });
  const categoryOptionsQuery = useQuery({
    queryKey: [props.categoryOptionsQueryKey ?? 'admin-category-options'],
    queryFn: () => props.fetchCategoryOptions?.() ?? Promise.resolve([]),
    enabled: Boolean(props.fetchCategoryOptions),
  });
  const logsQuery = useQuery({
    queryKey: ['taxonomy-logs', logsSubject, logsTarget?.id, logsPage, logsPageSize],
    queryFn: () => {
      const fetcher = logsSubject === 'category' && props.categoryActions ? props.categoryActions.fetchLogs : props.fetchLogs;
      return fetcher(logsTarget!.id, { page: logsPage, pageSize: logsPageSize });
    },
    enabled: Boolean(logsTarget && props.canViewLogs),
  });

  const invalidateRelated = async () => {
    await queryClient.invalidateQueries({ queryKey: [props.treeQueryKey] });
    if (props.categoryOptionsQueryKey) {
      await queryClient.invalidateQueries({ queryKey: [props.categoryOptionsQueryKey] });
    }
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
      await queryClient.invalidateQueries({ queryKey: ['taxonomy-logs', logsSubject, logsTarget.id] });
    }
  };

  const createMutation = useMutation({
    mutationFn: ({ subject, payload }: { subject: TaxonomySubject; payload: SaveTaxonomyPayload }) => {
      const creator = subject === 'category' && props.categoryActions ? props.categoryActions.createItem : props.createItem;
      return creator(payload);
    },
    onSuccess: async () => {
      messageApi.success(props.locale === 'zh-CN' ? '已创建。' : 'Created.');
      setActionState({ open: false, mode: 'create-root', subject: props.kind, target: null });
      form.resetFields();
      await invalidateRelated();
    },
    onError: (error) => messageApi.error(getApiErrorMessage(error, props.locale === 'zh-CN' ? '创建失败，请检查名称或层级。' : 'Create failed. Please check the name or hierarchy.', props.locale)),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, subject, payload }: { id: number; subject: TaxonomySubject; payload: SaveTaxonomyPayload }) => {
      const updater = subject === 'category' && props.categoryActions ? props.categoryActions.updateItem : props.updateItem;
      return updater(id, payload);
    },
    onSuccess: async () => {
      messageApi.success(props.locale === 'zh-CN' ? '已更新。' : 'Updated.');
      setActionState({ open: false, mode: 'create-root', subject: props.kind, target: null });
      form.resetFields();
      await invalidateRelated();
    },
    onError: (error) => messageApi.error(getApiErrorMessage(error, props.locale === 'zh-CN' ? '更新失败，请检查名称或层级。' : 'Update failed. Please check the name or hierarchy.', props.locale)),
  });

  const moveMutation = useMutation({
    mutationFn: ({ id, direction, subject }: { id: number; direction: 'up' | 'down'; subject: TaxonomySubject }) => {
      const mover = subject === 'category' && props.categoryActions ? props.categoryActions.moveItem : props.moveItem;
      return mover(id, { direction });
    },
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
    mutationFn: ({ id, subject }: { id: number; subject: TaxonomySubject }) => {
      const deleter = subject === 'category' && props.categoryActions ? props.categoryActions.deleteItem : props.deleteItem;
      return deleter(id);
    },
    onSuccess: async () => {
      messageApi.success(props.locale === 'zh-CN' ? '已删除。' : 'Deleted.');
      await invalidateRelated();
    },
    onError: (error) => messageApi.error(getApiErrorMessage(error, props.deleteInUseHint, props.locale)),
  });

  const categoryItems = useMemo(() => categoryOptionsQuery.data ?? [], [categoryOptionsQuery.data]);
  const treeItems = useMemo(() => treeQuery.data ?? [], [treeQuery.data]);

  const filteredCategoryItems = useMemo(
    () => filterCategoryTree(props.kind === 'category' ? treeItems : categoryItems, deferredSearch),
    [categoryItems, deferredSearch, props.kind, treeItems],
  );
  const filteredTagPayload = useMemo(
    () => filterTagTree(categoryItems, treeItems, deferredSearch),
    [categoryItems, deferredSearch, treeItems],
  );

  const categorySelectTreeData = useMemo(
    () => buildCategorySelectTreeData(categoryItems, actionState.mode === 'edit' ? actionState.target?.id : undefined),
    [actionState.mode, actionState.target?.id, categoryItems],
  );

  const defaultExpandedKeys = useMemo(() => {
    const source = props.kind === 'category' ? filteredCategoryItems : filteredTagPayload.categories;
    return source.map((item) => `category-${item.id}`);
  }, [filteredCategoryItems, filteredTagPayload.categories, props.kind]);

  const effectiveExpandedKeys = expandedKeys.length > 0 ? expandedKeys : defaultExpandedKeys;

  const openCreateModal = (mode: TreeActionMode, subject: TaxonomySubject, target: TaxonomyRecord | null = null) => {
    setActionState({ open: true, mode, subject, target });
    if (mode === 'edit' && target) {
      form.setFieldsValue({
        name: target.name,
        parentId: target.parentId,
        categoryId: target.categoryId,
      });
      return;
    }
    form.setFieldsValue({
      name: '',
      parentId: mode === 'create-child' && subject === 'category' ? target?.id : undefined,
      categoryId: subject === 'tag' ? target?.id : undefined,
    });
  };

  const renderMoveButtons = (record: TaxonomyRecord, subject: TaxonomySubject) => (
    <Space size={0}>
      <Button type="text" size="small" icon={<ArrowUpOutlined />} loading={movingKey === `${subject}-${record.id}-up`} onClick={(event) => {
        event.stopPropagation();
        setMovingKey(`${subject}-${record.id}-up`);
        moveMutation.mutate({ id: record.id, direction: 'up', subject });
      }} />
      <Button type="text" size="small" icon={<ArrowDownOutlined />} loading={movingKey === `${subject}-${record.id}-down`} onClick={(event) => {
        event.stopPropagation();
        setMovingKey(`${subject}-${record.id}-down`);
        moveMutation.mutate({ id: record.id, direction: 'down', subject });
      }} />
    </Space>
  );

  const renderCategoryTitle = (record: TaxonomyRecord, includeTagCreate: boolean) => (
    <Flex align="center" justify="space-between" gap={12} className="taxonomy-tree-row">
      <div className="taxonomy-tree-main">
        <Typography.Text strong>{record.name}</Typography.Text>
        <Typography.Text type="secondary">{record.fullPath || record.name}</Typography.Text>
        <Typography.Text type="secondary">
          {props.locale === 'zh-CN'
            ? `子分类 ${record.childCount ?? 0} · 标签 ${record.tagCount ?? 0} · 使用 ${record.usageCount}`
            : `Children ${record.childCount ?? 0} · Tags ${record.tagCount ?? 0} · Usage ${record.usageCount}`}
        </Typography.Text>
      </div>
      <Space size={4} wrap>
        {renderMoveButtons(record, 'category')}
        {props.canCreate ? (
          <Button type="text" size="small" icon={<FolderAddOutlined />} onClick={(event) => {
            event.stopPropagation();
            openCreateModal('create-child', 'category', record);
          }}>
            {props.locale === 'zh-CN' ? '子分类' : 'Child'}
          </Button>
        ) : null}
        {props.canCreate && includeTagCreate ? (
          <Button type="text" size="small" icon={<TagOutlined />} onClick={(event) => {
            event.stopPropagation();
            openCreateModal('create-tag', 'tag', record);
          }}>
            {props.locale === 'zh-CN' ? '标签' : 'Tag'}
          </Button>
        ) : null}
        {props.canEdit ? (
          <Button type="text" size="small" icon={<EditOutlined />} onClick={(event) => {
            event.stopPropagation();
            openCreateModal('edit', 'category', record);
          }}>
            {props.locale === 'zh-CN' ? '编辑' : 'Edit'}
          </Button>
        ) : null}
        {props.canViewLogs ? (
          <Button type="text" size="small" icon={<FileSearchOutlined />} onClick={(event) => {
            event.stopPropagation();
            setLogsSubject('category');
            setLogsTarget(record);
          }}>
            {props.locale === 'zh-CN' ? '记录' : 'Logs'}
          </Button>
        ) : null}
        {props.canDelete ? (
          <Popconfirm title={props.deleteConfirm} onConfirm={() => deleteMutation.mutate({ id: record.id, subject: 'category' })}>
            <Button danger type="text" size="small" icon={<DeleteOutlined />} onClick={(event) => event.stopPropagation()}>
              {props.locale === 'zh-CN' ? '删除' : 'Delete'}
            </Button>
          </Popconfirm>
        ) : null}
      </Space>
    </Flex>
  );

  const renderTagTitle = (record: TaxonomyRecord) => (
    <Flex align="center" justify="space-between" gap={12} className="taxonomy-tree-row taxonomy-tree-leaf">
      <div className="taxonomy-tree-main">
        <Typography.Text strong>{record.name}</Typography.Text>
        <Typography.Text type="secondary">{record.fullPath || record.name}</Typography.Text>
        <Typography.Text type="secondary">
          {props.locale === 'zh-CN' ? `使用 ${record.usageCount}` : `Usage ${record.usageCount}`}
        </Typography.Text>
      </div>
      <Space size={4} wrap>
        {renderMoveButtons(record, 'tag')}
        {props.canEdit ? (
          <Button type="text" size="small" icon={<EditOutlined />} onClick={(event) => {
            event.stopPropagation();
            openCreateModal('edit', 'tag', record);
          }}>
            {props.locale === 'zh-CN' ? '编辑' : 'Edit'}
          </Button>
        ) : null}
        {props.canViewLogs ? (
          <Button type="text" size="small" icon={<FileSearchOutlined />} onClick={(event) => {
            event.stopPropagation();
            setLogsSubject('tag');
            setLogsTarget(record);
          }}>
            {props.locale === 'zh-CN' ? '记录' : 'Logs'}
          </Button>
        ) : null}
        {props.canDelete ? (
          <Popconfirm title={props.deleteConfirm} onConfirm={() => deleteMutation.mutate({ id: record.id, subject: 'tag' })}>
            <Button danger type="text" size="small" icon={<DeleteOutlined />} onClick={(event) => event.stopPropagation()}>
              {props.locale === 'zh-CN' ? '删除' : 'Delete'}
            </Button>
          </Popconfirm>
        ) : null}
      </Space>
    </Flex>
  );

  const treeData = useMemo(() => {
    if (props.kind === 'category') {
      return buildCategoryTreeData(filteredCategoryItems, (item) => renderCategoryTitle(item, false));
    }
    return buildTagTreeData(
      filteredTagPayload.categories,
      filteredTagPayload.tags,
      (item) => renderCategoryTitle(item, true),
      (item) => renderTagTitle(item),
    );
  }, [filteredCategoryItems, filteredTagPayload.categories, filteredTagPayload.tags, props.kind]);

  const isCategoryModal = actionState.subject === 'category';

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
            <Button icon={<ReloadOutlined />} onClick={() => treeQuery.refetch()}>{props.locale === 'zh-CN' ? '刷新' : 'Refresh'}</Button>
            {props.canCreate ? (
              <Button type="primary" icon={<PlusOutlined />} onClick={() => openCreateModal('create-root', props.kind)}>
                {props.createLabel}
              </Button>
            ) : null}
            {props.canCreate && props.kind === 'tag' && props.categoryActions ? (
              <Button icon={<FolderAddOutlined />} onClick={() => openCreateModal('create-root', 'category')}>
                {props.locale === 'zh-CN' ? '新建顶级分类' : 'New root category'}
              </Button>
            ) : null}
          </div>
        </div>

        {treeQuery.isLoading || (props.kind === 'tag' && categoryOptionsQuery.isLoading) ? (
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
          : (actionState.subject === 'category'
            ? (props.locale === 'zh-CN' ? '新建分类' : 'New category')
            : props.createLabel)}
        onCancel={() => {
          setActionState({ open: false, mode: 'create-root', subject: props.kind, target: null });
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
              updateMutation.mutate({ id: actionState.target.id, subject: actionState.subject, payload: values });
              return;
            }
            createMutation.mutate({ subject: actionState.subject, payload: values });
          }}
        >
          <Form.Item
            name="name"
            label={actionState.subject === 'category'
              ? (props.locale === 'zh-CN' ? '分类名称' : 'Category name')
              : props.recordLabel}
            rules={[{ required: true }]}
          >
            <Input maxLength={128} />
          </Form.Item>

          {isCategoryModal ? (
            <Form.Item name="parentId" label={props.locale === 'zh-CN' ? '父分类' : 'Parent category'}>
              <TreeSelect
                allowClear
                treeDefaultExpandAll
                showSearch
                treeNodeFilterProp="title"
                treeData={categorySelectTreeData}
                placeholder={props.locale === 'zh-CN' ? '顶级分类可留空' : 'Leave empty for top-level category'}
              />
            </Form.Item>
          ) : null}

          {!isCategoryModal ? (
            <Form.Item name="categoryId" label={props.locale === 'zh-CN' ? '所属分类' : 'Category'} rules={[{ required: true }]}>
              <TreeSelect
                treeDefaultExpandAll
                showSearch
                treeNodeFilterProp="title"
                treeData={categorySelectTreeData}
                placeholder={props.locale === 'zh-CN' ? '请选择所属分类' : 'Select category'}
              />
            </Form.Item>
          ) : null}
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
