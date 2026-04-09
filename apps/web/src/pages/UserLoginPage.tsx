import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { useMutation, useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { Button, Card, Form, Input, Space, Typography, message } from 'antd';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { fetchCaptcha, fetchRegisterConfig, loginUser } from '../api/user';
import { LocaleToggle } from '../features/i18n/LocaleToggle';
import { useI18n } from '../features/i18n/LocaleProvider';
import { ThemeToggle } from '../features/theme/ThemeToggle';
import { useUserAuth } from '../features/user/AuthProvider';

function extractErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    const text = error.response?.data?.message;
    if (typeof text === 'string' && text.trim()) {
      return text;
    }
  }
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}

export function UserLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [messageApi, contextHolder] = message.useMessage();
  const { login } = useUserAuth();
  const { t, locale } = useI18n();

  const authConfigQuery = useQuery({
    queryKey: ['register-config'],
    queryFn: fetchRegisterConfig,
  });

  const captchaQuery = useQuery({
    queryKey: ['auth-captcha', 'login', authConfigQuery.data?.captcha.loginEnabled],
    queryFn: fetchCaptcha,
    enabled: authConfigQuery.data?.captcha.loginEnabled === true,
  });

  const loginMutation = useMutation({
    mutationFn: ({ username, password, captchaId, captchaAnswer }: { username: string; password: string; captchaId?: string; captchaAnswer?: string }) =>
      loginUser(username, password, captchaId, captchaAnswer),
    onSuccess: (payload) => {
      login(payload);
      const target = (location.state as { from?: string } | null)?.from ?? (payload.user.role === 'admin' ? '/admin' : '/me');
      navigate(target, { replace: true });
    },
    onError: (error) => {
      messageApi.error(extractErrorMessage(error, t('login.error')));
      void captchaQuery.refetch();
    },
  });

  const captchaEnabled = authConfigQuery.data?.captcha.loginEnabled === true;

  return (
    <div className="login-shell">
      {contextHolder}
      <div className="login-toolbar">
        <LocaleToggle />
        <ThemeToggle />
      </div>
      <Card className="surface-card login-card">
        <Typography.Title level={3} style={{ marginTop: 0, marginBottom: 6 }}>
          {t('login.title')}
        </Typography.Title>
        <Typography.Paragraph type="secondary" style={{ marginBottom: 28 }}>
          {t('login.subtitle')}
        </Typography.Paragraph>

        <Form
          layout="vertical"
          size="large"
          onFinish={(values: { username: string; password: string; captchaAnswer?: string }) => loginMutation.mutate({
            username: values.username,
            password: values.password,
            captchaId: captchaQuery.data?.id,
            captchaAnswer: values.captchaAnswer,
          })}
        >
          <Form.Item name="username" label={t('login.username')} rules={[{ required: true, message: t('login.username') }]}>
            <Input prefix={<UserOutlined />} placeholder={t('login.username')} />
          </Form.Item>
          <Form.Item name="password" label={t('login.password')} rules={[{ required: true, message: t('login.password') }]}>
            <Input.Password prefix={<LockOutlined />} placeholder={t('login.password')} />
          </Form.Item>
          {captchaEnabled ? (
            <>
              <Form.Item label={locale === 'zh-CN' ? '验证码' : 'Captcha'} required>
                <Space.Compact style={{ width: '100%' }}>
                  <Input value={captchaQuery.data?.question ?? ''} readOnly />
                  <Button onClick={() => captchaQuery.refetch()} loading={captchaQuery.isFetching}>
                    {locale === 'zh-CN' ? '刷新' : 'Refresh'}
                  </Button>
                </Space.Compact>
              </Form.Item>
              <Form.Item
                name="captchaAnswer"
                label={locale === 'zh-CN' ? '验证码答案' : 'Captcha answer'}
                rules={[{ required: true, message: locale === 'zh-CN' ? '请输入验证码答案' : 'Please enter the captcha answer.' }]}
              >
                <Input placeholder={locale === 'zh-CN' ? '输入结果' : 'Enter the result'} />
              </Form.Item>
            </>
          ) : null}
          <Button type="primary" htmlType="submit" block loading={loginMutation.isPending}>
            {t('login.submit')}
          </Button>
        </Form>

        <Typography.Paragraph style={{ marginTop: 18, marginBottom: 0 }}>
          {t('login.noAccount')} <Link to="/register">{t('login.create')}</Link>
        </Typography.Paragraph>
      </Card>
    </div>
  );
}
