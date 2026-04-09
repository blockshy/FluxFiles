import type { ReactNode } from 'react';
import { Button, Space } from 'antd';
import { Link } from 'react-router-dom';
import { LocaleToggle } from '../features/i18n/LocaleToggle';
import { useI18n } from '../features/i18n/LocaleProvider';
import { ThemeToggle } from '../features/theme/ThemeToggle';
import { canAccessAdmin, getAdminHomePath } from '../features/user/permissions';
import { useUserAuth } from '../features/user/AuthProvider';

export function PublicLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useUserAuth();
  const { t } = useI18n();

  return (
    <div className="app-shell">
      <header className="shell-header">
        <Link to="/" className="brand-link">
          <div>
            <h1 className="brand-title">{t('public.title')}</h1>
            <p className="brand-subtitle">{t('public.subtitle')}</p>
          </div>
        </Link>

        <Space size={12} wrap>
          <LocaleToggle />
          <ThemeToggle />
          {user ? (
            <>
              <Button type="default">
                <Link to="/me">{user.displayName}</Link>
              </Button>
              {canAccessAdmin(user) ? (
                <Button type="default">
                  <Link to={getAdminHomePath(user)}>{t('nav.admin')}</Link>
                </Button>
              ) : null}
              <Button onClick={logout}>{t('nav.logout')}</Button>
            </>
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
