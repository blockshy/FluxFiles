import { DeleteOutlined, DislikeOutlined, DownloadOutlined, LikeOutlined, MessageOutlined, StarFilled, StarOutlined } from '@ant-design/icons';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Avatar, Button, Card, Empty, Form, Input, Skeleton, Space, Tag, Typography, message } from 'antd';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fetchPublicFile, fetchPublicFileComments, requestDownloadLink } from '../api/files';
import { addFavoriteFile, createComment, deleteComment, fetchFavoriteFiles, voteComment, removeFavoriteFile } from '../api/user';
import type { CommentRecord } from '../api/types';
import { useI18n } from '../features/i18n/LocaleProvider';
import { useUserAuth } from '../features/user/AuthProvider';
import { formatBytes, formatDate } from '../lib/format';

const ROOT_PAGE_SIZE = 5;
const REPLY_PAGE_SIZE = 5;
const MAX_VISUAL_DEPTH = 2;

interface ThreadCommentNode extends CommentRecord {
  replies: ThreadCommentNode[];
}

interface ThreadState {
  initialized: boolean;
  isExpanded: boolean;
  isLoading: boolean;
  items: CommentRecord[];
  page: number;
  total: number;
}

interface CommentNodeProps {
  comment: ThreadCommentNode;
  threadRootId: number;
  depth: number;
  locale: string;
  token: string | null;
  replyingTo: number | null;
  submittingReply: boolean;
  onStartReply: (commentId: number) => void;
  onCancelReply: () => void;
  onReplySubmit: (commentId: number, threadRootId: number, content: string) => void;
  onDelete: (commentId: number, threadRootId: number) => void;
  onVote: (commentId: number, threadRootId: number, value: 1 | -1) => void;
  loadMoreAfterId?: number;
  hasMoreReplies?: boolean;
  loadingMoreReplies?: boolean;
  onLoadMoreReplies?: () => void;
}

function mergeComments(existing: CommentRecord[], incoming: CommentRecord[]) {
  const seen = new Set<number>();
  const merged: CommentRecord[] = [];
  for (const item of [...existing, ...incoming]) {
    if (seen.has(item.id)) {
      continue;
    }
    seen.add(item.id);
    merged.push(item);
  }
  return merged;
}

function buildReplyTree(items: CommentRecord[], rootId: number) {
  const nodes = new Map<number, ThreadCommentNode>();
  for (const item of items) {
    nodes.set(item.id, { ...item, replies: [] });
  }

  const roots: ThreadCommentNode[] = [];
  for (const item of items) {
    const node = nodes.get(item.id);
    if (!node) {
      continue;
    }
    if (item.parentId && item.parentId !== rootId) {
      const parent = nodes.get(item.parentId);
      if (parent) {
        parent.replies.push(node);
        continue;
      }
    }
    roots.push(node);
  }
  return roots;
}

