import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Form, Input, List, Space, Switch, Tabs, Tag, Typography, message } from 'antd';
import { useEffect } from 'react';
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
  const [profileForm] = Form.useForm();
  const [passwordForm] = Form.useForm();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [messageApi, contextHolder] = message.useMessage();
  const { logout, updateUser } = useUserAuth();
  const { t, locale } = useI18n();

  const meQuery = useQuery({ queryKey: ['user-me'], queryFn: fetchCurrentUser });
  const favoritesQuery = useQuery({ queryKey: ['user-favorites'], queryFn: fetchFavoriteFiles });
  const downloadsQuery = useQuery({ queryKey: ['user-downloads'], queryFn: () => fetchDownloadHistory(50) });

  useEffect(() => {
    if (!meQuery.data) {
      return;
    }
    profileForm.setFieldsValue({
      email: meQuery.data.email,
      displayName: meQuery.data.displayName,
      bio: meQuery.data.bio,
      profileVisibility: meQuery.data.profileVisibility,
    });
  }, [meQuery.data, profileForm]);

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
      passwordForm.resetFields();
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
                  form={profileForm}
                  layout="vertical"
                  onFinish={(values) => profileMutation.mutate(values)}
                >
                  <Form.Item name="displayName" label={t('register.displayName')}>
                    <Input />
                  </Form.Item>
                  <Form.Item name="email" label={t('register.email')}>
                    <Input />
                  </Form.Item>
                  <Form.Item name="bio" label={t('account.bio')}>
                    <Input.TextArea rows={4} />
                  </Form.Item>
                  <Typography.Title level={5}>{t('account.homepageVisibility')}</Typography.Title>
                  <Form.Item name={['profileVisibility', 'showBio']} label={t('account.showBio')} valuePropName="checked">
                    <Switch />
                  </Form.Item>
                  <Form.Item name={['profileVisibility', 'showStats']} label={t('account.showStats')} valuePropName="checked">
                    <Switch />
                  </Form.Item>
                  <Form.Item name={['profileVisibility', 'showPublishedFiles']} label={t('account.showPublishedFiles')} valuePropName="checked">
                    <Switch />
                  </Form.Item>
                  <Form.Item name={['profileVisibility', 'showFavorites']} label={t('account.showFavorites')} valuePropName="checked">
                    <Switch />
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
                <Form form={passwordForm} layout="vertical" onFinish={(values) => passwordMutation.mutate(values)}>
                  <Form.Item
                    name="currentPassword"
                    label={locale === 'zh-CN' ? '当前密码' : 'Current password'}
                    rules={[
                      { required: true, message: locale === 'zh-CN' ? '请输入当前密码' : 'Please enter your current password.' },
                      { min: 8, message: locale === 'zh-CN' ? '密码至少 8 位' : 'Password must be at least 8 characters.' },
                    ]}
                  >
                    <Input.Password />
                  </Form.Item>
                  <Form.Item
                    name="newPassword"
                    label={locale === 'zh-CN' ? '新密码' : 'New password'}
                    rules={[
                      { required: true, message: locale === 'zh-CN' ? '请输入新密码' : 'Please enter a new password.' },
                      { min: 8, message: locale === 'zh-CN' ? '密码至少 8 位' : 'Password must be at least 8 characters.' },
                      { max: 128, message: locale === 'zh-CN' ? '密码不能超过 128 位' : 'Password must be at most 128 characters.' },
                    ]}
                  >
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
                        {item.createdByUsername ? <Typography.Text type="secondary">{t('publicFiles.uploader')}: {item.createdByDisplayName || item.createdByUsername}</Typography.Text> : null}
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
                        {item.createdByUsername ? <Typography.Text type="secondary">{t('publicFiles.uploader')}: {item.createdByDisplayName || item.createdByUsername}</Typography.Text> : null}
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
