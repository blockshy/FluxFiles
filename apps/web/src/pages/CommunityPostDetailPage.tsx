import { ArrowLeftOutlined, DeleteOutlined, EditOutlined, LockOutlined, MessageOutlined, PushpinOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Avatar, Button, Card, Empty, Form, Input, Skeleton, Space, Tag, Typography, message } from 'antd';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { createCommunityReply, deleteCommunityPost, deleteCommunityReply, fetchCommunityPost, fetchCommunityReplies } from '../api/community';
import type { CommunityReplyRecord } from '../api/types';
import { useI18n } from '../features/i18n/LocaleProvider';
import { getApiErrorMessage } from '../lib/apiError';
import { formatDate } from '../lib/format';

const REPLY_PAGE_SIZE = 12;
const MAX_VISUAL_DEPTH = 2;

interface ReplyNode extends CommunityReplyRecord {
  children: ReplyNode[];
}

function buildReplyTree(items: CommunityReplyRecord[]) {
  const nodes = new Map<number, ReplyNode>();
  items.forEach((item) => nodes.set(item.id, { ...item, children: [] }));
  const roots: ReplyNode[] = [];
  items.forEach((item) => {
    const node = nodes.get(item.id);
    if (!node) {
      return;
    }
    if (item.parentId && nodes.has(item.parentId)) {
      nodes.get(item.parentId)?.children.push(node);
      return;
    }
    roots.push(node);
  });
  return roots;
}

interface ReplyItemProps {
  item: ReplyNode;
  depth: number;
  replyingTo: number | null;
  submitting: boolean;
  onReply: (parentId: number, content: string) => void;
  onDelete: (replyId: number) => void;
  onStartReply: (replyId: number) => void;
  onCancelReply: () => void;
}