function CommentNode({
  comment,
  threadRootId,
  depth,
  locale,
  token,
  replyingTo,
  submittingReply,
  onStartReply,
  onCancelReply,
  onReplySubmit,
  onDelete,
  onVote,
  loadMoreAfterId,
  hasMoreReplies,
  loadingMoreReplies,
  onLoadMoreReplies,
}: CommentNodeProps) {
  const [form] = Form.useForm();
  const visualDepth = Math.min(depth, MAX_VISUAL_DEPTH);

  return (
    <div className="comment-node reply-node" style={{ ['--comment-indent' as string]: `${visualDepth * 18}px` }}>
      <div className="comment-card">
        <div className="comment-header">
          <Space>
            <Avatar src={comment.author.avatarUrl}>{(comment.author.displayName || comment.author.username).slice(0, 1).toUpperCase()}</Avatar>
            <div>
              <Space size={8} wrap>
                <Link to={`/users/${comment.author.username}`}>{comment.author.displayName || comment.author.username}</Link>
                {depth > MAX_VISUAL_DEPTH ? <Tag bordered={false}>{locale === 'zh-CN' ? `第 ${depth + 1} 层回复` : `Level ${depth + 1}`}</Tag> : null}
              </Space>
              <div className="comment-meta">
                {formatDate(comment.createdAt)}
                {comment.replyTo ? ` ${locale === 'zh-CN' ? '回复' : 'replied to'} ${comment.replyTo.displayName || comment.replyTo.username}` : ''}
              </div>
            </div>
          </Space>
        </div>
        <Typography.Paragraph style={{ marginBottom: 8, whiteSpace: 'pre-wrap' }}>{comment.content}</Typography.Paragraph>
        <Space wrap>
          <Button type={comment.currentUserVote === 1 ? 'primary' : 'text'} icon={<LikeOutlined />} disabled={!token} onClick={() => onVote(comment.id, threadRootId, 1)}>
            {comment.likeCount}
          </Button>
          <Button type={comment.currentUserVote === -1 ? 'primary' : 'text'} danger={comment.currentUserVote === -1} icon={<DislikeOutlined />} disabled={!token} onClick={() => onVote(comment.id, threadRootId, -1)}>
            {comment.dislikeCount}
          </Button>
          <Button type="text" icon={<MessageOutlined />} disabled={!token} onClick={() => onStartReply(comment.id)}>
            {locale === 'zh-CN' ? '回复' : 'Reply'}
          </Button>
          {comment.canDelete ? (
            <Button type="text" danger icon={<DeleteOutlined />} onClick={() => onDelete(comment.id, threadRootId)}>
              {locale === 'zh-CN' ? '删除' : 'Delete'}
            </Button>
          ) : null}
        </Space>
        {replyingTo === comment.id ? (
          <Form
            form={form}
            layout="vertical"
            className="comment-reply-form"
            onFinish={(values: { content: string }) => {
              onReplySubmit(comment.id, threadRootId, values.content);
              form.resetFields();
            }}
          >
            <Form.Item name="content" rules={[{ required: true, message: locale === 'zh-CN' ? '请输入回复内容' : 'Please enter a reply.' }]}>
              <Input.TextArea rows={3} placeholder={locale === 'zh-CN' ? '写下你的回复…' : 'Write your reply...'} />
            </Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={submittingReply}>
                {locale === 'zh-CN' ? '提交回复' : 'Reply'}
              </Button>
              <Button onClick={onCancelReply}>{locale === 'zh-CN' ? '取消' : 'Cancel'}</Button>
            </Space>
          </Form>
        ) : null}
      </div>
      {comment.replies.length ? (
        <div className="comment-replies">
          {comment.replies.map((reply) => (
            <CommentNode
              key={reply.id}
              comment={reply}
              threadRootId={threadRootId}
              depth={depth + 1}
              locale={locale}
              token={token}
              replyingTo={replyingTo}
              submittingReply={submittingReply}
              onStartReply={onStartReply}
              onCancelReply={onCancelReply}
              onReplySubmit={onReplySubmit}
              onDelete={onDelete}
              onVote={onVote}
              loadMoreAfterId={loadMoreAfterId}
              hasMoreReplies={hasMoreReplies}
              loadingMoreReplies={loadingMoreReplies}
              onLoadMoreReplies={onLoadMoreReplies}
            />
          ))}
        </div>
      ) : null}
      {loadMoreAfterId === comment.id && hasMoreReplies ? (
        <Button type="link" className="comment-load-more inline" loading={loadingMoreReplies} onClick={onLoadMoreReplies}>
          {locale === 'zh-CN' ? '展开更多回复' : 'Load more replies'}
        </Button>
      ) : null}
    </div>
  );
}

