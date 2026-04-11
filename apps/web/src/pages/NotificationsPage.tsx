import { CheckOutlined, DeleteOutlined, MessageOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Avatar, Button, Card, Empty, Form, Input, List, Skeleton, Space, Tabs, Typography, message } from 'antd';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { createCommunityReply } from '../api/community';
import { createComment, deleteComment, fetchMyComments, fetchNotifications, markNotificationRead, markNotificationsRead } from '../api/user';
import type { CommentRecord, NotificationRecord } from '../api/types';
import { useI18n } from '../features/i18n/LocaleProvider';
import { getApiErrorMessage } from '../lib/apiError';
import { formatDate } from '../lib/format';

type NotificationTabKey = 'all' | 'replies' | 'likes' | 'dislikes' | 'community' | 'mine';

const typeMap: Record<Exclude<NotificationTabKey, 'mine'>, string | undefined> = {
  all: undefined,
  replies: 'comment.reply',
  likes: 'comment.like',
  dislikes: 'comment.dislike',
  community: 'community.post.reply,community.reply.reply',
};

export function NotificationsPage() {
  const queryClient = useQueryClient();
  const [messageApi, contextHolder] = message.useMessage();
  const [activeTab, setActiveTab] = useState<NotificationTabKey>('all');
  const [replyingNotification, setReplyingNotification] = useState<number | null>(null);
  const [form] = Form.useForm();
  const { locale } = useI18n();

  const notificationsQuery = useQuery({
    queryKey: ['user-notifications', activeTab],
    queryFn: () => fetchNotifications(1, 50, activeTab === 'mine' ? undefined : typeMap[activeTab as Exclude<NotificationTabKey, 'mine'>]),
    enabled: activeTab !== 'mine',
  });
  const myCommentsQuery = useQuery({
    queryKey: ['my-comments'],
    queryFn: () => fetchMyComments(1, 50),
    enabled: activeTab === 'mine',
  });

  const markReadMutation = useMutation({
    mutationFn: (id: number) => markNotificationRead(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['user-notifications'] });
      void queryClient.invalidateQueries({ queryKey: ['user-notifications-summary'] });
    },
    onError: (error) => messageApi.error(getApiErrorMessage(error, locale === 'zh-CN' ? '标记已读失败，请稍后再试。' : 'Failed to mark as read. Please try again later.', locale)),
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => markNotificationsRead(activeTab === 'mine' ? undefined : typeMap[activeTab as Exclude<NotificationTabKey, 'mine'>]),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['user-notifications'] });
      void queryClient.invalidateQueries({ queryKey: ['user-notifications-summary'] });
      messageApi.success(locale === 'zh-CN' ? '已标记为已读。' : 'Marked as read.');
    },
    onError: (error) => messageApi.error(getApiErrorMessage(error, locale === 'zh-CN' ? '批量标记已读失败，请稍后再试。' : 'Failed to mark all as read. Please try again later.', locale)),
  });

  const deleteCommentMutation = useMutation({
    mutationFn: deleteComment,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['my-comments'] });
      messageApi.success(locale === 'zh-CN' ? '评论已删除。' : 'Comment deleted.');
    },
    onError: (error) => messageApi.error(getApiErrorMessage(error, locale === 'zh-CN' ? '删除评论失败，请确认评论是否存在且属于你。' : 'Failed to delete comment. Please confirm it exists and belongs to you.', locale)),
  });

  const replyMutation = useMutation({
    mutationFn: ({ fileId, commentId, content }: { fileId: number; commentId: number; content: string }) => createComment(fileId, { content, parentId: commentId }),
    onSuccess: () => {
      form.resetFields();
      setReplyingNotification(null);
      void queryClient.invalidateQueries({ queryKey: ['user-notifications'] });
      void queryClient.invalidateQueries({ queryKey: ['user-notifications-summary'] });
      messageApi.success(locale === 'zh-CN' ? '回复已发送。' : 'Reply posted.');
    },
    onError: (error) => messageApi.error(getApiErrorMessage(error, locale === 'zh-CN' ? '回复发送失败，请检查内容或评论状态。' : 'Failed to send reply. Please check content or comment status.', locale)),
  });

  const communityReplyMutation = useMutation({
    mutationFn: ({ postId, replyId, content }: { postId: number; replyId?: number; content: string }) => createCommunityReply(postId, { parentId: replyId, content }),
    onSuccess: () => {
      form.resetFields();
      setReplyingNotification(null);
      void queryClient.invalidateQueries({ queryKey: ['user-notifications'] });
      void queryClient.invalidateQueries({ queryKey: ['user-notifications-summary'] });
      void queryClient.invalidateQueries({ queryKey: ['community-post'] });
      void queryClient.invalidateQueries({ queryKey: ['community-replies'] });
      messageApi.success(locale === 'zh-CN' ? '社区回复已发送。' : 'Community reply posted.');
    },
    onError: (error) => messageApi.error(getApiErrorMessage(error, locale === 'zh-CN' ? '社区回复发送失败，请检查内容或帖子状态。' : 'Failed to send community reply.', locale)),
  });

  function renderNotification(item: NotificationRecord) {
    return (
      <List.Item
        actions={[
          !item.isRead ? <Button key="read" className="table-action-button" icon={<CheckOutlined />} onClick={() => markReadMutation.mutate(item.id)}>{locale === 'zh-CN' ? '标记已读' : 'Mark read'}</Button> : null,
          item.relatedCommentFileId && item.relatedCommentId ? <Link key="link" to={`/files/${item.relatedCommentFileId}`} className="table-action-link file-action-button">{locale === 'zh-CN' ? '查看详情' : 'Open'}</Link> : null,
          item.relatedPostId ? <Link key="post" to={`/community/${item.relatedPostId}`} className="table-action-link file-action-button">{locale === 'zh-CN' ? '查看帖子' : 'Open post'}</Link> : null,
          item.relatedCommentFileId && item.relatedCommentId ? <Button key="reply" className="table-action-button" icon={<MessageOutlined />} onClick={() => setReplyingNotification(item.id)}>{locale === 'zh-CN' ? '快捷回复' : 'Quick reply'}</Button> : null,
          item.relatedPostId ? <Button key="community-reply" className="table-action-button" icon={<MessageOutlined />} onClick={() => setReplyingNotification(item.id)}>{locale === 'zh-CN' ? '社区回复' : 'Reply'}</Button> : null,
        ].filter(Boolean)}
      >
        <List.Item.Meta
          avatar={<Avatar src={item.actorAvatarUrl}>{(item.actorDisplayName || item.actorUsername || 'F').slice(0, 1).toUpperCase()}</Avatar>}
          title={
            <Space wrap>
              <Typography.Text strong>{item.title}</Typography.Text>
              {!item.isRead ? <span className="notification-unread-dot" /> : null}
            </Space>
          }
          description={
            <Space direction="vertical" size={4}>
              <Typography.Text>{item.content}</Typography.Text>
              {item.relatedCommentBody ? <Typography.Text type="secondary">“{item.relatedCommentBody}”</Typography.Text> : null}
              <Typography.Text type="secondary">{formatDate(item.createdAt)}</Typography.Text>
              {replyingNotification === item.id && item.relatedCommentFileId && item.relatedCommentId ? (
                <Form
                  form={form}
                  layout="vertical"
                  onFinish={(values: { content: string }) => replyMutation.mutate({ fileId: item.relatedCommentFileId!, commentId: item.relatedCommentId!, content: values.content })}
                >
                  <Form.Item name="content" rules={[{ required: true, message: locale === 'zh-CN' ? '请输入回复内容' : 'Please enter a reply.' }]}>
                    <Input.TextArea rows={3} placeholder={locale === 'zh-CN' ? '直接回复这条互动…' : 'Reply to this interaction...'} />
                  </Form.Item>
                  <Space>
                    <Button type="primary" htmlType="submit" loading={replyMutation.isPending}>{locale === 'zh-CN' ? '发送回复' : 'Reply'}</Button>
                    <Button onClick={() => setReplyingNotification(null)}>{locale === 'zh-CN' ? '取消' : 'Cancel'}</Button>
                  </Space>
                </Form>
              ) : null}
              {replyingNotification === item.id && item.relatedPostId ? (
                <Form
                  form={form}
                  layout="vertical"
                  onFinish={(values: { content: string }) => communityReplyMutation.mutate({ postId: item.relatedPostId!, replyId: item.relatedReplyId, content: values.content })}
                >
                  <Form.Item name="content" rules={[{ required: true, message: locale === 'zh-CN' ? '请输入回复内容' : 'Please enter a reply.' }]}>
                    <Input.TextArea rows={3} placeholder={locale === 'zh-CN' ? '直接回复这条社区互动…' : 'Reply to this community interaction...'} />
                  </Form.Item>
                  <Space>
                    <Button type="primary" htmlType="submit" loading={communityReplyMutation.isPending}>{locale === 'zh-CN' ? '发送回复' : 'Reply'}</Button>
                    <Button onClick={() => setReplyingNotification(null)}>{locale === 'zh-CN' ? '取消' : 'Cancel'}</Button>
                  </Space>
                </Form>
              ) : null}
            </Space>
          }
        />
      </List.Item>
    );
  }

  function renderMyComment(item: CommentRecord) {
    return (
      <List.Item
        actions={[
          <Link key="open" to={`/files/${item.fileId}`} className="table-action-link file-action-button">{locale === 'zh-CN' ? '查看文件详情' : 'Open file'}</Link>,
          item.canDelete ? <Button key="delete" className="table-action-button" danger icon={<DeleteOutlined />} onClick={() => deleteCommentMutation.mutate(item.id)}>{locale === 'zh-CN' ? '删除' : 'Delete'}</Button> : null,
        ].filter(Boolean)}
      >
        <List.Item.Meta
          title={<Typography.Text strong>{locale === 'zh-CN' ? `文件 #${item.fileId} 的评论` : `Comment on file #${item.fileId}`}</Typography.Text>}
          description={
            <Space direction="vertical" size={4}>
              <Typography.Text>{item.content}</Typography.Text>
              <Typography.Text type="secondary">{formatDate(item.createdAt)}</Typography.Text>
            </Space>
          }
        />
      </List.Item>
    );
  }

  const notificationItems = notificationsQuery.data?.items ?? [];
  const myCommentItems = myCommentsQuery.data?.items ?? [];
  const isCurrentTabLoading = activeTab === 'mine' ? myCommentsQuery.isLoading : notificationsQuery.isLoading;

  return (
    <>
      {contextHolder}
      <Card className="surface-card">
        <div className="toolbar-row">
          <div>
            <h2 className="section-title">{locale === 'zh-CN' ? '消息与互动' : 'Messages & interactions'}</h2>
            <p className="section-subtitle">
              {locale === 'zh-CN' ? '集中查看评论回复、点赞点踩，以及你发布过的评论。' : 'Track replies, votes, and your own comments in one place.'}
            </p>
          </div>
          {activeTab !== 'mine' ? (
            <Button icon={<CheckOutlined />} onClick={() => markAllReadMutation.mutate()} loading={markAllReadMutation.isPending}>
              {locale === 'zh-CN' ? '本页全部已读' : 'Mark tab as read'}
            </Button>
          ) : null}
        </div>

        <Tabs
          activeKey={activeTab}
          onChange={(key) => setActiveTab(key as NotificationTabKey)}
          items={[
            { key: 'all', label: locale === 'zh-CN' ? `全部通知 (${notificationsQuery.data?.unread ?? 0})` : `All (${notificationsQuery.data?.unread ?? 0})` },
            { key: 'replies', label: locale === 'zh-CN' ? '回复我的' : 'Replies' },
            { key: 'likes', label: locale === 'zh-CN' ? '点赞我的' : 'Likes' },
            { key: 'dislikes', label: locale === 'zh-CN' ? '点踩我的' : 'Dislikes' },
            { key: 'community', label: locale === 'zh-CN' ? '社区互动' : 'Community' },
            { key: 'mine', label: locale === 'zh-CN' ? '我的评论' : 'My comments' },
          ]}
        />

        {isCurrentTabLoading ? (
          <Skeleton active avatar paragraph={{ rows: 6 }} />
        ) : activeTab === 'mine' ? (
          myCommentItems.length ? <List dataSource={myCommentItems} renderItem={renderMyComment} /> : <Empty description={locale === 'zh-CN' ? '暂时没有评论记录' : 'No comments yet'} />
        ) : (
          notificationItems.length ? <List dataSource={notificationItems} renderItem={renderNotification} /> : <Empty description={locale === 'zh-CN' ? '暂时没有相关通知' : 'No notifications'} />
        )}
      </Card>
    </>
  );
}
