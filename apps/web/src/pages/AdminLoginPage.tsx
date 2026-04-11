import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { useMutation } from '@tanstack/react-query';
import { Button, Card, Form, Input, Typography, message } from 'antd';
import { useLocation, useNavigate } from 'react-router-dom';
import { adminLogin } from '../api/admin';
import { useAuth } from '../features/admin/AuthProvider';
import { ThemeToggle } from '../features/theme/ThemeToggle';
import { getApiErrorMessage } from '../lib/apiError';

export function AdminLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [messageApi, contextHolder] = message.useMessage();
  const { login } = useAuth();

  const loginMutation = useMutation({
    mutationFn: ({ username, password }: { username: string; password: string }) =>
      adminLogin(username, password),
    onSuccess: (payload) => {
      login(payload);
      const target = (location.state as { from?: string } | null)?.from ?? '/admin/files';
      navigate(target, { replace: true });
    },
    onError: (error) => {
      messageApi.error(getApiErrorMessage(error, '登录失败，请检查账号密码。', 'zh-CN'));
    },
  });

  return (
    <div className="login-shell">
      {contextHolder}

      <div className="login-toolbar">
        <ThemeToggle />
      </div>

      <Card className="surface-card login-card">
        <Typography.Title level={3} style={{ marginTop: 0, marginBottom: 6 }}>
          FluxFiles Console
        </Typography.Title>
        <Typography.Paragraph type="secondary" style={{ marginBottom: 28 }}>
          管理员登录后可进行文件上传、编辑、删除与展示状态管理。
        </Typography.Paragraph>

        <Form
          layout="vertical"
          size="large"
          onFinish={(values: { username: string; password: string }) => loginMutation.mutate(values)}
        >
          <Form.Item name="username" label="账号" rules={[{ required: true, message: '请输入管理员账号' }]}>
            <Input prefix={<UserOutlined />} placeholder="admin" />
          </Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true, message: '请输入管理员密码' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="请输入密码" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={loginMutation.isPending}>
            登录后台
          </Button>
        </Form>
      </Card>
    </div>
  );
}
