import { FilterOutlined, FileSearchOutlined, FolderOpenOutlined, ReloadOutlined, SearchOutlined, TagsOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { Avatar, Button, Card, Input, Modal, Select, Skeleton, Space, Table, Tag, Tree, Typography } from 'antd';
import type { DataNode } from 'antd/es/tree';
import type { ColumnsType } from 'antd/es/table';
import { useDeferredValue, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchPublicCategoryOptions, fetchPublicFileListDisplayConfig, fetchPublicFiles, fetchPublicTagOptions } from '../api/files';
import type { FileListDisplaySettings, FileRecord, TaxonomyRecord } from '../api/types';
import { useI18n } from '../features/i18n/LocaleProvider';
import { useUserAuth } from '../features/user/AuthProvider';
import { formatBytes, formatDate } from '../lib/format';
import { buildAccordionTreeMaps, toggleAccordionExpandedKeys } from '../lib/treeAccordion';

function sortTaxonomyItems<T extends { sortOrder: number; name: string }>(items: T[]) {
  return [...items].sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name, 'zh-Hans-CN'));
}

function toggleSelection(current: string[], targets: string[]) {
  const currentSet = new Set(current);
  const allSelected = targets.every((item) => currentSet.has(item));
  if (allSelected) {
    return current.filter((item) => !targets.includes(item));
  }
  const next = new Set(current);
  targets.forEach((item) => next.add(item));
  return Array.from(next);
}

function buildNodeTitle(label: string, selectedLeaves: number, totalLeaves: number, active: boolean, partial: boolean) {
  return (
    <span className={`filter-node-title${active ? ' is-active' : ''}${partial ? ' is-partial' : ''}`}>
      <span className="filter-node-label">{label}</span>
      {totalLeaves > 1 ? <span className="filter-node-count">{selectedLeaves}/{totalLeaves}</span> : null}
    </span>
  );
}

function resolveLeafName(value?: string) {
  if (!value) {
    return '';
  }
  const parts = value.split('.');
  return parts[parts.length - 1] || value;
}

function buildCategoryTreeOptions(items: TaxonomyRecord[], selected: string[]) {
  const selectedSet = new Set(selected);
  const childrenByParent = new Map<number | null, TaxonomyRecord[]>();
  for (const item of items) {
    const key = item.parentId ?? null;
    const siblings = childrenByParent.get(key) ?? [];
    siblings.push(item);
    childrenByParent.set(key, siblings);
  }

  const descendants = new Map<string, string[]>();
  const build = (parentId: number | null): DataNode[] =>
    sortTaxonomyItems(childrenByParent.get(parentId) ?? []).map((item) => {
      const children = build(item.id);
      const childDescendants = children.flatMap((child) => descendants.get(String(child.key)) ?? []);
      const ownDescendants = [item.name, ...childDescendants];
      descendants.set(item.name, ownDescendants);
      const selectedLeaves = ownDescendants.filter((entry) => selectedSet.has(entry)).length;
      return {
        title: buildNodeTitle(item.name, selectedLeaves, ownDescendants.length, selectedLeaves === ownDescendants.length, selectedLeaves > 0 && selectedLeaves < ownDescendants.length),
        key: item.name,
        children,
      };
    });

  return { treeData: build(null), descendants };
}

function buildTagTreeOptions(tags: TaxonomyRecord[], selected: string[]) {
  const selectedSet = new Set(selected);
  const childrenByParent = new Map<number | null, TaxonomyRecord[]>();
  for (const item of tags) {
    const key = item.parentId ?? null;
    const siblings = childrenByParent.get(key) ?? [];
    siblings.push(item);
    childrenByParent.set(key, siblings);
  }

  const descendants = new Map<string, string[]>();
  const build = (parentId: number | null): DataNode[] =>
    sortTaxonomyItems(childrenByParent.get(parentId) ?? []).map((item) => {
      const children = build(item.id);
      const ownDescendants = [item.name, ...children.flatMap((child) => descendants.get(String(child.key)) ?? [])];
      descendants.set(`tag:${item.name}`, ownDescendants);
      const selectedLeaves = ownDescendants.filter((entry) => selectedSet.has(entry)).length;
      return {
        title: buildNodeTitle(item.name, selectedLeaves, ownDescendants.length, selectedLeaves === ownDescendants.length, selectedLeaves > 0 && selectedLeaves < ownDescendants.length),
        key: `tag:${item.name}`,
        children,
      };
    });

  return { treeData: build(null), descendants };
}

