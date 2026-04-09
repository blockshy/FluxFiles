import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Form, Input, List, Space, Tabs, Tag, Typography, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import {
  changeCurrentUserPassword,
  fetchCurrentUser,
  fetchDownloadHistory,
  fetchFavoriteFiles,
  updateCurrentUser,
} from '../api/user';
import { useI18n } from '../features/i18n/LocaleProvider';
import { useUserAuth } from '../features/user/AuthProvider';
import { formatBytes, formatDate } from '../lib/format';

export function UserCenterPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [messageApi, contextHolder] = message.useMessage();
  const { logout, updateUser } = useUserAuth();
  const { t, locale } = useI18n();

  const meQuery = useQuery({ queryKey: ['user-me'], queryFn: fetchCurrentUser });
  const favoritesQuery = useQuery({ queryKey: ['user-favorites'], queryFn: fetchFavoriteFiles });
  const downloadsQuery = useQuery({ queryKey: ['user-downloads'], queryFn: () => fetchDownloadHistory(50) });

  const profileMutation = useMutation({
    mutationFn: updateCurrentUser,
    onSuccess: (user) => {
      updateUser(user);
      messageApi.success(t('account.profileUpdated'));
      void queryClient.invalidateQueries({ queryKey: ['user-me'] });
    },
  });

  const passwordMutation = useMutation({
    mutationFn: changeCurrentUserPassword,
    onSuccess: () => {
      messageApi.success(t('account.passwordUpdated'));
      logout();
      window.location.href = '/fluxfiles/login';
    },
  });

  function handleClose() {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate('/');
  }

  return (
    <>
      {contextHolder}
      <Card className="surface-card">
        <div className="toolbar-row">
          <div>
            <h2 className="section-title">{t('account.title')}</h2>
            <p className="section-subtitle">{t('account.subtitle')}</p>
          </div>
          <Button onClick={handleClose}>{locale === 'zh-CN' ? '返回' : 'Back'}</Button>
        </div>

        <Tabs
          items={[
            {
              key: 'profile',
              label: t('account.profile'),
              children: (
                <Form
                  layout="vertical"
                  initialValues={{ email: meQuery.data?.email, displayName: meQuery.data?.displayName }}
                  onFinish={(values) => profileMutation.mutate(values)}
                >
                  <Form.Item name="displayName" label={t('register.displayName')}>
                    <Input />
                  </Form.Item>
                  <Form.Item name="email" label={t('register.email')}>
                    <Input />
                  </Form.Item>
                  <Button type="primary" htmlType="submit" loading={profileMutation.isPending}>
                    {t('account.save')}
                  </Button>
                </Form>
              ),
            },
            {
              key: 'password',
              label: t('account.password'),
              children: (
                <Form layout="vertical" onFinish={(values) => passwordMutation.mutate(values)}>
                  <Form.Item name="currentPassword" label={t('login.password')}>
                    <Input.Password />
                  </Form.Item>
                  <Form.Item name="newPassword" label={t('account.password')}>
                    <Input.Password />
                  </Form.Item>
                  <Button type="primary" htmlType="submit" loading={passwordMutation.isPending}>
                    {t('account.passwordUpdate')}
                  </Button>
                </Form>
              ),
            },
            {
              key: 'favorites',
              label: t('account.favorites'),
              children: (
                <List
                  dataSource={favoritesQuery.data ?? []}
                  loading={favoritesQuery.isLoading}
                  renderItem={(item) => (
                    <List.Item>
                      <Space direction="vertical" size={4} style={{ width: '100%' }}>
                        <Typography.Text strong>{item.name}</Typography.Text>
                        <Typography.Text type="secondary">{item.originalName}</Typography.Text>
                        <Space wrap>
                          {item.category ? <Tag>{item.category}</Tag> : null}
                          {(item.tags || []).map((tag) => (
                            <Tag key={tag}>{tag}</Tag>
                          ))}
                        </Space>
                      </Space>
                    </List.Item>
                  )}
                />
              ),
            },
            {
              key: 'downloads',
              label: t('account.downloads'),
              children: (
                <List
                  dataSource={downloadsQuery.data ?? []}
                  loading={downloadsQuery.isLoading}
                  renderItem={(item) => (
                    <List.Item>
                      <Space direction="vertical" size={4} style={{ width: '100%' }}>
                        <Typography.Text strong>{item.name}</Typography.Text>
                        <Typography.Text type="secondary">{item.originalName}</Typography.Text>
                        <Typography.Text type="secondary">
                          {formatBytes(item.size)} / {formatDate(item.downloadedAt)}
                        </Typography.Text>
                      </Space>
                    </List.Item>
                  )}
                />
              ),
            },
          ]}
        />
      </Card>
    </>
  );
}
