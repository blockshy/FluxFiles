import { DeleteOutlined, LockOutlined, PushpinOutlined, ReloadOutlined, SearchOutlined, UnlockOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Input, Space, Table, Tag, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useDeferredValue, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchAdminCommunityPosts, moderateCommunityPost } from '../api/community';
import type { CommunityPostRecord } from '../api/types';
import { useI18n } from '../features/i18n/LocaleProvider';
import { getApiErrorMessage } from '../lib/apiError';
import { formatDate } from '../lib/format';

export function AdminCommunityPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const deferredSearch = useDeferredValue(search.trim());
  const queryClient = useQueryClient();
  const [messageApi, contextHolder] = message.useMessage();
  const { locale } = useI18n();

  const postsQuery = useQuery({
    queryKey: ['admin-community-posts', page, deferredSearch],
    queryFn: () => fetchAdminCommunityPosts({ page, pageSize: 20, search: deferredSearch || undefined }),
  });

  const moderateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: { isPinned?: boolean; isLocked?: boolean; delete?: boolean } }) => moderateCommunityPost(id, payload),
    onSuccess: async () => {
      messageApi.success(locale === 'zh-CN' ? '帖子状态已更新。' : 'Post updated.');
      await queryClient.invalidateQueries({ queryKey: ['admin-community-posts'] });
      await queryClient.invalidateQueries({ queryKey: ['community-posts'] });
    },
    onError: (error) => messageApi.error(getApiErrorMessage(error, locale === 'zh-CN' ? '更新帖子状态失败，请稍后再试。' : 'Failed to update post state.', locale)),
  });

  const columns: ColumnsType<CommunityPostRecord> = [
    {
      title: locale === 'zh-CN' ? '标题' : 'Title',
      key: 'title',
      render: (_, record) => (
        <Space direction="vertical" size={4}>
          <Link to={`/community/${record.id}`}>{record.title}</Link>
          <Space wrap size={6}>
            {record.isPinned ? <Tag color="gold">置顶</Tag> : null}
            {record.isLocked ? <Tag>已锁定</Tag> : null}
          </Space>
        </Space>
      ),
    },
    {
      title: locale === 'zh-CN' ? '作者' : 'Author',
      dataIndex: 'author',
      key: 'author',
      width: 180,
      render: (author) => author.displayName || author.username,
    },
    {
      title: locale === 'zh-CN' ? '回复' : 'Replies',
      dataIndex: 'replyCount',
      key: 'replyCount',
      width: 90,
    },
    {
      title: locale === 'zh-CN' ? '浏览' : 'Views',
      dataIndex: 'viewCount',
      key: 'viewCount',
      width: 90,
    },
    {
      title: locale === 'zh-CN' ? '最后活跃' : 'Last active',
      key: 'lastActive',
      width: 180,
      render: (_, record) => formatDate(record.lastRepliedAt || record.createdAt),
    },
    {
      title: locale === 'zh-CN' ? '操作' : 'Actions',
      key: 'actions',
      width: 260,
      fixed: 'right',
      render: (_, record) => (
        <div className="table-action-cell align-right">
          <Space wrap>
            <Button
              className="table-action-button"
              icon={<PushpinOutlined />}
              loading={moderateMutation.isPending}
              onClick={() => moderateMutation.mutate({ id: record.id, payload: { isPinned: !record.isPinned } })}
            >
              {record.isPinned ? '取消置顶' : '置顶'}
            </Button>
            <Button
              className="table-action-button"
              icon={record.isLocked ? <UnlockOutlined /> : <LockOutlined />}
              loading={moderateMutation.isPending}
              onClick={() => moderateMutation.mutate({ id: record.id, payload: { isLocked: !record.isLocked } })}
            >
              {record.isLocked ? '解锁' : '锁定'}
            </Button>
            <Button
              className="table-action-button"
              danger
              icon={<DeleteOutlined />}
              loading={moderateMutation.isPending}
              onClick={() => moderateMutation.mutate({ id: record.id, payload: { delete: true } })}
            >
              删除
            </Button>
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
            <h2 className="section-title">{locale === 'zh-CN' ? '社区管理' : 'Community Management'}</h2>
            <p className="section-subtitle">{locale === 'zh-CN' ? '集中查看帖子并执行置顶、锁定和删除。' : 'Review community posts and manage moderation state.'}</p>
          </div>
          <div className="toolbar-controls">
            <Input
              allowClear
              prefix={<SearchOutlined />}
              style={{ width: 320 }}
              placeholder={locale === 'zh-CN' ? '搜索帖子标题、正文或作者' : 'Search posts'}
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
            <Button icon={<ReloadOutlined />} onClick={() => postsQuery.refetch()}>
              {locale === 'zh-CN' ? '刷新' : 'Refresh'}
            </Button>
          </div>
        </div>

        <Table<CommunityPostRecord>
          rowKey="id"
          loading={postsQuery.isLoading}
          columns={columns}
          dataSource={postsQuery.data?.items ?? []}
          scroll={{ x: 1100 }}
          pagination={{
            current: page,
            pageSize: 20,
            total: postsQuery.data?.pagination.total ?? 0,
            onChange: (nextPage) => setPage(nextPage),
          }}
        />
      </Card>
    </>
  );
}
