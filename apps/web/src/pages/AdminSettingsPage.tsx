import { PlusOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Card, Checkbox, Form, Input, InputNumber, Modal, Select, Space, Switch, Table, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useEffect, useState } from 'react';
import {
  fetchAdminSettings,
  fetchPermissionTemplates,
  updateCaptchaSettings,
  updateDownloadSettings,
  updateFileListDisplaySettings,
  updatePermissionTemplates,
  updateRateLimitSettings,
  updateRegistrationSetting,
  updateUploadSettings,
} from '../api/admin';
import type { DownloadSettings, FileListDisplaySettings, PermissionTemplate, RateLimitSettings, UploadSettings } from '../api/types';
import { useI18n } from '../features/i18n/LocaleProvider';
import { getPermissionCombinationFeedback, getPermissionGroups, getPermissionLabels } from '../features/user/permissionConfig';
import { getApiErrorMessage } from '../lib/apiError';

const splitList = (value: string) =>
  value
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);

const joinList = (items?: string[] | null) => (Array.isArray(items) ? items : []).join(', ');

export function AdminSettingsPage() {
  const queryClient = useQueryClient();
  const [messageApi, contextHolder] = message.useMessage();
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [draftTemplates, setDraftTemplates] = useState<PermissionTemplate[]>([]);
  const [templateForm] = Form.useForm<PermissionTemplate>();
  const [rateLimitForm] = Form.useForm<RateLimitSettings>();
  const [downloadForm] = Form.useForm<DownloadSettings>();
  const [fileListDisplayForm] = Form.useForm<FileListDisplaySettings>();
  const [uploadForm] = Form.useForm<UploadSettings & { allowedExtensionsText?: string; allowedMimeTypesText?: string }>();
  const selectedPermissions = Form.useWatch('permissions', templateForm) as string[] | undefined;
  const restrictFileTypes = Form.useWatch('restrictFileTypes', uploadForm);
  const restrictFileSize = Form.useWatch('restrictFileSize', uploadForm);
  const { t, locale } = useI18n();

  const settingsQuery = useQuery({ queryKey: ['admin-settings'], queryFn: fetchAdminSettings });
  const templatesQuery = useQuery({ queryKey: ['permission-templates'], queryFn: fetchPermissionTemplates });

  useEffect(() => {
    if (!settingsQuery.data) {
      return;
    }
    rateLimitForm.setFieldsValue(settingsQuery.data.rateLimits);
    downloadForm.setFieldsValue(settingsQuery.data.downloadSettings);
    uploadForm.setFieldsValue({
      ...settingsQuery.data.uploadSettings,
      allowedExtensionsText: joinList(settingsQuery.data.uploadSettings.allowedExtensions),
      allowedMimeTypesText: joinList(settingsQuery.data.uploadSettings.allowedMimeTypes),
    });
    fileListDisplayForm.setFieldsValue(settingsQuery.data.fileListDisplay);
  }, [downloadForm, fileListDisplayForm, rateLimitForm, settingsQuery.data, uploadForm]);

  const registrationMutation = useMutation({
    mutationFn: updateRegistrationSetting,
    onSuccess: () => {
      messageApi.success(t('settings.saved'));
      void queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
      void queryClient.invalidateQueries({ queryKey: ['register-config'] });
    },
    onError: (error) => messageApi.error(getApiErrorMessage(error, locale === 'zh-CN' ? '注册开关更新失败。' : 'Failed to update registration setting.', locale)),
  });

  const captchaMutation = useMutation({
    mutationFn: updateCaptchaSettings,
    onSuccess: () => {
      messageApi.success(t('settings.saved'));
      void queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
      void queryClient.invalidateQueries({ queryKey: ['register-config'] });
    },
    onError: (error) => messageApi.error(getApiErrorMessage(error, locale === 'zh-CN' ? '验证码设置更新失败。' : 'Failed to update captcha settings.', locale)),
  });

  const downloadMutation = useMutation({
    mutationFn: updateDownloadSettings,
    onSuccess: () => {
      messageApi.success(t('settings.saved'));
      void queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-logs'] });
    },
    onError: (error) => messageApi.error(getApiErrorMessage(error, locale === 'zh-CN' ? '下载设置保存失败，请检查验证码开关和链接有效期。' : 'Failed to save download settings. Please check captcha and URL expiry.', locale)),
  });

  const rateLimitMutation = useMutation({
    mutationFn: updateRateLimitSettings,
    onSuccess: () => {
      messageApi.success(t('settings.saved'));
      void queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-logs'] });
    },
    onError: (error) => messageApi.error(getApiErrorMessage(error, locale === 'zh-CN' ? '限流配置保存失败，请检查数值。' : 'Failed to save rate limits. Please check values.', locale)),
  });

  const fileListDisplayMutation = useMutation({
    mutationFn: updateFileListDisplaySettings,
    onSuccess: () => {
      messageApi.success(t('settings.saved'));
      void queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
      void queryClient.invalidateQueries({ queryKey: ['public-file-list-display-config'] });
      void queryClient.invalidateQueries({ queryKey: ['public-files'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-logs'] });
    },
    onError: (error) => messageApi.error(getApiErrorMessage(error, locale === 'zh-CN' ? '文件列表显示方式保存失败，请检查配置。' : 'Failed to save file list display settings.', locale)),
  });

  const uploadMutation = useMutation({
    mutationFn: updateUploadSettings,
    onSuccess: () => {
      messageApi.success(t('settings.saved'));
      void queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-logs'] });
    },
    onError: (error) => messageApi.error(getApiErrorMessage(error, locale === 'zh-CN' ? '上传限制保存失败，请检查文件大小和类型配置。' : 'Failed to save upload restrictions. Please check size and type settings.', locale)),
  });

  const templatesMutation = useMutation({
    mutationFn: updatePermissionTemplates,
    onSuccess: () => {
      messageApi.success(t('settings.saved'));
      setDraftTemplates([]);
      void queryClient.invalidateQueries({ queryKey: ['permission-templates'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-logs'] });
    },
    onError: (error) => messageApi.error(getApiErrorMessage(error, locale === 'zh-CN' ? '权限模板保存失败，请检查模板名称和权限组合。' : 'Failed to save permission templates. Please check template names and permission combinations.', locale)),
  });

  const templates = draftTemplates.length > 0 ? draftTemplates : templatesQuery.data ?? [];
  const permissionLabels = getPermissionLabels(locale);
  const permissionGroups = getPermissionGroups(locale);
  const permissionFeedback = getPermissionCombinationFeedback(locale, selectedPermissions);

  const columns: ColumnsType<PermissionTemplate> = [
    { title: 'Key', dataIndex: 'key', key: 'key', width: 180 },
    { title: 'Name', dataIndex: 'name', key: 'name', width: 180 },
    { title: 'Description', dataIndex: 'description', key: 'description', width: 260 },
    { title: t('users.permissions'), dataIndex: 'permissions', key: 'permissions', render: (value: string[]) => value.map((item) => permissionLabels[item] ?? item).join(', ') },
    {
      title: t('common.edit'),
      key: 'action',
      width: 100,
      fixed: 'right',
      render: (_, __, index) => (
        <div className="table-action-cell align-right">
          <Button
            className="table-action-button"
            onClick={() => {
              setEditingIndex(index);
              templateForm.setFieldsValue(templates[index]);
              setModalOpen(true);
            }}
          >
            {t('common.edit')}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      {contextHolder}
      <Card className="surface-card" loading={settingsQuery.isLoading}>
        <Space direction="vertical" size={20} style={{ width: '100%' }}>
          <div>
            <h2 className="section-title">{t('settings.title')}</h2>
            <p className="section-subtitle">{t('settings.subtitle')}</p>
          </div>
          <div className="detail-metadata">
            <div className="detail-item">
              <span className="detail-label">{locale === 'zh-CN' ? '公开注册' : 'Public registration'}</span>
              <Space align="center">
                <Switch
                  checked={settingsQuery.data?.registrationEnabled ?? true}
                  checkedChildren={t('common.on')}
                  unCheckedChildren={t('common.off')}
                  loading={registrationMutation.isPending}
                  onChange={(checked) => registrationMutation.mutate(checked)}
                />
              </Space>
            </div>
            <div className="detail-item">
              <span className="detail-label">{locale === 'zh-CN' ? '登录验证码' : 'Login captcha'}</span>
              <Space align="center">
                <Switch
                  checked={settingsQuery.data?.captcha.loginEnabled ?? false}
                  checkedChildren={t('common.on')}
                  unCheckedChildren={t('common.off')}
                  loading={captchaMutation.isPending}
                  onChange={(checked) => captchaMutation.mutate({
                    loginEnabled: checked,
                    registrationEnabled: settingsQuery.data?.captcha.registrationEnabled ?? false,
                  })}
                />
              </Space>
            </div>
            <div className="detail-item">
              <span className="detail-label">{locale === 'zh-CN' ? '注册验证码' : 'Registration captcha'}</span>
              <Space align="center">
                <Switch
                  checked={settingsQuery.data?.captcha.registrationEnabled ?? false}
                  checkedChildren={t('common.on')}
                  unCheckedChildren={t('common.off')}
                  loading={captchaMutation.isPending}
                  onChange={(checked) => captchaMutation.mutate({
                    loginEnabled: settingsQuery.data?.captcha.loginEnabled ?? false,
                    registrationEnabled: checked,
                  })}
                />
              </Space>
            </div>
          </div>
        </Space>
      </Card>

      <Card className="surface-card settings-section-card" loading={settingsQuery.isLoading}>
        <div className="toolbar-row">
          <div>
            <h2 className="section-title">{locale === 'zh-CN' ? '文件下载设置' : 'Download Settings'}</h2>
            <p className="section-subtitle">
              {locale === 'zh-CN' ? '控制游客下载、下载验证码，以及阿里云临时下载链接的有效期。' : 'Control guest downloads, download captcha, and the expiry of temporary Aliyun download links.'}
            </p>
          </div>
          <Button type="primary" loading={downloadMutation.isPending} onClick={() => downloadForm.submit()}>
            {t('common.save')}
          </Button>
        </div>

        <Form form={downloadForm} layout="vertical" onFinish={(values) => downloadMutation.mutate(values)}>
          <div className="detail-metadata">
            <Form.Item label={locale === 'zh-CN' ? '允许游客下载' : 'Allow guest downloads'} name="guestDownloadAllowed" valuePropName="checked">
              <Switch checkedChildren={t('common.on')} unCheckedChildren={t('common.off')} />
            </Form.Item>
            <Form.Item label={locale === 'zh-CN' ? '下载验证码' : 'Download captcha'} name="captchaEnabled" valuePropName="checked">
              <Switch checkedChildren={t('common.on')} unCheckedChildren={t('common.off')} />
            </Form.Item>
            <Form.Item
              label={locale === 'zh-CN' ? '下载链接有效期（秒）' : 'Download URL expiry (s)'}
              name="urlExpiresSeconds"
              rules={[{ required: true, message: locale === 'zh-CN' ? '请输入下载链接有效期' : 'Please enter download URL expiry.' }]}
            >
              <InputNumber min={10} max={86400} style={{ width: '100%' }} />
            </Form.Item>
          </div>
        </Form>
      </Card>

      <Card className="surface-card settings-section-card" loading={settingsQuery.isLoading}>
        <div className="toolbar-row">
          <div>
            <h2 className="section-title">{locale === 'zh-CN' ? '首页文件列表显示' : 'Public File List Display'}</h2>
            <p className="section-subtitle">
              {locale === 'zh-CN' ? '控制首页文件列表中的分类列和标签列显示完整路径，还是只显示当前节点名称。' : 'Choose whether category and tag columns show full paths or only the current node names.'}
            </p>
          </div>
          <Button type="primary" loading={fileListDisplayMutation.isPending} onClick={() => fileListDisplayForm.submit()}>
            {t('common.save')}
          </Button>
        </div>

        <Form form={fileListDisplayForm} layout="vertical" onFinish={(values) => fileListDisplayMutation.mutate(values)}>
          <div className="detail-metadata">
            <Form.Item label={locale === 'zh-CN' ? '分类列显示方式' : 'Category column mode'} name="categoryMode" rules={[{ required: true }]}>
              <Select options={[
                { label: locale === 'zh-CN' ? '显示完整路径' : 'Show full path', value: 'fullPath' },
                { label: locale === 'zh-CN' ? '只显示当前节点名称' : 'Show current node name only', value: 'leafName' },
              ]} />
            </Form.Item>
            <Form.Item label={locale === 'zh-CN' ? '标签列显示方式' : 'Tag column mode'} name="tagMode" rules={[{ required: true }]}>
              <Select options={[
                { label: locale === 'zh-CN' ? '显示完整路径' : 'Show full path', value: 'fullPath' },
                { label: locale === 'zh-CN' ? '只显示当前节点名称' : 'Show current node name only', value: 'leafName' },
              ]} />
            </Form.Item>
          </div>
        </Form>
      </Card>

      <Card className="surface-card settings-section-card" loading={settingsQuery.isLoading}>
        <div className="toolbar-row">
          <div>
            <h2 className="section-title">{locale === 'zh-CN' ? '限流配置' : 'Rate Limits'}</h2>
            <p className="section-subtitle">
              {locale === 'zh-CN' ? '登录和列表限流按游客/已登录用户分开配置；下载和上传保持统一。将 limit 设为 0 可关闭该项限流。' : 'Configure guest/authenticated limits separately for login and list. Download and upload remain shared. Set limit to 0 to disable a rule.'}
            </p>
          </div>
          <Button type="primary" loading={rateLimitMutation.isPending} onClick={() => rateLimitForm.submit()}>
            {t('common.save')}
          </Button>
        </div>

        <Form form={rateLimitForm} layout="vertical" onFinish={(values) => rateLimitMutation.mutate(values)}>
          <div className="detail-metadata">
            <Form.Item label={locale === 'zh-CN' ? '游客登录次数' : 'Guest login limit'} name={['login', 'guest', 'limit']}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
            <Form.Item label={locale === 'zh-CN' ? '游客登录窗口（秒）' : 'Guest login window (s)'} name={['login', 'guest', 'windowSeconds']}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
            <Form.Item label={locale === 'zh-CN' ? '已登录用户登录次数' : 'Authenticated login limit'} name={['login', 'authenticated', 'limit']}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
            <Form.Item label={locale === 'zh-CN' ? '已登录用户登录窗口（秒）' : 'Authenticated login window (s)'} name={['login', 'authenticated', 'windowSeconds']}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
            <Form.Item label={locale === 'zh-CN' ? '游客列表次数' : 'Guest list limit'} name={['list', 'guest', 'limit']}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
            <Form.Item label={locale === 'zh-CN' ? '游客列表窗口（秒）' : 'Guest list window (s)'} name={['list', 'guest', 'windowSeconds']}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
            <Form.Item label={locale === 'zh-CN' ? '已登录用户列表次数' : 'Authenticated list limit'} name={['list', 'authenticated', 'limit']}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
            <Form.Item label={locale === 'zh-CN' ? '已登录用户列表窗口（秒）' : 'Authenticated list window (s)'} name={['list', 'authenticated', 'windowSeconds']}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
            <Form.Item label={locale === 'zh-CN' ? '下载次数' : 'Download limit'} name={['download', 'limit']}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
            <Form.Item label={locale === 'zh-CN' ? '下载窗口（秒）' : 'Download window (s)'} name={['download', 'windowSeconds']}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
            <Form.Item label={locale === 'zh-CN' ? '上传次数' : 'Upload limit'} name={['upload', 'limit']}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
            <Form.Item label={locale === 'zh-CN' ? '上传窗口（秒）' : 'Upload window (s)'} name={['upload', 'windowSeconds']}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
          </div>
        </Form>
      </Card>

      <Card className="surface-card settings-section-card" loading={settingsQuery.isLoading}>
        <div className="toolbar-row">
          <div>
            <h2 className="section-title">{locale === 'zh-CN' ? '文件上传限制' : 'Upload Restrictions'}</h2>
            <p className="section-subtitle">
              {locale === 'zh-CN' ? '可分别控制文件大小和文件类型限制，也可以关闭为不限制。' : 'Configure file size and file type restrictions independently, or disable them entirely.'}
            </p>
          </div>
          <Button type="primary" loading={uploadMutation.isPending} onClick={() => uploadForm.submit()}>
            {t('common.save')}
          </Button>
        </div>

        <Form
          form={uploadForm}
          layout="vertical"
          onFinish={(values) => uploadMutation.mutate({
            restrictFileSize: values.restrictFileSize,
            maxSizeBytes: values.restrictFileSize ? values.maxSizeBytes ?? 0 : 0,
            restrictFileTypes: values.restrictFileTypes,
            allowedExtensions: values.restrictFileTypes ? splitList(values.allowedExtensionsText ?? '') : [],
            allowedMimeTypes: values.restrictFileTypes ? splitList(values.allowedMimeTypesText ?? '') : [],
          })}
        >
          <div className="detail-metadata">
            <Form.Item label={locale === 'zh-CN' ? '限制文件大小' : 'Restrict file size'} name="restrictFileSize" valuePropName="checked">
              <Switch checkedChildren={t('common.on')} unCheckedChildren={t('common.off')} />
            </Form.Item>
            <Form.Item
              label={locale === 'zh-CN' ? '最大大小（字节）' : 'Max size (bytes)'}
              name="maxSizeBytes"
              rules={restrictFileSize ? [{ required: true, message: locale === 'zh-CN' ? '请输入最大大小' : 'Please enter a max size.' }] : []}
            >
              <InputNumber min={1} style={{ width: '100%' }} disabled={!restrictFileSize} />
            </Form.Item>
            <Form.Item label={locale === 'zh-CN' ? '限制文件类型' : 'Restrict file types'} name="restrictFileTypes" valuePropName="checked">
              <Switch checkedChildren={t('common.on')} unCheckedChildren={t('common.off')} />
            </Form.Item>
            <div />
            <Form.Item label={locale === 'zh-CN' ? '允许的后缀' : 'Allowed extensions'} name="allowedExtensionsText">
              <Input.TextArea rows={3} disabled={!restrictFileTypes} placeholder={locale === 'zh-CN' ? '.pdf, .zip, .png' : '.pdf, .zip, .png'} />
            </Form.Item>
            <Form.Item label={locale === 'zh-CN' ? '允许的 MIME 类型' : 'Allowed MIME types'} name="allowedMimeTypesText">
              <Input.TextArea rows={3} disabled={!restrictFileTypes} placeholder="application/pdf, image/png" />
            </Form.Item>
          </div>
        </Form>
      </Card>

      <Card className="surface-card settings-section-card" loading={templatesQuery.isLoading}>
        <div className="toolbar-row">
          <div>
            <h2 className="section-title">{t('settings.templateTitle')}</h2>
            <p className="section-subtitle">{t('settings.templateSubtitle')}</p>
          </div>
          <div className="toolbar-controls">
            <Button
              icon={<PlusOutlined />}
              onClick={() => {
                setEditingIndex(null);
                templateForm.resetFields();
                setModalOpen(true);
              }}
            >
              {t('settings.templateNew')}
            </Button>
            <Button
              type="primary"
              loading={templatesMutation.isPending}
              onClick={() => templatesMutation.mutate(templates)}
            >
              {t('settings.templateSave')}
            </Button>
          </div>
        </div>

        <Table rowKey="key" columns={columns} dataSource={templates} pagination={false} scroll={{ x: 1100 }} />
      </Card>

      <Modal
        className="surface-modal"
        open={modalOpen}
        title={editingIndex === null ? t('settings.templateNew') : t('common.edit')}
        onCancel={() => setModalOpen(false)}
        onOk={async () => {
          const values = await templateForm.validateFields();
          const next = [...templates];
          if (editingIndex === null) {
            next.push(values);
          } else {
            next[editingIndex] = values;
          }
          setDraftTemplates(next);
          setModalOpen(false);
        }}
      >
        <Form form={templateForm} className="surface-form" layout="vertical">
          <Form.Item name="key" label="Key" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input />
          </Form.Item>
          <Form.Item label={t('users.permissions')} required>
            <Form.Item
              name="permissions"
              noStyle
              rules={[
                { required: true, type: 'array', min: 1 },
                {
                  validator: async (_, value: string[] | undefined) => {
                    const feedback = getPermissionCombinationFeedback(locale, value);
                    if (feedback.errors.length > 0) {
                      throw new Error(feedback.errors[0]);
                    }
                  },
                },
              ]}
            >
              <Checkbox.Group>
                <div className="permission-groups">
                  {permissionGroups.map((group) => (
                    <div key={group.key} className="permission-group-card">
                      <div className="permission-group-title">{group.title}</div>
                      <Space direction="vertical" size={8} style={{ width: '100%' }}>
                        {group.options.map((permission) => (
                          <Checkbox key={permission} value={permission}>
                            {permissionLabels[permission] ?? permission}
                          </Checkbox>
                        ))}
                      </Space>
                    </div>
                  ))}
                </div>
              </Checkbox.Group>
            </Form.Item>
            {permissionFeedback.errors.length > 0 ? <Alert style={{ marginTop: 12 }} type="error" showIcon message={permissionFeedback.errors[0]} /> : null}
            {permissionFeedback.warnings.map((warning) => (
              <Alert key={warning} style={{ marginTop: 12 }} type="warning" showIcon message={warning} />
            ))}
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