export function PublicFileDetailPage() {
  const { id } = useParams();
  const fileId = Number(id);
  const queryClient = useQueryClient();
  const [messageApi, contextHolder] = message.useMessage();
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [threadStates, setThreadStates] = useState<Record<number, ThreadState>>({});
  const [commentForm] = Form.useForm();
  const { token } = useUserAuth();
  const { locale } = useI18n();

  const fileQuery = useQuery({ queryKey: ['public-file', fileId], queryFn: () => fetchPublicFile(fileId), enabled: Number.isFinite(fileId) && fileId > 0 });
  const rootCommentsQuery = useInfiniteQuery({
    queryKey: ['public-file-comments', fileId, 'roots'],
    enabled: Number.isFinite(fileId) && fileId > 0,
    initialPageParam: 1,
    queryFn: ({ pageParam }) => fetchPublicFileComments(fileId, { page: pageParam, pageSize: ROOT_PAGE_SIZE }),
    getNextPageParam: (lastPage) => (
      lastPage.pagination.page < (lastPage.pagination.totalPages ?? 0) ? lastPage.pagination.page + 1 : undefined
    ),
  });
  const favoritesQuery = useQuery({ queryKey: ['user-favorites'], queryFn: fetchFavoriteFiles, enabled: Boolean(token) });
  const favoriteIds = new Set((favoritesQuery.data ?? []).map((item) => item.id));
  const isFavorite = favoriteIds.has(fileId);
  const rootComments = rootCommentsQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const overallCommentTotal = rootCommentsQuery.data?.pages[0]?.overallTotal ?? 0;

  async function refreshThreadReplies(rootId: number, preferredCount?: number) {
    const current = threadStates[rootId];
    if (!current?.initialized) {
      return;
    }
    const targetCount = Math.max(preferredCount ?? current.items.length, REPLY_PAGE_SIZE);
    setThreadStates((state) => ({
      ...state,
      [rootId]: {
        ...state[rootId],
        isLoading: true,
      },
    }));

    try {
      const result = await fetchPublicFileComments(fileId, { rootId, page: 1, pageSize: targetCount });
      setThreadStates((state) => ({
        ...state,
        [rootId]: {
          initialized: true,
          isExpanded: true,
          isLoading: false,
          items: result.items,
          page: result.pagination.page,
          total: result.pagination.total,
        },
      }));
    } catch {
      setThreadStates((state) => ({
        ...state,
        [rootId]: {
          ...state[rootId],
          isLoading: false,
        },
      }));
      messageApi.error(locale === 'zh-CN' ? '刷新回复失败。' : 'Failed to refresh replies.');
    }
  }

  async function loadThreadReplies(rootId: number, page: number, append: boolean) {
    setThreadStates((current) => ({
      ...current,
      [rootId]: {
        initialized: current[rootId]?.initialized ?? false,
        isExpanded: true,
        isLoading: true,
        items: current[rootId]?.items ?? [],
        page: current[rootId]?.page ?? 0,
        total: current[rootId]?.total ?? 0,
      },
    }));

    try {
      const result = await fetchPublicFileComments(fileId, { rootId, page, pageSize: REPLY_PAGE_SIZE });
      setThreadStates((current) => ({
        ...current,
        [rootId]: {
          initialized: true,
          isExpanded: true,
          isLoading: false,
          items: append ? mergeComments(current[rootId]?.items ?? [], result.items) : result.items,
          page: result.pagination.page,
          total: result.pagination.total,
        },
      }));
    } catch {
      setThreadStates((current) => ({
        ...current,
        [rootId]: {
          initialized: current[rootId]?.initialized ?? false,
          isExpanded: current[rootId]?.isExpanded ?? false,
          isLoading: false,
          items: current[rootId]?.items ?? [],
          page: current[rootId]?.page ?? 0,
          total: current[rootId]?.total ?? 0,
        },
      }));
      messageApi.error(locale === 'zh-CN' ? '加载回复失败。' : 'Failed to load replies.');
    }
  }

  function removeThreadCommentTree(rootId: number, commentId: number) {
    const current = threadStates[rootId];
    if (!current) {
      return;
    }
    const byParent = new Map<number, number[]>();
    for (const item of current.items) {
      if (!item.parentId) {
        continue;
      }
      const siblings = byParent.get(item.parentId) ?? [];
      siblings.push(item.id);
      byParent.set(item.parentId, siblings);
    }

    const removed = new Set<number>([commentId]);
    const queue = [commentId];
    while (queue.length > 0) {
      const cursor = queue.shift()!;
      for (const child of byParent.get(cursor) ?? []) {
        if (!removed.has(child)) {
          removed.add(child);
          queue.push(child);
        }
      }
    }

    setThreadStates((state) => ({
      ...state,
      [rootId]: {
        ...state[rootId],
        items: (state[rootId]?.items ?? []).filter((item) => !removed.has(item.id)),
        total: Math.max((state[rootId]?.total ?? 0) - removed.size, 0),
      },
    }));
  }

  function invalidateCommentQueries() {
    void queryClient.invalidateQueries({ queryKey: ['public-file-comments', fileId] });
  }

  const downloadMutation = useMutation({
    mutationFn: requestDownloadLink,
    onSuccess: (payload) => {
      const anchor = document.createElement('a');
      anchor.href = payload.url;
      anchor.rel = 'noopener noreferrer';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      void queryClient.invalidateQueries({ queryKey: ['public-file', fileId] });
      void queryClient.invalidateQueries({ queryKey: ['user-downloads'] });
    },
    onError: () => messageApi.error(locale === 'zh-CN' ? '下载失败，请稍后重试。' : 'Download failed.'),
  });

  const favoriteMutation = useMutation({
    mutationFn: async () => (isFavorite ? removeFavoriteFile(fileId) : addFavoriteFile(fileId)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['user-favorites'] });
    },
    onError: () => messageApi.error(locale === 'zh-CN' ? '收藏操作失败。' : 'Favorite action failed.'),
  });

  const createCommentMutation = useMutation({
    mutationFn: ({ content, parentId }: { content: string; parentId?: number }) => createComment(fileId, { content, parentId }),
    onSuccess: async (created, variables) => {
      commentForm.resetFields();
      setReplyingTo(null);
      invalidateCommentQueries();
      const threadRootId = created.rootId ?? created.parentId ?? 0;
      if (variables.parentId && threadRootId > 0) {
        if (threadStates[threadRootId]?.initialized) {
          await refreshThreadReplies(threadRootId, (threadStates[threadRootId]?.items.length ?? 0) + 1);
        } else {
          await loadThreadReplies(threadRootId, 1, false);
        }
      }
      void queryClient.invalidateQueries({ queryKey: ['user-notifications-summary'] });
      messageApi.success(locale === 'zh-CN' ? '评论已发布。' : 'Comment posted.');
    },
    onError: () => messageApi.error(locale === 'zh-CN' ? '评论发布失败。' : 'Failed to post comment.'),
  });

  const deleteCommentMutation = useMutation({
    mutationFn: ({ commentId }: { commentId: number; threadRootId: number }) => deleteComment(commentId),
    onSuccess: (_data, variables) => {
      setReplyingTo(null);
      if (variables.threadRootId === variables.commentId) {
        setThreadStates((state) => {
          const next = { ...state };
          delete next[variables.threadRootId];
          return next;
        });
      } else {
        removeThreadCommentTree(variables.threadRootId, variables.commentId);
      }
      invalidateCommentQueries();
      void queryClient.invalidateQueries({ queryKey: ['my-comments'] });
      messageApi.success(locale === 'zh-CN' ? '评论已删除。' : 'Comment deleted.');
    },
    onError: () => messageApi.error(locale === 'zh-CN' ? '删除失败。' : 'Delete failed.'),
  });

  const voteMutation = useMutation({
    mutationFn: ({ commentId, value }: { commentId: number; threadRootId: number; value: 1 | -1 }) => voteComment(commentId, value),
    onSuccess: async (_data, variables) => {
      invalidateCommentQueries();
      if (threadStates[variables.threadRootId]?.initialized) {
        await refreshThreadReplies(variables.threadRootId);
      }
      void queryClient.invalidateQueries({ queryKey: ['user-notifications-summary'] });
    },
    onError: () => messageApi.error(locale === 'zh-CN' ? '操作失败。' : 'Action failed.'),
  });

  const file = fileQuery.data;

  return (
    <>
      {contextHolder}
      <div className="detail-page">
        <Card className="surface-card">
          {file ? (
            <Space direction="vertical" size={20} style={{ width: '100%' }}>
              <div className="detail-hero">
                <div>
                  <Typography.Title level={2} style={{ marginTop: 0, marginBottom: 8 }}>{file.name}</Typography.Title>
                </div>
                <Space wrap>
                  <Button type="primary" icon={<DownloadOutlined />} loading={downloadMutation.isPending} onClick={() => downloadMutation.mutate(file.id)}>
                    {locale === 'zh-CN' ? '下载文件' : 'Download'}
                  </Button>
                  {token ? (
                    <Button icon={isFavorite ? <StarFilled /> : <StarOutlined />} onClick={() => favoriteMutation.mutate()}>
                      {isFavorite ? (locale === 'zh-CN' ? '已收藏' : 'Favorited') : (locale === 'zh-CN' ? '收藏' : 'Favorite')}
                    </Button>
                  ) : null}
                </Space>
              </div>

              <div className="detail-metadata">
                <div className="detail-item">
                  <span className="detail-label">{locale === 'zh-CN' ? '文件大小' : 'Size'}</span>
                  <span className="detail-value">{formatBytes(file.size)}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">{locale === 'zh-CN' ? '下载次数' : 'Downloads'}</span>
                  <span className="detail-value">{file.downloadCount}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">{locale === 'zh-CN' ? '分类' : 'Category'}</span>
                  <span className="detail-value">{file.categoryPath || file.category || (locale === 'zh-CN' ? '未分类' : 'Uncategorized')}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">{locale === 'zh-CN' ? '上传时间' : 'Uploaded'}</span>
                  <span className="detail-value">{formatDate(file.createdAt)}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">{locale === 'zh-CN' ? '类型' : 'Type'}</span>
                  <span className="detail-value">{file.mimeType || '-'}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">{locale === 'zh-CN' ? '上传者' : 'Uploader'}</span>
                  {file.createdByUsername ? (
                    <Link to={`/users/${file.createdByUsername}`} className="uploader-link inline">
                      <Avatar src={file.createdByAvatarUrl} size={32}>{(file.createdByDisplayName || file.createdByUsername).slice(0, 1).toUpperCase()}</Avatar>
                      <span>{file.createdByDisplayName || file.createdByUsername}</span>
                    </Link>
                  ) : (
                    <span className="detail-value">-</span>
                  )}
                </div>
                <div className="detail-item detail-item-full">
                  <span className="detail-label">{locale === 'zh-CN' ? '标签' : 'Tags'}</span>
                  <div className="detail-tag-list">
                    {(file.tagPaths?.length ? file.tagPaths : file.tags || []).length > 0 ? (file.tagPaths?.length ? file.tagPaths : file.tags).map((tag) => <Tag key={tag}>{tag}</Tag>) : <Tag>{locale === 'zh-CN' ? '无标签' : 'No tags'}</Tag>}
                  </div>
                </div>
                <div className="detail-item detail-item-full">
                  <span className="detail-label">{locale === 'zh-CN' ? '原文件名' : 'Original filename'}</span>
                  <span className="detail-value detail-value-rich">{file.originalName || '-'}</span>
                </div>
                <div className="detail-item detail-item-full">
                  <span className="detail-label">{locale === 'zh-CN' ? '描述' : 'Description'}</span>
                  <span className="detail-value detail-value-rich">{file.description || (locale === 'zh-CN' ? '暂无描述。' : 'No description.')}</span>
                </div>
              </div>
            </Space>
          ) : fileQuery.isLoading ? (
            <Skeleton active paragraph={{ rows: 8 }} />
          ) : <Empty description={locale === 'zh-CN' ? '文件不存在或已下线' : 'File not found'} />}
        </Card>

        <Card className="surface-card" title={locale === 'zh-CN' ? `评论区 (${overallCommentTotal})` : `Comments (${overallCommentTotal})`}>
          {token ? (
            <Form
              form={commentForm}
              layout="vertical"
              onFinish={(values: { content: string }) => createCommentMutation.mutate({ content: values.content })}
            >
              <Form.Item name="content" rules={[{ required: true, message: locale === 'zh-CN' ? '请输入评论内容' : 'Please enter a comment.' }]}>
                <Input.TextArea rows={4} placeholder={locale === 'zh-CN' ? '说点什么吧…' : 'Share your thoughts...'} />
              </Form.Item>
              <Button type="primary" htmlType="submit" loading={createCommentMutation.isPending}>
                {locale === 'zh-CN' ? '发布评论' : 'Post comment'}
              </Button>
            </Form>
          ) : (
            <Typography.Text type="secondary">{locale === 'zh-CN' ? '登录后即可发表评论、回复和点赞。' : 'Sign in to comment, reply, and vote.'}</Typography.Text>
          )}

          <div className="comment-list">
            {rootCommentsQuery.isLoading && rootComments.length === 0 ? (
              <Skeleton active avatar paragraph={{ rows: 6 }} />
            ) : rootComments.length === 0 ? (
              <Empty description={locale === 'zh-CN' ? '还没有评论' : 'No comments yet'} />
            ) : (
              rootComments.map((comment) => {
                const threadState = threadStates[comment.id];
                const threadRoots = buildReplyTree(threadState?.items ?? [], comment.id);
                const loadedReplies = threadState?.items.length ?? 0;
                const totalReplies = threadState?.total ?? comment.replyCount ?? 0;
                const hasMoreReplies = loadedReplies < totalReplies;

                return (
                  <div key={comment.id} className="comment-thread">
                    <div className="comment-card comment-root-card">
                      <div className="comment-header">
                        <Space>
                          <Avatar src={comment.author.avatarUrl}>{(comment.author.displayName || comment.author.username).slice(0, 1).toUpperCase()}</Avatar>
                          <div>
                            <Link to={`/users/${comment.author.username}`}>{comment.author.displayName || comment.author.username}</Link>
                            <div className="comment-meta">{formatDate(comment.createdAt)}</div>
                          </div>
                        </Space>
                      </div>
                      <Typography.Paragraph style={{ marginBottom: 8, whiteSpace: 'pre-wrap' }}>{comment.content}</Typography.Paragraph>
                      <Space wrap>
                        <Button type={comment.currentUserVote === 1 ? 'primary' : 'text'} icon={<LikeOutlined />} disabled={!token} onClick={() => voteMutation.mutate({ commentId: comment.id, threadRootId: comment.id, value: 1 })}>
                          {comment.likeCount}
                        </Button>
                        <Button type={comment.currentUserVote === -1 ? 'primary' : 'text'} danger={comment.currentUserVote === -1} icon={<DislikeOutlined />} disabled={!token} onClick={() => voteMutation.mutate({ commentId: comment.id, threadRootId: comment.id, value: -1 })}>
                          {comment.dislikeCount}
                        </Button>
                        <Button type="text" icon={<MessageOutlined />} disabled={!token} onClick={() => setReplyingTo(comment.id)}>
                          {locale === 'zh-CN' ? '回复' : 'Reply'}
                        </Button>
                        {comment.canDelete ? (
                          <Button type="text" danger icon={<DeleteOutlined />} onClick={() => deleteCommentMutation.mutate({ commentId: comment.id, threadRootId: comment.id })}>
                            {locale === 'zh-CN' ? '删除' : 'Delete'}
                          </Button>
                        ) : null}
                      </Space>

                      {replyingTo === comment.id ? (
                        <Form
                          layout="vertical"
                          className="comment-reply-form"
                          onFinish={(values: { content: string }) => createCommentMutation.mutate({ content: values.content, parentId: comment.id })}
                        >
                          <Form.Item name="content" rules={[{ required: true, message: locale === 'zh-CN' ? '请输入回复内容' : 'Please enter a reply.' }]}>
                            <Input.TextArea rows={3} placeholder={locale === 'zh-CN' ? '写下你的回复…' : 'Write your reply...'} />
                          </Form.Item>
                          <Space>
                            <Button type="primary" htmlType="submit" loading={createCommentMutation.isPending}>
                              {locale === 'zh-CN' ? '提交回复' : 'Reply'}
                            </Button>
                            <Button onClick={() => setReplyingTo(null)}>{locale === 'zh-CN' ? '取消' : 'Cancel'}</Button>
                          </Space>
                        </Form>
                      ) : null}

                      {comment.replyCount > 0 ? (
                        <div className="comment-thread-actions">
                          <Button
                            type="link"
                            className="comment-toggle-button"
                            loading={threadState?.isLoading && !threadState?.initialized}
                            onClick={() => {
                              if (threadState?.isExpanded) {
                                setThreadStates((current) => ({
                                  ...current,
                                  [comment.id]: {
                                    initialized: current[comment.id]?.initialized ?? false,
                                    isExpanded: false,
                                    isLoading: false,
                                    items: current[comment.id]?.items ?? [],
                                    page: current[comment.id]?.page ?? 0,
                                    total: current[comment.id]?.total ?? comment.replyCount,
                                  },
                                }));
                                return;
                              }
                              if (threadState?.initialized) {
                                setThreadStates((current) => ({
                                  ...current,
                                  [comment.id]: {
                                    initialized: true,
                                    isExpanded: true,
                                    isLoading: false,
                                    items: current[comment.id]?.items ?? [],
                                    page: current[comment.id]?.page ?? 1,
                                    total: current[comment.id]?.total ?? comment.replyCount,
                                  },
                                }));
                                return;
                              }
                              void loadThreadReplies(comment.id, 1, false);
                            }}
                          >
                            {threadState?.isLoading && !threadState?.initialized
                              ? (locale === 'zh-CN' ? '正在加载回复…' : 'Loading replies...')
                              : threadState?.isExpanded
                                ? (locale === 'zh-CN' ? '收起回复' : 'Collapse replies')
                                : (locale === 'zh-CN' ? `展开回复 (${comment.replyCount})` : `Show replies (${comment.replyCount})`)}
                          </Button>
                          {threadState?.isExpanded && threadState?.initialized ? (
                            <Typography.Text type="secondary">
                              {locale === 'zh-CN' ? `已显示 ${loadedReplies} / ${totalReplies} 条回复` : `${loadedReplies} of ${totalReplies} replies shown`}
                            </Typography.Text>
                          ) : null}
                        </div>
                      ) : null}
                    </div>

                    {threadState?.isExpanded ? (
                      <div className="comment-thread-body">
                        {threadRoots.length ? (
                          <div className="comment-replies">
                            {threadRoots.map((reply) => (
                              <CommentNode
                                key={reply.id}
                                comment={reply}
                                threadRootId={comment.id}
                                depth={1}
                                locale={locale}
                                token={token}
                                replyingTo={replyingTo}
                                submittingReply={createCommentMutation.isPending}
                                onStartReply={setReplyingTo}
                                onCancelReply={() => setReplyingTo(null)}
                                onReplySubmit={(commentId, threadRootId, content) => createCommentMutation.mutate({ content, parentId: commentId })}
                                onDelete={(commentId, threadRootId) => deleteCommentMutation.mutate({ commentId, threadRootId })}
                                onVote={(commentId, threadRootId, value) => voteMutation.mutate({ commentId, threadRootId, value })}
                                loadMoreAfterId={threadState?.items[threadState.items.length - 1]?.id}
                                hasMoreReplies={hasMoreReplies}
                                loadingMoreReplies={threadState?.isLoading}
                                onLoadMoreReplies={() => void loadThreadReplies(comment.id, (threadState.page || 0) + 1, true)}
                              />
                            ))}
                          </div>
                        ) : !threadState.isLoading ? (
                          <div className="comment-thread-empty">
                            <Typography.Text type="secondary">{locale === 'zh-CN' ? '还没有回复' : 'No replies yet'}</Typography.Text>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}

            {rootCommentsQuery.hasNextPage ? (
              <div className="comment-load-more-row">
                <Button type="default" loading={rootCommentsQuery.isFetchingNextPage} onClick={() => void rootCommentsQuery.fetchNextPage()}>
                  {locale === 'zh-CN' ? `更多评论 (${ROOT_PAGE_SIZE} 条)` : `Load ${ROOT_PAGE_SIZE} more comments`}
                </Button>
              </div>
            ) : null}
          </div>
        </Card>
      </div>
    </>
  );
}
