import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Card, Checkbox, Form, Input, Modal, Select, Space, Switch, Table, Tag, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useDeferredValue, useMemo, useState } from 'react';
import { createAdminUser, fetchAdminUsers, fetchPermissionTemplates, updateAdminUser } from '../api/admin';
import type { AdminUser, CreateManagedUserPayload, PermissionTemplate, UpdateManagedUserPayload } from '../api/types';
import { useI18n } from '../features/i18n/LocaleProvider';
import { getPermissionCombinationFeedback, getPermissionGroups, getPermissionLabels } from '../features/user/permissionConfig';
import { useUserAuth } from '../features/user/AuthProvider';
import { hasPermission, PERMISSION_ADMIN_USERS_CREATE, PERMISSION_ADMIN_USERS_EDIT } from '../features/user/permissions';
import { formatDate } from '../lib/format';

interface UserModalState {
  open: boolean;
  mode: 'create' | 'edit';
  user?: AdminUser | null;
}

function errorText(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function AdminUsersPage() {
  const queryClient = useQueryClient();
  const [messageApi, contextHolder] = message.useMessage();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [modalState, setModalState] = useState<UserModalState>({ open: false, mode: 'create', user: null });
  const [form] = Form.useForm();
  const deferredSearch = useDeferredValue(search.trim());
  const role = Form.useWatch('role', form);
  const selectedPermissions = Form.useWatch('permissions', form) as string[] | undefined;
  const { t, locale } = useI18n();
  const { user } = useUserAuth();

  const canCreate = hasPermission(user, PERMISSION_ADMIN_USERS_CREATE);
  const canEdit = hasPermission(user, PERMISSION_ADMIN_USERS_EDIT);

  const usersQuery = useQuery({
    queryKey: ['admin-users', page, pageSize, deferredSearch],
    queryFn: () => fetchAdminUsers({ page, pageSize, search: deferredSearch || undefined }),
  });

  const templatesQuery = useQuery({
    queryKey: ['permission-templates'],
    queryFn: fetchPermissionTemplates,
  });

  const createMutation = useMutation({
    mutationFn: (payload: CreateManagedUserPayload) => createAdminUser(payload),
    onSuccess: () => {
      messageApi.success(t('users.createSuccess'));
      setModalState({ open: false, mode: 'create', user: null });
      form.resetFields();
      void queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-logs'] });
    },
    onError: (error) => messageApi.error(errorText(error, 'Create user failed.')),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateManagedUserPayload }) => updateAdminUser(id, payload),
    onSuccess: () => {
      messageApi.success(t('users.updateSuccess'));
      setModalState({ open: false, mode: 'create', user: null });
      form.resetFields();
      void queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-logs'] });
    },
    onError: (error) => messageApi.error(errorText(error, 'Update user failed.')),
  });

  const templates = templatesQuery.data ?? [];
  const permissionLabels = getPermissionLabels(locale);
  const permissionGroups = getPermissionGroups(locale);
  const permissionFeedback = getPermissionCombinationFeedback(locale, selectedPermissions);

  const columns = useMemo<ColumnsType<AdminUser>>(() => {
    const base: ColumnsType<AdminUser> = [
      { title: t('login.username'), dataIndex: 'username', key: 'username', width: 150 },
      { title: t('register.displayName'), dataIndex: 'displayName', key: 'displayName', width: 180 },
      { title: t('register.email'), dataIndex: 'email', key: 'email', width: 220 },
      { title: 'Role', dataIndex: 'role', key: 'role', width: 120, render: (value: string) => <Tag color={value === 'admin' ? 'gold' : 'default'}>{value}</Tag> },
      {
        title: t('users.permissions'),
        dataIndex: 'permissions',
        key: 'permissions',
        width: 360,
        render: (value: string[]) => value?.length ? <Space size={[4, 4]} wrap>{value.map((permission) => <Tag key={permission}>{permissionLabels[permission] ?? permission}</Tag>)}</Space> : '-',
      },
      { title: 'Status', dataIndex: 'isEnabled', key: 'isEnabled', width: 120, render: (value: boolean) => <Tag color={value ? 'green' : 'red'}>{value ? t('common.enabled') : t('common.disabled')}</Tag> },
      { title: 'Last login', dataIndex: 'lastLoginAt', key: 'lastLoginAt', width: 180, render: (value?: string) => (value ? formatDate(value) : '-') },
    ];

    if (canEdit) {
      base.push({
        title: t('common.edit'),
        key: 'action',
        width: 100,
        fixed: 'right',
        render: (_, record) => (
          <div className="table-action-cell align-right">
            <Button
              className="table-action-button"
              onClick={() => {
                setModalState({ open: true, mode: 'edit', user: record });
                form.setFieldsValue({
                  displayName: record.displayName,
                  email: record.email,
                  role: record.role,
                  permissions: record.permissions,
                  permissionTemplate: undefined,
                  isEnabled: record.isEnabled,
                });
              }}
            >
              {t('common.edit')}
            </Button>
          </div>
        ),
      });
    }

    return base;
  }, [canEdit, form, permissionLabels, t]);

  function applyTemplate(templateKey: string | undefined) {
    const template = templates.find((item) => item.key === templateKey);
    form.setFieldValue('permissions', template?.permissions ?? []);
  }

  return (
    <>
      {contextHolder}
      <Card className="surface-card">
        <div className="toolbar-row">
          <div>
            <h2 className="section-title">{t('users.title')}</h2>
            <p className="section-subtitle">{t('users.subtitle')}</p>
          </div>

          <div className="toolbar-controls">
            <Input allowClear placeholder={t('publicFiles.search')} style={{ width: 280 }} value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
            <Button icon={<ReloadOutlined />} onClick={() => usersQuery.refetch()}>{t('users.refresh')}</Button>
            {canCreate ? (
              <Button type="primary" icon={<PlusOutlined />} onClick={() => { setModalState({ open: true, mode: 'create', user: null }); form.resetFields(); form.setFieldsValue({ role: 'user', permissions: [], permissionTemplate: undefined, isEnabled: true }); }}>
                {t('users.new')}
              </Button>
            ) : null}
          </div>
        </div>

        <Table<AdminUser>
          rowKey="id"
          columns={columns}
          dataSource={usersQuery.data?.items ?? []}
          loading={usersQuery.isLoading}
          scroll={{ x: canEdit ? 1500 : 1400 }}
          pagination={{ current: page, pageSize, total: usersQuery.data?.pagination.total ?? 0, onChange: (nextPage, nextPageSize) => { setPage(nextPage); setPageSize(nextPageSize); } }}
        />
      </Card>

      <Modal
        title={modalState.mode === 'create' ? t('common.create') : t('common.edit')}
        open={modalState.open}
        onCancel={() => { setModalState({ open: false, mode: 'create', user: null }); form.resetFields(); }}
        onOk={() => form.submit()}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
        destroyOnHidden
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ role: 'user', permissions: [], permissionTemplate: undefined, isEnabled: true }}
          onFinish={(values) => {
            const payload = { ...values, permissions: values.role === 'admin' ? values.permissions ?? [] : [] };
            delete payload.permissionTemplate;
            if (modalState.mode === 'create') {
              createMutation.mutate(payload as CreateManagedUserPayload);
              return;
            }
            if (!modalState.user) {
              return;
            }
            updateMutation.mutate({ id: modalState.user.id, payload: payload as UpdateManagedUserPayload });
          }}
        >
          {modalState.mode === 'create' ? (
            <Form.Item name="username" label={t('login.username')} rules={[{ required: true }]}>
              <Input />
            </Form.Item>
          ) : null}
          <Form.Item name="displayName" label={t('register.displayName')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="email" label={t('register.email')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          {modalState.mode === 'create' ? (
            <Form.Item name="password" label={t('register.password')} rules={[{ required: true }]}>
              <Input.Password />
            </Form.Item>
          ) : null}
          <Form.Item name="role" label="Role" rules={[{ required: true }]}>
            <Select options={[{ label: t('common.user'), value: 'user' }, { label: t('common.admin'), value: 'admin' }]} />
          </Form.Item>
          {role === 'admin' ? (
            <>
              <Form.Item name="permissionTemplate" label={t('users.template')}>
                <Select
                  allowClear
                  placeholder={t('users.template')}
                  options={templates.map((template: PermissionTemplate) => ({ label: template.name, value: template.key }))}
                  onChange={(value) => applyTemplate(value)}
                />
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
            </>
          ) : null}
          <Form.Item name="isEnabled" label={t('common.enabled')} valuePropName="checked">
            <Switch checkedChildren={t('common.on')} unCheckedChildren={t('common.off')} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
