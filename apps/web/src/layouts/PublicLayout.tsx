import type { ReactNode } from 'react';
import { BellOutlined, DownOutlined, HomeOutlined, LogoutOutlined, SettingOutlined, UserOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import type { MenuProps } from 'antd';
import { Avatar, Badge, Button, Dropdown, Space } from 'antd';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { fetchNotifications } from '../api/user';
import { LocaleToggle } from '../features/i18n/LocaleToggle';
import { useI18n } from '../features/i18n/LocaleProvider';
import { ThemeToggle } from '../features/theme/ThemeToggle';
import { canAccessAdmin, getAdminHomePath } from '../features/user/permissions';
import { useUserAuth } from '../features/user/AuthProvider';

export function PublicLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useUserAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const notificationsQuery = useQuery({
    queryKey: ['user-notifications-summary'],
    queryFn: () => fetchNotifications(1, 1),
    enabled: Boolean(user),
  });
  const unreadCount = notificationsQuery.data?.unread ?? 0;

  const userMenuItems: MenuProps['items'] = user ? [
    { key: 'notifications', icon: <BellOutlined />, label: <Badge count={unreadCount} size="small" offset={[10, 0]}>{t('nav.notifications') || '消息通知'}</Badge> },
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
    <div className="app-shell">
      <header className="shell-header">
        <div className="shell-header-left">
          <Link to="/" className="brand-link">
            <div>
              <h1 className="brand-title">{t('public.title')}</h1>
              <p className="brand-subtitle">{t('public.subtitle')}</p>
            </div>
          </Link>
          <nav className="shell-nav" aria-label="Primary">
            <Link to="/" className={`shell-nav-link${location.pathname === '/' ? ' active' : ''}`}>
              <HomeOutlined />
              <span>{t('nav.home')}</span>
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
            <>
              <Button type="default">
                <Link to="/login">{t('nav.login')}</Link>
              </Button>
              <Button type="default">
                <Link to="/register">{t('nav.register')}</Link>
              </Button>
            </>
          )}
        </Space>
      </header>
      <main className="shell-body">{children}</main>
    </div>
  );
}
