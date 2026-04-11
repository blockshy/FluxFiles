import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Form, Input, Space, Typography, message } from 'antd';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { fetchCaptcha, fetchRegisterConfig, loginUser } from '../api/user';
import { LocaleToggle } from '../features/i18n/LocaleToggle';
import { useI18n } from '../features/i18n/LocaleProvider';
import { ThemeToggle } from '../features/theme/ThemeToggle';
import { useUserAuth } from '../features/user/AuthProvider';
import { getApiErrorMessage } from '../lib/apiError';

export function UserLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [messageApi, contextHolder] = message.useMessage();
  const { login } = useUserAuth();
  const { t, locale } = useI18n();
  const [form] = Form.useForm<{ username: string; password: string; captchaAnswer?: string }>();

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
    mutationFn: async ({ username, password, captchaAnswer }: { username: string; password: string; captchaAnswer?: string }) => {
      const config = await queryClient.fetchQuery({
        queryKey: ['register-config'],
        queryFn: fetchRegisterConfig,
      });
      const captchaEnabled = config.captcha.loginEnabled === true;
      let captchaId: string | undefined;

      if (captchaEnabled) {
        const answer = captchaAnswer?.trim();
        if (!answer) {
          await queryClient.fetchQuery({
            queryKey: ['auth-captcha', 'login', true],
            queryFn: fetchCaptcha,
          });
          throw new Error(locale === 'zh-CN' ? '当前登录已启用验证码，请先填写验证码。' : 'Login now requires captcha. Please complete the captcha first.');
        }

        const challenge = captchaQuery.data?.id
          ? captchaQuery.data
          : await queryClient.fetchQuery({
            queryKey: ['auth-captcha', 'login', true],
            queryFn: fetchCaptcha,
          });
        captchaId = challenge.id;
      }

      return loginUser(username, password, captchaId, captchaEnabled ? captchaAnswer?.trim() : undefined);
    },
    onSuccess: (payload) => {
      login(payload);
      const target = (location.state as { from?: string } | null)?.from ?? (payload.user.role === 'admin' ? '/admin' : '/me');
      navigate(target, { replace: true });
    },
    onError: (error) => {
      messageApi.error(getApiErrorMessage(error, t('login.error'), locale));
      void authConfigQuery.refetch();
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
        <Typography.Title level={3} className="auth-card-title">
          {t('login.title')}
        </Typography.Title>
        <Typography.Paragraph type="secondary" className="auth-card-subtitle">
          {t('login.subtitle')}
        </Typography.Paragraph>

        <Form
          form={form}
          layout="vertical"
          size="large"
          onFinish={(values) => loginMutation.mutate(values)}
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
                <Space.Compact className="auth-captcha-compact">
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

        <Typography.Paragraph className="auth-card-footer">
          {t('login.noAccount')} <Link to="/register">{t('login.create')}</Link>
        </Typography.Paragraph>
      </Card>
    </div>
  );
}
