import { FilterOutlined, FileSearchOutlined, ReloadOutlined, SearchOutlined, TagsOutlined, FolderOpenOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { Avatar, Button, Card, Input, Modal, Select, Skeleton, Space, Table, Tag, Tree, Typography } from 'antd';
import type { DataNode } from 'antd/es/tree';
import type { ColumnsType } from 'antd/es/table';
import { useDeferredValue, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchPublicCategoryOptions, fetchPublicFiles, fetchPublicTagCategoryOptions, fetchPublicTagOptions } from '../api/files';
import type { FileRecord, TaxonomyRecord } from '../api/types';
import { useI18n } from '../features/i18n/LocaleProvider';
import { formatBytes, formatDate } from '../lib/format';

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

  const build = (parentId: number | null): DataNode[] =>
    sortTaxonomyItems(childrenByParent.get(parentId) ?? []).map((item) => ({
      title: item.fullPath || item.name,
      key: item.name,
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

  const build = (parentId: number | null): DataNode[] =>
    sortTaxonomyItems(categoryChildrenByParent.get(parentId) ?? []).map((category) => ({
      title: category.fullPath || category.name,
      key: `category-${category.id}`,
      selectable: false,
      disableCheckbox: true,
      children: [
        ...build(category.id),
        ...sortTaxonomyItems(tagsByCategory.get(category.id) ?? []).map((tag) => ({
          title: tag.fullPath || tag.name,
          key: tag.name,
        })),
      ],
    }));

  return build(null);
}

export function PublicFilesPage() {
  const [search, setSearch] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [draftCategories, setDraftCategories] = useState<string[]>([]);
  const [draftTags, setDraftTags] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const deferredSearch = useDeferredValue(search.trim());
  const { t, locale } = useI18n();

  const categoryOptionsQuery = useQuery({ queryKey: ['public-category-options'], queryFn: fetchPublicCategoryOptions });
  const tagCategoryOptionsQuery = useQuery({ queryKey: ['public-tag-category-options'], queryFn: fetchPublicTagCategoryOptions });
  const tagOptionsQuery = useQuery({ queryKey: ['public-tag-options'], queryFn: fetchPublicTagOptions });
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

  const categoryTreeData = useMemo(
    () => buildCategoryTreeOptions(categoryOptionsQuery.data ?? []),
    [categoryOptionsQuery.data],
  );
  const tagTreeData = useMemo(
    () => buildTagTreeOptions(tagCategoryOptionsQuery.data ?? [], tagOptionsQuery.data ?? []),
    [tagCategoryOptionsQuery.data, tagOptionsQuery.data],
  );
  const taxonomyLoading = categoryOptionsQuery.isLoading || tagCategoryOptionsQuery.isLoading || tagOptionsQuery.isLoading;
  const categoryPathMap = useMemo(() => new Map((categoryOptionsQuery.data ?? []).map((item) => [item.name, item.fullPath || item.name])), [categoryOptionsQuery.data]);
  const tagPathMap = useMemo(() => new Map((tagOptionsQuery.data ?? []).map((item) => [item.name, item.fullPath || item.name])), [tagOptionsQuery.data]);
  const appliedFilterCount = categories.length + tags.length;

  function openFilterModal() {
    setDraftCategories(categories);
    setDraftTags(tags);
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
      width: 240,
      render: (value, record) => (
        <Link to={`/files/${record.id}`} className="file-entry-link">
          <Typography.Text strong>{value}</Typography.Text>
        </Link>
      ),
    },
    { title: locale === 'zh-CN' ? '标签' : 'Tags', dataIndex: 'tagPaths', key: 'tagPaths', width: 260, render: (value: string[] | undefined, record) => <Space size={[6, 6]} wrap>{(value?.length ? value : record.tags)?.length ? (value?.length ? value : record.tags).map((tag) => <Tag key={tag}>{tag}</Tag>) : '-'}</Space> },
    { title: locale === 'zh-CN' ? '分类' : 'Category', dataIndex: 'categoryPath', key: 'categoryPath', width: 180, render: (value, record) => ((value || record.category) ? <Tag>{value || record.category}</Tag> : '-') },
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
            <h2 className="section-title">{t('publicFiles.title')}</h2>
            <p className="section-subtitle">{t('publicFiles.subtitle')}</p>
          </div>

          <div className="toolbar-controls">
            <Input allowClear placeholder={t('publicFiles.search')} prefix={<SearchOutlined />} style={{ width: 320 }} value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
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
            <Select style={{ width: 150 }} value={sortBy} options={[{ label: locale === 'zh-CN' ? '按上传时间' : 'Created at', value: 'createdAt' }, { label: locale === 'zh-CN' ? '按名称' : 'Name', value: 'name' }, { label: locale === 'zh-CN' ? '按大小' : 'Size', value: 'size' }]} onChange={(value) => { setSortBy(value); setPage(1); }} />
            <Select style={{ width: 110 }} value={sortOrder} options={[{ label: locale === 'zh-CN' ? '降序' : 'Desc', value: 'desc' }, { label: locale === 'zh-CN' ? '升序' : 'Asc', value: 'asc' }]} onChange={(value) => { setSortOrder(value); setPage(1); }} />
            <Button icon={<ReloadOutlined />} onClick={() => filesQuery.refetch()}>{t('files.refresh')}</Button>
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
          scroll={{ x: 1720 }}
          columns={columns}
          dataSource={filesQuery.data?.items ?? []}
          loading={filesQuery.isLoading}
          pagination={{ current: page, pageSize, total: filesQuery.data?.pagination.total ?? 0, onChange: (nextPage, nextPageSize) => { setPage(nextPage); setPageSize(nextPageSize); } }}
        />
      </Card>

      <Modal
        open={filterModalOpen}
        width={860}
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
                  {locale === 'zh-CN' ? '支持多选，命中任一分类即可。' : 'Multi-select. Files in any selected category will match.'}
                </Typography.Text>
              </div>
              <Tree
                checkable
                defaultExpandAll
                checkedKeys={draftCategories}
                treeData={categoryTreeData}
                onCheck={(checkedKeys) => setDraftCategories((checkedKeys as string[]).filter((item) => !item.startsWith('category-')))}
                className="filter-selection-tree"
              />
            </section>

            <section className="filter-panel">
              <div className="filter-panel-header">
                <Typography.Title level={5}><TagsOutlined /> {locale === 'zh-CN' ? '标签' : 'Tags'}</Typography.Title>
                <Typography.Text type="secondary">
                  {locale === 'zh-CN' ? '支持多选，命中任一标签即可。' : 'Multi-select. Files with any selected tag will match.'}
                </Typography.Text>
              </div>
              <Tree
                checkable
                defaultExpandAll
                checkedKeys={draftTags}
                treeData={tagTreeData}
                onCheck={(checkedKeys) => setDraftTags((checkedKeys as string[]).filter((item) => !item.startsWith('category-')))}
                className="filter-selection-tree"
              />
            </section>
          </div>
        )}
      </Modal>
    </>
  );
}
