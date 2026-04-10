import { UploadOutlined, UserOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Avatar, Button, Card, Form, Input, List, Skeleton, Space, Switch, Tabs, Tag, Typography, message } from 'antd';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  changeCurrentUserPassword,
  fetchCurrentUser,
  fetchDownloadHistory,
  fetchFavoriteFiles,
  updateCurrentUser,
} from '../api/user';
import { useI18n } from '../features/i18n/LocaleProvider';
import { useUserAuth } from '../features/user/AuthProvider';
import { buildDefaultAvatarDataUrl } from '../lib/avatar';
import { formatBytes, formatDate } from '../lib/format';

export function UserCenterPage() {
  const [profileForm] = Form.useForm();
  const [passwordForm] = Form.useForm();
  const [selectedAvatarName, setSelectedAvatarName] = useState('');
  const queryClient = useQueryClient();
  const [messageApi, contextHolder] = message.useMessage();
  const { logout, updateUser } = useUserAuth();
  const { t, locale } = useI18n();

  const meQuery = useQuery({ queryKey: ['user-me'], queryFn: fetchCurrentUser });
  const favoritesQuery = useQuery({ queryKey: ['user-favorites'], queryFn: fetchFavoriteFiles });
  const downloadsQuery = useQuery({ queryKey: ['user-downloads'], queryFn: () => fetchDownloadHistory(50) });
  const avatarValue = Form.useWatch('avatarUrl', profileForm) as string | undefined;
  const nicknameValue = Form.useWatch('displayName', profileForm) as string | undefined;
  const avatarPreview = meQuery.data
    ? (avatarValue || buildDefaultAvatarDataUrl(meQuery.data.username, nicknameValue || meQuery.data.displayName))
    : avatarValue;

  useEffect(() => {
    if (!meQuery.data) {
      return;
    }
    profileForm.setFieldsValue({
      email: meQuery.data.email,
      displayName: meQuery.data.displayName,
      avatarUrl: meQuery.data.avatarUrl,
      bio: meQuery.data.bio,
      profileVisibility: meQuery.data.profileVisibility,
    });
    setSelectedAvatarName('');
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

  if (meQuery.isLoading && !meQuery.data) {
    return (
      <>
        {contextHolder}
        <Card className="surface-card">
          <Skeleton active avatar paragraph={{ rows: 8 }} />
        </Card>
      </>
    );
  }

  async function handleAvatarSelect(file?: File | null) {
    if (!file) {
      return;
    }
    const acceptedTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
    if (!acceptedTypes.includes(file.type) || file.size > 2 * 1024 * 1024) {
      messageApi.error(t('account.avatarInvalid'));
      return;
    }

    const result = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
          return;
        }
        reject(new Error('invalid avatar'));
      };
      reader.onerror = () => reject(reader.error ?? new Error('avatar read failed'));
      reader.readAsDataURL(file);
    });

    profileForm.setFieldValue('avatarUrl', result);
    setSelectedAvatarName(file.name);
    messageApi.success(locale === 'zh-CN' ? '头像已选中，点击“保存资料”后生效。' : 'Avatar selected. Click "Save profile" to apply it.');
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
                  <Form.Item name="avatarUrl" hidden>
                    <Input />
                  </Form.Item>
                  <Form.Item noStyle shouldUpdate>
                    {({ getFieldValue }) => (
                      <div className="avatar-editor">
                        <Avatar src={avatarPreview || getFieldValue('avatarUrl')} size={88} icon={<UserOutlined />} />
                        <Space direction="vertical" size={4}>
                          <Typography.Text strong>{t('account.avatar')}</Typography.Text>
                          <Typography.Text type="secondary">{t('account.avatarHint')}</Typography.Text>
                          {selectedAvatarName ? (
                            <Typography.Text type="secondary">
                              {locale === 'zh-CN' ? `已选择文件：${selectedAvatarName}` : `Selected file: ${selectedAvatarName}`}
                            </Typography.Text>
                          ) : null}
                          <Space wrap>
                            <label className="avatar-upload-button">
                              <UploadOutlined />
                              <span>{t('account.avatarUpload')}</span>
                              <input
                                type="file"
                                accept="image/png,image/jpeg,image/webp,image/gif"
                                hidden
                                onChange={(event) => {
                                  const [file] = Array.from(event.target.files ?? []);
                                  void handleAvatarSelect(file ?? null);
                                  event.target.value = '';
                                }}
                              />
                            </label>
                            <Button onClick={() => {
                              profileForm.setFieldValue('avatarUrl', '');
                              setSelectedAvatarName('');
                              messageApi.success(locale === 'zh-CN' ? '已切换为默认头像，点击“保存资料”后生效。' : 'Switched to the default avatar. Click "Save profile" to apply it.');
                            }}>
                              {t('account.avatarRemove')}
                            </Button>
                          </Space>
                        </Space>
                      </div>
                    )}
                  </Form.Item>
                  <Form.Item name="displayName" label={t('account.nickname')}>
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
                        {item.createdByUsername ? (
                          <Link to={`/users/${item.createdByUsername}`} className="uploader-link inline">
                            <Avatar src={item.createdByAvatarUrl} size={24}>
                              {(item.createdByDisplayName || item.createdByUsername).slice(0, 1).toUpperCase()}
                            </Avatar>
                            <span>{t('publicFiles.uploader')}: {item.createdByDisplayName || item.createdByUsername}</span>
                          </Link>
                        ) : null}
                        <Space wrap>
                          {item.category ? <Tag>{item.category}</Tag> : null}
                          {(item.tagPaths?.length ? item.tagPaths : item.tags || []).map((tag) => (
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
                        {item.createdByUsername ? (
                          <Link to={`/users/${item.createdByUsername}`} className="uploader-link inline">
                            <Avatar src={item.createdByAvatarUrl} size={24}>
                              {(item.createdByDisplayName || item.createdByUsername).slice(0, 1).toUpperCase()}
                            </Avatar>
                            <span>{t('publicFiles.uploader')}: {item.createdByDisplayName || item.createdByUsername}</span>
                          </Link>
                        ) : null}
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
