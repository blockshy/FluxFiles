import { PlusOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Card, Checkbox, Form, Input, InputNumber, Modal, Space, Switch, Table, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useEffect, useState } from 'react';
import {
  fetchAdminSettings,
  fetchPermissionTemplates,
  updateCaptchaSettings,
  updatePermissionTemplates,
  updateRateLimitSettings,
  updateRegistrationSetting,
  updateUploadSettings,
} from '../api/admin';
import type { PermissionTemplate, RateLimitSettings, UploadSettings } from '../api/types';
import { useI18n } from '../features/i18n/LocaleProvider';
import { getPermissionCombinationFeedback, getPermissionGroups, getPermissionLabels } from '../features/user/permissionConfig';

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
    uploadForm.setFieldsValue({
      ...settingsQuery.data.uploadSettings,
      allowedExtensionsText: joinList(settingsQuery.data.uploadSettings.allowedExtensions),
      allowedMimeTypesText: joinList(settingsQuery.data.uploadSettings.allowedMimeTypes),
    });
  }, [rateLimitForm, settingsQuery.data, uploadForm]);

  const registrationMutation = useMutation({
    mutationFn: updateRegistrationSetting,
    onSuccess: () => {
      messageApi.success(t('settings.saved'));
      void queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
      void queryClient.invalidateQueries({ queryKey: ['register-config'] });
    },
  });

  const captchaMutation = useMutation({
    mutationFn: updateCaptchaSettings,
    onSuccess: () => {
      messageApi.success(t('settings.saved'));
      void queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
      void queryClient.invalidateQueries({ queryKey: ['register-config'] });
    },
  });

  const rateLimitMutation = useMutation({
    mutationFn: updateRateLimitSettings,
    onSuccess: () => {
      messageApi.success(t('settings.saved'));
      void queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-logs'] });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: updateUploadSettings,
    onSuccess: () => {
      messageApi.success(t('settings.saved'));
      void queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-logs'] });
    },
  });

  const templatesMutation = useMutation({
    mutationFn: updatePermissionTemplates,
    onSuccess: () => {
      messageApi.success(t('settings.saved'));
      setDraftTemplates([]);
      void queryClient.invalidateQueries({ queryKey: ['permission-templates'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-logs'] });
    },
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
        <Button
          type="link"
          onClick={() => {
            setEditingIndex(index);
            templateForm.setFieldsValue(templates[index]);
            setModalOpen(true);
          }}
        >
          {t('common.edit')}
        </Button>
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

      <Card className="surface-card" style={{ marginTop: 24 }} loading={settingsQuery.isLoading}>
        <div className="toolbar-row">
          <div>
            <h2 className="section-title">{locale === 'zh-CN' ? '限流配置' : 'Rate Limits'}</h2>
            <p className="section-subtitle">
              {locale === 'zh-CN' ? '分别配置登录、列表、下载和上传的限流阈值。将 limit 设为 0 可关闭该项限流。' : 'Configure thresholds for login, list, download, and upload. Set limit to 0 to disable a rule.'}
            </p>
          </div>
          <Button type="primary" loading={rateLimitMutation.isPending} onClick={() => rateLimitForm.submit()}>
            {t('common.save')}
          </Button>
        </div>

        <Form form={rateLimitForm} layout="vertical" onFinish={(values) => rateLimitMutation.mutate(values)}>
          <div className="detail-metadata">
            <Form.Item label={locale === 'zh-CN' ? '登录次数' : 'Login limit'} name={['login', 'limit']}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
            <Form.Item label={locale === 'zh-CN' ? '登录窗口（秒）' : 'Login window (s)'} name={['login', 'windowSeconds']}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
            <Form.Item label={locale === 'zh-CN' ? '列表次数' : 'List limit'} name={['list', 'limit']}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
            <Form.Item label={locale === 'zh-CN' ? '列表窗口（秒）' : 'List window (s)'} name={['list', 'windowSeconds']}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
            <Form.Item label={locale === 'zh-CN' ? '下载次数' : 'Download limit'} name={['download', 'limit']}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
            <Form.Item label={locale === 'zh-CN' ? '下载窗口（秒）' : 'Download window (s)'} name={['download', 'windowSeconds']}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
            <Form.Item label={locale === 'zh-CN' ? '上传次数' : 'Upload limit'} name={['upload', 'limit']}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
            <Form.Item label={locale === 'zh-CN' ? '上传窗口（秒）' : 'Upload window (s)'} name={['upload', 'windowSeconds']}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
          </div>
        </Form>
      </Card>

      <Card className="surface-card" style={{ marginTop: 24 }} loading={settingsQuery.isLoading}>
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

      <Card className="surface-card" style={{ marginTop: 24 }} loading={templatesQuery.isLoading}>
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
        <Form form={templateForm} layout="vertical">
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