function ReplyItem({ item, depth, replyingTo, submitting, onReply, onDelete, onStartReply, onCancelReply }: ReplyItemProps) {
  const [form] = Form.useForm<{ content: string }>();
  const visualDepth = Math.min(depth, MAX_VISUAL_DEPTH);

  return (
    <div className="community-reply-card" style={{ ['--reply-indent' as string]: `${visualDepth * 18}px` }}>
      <div className="community-reply-body">
        <div className="comment-header">
          <Space>
            <Avatar src={item.author.avatarUrl}>
              {(item.author.displayName || item.author.username).slice(0, 1).toUpperCase()}
            </Avatar>
            <div>
              <Space size={8} wrap>
                <Typography.Text strong>{item.author.displayName || item.author.username}</Typography.Text>
                {item.replyTo ? <Tag bordered={false}>回复 {item.replyTo.displayName || item.replyTo.username}</Tag> : null}
                {depth > MAX_VISUAL_DEPTH ? <Tag bordered={false}>第 {depth + 1} 层</Tag> : null}
              </Space>
              <div className="comment-meta">{formatDate(item.createdAt)}</div>
            </div>
          </Space>
        </div>
        <Typography.Paragraph className="community-reply-content">{item.content}</Typography.Paragraph>
        <Space wrap className="comment-action-row">
          <Button className="comment-action-button" type="text" icon={<MessageOutlined />} onClick={() => onStartReply(item.id)}>回复</Button>
          {item.canDelete ? <Button className="comment-action-button" type="text" danger icon={<DeleteOutlined />} onClick={() => onDelete(item.id)}>删除</Button> : null}
        </Space>
        {replyingTo === item.id ? (
          <Form
            form={form}
            layout="vertical"
            className="comment-reply-form"
            onFinish={(values) => {
              onReply(item.id, values.content);
              form.resetFields();
            }}
          >
            <Form.Item name="content" rules={[{ required: true, message: '请输入回复内容' }]}>
              <Input.TextArea rows={3} placeholder="继续回复…" />
            </Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={submitting}>发送回复</Button>
              <Button onClick={onCancelReply}>取消</Button>
            </Space>
          </Form>
        ) : null}
      </div>
      {item.children.length ? (
        <div className="community-reply-children">
          {item.children.map((child) => (
            <ReplyItem
              key={child.id}
              item={child}
              depth={depth + 1}
              replyingTo={replyingTo}
              submitting={submitting}
              onReply={onReply}
              onDelete={onDelete}
              onStartReply={onStartReply}
              onCancelReply={onCancelReply}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function CommunityPostDetailPage() {
  const { id } = useParams();
  const postId = Number(id);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [replyPage, setReplyPage] = useState(1);
  const [topLevelForm] = Form.useForm<{ content: string }>();
  const [messageApi, contextHolder] = message.useMessage();
  const { locale } = useI18n();

  const postQuery = useQuery({
    queryKey: ['community-post', postId],
    queryFn: () => fetchCommunityPost(postId),
    enabled: Number.isFinite(postId) && postId > 0,
  });
  const visibleRepliesQuery = useQuery({
    queryKey: ['community-replies', postId, replyPage],
    queryFn: () => fetchCommunityReplies(postId, { page: 1, pageSize: replyPage * REPLY_PAGE_SIZE }),
    enabled: Number.isFinite(postId) && postId > 0,
  });

  const replyTree = useMemo(() => buildReplyTree(visibleRepliesQuery.data?.items ?? []), [visibleRepliesQuery.data?.items]);
  const loadedReplyCount = visibleRepliesQuery.data?.items.length ?? 0;
  const totalReplyCount = visibleRepliesQuery.data?.pagination.total ?? 0;

  const replyMutation = useMutation({
    mutationFn: ({ parentId, content }: { parentId?: number; content: string }) => createCommunityReply(postId, { parentId, content }),
    onSuccess: async () => {
      setReplyingTo(null);
      topLevelForm.resetFields();
      messageApi.success(locale === 'zh-CN' ? '回复已发送。' : 'Reply posted.');
      setReplyPage((current) => Math.max(current, Math.ceil((loadedReplyCount + 1) / REPLY_PAGE_SIZE)));
      await queryClient.invalidateQueries({ queryKey: ['community-post', postId] });
      await queryClient.invalidateQueries({ queryKey: ['community-replies', postId] });
      await queryClient.invalidateQueries({ queryKey: ['user-notifications'] });
      await queryClient.invalidateQueries({ queryKey: ['user-notifications-summary'] });
    },
    onError: (error) => messageApi.error(getApiErrorMessage(error, locale === 'zh-CN' ? '回复失败，请检查内容或帖子状态。' : 'Failed to reply. Please check content or post state.', locale)),
  });

  const deleteReplyMutation = useMutation({
    mutationFn: deleteCommunityReply,
    onSuccess: async () => {
      messageApi.success(locale === 'zh-CN' ? '回复已删除。' : 'Reply deleted.');
      await queryClient.invalidateQueries({ queryKey: ['community-post', postId] });
      await queryClient.invalidateQueries({ queryKey: ['community-replies', postId] });
    },
    onError: (error) => messageApi.error(getApiErrorMessage(error, locale === 'zh-CN' ? '删除回复失败，请确认回复仍存在且属于你。' : 'Failed to delete reply.', locale)),
  });

  const deletePostMutation = useMutation({
    mutationFn: deleteCommunityPost,
    onSuccess: async () => {
      messageApi.success(locale === 'zh-CN' ? '帖子已删除。' : 'Post deleted.');
      await queryClient.invalidateQueries({ queryKey: ['community-posts'] });
      navigate('/community');
    },
    onError: (error) => messageApi.error(getApiErrorMessage(error, locale === 'zh-CN' ? '删除帖子失败，请确认帖子仍存在且属于你。' : 'Failed to delete post.', locale)),
  });

  if (postQuery.isLoading || visibleRepliesQuery.isLoading) {
    return (
      <>
        {contextHolder}
        <Card className="surface-card">
          <Skeleton active paragraph={{ rows: 12 }} />
        </Card>
      </>
    );
  }

  if (!postQuery.data) {
    return (
      <>
        {contextHolder}
        <Card className="surface-card">
          <Empty description={locale === 'zh-CN' ? '帖子不存在或已被删除' : 'Post not found'} />
        </Card>
      </>
    );
  }

  const post = postQuery.data;
  const hasMoreReplies = loadedReplyCount < totalReplyCount;

  return (
    <>
      {contextHolder}
      <Card className="surface-card">
        <div className="toolbar-row">
          <div>
            <Button
              className="table-action-button community-back-button"
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate('/community')}
            >
              返回社区
            </Button>
            <Space wrap size={10}>
              <h2 className="section-title community-detail-title">{post.title}</h2>
              {post.isPinned ? <Tag icon={<PushpinOutlined />} color="gold">置顶</Tag> : null}
              {post.isLocked ? <Tag icon={<LockOutlined />}>已锁定</Tag> : null}
            </Space>
            <p className="section-subtitle">
              {post.author.displayName || post.author.username} 发布于 {formatDate(post.createdAt)}，共 {post.replyCount} 条回复。
            </p>
          </div>
          <Space wrap>
            {post.canEdit ? <Link to={`/community/${post.id}/edit`} className="table-action-link file-action-button"><EditOutlined /><span>编辑帖子</span></Link> : null}
            {post.canDelete ? <Button className="table-action-button" danger icon={<DeleteOutlined />} loading={deletePostMutation.isPending} onClick={() => deletePostMutation.mutate(post.id)}>删除帖子</Button> : null}
          </Space>
        </div>

        <div className="community-post-content" dangerouslySetInnerHTML={{ __html: post.contentHtml }} />
      </Card>

      <Card className="surface-card community-reply-card-shell">
        <div className="toolbar-row">
          <div>
            <h3 className="section-title community-detail-title">回复区</h3>
            <p className="section-subtitle">支持直接回复帖子，也支持回复楼中内容。</p>
          </div>
        </div>

        {!post.isLocked ? (
          <Form
            form={topLevelForm}
            layout="vertical"
            onFinish={(values: { content: string }) => replyMutation.mutate({ content: values.content })}
          >
            <Form.Item name="content" rules={[{ required: true, message: '请输入回复内容' }]}>
              <Input.TextArea rows={4} placeholder="写下你的回复…" />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={replyMutation.isPending}>发布回复</Button>
          </Form>
        ) : (
          <Tag>该帖子已锁定，暂时不能继续回复。</Tag>
        )}

        <div className="community-reply-list community-reply-list-shell">
          {replyTree.length ? replyTree.map((item) => (
            <ReplyItem
              key={item.id}
              item={item}
              depth={0}
              replyingTo={replyingTo}
              submitting={replyMutation.isPending}
              onReply={(parentId, content) => replyMutation.mutate({ parentId, content })}
              onDelete={(replyId) => deleteReplyMutation.mutate(replyId)}
              onStartReply={setReplyingTo}
              onCancelReply={() => setReplyingTo(null)}
            />
          )) : <Empty description="暂时还没有回复" />}
          {hasMoreReplies ? (
            <div className="comment-load-more-row">
              <Button
                className="table-action-button"
                loading={visibleRepliesQuery.isFetching}
                onClick={() => setReplyPage((current) => current + 1)}
              >
                {locale === 'zh-CN' ? `加载更多回复 (${totalReplyCount - loadedReplyCount})` : `Load more replies (${totalReplyCount - loadedReplyCount})`}
              </Button>
            </div>
          ) : null}
        </div>
      </Card>
    </>
  );
}
