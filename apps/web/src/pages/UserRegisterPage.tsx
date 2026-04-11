import { LockOutlined, MailOutlined, UserOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Card, Form, Input, Space, Typography, message } from 'antd';
import { Link, useNavigate } from 'react-router-dom';
import { fetchCaptcha, fetchRegisterConfig, registerUser } from '../api/user';
import { LocaleToggle } from '../features/i18n/LocaleToggle';
import { useI18n } from '../features/i18n/LocaleProvider';
import { ThemeToggle } from '../features/theme/ThemeToggle';
import { getApiErrorMessage } from '../lib/apiError';

export function UserRegisterPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [messageApi, contextHolder] = message.useMessage();
  const { t, locale } = useI18n();
  const [form] = Form.useForm<{ username: string; email: string; displayName: string; password: string; captchaAnswer?: string }>();

  const registerConfigQuery = useQuery({
    queryKey: ['register-config'],
    queryFn: fetchRegisterConfig,
  });

  const captchaQuery = useQuery({
    queryKey: ['auth-captcha', 'register', registerConfigQuery.data?.captcha.registrationEnabled],
    queryFn: fetchCaptcha,
    enabled: registerConfigQuery.data?.captcha.registrationEnabled === true,
  });

  const registerMutation = useMutation({
    mutationFn: async (values: { username: string; email: string; displayName: string; password: string; captchaAnswer?: string }) => {
      const config = await queryClient.fetchQuery({
        queryKey: ['register-config'],
        queryFn: fetchRegisterConfig,
      });
      if (config.registrationEnabled === false) {
        throw new Error('registration is currently disabled');
      }

      const captchaEnabled = config.captcha.registrationEnabled === true;
      let captchaId: string | undefined;
      if (captchaEnabled) {
        const answer = values.captchaAnswer?.trim();
        if (!answer) {
          await queryClient.fetchQuery({
            queryKey: ['auth-captcha', 'register', true],
            queryFn: fetchCaptcha,
          });
          throw new Error(locale === 'zh-CN' ? '当前注册已启用验证码，请先填写验证码。' : 'Registration now requires captcha. Please complete the captcha first.');
        }

        const challenge = captchaQuery.data?.id
          ? captchaQuery.data
          : await queryClient.fetchQuery({
            queryKey: ['auth-captcha', 'register', true],
            queryFn: fetchCaptcha,
          });
        captchaId = challenge.id;
      }

      return registerUser({
        username: values.username,
        email: values.email,
        displayName: values.displayName,
        password: values.password,
        captchaId,
        captchaAnswer: captchaEnabled ? values.captchaAnswer?.trim() : undefined,
      });
    },
    onSuccess: () => {
      messageApi.success(t('register.success'));
      navigate('/login', { replace: true });
    },
    onError: (error) => {
      messageApi.error(getApiErrorMessage(error, t('register.error'), locale));
      void registerConfigQuery.refetch();
      void captchaQuery.refetch();
    },
  });

  const registrationDisabled = registerConfigQuery.data?.registrationEnabled === false;
  const captchaEnabled = registerConfigQuery.data?.captcha.registrationEnabled === true;

  return (
    <div className="login-shell">
      {contextHolder}
      <div className="login-toolbar">
        <LocaleToggle />
        <ThemeToggle />
      </div>
      <Card className="surface-card login-card">
        <Typography.Title level={3} className="auth-card-title">
          {t('register.title')}
        </Typography.Title>
        <Typography.Paragraph type="secondary" className="auth-card-subtitle">
          {t('register.subtitle')}
        </Typography.Paragraph>

        {registrationDisabled ? (
          <Alert className="auth-state-alert" type="warning" showIcon message={t('register.closedTitle')} description={t('register.closedDesc')} />
        ) : null}

        <Form
          form={form}
          layout="vertical"
          size="large"
          disabled={registrationDisabled}
          onFinish={(values) => registerMutation.mutate(values)}
        >
          <Form.Item
            name="username"
            label={t('register.username')}
            rules={[
              { required: true, message: t('register.username') },
              { min: 3, message: locale === 'zh-CN' ? '用户名至少 3 个字符' : 'Username must be at least 3 characters.' },
              { max: 64, message: locale === 'zh-CN' ? '用户名不能超过 64 个字符' : 'Username must be at most 64 characters.' },
            ]}
          >
            <Input prefix={<UserOutlined />} placeholder={t('register.username')} />
          </Form.Item>
          <Form.Item
            name="displayName"
            label={t('register.displayName')}
            rules={[
              { required: true, message: t('register.displayName') },
              { max: 128, message: locale === 'zh-CN' ? '昵称不能超过 128 个字符' : 'Nickname must be at most 128 characters.' },
            ]}
          >
            <Input prefix={<UserOutlined />} placeholder={t('register.displayName')} />
          </Form.Item>
          <Form.Item
            name="email"
            label={t('register.email')}
            rules={[
              { required: true, message: t('register.email') },
              { type: 'email', message: locale === 'zh-CN' ? '请输入有效邮箱地址' : 'Please enter a valid email address.' },
              { max: 128, message: locale === 'zh-CN' ? '邮箱不能超过 128 个字符' : 'Email must be at most 128 characters.' },
            ]}
          >
            <Input prefix={<MailOutlined />} placeholder={t('register.email')} />
          </Form.Item>
          <Form.Item
            name="password"
            label={t('register.password')}
            rules={[
              { required: true, message: t('register.password') },
              { min: 8, message: locale === 'zh-CN' ? '密码至少 8 位' : 'Password must be at least 8 characters.' },
              { max: 128, message: locale === 'zh-CN' ? '密码不能超过 128 位' : 'Password must be at most 128 characters.' },
            ]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder={t('register.password')} />
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
          <Button type="primary" htmlType="submit" block loading={registerMutation.isPending} disabled={registrationDisabled}>
            {t('register.submit')}
          </Button>
        </Form>

        <Typography.Paragraph className="auth-card-footer">
          {t('register.hasAccount')} <Link to="/login">{t('register.goLogin')}</Link>
        </Typography.Paragraph>
      </Card>
    </div>
  );
}
