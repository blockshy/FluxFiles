import { ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Avatar, Button, Card, Input, Select, Space, Switch, Table, Tag, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useDeferredValue, useState } from 'react';
import { fetchAdminLogs, updateAdminUserEnabled } from '../api/admin';
import type { OperationLogRecord } from '../api/types';
import { useI18n } from '../features/i18n/LocaleProvider';
import { hasPermission, PERMISSION_ADMIN_USERS_EDIT } from '../features/user/permissions';
import { useUserAuth } from '../features/user/AuthProvider';
import { getApiErrorMessage } from '../lib/apiError';
import { formatDate } from '../lib/format';

function renderDetail(record: OperationLogRecord) {
  if (!record.detailParsed) {
    return record.detail;
  }
  return (
    <Space direction="vertical" size={4}>
      <Typography.Text>{record.detailParsed.summary}</Typography.Text>
      {(record.detailParsed.changes ?? []).map((change, index) => (
        <Typography.Text key={`${record.id}-${index}`} type="secondary">
          {change.label}: {JSON.stringify(change.before)} {'->'} {JSON.stringify(change.after)}
        </Typography.Text>
      ))}
    </Space>
  );
}

export function AdminLogsPage() {
  const queryClient = useQueryClient();
  const [messageApi, contextHolder] = message.useMessage();
  const [search, setSearch] = useState('');
  const [action, setAction] = useState<string | undefined>(undefined);
  const [targetType, setTargetType] = useState<string | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const deferredSearch = useDeferredValue(search.trim());
  const { t, locale } = useI18n();
  const { user } = useUserAuth();
  const canEditUsers = hasPermission(user, PERMISSION_ADMIN_USERS_EDIT);

  const logsQuery = useQuery({
    queryKey: ['admin-logs', page, pageSize, deferredSearch, action, targetType],
    queryFn: () => fetchAdminLogs({ page, pageSize, search: deferredSearch || undefined, action, targetType }),
  });

  const toggleMutation = useMutation({
    mutationFn: (record: OperationLogRecord) => updateAdminUserEnabled(record.targetUserId!, !record.targetUserIsEnabled),
    onSuccess: () => {
      messageApi.success(t('users.updateSuccess'));
      void queryClient.invalidateQueries({ queryKey: ['admin-logs'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (error) => {
      messageApi.error(getApiErrorMessage(error, locale === 'zh-CN' ? '账号状态更新失败。' : 'Failed to update account status.', locale));
    },
  });

  const columns: ColumnsType<OperationLogRecord> = [
    { title: t('logs.time'), dataIndex: 'createdAt', key: 'createdAt', width: 180, render: (value: string) => formatDate(value) },
    {
      title: t('logs.operator'),
      dataIndex: 'adminUsername',
      key: 'adminUsername',
      width: 240,
      render: (_, record) => (
        <Space>
          <Avatar src={record.adminAvatarUrl}>{(record.adminDisplayName || record.adminUsername || 'A').slice(0, 1).toUpperCase()}</Avatar>
          <Space direction="vertical" size={0}>
            <Typography.Text strong>{record.adminDisplayName || record.adminUsername || '-'}</Typography.Text>
            <Typography.Text type="secondary">@{record.adminUsername || '-'}</Typography.Text>
          </Space>
        </Space>
      ),
    },
    { title: t('logs.action'), dataIndex: 'action', key: 'action', width: 220, render: (value: string) => <Tag>{value}</Tag> },
    { title: t('logs.target'), dataIndex: 'targetType', key: 'targetType', width: 120, render: (value: string) => <Tag color="blue">{value}</Tag> },
    {
      title: 'Target',
      key: 'targetId',
      width: 300,
      render: (_, record) => record.targetType === 'user' && record.targetUserId ? (
        <Space direction="vertical" size={4}>
          <Space>
            <Avatar src={record.targetAvatarUrl}>{(record.targetDisplayName || record.targetUsername || 'U').slice(0, 1).toUpperCase()}</Avatar>
            <Space direction="vertical" size={0}>
              <Typography.Text strong>{record.targetDisplayName || record.targetUsername}</Typography.Text>
              <Typography.Text type="secondary">@{record.targetUsername}</Typography.Text>
            </Space>
          </Space>
          {canEditUsers ? (
            <Space>
              <Typography.Text type="secondary">{record.targetUserIsEnabled ? t('common.enabled') : t('common.disabled')}</Typography.Text>
              <Switch
                size="small"
                checked={record.targetUserIsEnabled}
                loading={toggleMutation.isPending}
                onChange={() => toggleMutation.mutate(record)}
              />
            </Space>
          ) : null}
        </Space>
      ) : record.targetId,
    },
    { title: t('logs.detail'), key: 'detail', width: 420, render: (_, record) => renderDetail(record) },
    { title: 'IP', dataIndex: 'ip', key: 'ip', width: 140 },
  ];

  return (
    <>
      {contextHolder}
      <Card className="surface-card">
      <div className="toolbar-row">
        <div>
          <h2 className="section-title">{t('logs.title')}</h2>
          <p className="section-subtitle">{t('logs.subtitle')}</p>
        </div>

        <div className="toolbar-controls">
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder={t('logs.search')}
            style={{ width: 280 }}
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
          <Select
            allowClear
            placeholder={t('logs.action')}
            style={{ width: 220 }}
            value={action}
            options={[
              { label: 'user.create', value: 'user.create' },
              { label: 'user.update', value: 'user.update' },
              { label: 'settings.registration.update', value: 'settings.registration.update' },
              { label: 'settings.guest_download.update', value: 'settings.guest_download.update' },
              { label: 'settings.download.update', value: 'settings.download.update' },
              { label: 'settings.rate_limits.update', value: 'settings.rate_limits.update' },
              { label: 'settings.captcha.update', value: 'settings.captcha.update' },
              { label: 'settings.upload_policy.update', value: 'settings.upload_policy.update' },
              { label: 'settings.permission_templates.update', value: 'settings.permission_templates.update' },
            ]}
            onChange={(value) => {
              setAction(value);
              setPage(1);
            }}
          />
          <Select
            allowClear
            placeholder={t('logs.target')}
            style={{ width: 180 }}
            value={targetType}
            options={[
              { label: 'user', value: 'user' },
              { label: 'system_setting', value: 'system_setting' },
              { label: 'file', value: 'file' },
            ]}
            onChange={(value) => {
              setTargetType(value);
              setPage(1);
            }}
          />
          <Button icon={<ReloadOutlined />} onClick={() => logsQuery.refetch()}>
            {t('logs.refresh')}
          </Button>
        </div>
      </div>

      <Table<OperationLogRecord>
        rowKey="id"
        columns={columns}
        dataSource={logsQuery.data?.items ?? []}
        loading={logsQuery.isLoading}
        scroll={{ x: 1400 }}
        pagination={{
          current: page,
          pageSize,
          total: logsQuery.data?.pagination.total ?? 0,
          onChange: (nextPage, nextPageSize) => {
            setPage(nextPage);
            setPageSize(nextPageSize);
          },
        }}
      />
      </Card>
    </>
  );
}
