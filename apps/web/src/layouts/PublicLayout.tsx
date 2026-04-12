import type { ReactNode } from 'react';
import { BellOutlined, DownOutlined, HomeOutlined, InfoCircleOutlined, LogoutOutlined, MessageOutlined, SettingOutlined, UserOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import type { MenuProps } from 'antd';
import { Avatar, Badge, Button, Dropdown, Space, message } from 'antd';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { fetchNotifications } from '../api/user';
import { LocaleToggle } from '../features/i18n/LocaleToggle';
import { useI18n } from '../features/i18n/LocaleProvider';
import { ThemeToggle } from '../features/theme/ThemeToggle';
import { canAccessAdmin, canAccessCommunity, getAdminHomePath, hasPermission, PERMISSION_PUBLIC_NOTIFICATIONS_VIEW } from '../features/user/permissions';
import { useUserAuth } from '../features/user/AuthProvider';
import { withAppBase } from '../lib/base';

export function PublicLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useUserAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const [messageApi, contextHolder] = message.useMessage();
  const notificationsQuery = useQuery({
    queryKey: ['user-notifications-summary'],
    queryFn: () => fetchNotifications(1, 1),
    enabled: Boolean(user) && hasPermission(user, PERMISSION_PUBLIC_NOTIFICATIONS_VIEW),
  });
  const unreadCount = notificationsQuery.data?.unread ?? 0;
  const canViewNotifications = hasPermission(user, PERMISSION_PUBLIC_NOTIFICATIONS_VIEW);
  const brandIconSrc = withAppBase('/favicon.ico');

  const userMenuItems: MenuProps['items'] = user ? [
    ...(canViewNotifications ? [{ key: 'notifications', icon: <BellOutlined />, label: <Badge count={unreadCount} size="small" offset={[10, 0]}>{t('nav.notifications') || '消息通知'}</Badge> }] : []),
    { key: 'profile', icon: <UserOutlined />, label: t('nav.profile') },
    ...(canAccessAdmin(user) ? [{ key: 'admin', icon: <SettingOutlined />, label: t('nav.admin') }] : []),
    { key: 'logout', icon: <LogoutOutlined />, label: t('nav.logout') },
  ] : [];

  function handleUserMenuClick({ key }: { key: string }) {
    if (!user) {
      return;
    }
    if (key === 'notifications') {
      navigate('/notifications');
      return;
    }
    if (key === 'profile') {
      navigate('/me');
      return;
    }
    if (key === 'admin') {
      navigate(getAdminHomePath(user));
      return;
    }
    if (key === 'logout') {
      logout();
      navigate('/');
    }
  }

  return (
    <>
      {contextHolder}
      <div className="app-shell">
        <header className="shell-header">
          <div className="shell-header-left">
            <Link to="/" className="brand-link">
              <img src={brandIconSrc} alt="" className="brand-mark" />
              <div className="brand-copy">
                <h1 className="brand-title">{t('public.title')}</h1>
              </div>
            </Link>
            <nav className="shell-nav" aria-label="Primary">
              <Link to="/" className={`shell-nav-link${location.pathname === '/' ? ' active' : ''}`}>
                <HomeOutlined />
                <span>{t('nav.home')}</span>
              </Link>
              {user && canAccessCommunity(user) ? (
                <Link to="/community" className={`shell-nav-link${location.pathname.startsWith('/community') ? ' active' : ''}`}>
                  <MessageOutlined />
                  <span>社区</span>
                </Link>
              ) : (
                <button
                  type="button"
                  className="shell-nav-link shell-nav-button"
                  onClick={() => {
                    if (!user) {
                      messageApi.warning('请先登录后再进入社区。');
                      return;
                    }
                    messageApi.warning('当前账号没有社区访问权限。');
                  }}
                >
                  <MessageOutlined />
                  <span>社区</span>
                </button>
              )}
              <Link to="/about" className={`shell-nav-link${location.pathname === '/about' ? ' active' : ''}`}>
                <InfoCircleOutlined />
                <span>关于本站</span>
              </Link>
            </nav>
          </div>

          <Space size={12} wrap>
            <LocaleToggle />
            <ThemeToggle />
            {user ? (
              <Dropdown menu={{ items: userMenuItems, onClick: handleUserMenuClick }} trigger={['click']} placement="bottomRight">
                <button type="button" className="user-menu-trigger">
                  <Badge count={unreadCount} size="small">
                    <Avatar src={user.avatarUrl} size={36} icon={<UserOutlined />} />
                  </Badge>
                  <span className="user-menu-name">{user.displayName || user.username}</span>
                  <DownOutlined />
                </button>
              </Dropdown>
            ) : (
              <div className="shell-auth-actions">
                <Link to="/login" className="shell-auth-link">
                  <Button type="default">{t('nav.login')}</Button>
                </Link>
                <Link to="/register" className="shell-auth-link">
                  <Button type="default">{t('nav.register')}</Button>
                </Link>
              </div>
            )}
          </Space>
        </header>
        <main className="shell-body">{children}</main>
      </div>
    </>
  );
}