export function PublicFilesPage() {
  const [search, setSearch] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [draftCategories, setDraftCategories] = useState<string[]>([]);
  const [draftTags, setDraftTags] = useState<string[]>([]);
  const [categoryExpandedKeys, setCategoryExpandedKeys] = useState<string[]>([]);
  const [tagExpandedKeys, setTagExpandedKeys] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const deferredSearch = useDeferredValue(search.trim());
  const { locale } = useI18n();
  const { token } = useUserAuth();

  const categoryOptionsQuery = useQuery({ queryKey: ['public-category-options'], queryFn: fetchPublicCategoryOptions });
  const tagOptionsQuery = useQuery({ queryKey: ['public-tag-options'], queryFn: fetchPublicTagOptions });
  const fileListDisplayQuery = useQuery({ queryKey: ['public-file-list-display-config'], queryFn: fetchPublicFileListDisplayConfig });
  const filesQuery = useQuery({
    queryKey: ['public-files', page, pageSize, deferredSearch, categories.join('|'), tags.join('|'), sortBy, sortOrder],
    queryFn: () => fetchPublicFiles({
      page,
      pageSize,
      search: deferredSearch || undefined,
      categories,
      tags,
      sortBy,
      sortOrder,
    }),
  });

  const categoryTree = useMemo(
    () => buildCategoryTreeOptions(categoryOptionsQuery.data ?? [], draftCategories),
    [categoryOptionsQuery.data, draftCategories],
  );
  const tagTree = useMemo(
    () => buildTagTreeOptions(tagOptionsQuery.data ?? [], draftTags),
    [tagOptionsQuery.data, draftTags],
  );
  const taxonomyLoading = categoryOptionsQuery.isLoading || tagOptionsQuery.isLoading;
  const categoryTreeMaps = useMemo(() => buildAccordionTreeMaps(categoryTree.treeData), [categoryTree.treeData]);
  const tagTreeMaps = useMemo(() => buildAccordionTreeMaps(tagTree.treeData), [tagTree.treeData]);
  const fileListDisplay = fileListDisplayQuery.data ?? ({ categoryMode: 'fullPath', tagMode: 'fullPath' } satisfies FileListDisplaySettings);
  const categoryPathMap = useMemo(() => new Map((categoryOptionsQuery.data ?? []).map((item) => [item.name, item.fullPath || item.name])), [categoryOptionsQuery.data]);
  const tagPathMap = useMemo(() => new Map((tagOptionsQuery.data ?? []).map((item) => [item.name, item.fullPath || item.name])), [tagOptionsQuery.data]);
  const appliedFilterCount = categories.length + tags.length;

  function openFilterModal() {
    setDraftCategories(categories);
    setDraftTags(tags);
    setCategoryExpandedKeys([]);
    setTagExpandedKeys([]);
    setFilterModalOpen(true);
  }

  function applyFilters() {
    setCategories(draftCategories);
    setTags(draftTags);
    setPage(1);
    setFilterModalOpen(false);
  }

  function clearFilters() {
    setDraftCategories([]);
    setDraftTags([]);
  }

  const columns: ColumnsType<FileRecord> = [
    {
      title: locale === 'zh-CN' ? '展示名称' : 'Name',
      dataIndex: 'name',
      key: 'name',
      width: 220,
      render: (value, record) => (
        <Link to={`/files/${record.id}`} className="file-entry-link">
          <Typography.Text strong>{value}</Typography.Text>
        </Link>
      ),
    },
    {
      title: locale === 'zh-CN' ? '标签' : 'Tags',
      dataIndex: 'tagPaths',
      key: 'tagPaths',
      width: 340,
      render: (value: string[] | undefined, record) => {
        const items = value?.length ? value : record.tags;
        if (!items?.length) {
          return '-';
        }
        const displayItems = fileListDisplay.tagMode === 'leafName'
          ? items.map((item) => resolveLeafName(item))
          : items;
        return (
          <div className="public-tag-grid adaptive">
            {displayItems.map((tag, index) => (
              <Tag key={`${items[index]}-${index}`} className="public-tag-grid-item" title={tag}>{tag}</Tag>
            ))}
          </div>
        );
      },
    },
    {
      title: locale === 'zh-CN' ? '分类' : 'Category',
      dataIndex: 'categoryPath',
      key: 'categoryPath',
      width: 150,
      render: (value, record) => {
        const displayValue = fileListDisplay.categoryMode === 'leafName'
          ? (record.category || resolveLeafName(value))
          : (value || record.category);
        return displayValue ? <Tag>{displayValue}</Tag> : '-';
      },
    },
    {
      title: locale === 'zh-CN' ? '上传者' : 'Uploader',
      key: 'uploader',
      width: 150,
      render: (_, record) => {
        if (!record.createdByUsername) {
          return '-';
        }
        const label = record.createdByDisplayName || record.createdByUsername;
        const content = (
          <>
            <Avatar src={record.createdByAvatarUrl} size={28}>{label.slice(0, 1).toUpperCase()}</Avatar>
            <span>{label}</span>
          </>
        );
        if (!token) {
          return <span className="uploader-link disabled">{content}</span>;
        }
        return <Link to={`/users/${record.createdByUsername}`} className="uploader-link">{content}</Link>;
      },
    },
    { title: locale === 'zh-CN' ? '大小' : 'Size', dataIndex: 'size', key: 'size', width: 110, render: (value) => formatBytes(value) },
    { title: locale === 'zh-CN' ? '类型' : 'MIME', dataIndex: 'mimeType', key: 'mimeType', width: 150, render: (value) => <Typography.Text type="secondary">{value || '-'}</Typography.Text> },
    { title: locale === 'zh-CN' ? '上传时间' : 'Created at', dataIndex: 'createdAt', key: 'createdAt', width: 165, render: (value) => formatDate(value) },
    {
      title: locale === 'zh-CN' ? '操作' : 'Action',
      key: 'action',
      width: 120,
      fixed: 'right',
      render: (_, record) => (
        <div className="table-action-cell align-right">
          <Space size={4} className="file-action-group" wrap={false}>
            <Link to={`/files/${record.id}`} className="table-action-link file-action-button">
              <FileSearchOutlined />
              <span>{locale === 'zh-CN' ? '详情' : 'Details'}</span>
            </Link>
          </Space>
        </div>
      ),
    },
  ];

  return (
    <>
      <Card className="surface-card">
        <div className="toolbar-row">
          <div>
            <h2 className="section-title">{locale === 'zh-CN' ? '文件列表' : 'Files'}</h2>
            <p className="section-subtitle">{locale === 'zh-CN' ? '按关键词、分类和标签快速定位公开文件。' : 'Browse public files with keyword, category, and tag filters.'}</p>
          </div>

          <div className="toolbar-controls">
            <Input
              className="public-files-search-input"
              allowClear
              placeholder={locale === 'zh-CN' ? '搜索展示名称、原文件名、描述、上传者等关键词' : 'Search by keywords'}
              prefix={<SearchOutlined />}
              value={search}
              onChange={(event) => { setSearch(event.target.value); setPage(1); }}
            />
            <Button className="filter-trigger-button" icon={<FilterOutlined />} onClick={openFilterModal}>
              {locale === 'zh-CN' ? `分类与标签筛选${appliedFilterCount ? ` (${appliedFilterCount})` : ''}` : `Filters${appliedFilterCount ? ` (${appliedFilterCount})` : ''}`}
            </Button>
            {appliedFilterCount > 0 ? (
              <Button className="subtle-control-button" onClick={() => {
                setCategories([]);
                setTags([]);
                setDraftCategories([]);
                setDraftTags([]);
                setPage(1);
              }}>
                {locale === 'zh-CN' ? '清空筛选' : 'Clear filters'}
              </Button>
            ) : null}
            <Select className="toolbar-select medium" value={sortBy} options={[{ label: locale === 'zh-CN' ? '按上传时间' : 'Created at', value: 'createdAt' }, { label: locale === 'zh-CN' ? '按名称' : 'Name', value: 'name' }, { label: locale === 'zh-CN' ? '按大小' : 'Size', value: 'size' }]} onChange={(value) => { setSortBy(value); setPage(1); }} />
            <Select className="toolbar-select compact" value={sortOrder} options={[{ label: locale === 'zh-CN' ? '降序' : 'Desc', value: 'desc' }, { label: locale === 'zh-CN' ? '升序' : 'Asc', value: 'asc' }]} onChange={(value) => { setSortOrder(value); setPage(1); }} />
            <Button icon={<ReloadOutlined />} loading={filesQuery.isFetching} onClick={() => filesQuery.refetch()}>{locale === 'zh-CN' ? '刷新' : 'Refresh'}</Button>
          </div>
        </div>

        {appliedFilterCount > 0 ? (
          <div className="public-filter-summary">
            {categories.map((item) => (
              <Tag key={`category-${item}`} closable onClose={(event) => {
                event.preventDefault();
                setCategories((current) => current.filter((entry) => entry !== item));
                setDraftCategories((current) => current.filter((entry) => entry !== item));
                setPage(1);
              }}>
                {locale === 'zh-CN' ? '分类' : 'Category'}: {categoryPathMap.get(item) || item}
              </Tag>
            ))}
            {tags.map((item) => (
              <Tag key={`tag-${item}`} closable onClose={(event) => {
                event.preventDefault();
                setTags((current) => current.filter((entry) => entry !== item));
                setDraftTags((current) => current.filter((entry) => entry !== item));
                setPage(1);
              }}>
                {locale === 'zh-CN' ? '标签' : 'Tag'}: {tagPathMap.get(item) || item}
              </Tag>
            ))}
          </div>
        ) : null}

        <Table<FileRecord>
          rowKey="id"
          scroll={{ x: 1500 }}
          columns={columns}
          dataSource={filesQuery.data?.items ?? []}
          loading={filesQuery.isLoading || fileListDisplayQuery.isLoading}
          pagination={{ current: page, pageSize, total: filesQuery.data?.pagination.total ?? 0, onChange: (nextPage, nextPageSize) => { setPage(nextPage); setPageSize(nextPageSize); } }}
        />
      </Card>

      <Modal
        open={filterModalOpen}
        width={920}
        title={locale === 'zh-CN' ? '筛选分类与标签' : 'Filter categories and tags'}
        onCancel={() => setFilterModalOpen(false)}
        onOk={applyFilters}
        okText={locale === 'zh-CN' ? '应用筛选' : 'Apply filters'}
        cancelText={locale === 'zh-CN' ? '取消' : 'Cancel'}
        className="filter-modal"
        footer={(_, { OkBtn, CancelBtn }) => (
          <div className="filter-modal-footer">
            <Button className="subtle-control-button" onClick={clearFilters}>
              {locale === 'zh-CN' ? '清空当前选择' : 'Clear current selection'}
            </Button>
            <Space>
              <CancelBtn />
              <OkBtn />
            </Space>
          </div>
        )}
      >
        {taxonomyLoading ? (
          <Skeleton active paragraph={{ rows: 10 }} />
        ) : (
          <div className="filter-modal-grid">
            <section className="filter-panel">
              <div className="filter-panel-header">
                <Typography.Title level={5}><FolderOpenOutlined /> {locale === 'zh-CN' ? '分类' : 'Categories'}</Typography.Title>
                <Typography.Text type="secondary">
                  {locale === 'zh-CN' ? '勾选表示命中任一已选分类，点击父分类可一次选中整个分支。' : 'Select any categories. Clicking a parent selects the whole branch.'}
                </Typography.Text>
              </div>
              <Tree
                checkable
                expandedKeys={categoryExpandedKeys}
                checkedKeys={draftCategories}
                treeData={categoryTree.treeData}
                onCheck={(checkedKeys) => setDraftCategories(checkedKeys as string[])}
                onExpand={(keys, info) => {
                  setCategoryExpandedKeys(toggleAccordionExpandedKeys(keys, info.node.key, info.expanded, categoryTreeMaps));
                }}
                onSelect={(selectedKeys, info) => {
                  const key = String(info.node.key);
                  const targets = categoryTree.descendants.get(key) ?? [key];
                  setDraftCategories((current) => toggleSelection(current, targets));
                }}
                className="filter-selection-tree"
              />
            </section>

            <section className="filter-panel">
              <div className="filter-panel-header">
                <Typography.Title level={5}><TagsOutlined /> {locale === 'zh-CN' ? '标签' : 'Tags'}</Typography.Title>
                <Typography.Text type="secondary">
                  {locale === 'zh-CN' ? '勾选标签即可生效，点击父标签可批量选中其下全部子标签。' : 'Select tags directly, or click a parent tag to batch select its descendants.'}
                </Typography.Text>
              </div>
              <Tree
                checkable
                expandedKeys={tagExpandedKeys}
                checkedKeys={draftTags.map((item) => `tag:${item}`)}
                treeData={tagTree.treeData}
                onCheck={(checkedKeys) => {
                  const explicitKeys = Array.isArray(checkedKeys) ? checkedKeys : checkedKeys.checked;
                  const nextTags = new Set<string>();
                  for (const key of explicitKeys as string[]) {
                    const mapped = tagTree.descendants.get(String(key));
                    if (mapped?.length) {
                      mapped.forEach((item) => nextTags.add(item));
                    } else if (String(key).startsWith('tag:')) {
                      nextTags.add(String(key).slice(4));
                    }
                  }
                  setDraftTags(Array.from(nextTags));
                }}
                onExpand={(keys, info) => {
                  setTagExpandedKeys(toggleAccordionExpandedKeys(keys, info.node.key, info.expanded, tagTreeMaps));
                }}
                onSelect={(selectedKeys, info) => {
                  const key = String(info.node.key);
                  const targets = tagTree.descendants.get(key) ?? (key.startsWith('tag:') ? [key.slice(4)] : []);
                  setDraftTags((current) => toggleSelection(current, targets));
                }}
                className="filter-selection-tree"
              />
            </section>
          </div>
        )}
      </Modal>
    </>
  );
}
