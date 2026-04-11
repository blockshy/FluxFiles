import { EyeOutlined, MessageOutlined, PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { useDeferredValue, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, Card, Empty, Input, List, Skeleton, Space, Tag, Typography } from 'antd';
import { Link } from 'react-router-dom';
import { fetchCommunityPosts } from '../api/community';
import type { CommunityPostRecord } from '../api/types';
import { useI18n } from '../features/i18n/LocaleProvider';
import { formatDate } from '../lib/format';

export function CommunityPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const deferredSearch = useDeferredValue(search.trim());
  const { locale } = useI18n();

  const postsQuery = useQuery({
    queryKey: ['community-posts', page, deferredSearch],
    queryFn: () => fetchCommunityPosts({ page, pageSize: 12, search: deferredSearch || undefined }),
  });

  return (
    <Card className="surface-card community-list-card">
        <div className="toolbar-row">
          <div>
            <h2 className="section-title">社区</h2>
            <p className="section-subtitle">发布主题、持续讨论、集中处理和文件相关的延伸交流。</p>
          </div>
          <div className="toolbar-controls">
            <Input
              className="community-search-input"
              allowClear
              prefix={<SearchOutlined />}
              placeholder={locale === 'zh-CN' ? '搜索帖子标题、正文或作者' : 'Search posts'}
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
            <Button icon={<ReloadOutlined />} loading={postsQuery.isFetching} onClick={() => postsQuery.refetch()}>
              刷新
            </Button>
            <Link to="/community/new" className="table-action-link file-action-button">
              <PlusOutlined />
              <span>发布帖子</span>
            </Link>
          </div>
        </div>

        {postsQuery.isLoading ? (
          <Skeleton active paragraph={{ rows: 10 }} />
        ) : (postsQuery.data?.items.length ?? 0) === 0 ? (
          <Empty description={locale === 'zh-CN' ? '暂时还没有帖子' : 'No posts yet'} />
        ) : (
          <>
            {(postsQuery.isFetching && !postsQuery.isLoading) ? (
              <div className="inline-loading-block">
                <Skeleton active paragraph={{ rows: 1 }} title={false} />
              </div>
            ) : null}
            <List
              itemLayout="horizontal"
              dataSource={postsQuery.data?.items ?? []}
              renderItem={(item: CommunityPostRecord) => (
                <div className="community-post-shell">
                  <List.Item
                    actions={[
                      <Link key="open" to={`/community/${item.id}`} className="table-action-link file-action-button community-open-button">
                        <MessageOutlined />
                        <span>进入讨论</span>
                      </Link>,
                    ]}
                  >
                    <List.Item.Meta
                      title={(
                        <Space wrap size={10}>
                          <Link to={`/community/${item.id}`} className="community-post-link">
                            <Typography.Text strong>{item.title}</Typography.Text>
                          </Link>
                          {item.isPinned ? <Tag color="gold">置顶</Tag> : null}
                          {item.isLocked ? <Tag color="default">已锁定</Tag> : null}
                        </Space>
                      )}
                      description={(
                        <div className="community-post-summary">
                          <Typography.Paragraph ellipsis={{ rows: 2 }} className="community-post-excerpt">
                            {item.contentText}
                          </Typography.Paragraph>
                          <Space size={12} wrap className="community-post-meta">
                            <span>{item.author.displayName || item.author.username}</span>
                            <span>{formatDate(item.createdAt)}</span>
                            <span><MessageOutlined /> {item.replyCount}</span>
                            <span><EyeOutlined /> {item.viewCount}</span>
                            {item.lastRepliedAt ? <span>最后回复：{formatDate(item.lastRepliedAt)}</span> : null}
                          </Space>
                        </div>
                      )}
                    />
                  </List.Item>
                </div>
              )}
              pagination={{
                current: page,
                pageSize: 12,
                total: postsQuery.data?.pagination.total ?? 0,
                onChange: (nextPage) => setPage(nextPage),
              }}
            />
          </>
        )}
    </Card>
  );
}
