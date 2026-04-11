import { CloudServerOutlined, DownloadOutlined, FileSearchOutlined, FolderOpenOutlined, HomeOutlined, LogoutOutlined, MessageOutlined, SettingOutlined, TagsOutlined, TeamOutlined } from '@ant-design/icons';
import { Avatar, Button, Layout, Menu, Typography } from 'antd';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LocaleToggle } from '../features/i18n/LocaleToggle';
import { useI18n } from '../features/i18n/LocaleProvider';
import { useThemeMode } from '../features/theme/ThemeProvider';
import { ThemeToggle } from '../features/theme/ThemeToggle';
import {
  PERMISSION_ADMIN_AUDIT,
  PERMISSION_ADMIN_FILES_ALL,
  PERMISSION_ADMIN_FILES_OWN,
  PERMISSION_ADMIN_FILES_UPLOAD,
  PERMISSION_ADMIN_FILES_EDIT,
  PERMISSION_ADMIN_FILES_DELETE,
  PERMISSION_ADMIN_DOWNLOADS_VIEW,
  PERMISSION_ADMIN_SETTINGS,
  PERMISSION_ADMIN_USERS_CREATE,
  PERMISSION_ADMIN_USERS_EDIT,
  PERMISSION_ADMIN_CATEGORIES_VIEW,
  PERMISSION_ADMIN_CATEGORIES_CREATE,
  PERMISSION_ADMIN_CATEGORIES_EDIT,
  PERMISSION_ADMIN_CATEGORIES_DELETE,
  PERMISSION_ADMIN_CATEGORIES_LOGS,
  PERMISSION_ADMIN_TAGS_VIEW,
  PERMISSION_ADMIN_TAGS_CREATE,
  PERMISSION_ADMIN_TAGS_EDIT,
  PERMISSION_ADMIN_TAGS_DELETE,
  PERMISSION_ADMIN_TAGS_LOGS,
  PERMISSION_ADMIN_COMMUNITY_VIEW,
  PERMISSION_ADMIN_COMMUNITY_MODERATE,
  hasPermission,
} from '../features/user/permissions';
import { useUserAuth } from '../features/user/AuthProvider';

const { Header, Sider, Content } = Layout;

export function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useUserAuth();
  const { t, locale } = useI18n();
  const { themeMode } = useThemeMode();

  const items = [];
  if (
    hasPermission(user, PERMISSION_ADMIN_FILES_OWN) ||
    hasPermission(user, PERMISSION_ADMIN_FILES_ALL) ||
    hasPermission(user, PERMISSION_ADMIN_FILES_UPLOAD) ||
    hasPermission(user, PERMISSION_ADMIN_FILES_EDIT) ||
    hasPermission(user, PERMISSION_ADMIN_FILES_DELETE)
  ) {
    items.push({ key: '/admin/files', icon: <CloudServerOutlined />, label: <Link to="/admin/files">{t('admin.files')}</Link> });
  }
  if (hasPermission(user, PERMISSION_ADMIN_DOWNLOADS_VIEW)) {
    items.push({ key: '/admin/downloads', icon: <DownloadOutlined />, label: <Link to="/admin/downloads">{locale === 'zh-CN' ? '下载记录' : 'Downloads'}</Link> });
  }
  if (hasPermission(user, PERMISSION_ADMIN_USERS_CREATE) || hasPermission(user, PERMISSION_ADMIN_USERS_EDIT)) {
    items.push({ key: '/admin/users', icon: <TeamOutlined />, label: <Link to="/admin/users">{t('admin.users')}</Link> });
  }
  if (
    hasPermission(user, PERMISSION_ADMIN_CATEGORIES_VIEW) ||
    hasPermission(user, PERMISSION_ADMIN_CATEGORIES_CREATE) ||
    hasPermission(user, PERMISSION_ADMIN_CATEGORIES_EDIT) ||
    hasPermission(user, PERMISSION_ADMIN_CATEGORIES_DELETE) ||
    hasPermission(user, PERMISSION_ADMIN_CATEGORIES_LOGS)
  ) {
    items.push({ key: '/admin/categories', icon: <FolderOpenOutlined />, label: <Link to="/admin/categories">{t('admin.categories')}</Link> });
  }
  if (
    hasPermission(user, PERMISSION_ADMIN_TAGS_VIEW) ||
    hasPermission(user, PERMISSION_ADMIN_TAGS_CREATE) ||
    hasPermission(user, PERMISSION_ADMIN_TAGS_EDIT) ||
    hasPermission(user, PERMISSION_ADMIN_TAGS_DELETE) ||
    hasPermission(user, PERMISSION_ADMIN_TAGS_LOGS)
  ) {
    items.push({ key: '/admin/tags', icon: <TagsOutlined />, label: <Link to="/admin/tags">{t('admin.tags')}</Link> });
  }
  if (hasPermission(user, PERMISSION_ADMIN_COMMUNITY_VIEW) || hasPermission(user, PERMISSION_ADMIN_COMMUNITY_MODERATE)) {
    items.push({ key: '/admin/community', icon: <MessageOutlined />, label: <Link to="/admin/community">{locale === 'zh-CN' ? '社区管理' : 'Community'}</Link> });
  }
  if (hasPermission(user, PERMISSION_ADMIN_SETTINGS)) {
    items.push({ key: '/admin/settings', icon: <SettingOutlined />, label: <Link to="/admin/settings">{t('admin.settings')}</Link> });
  }
  if (hasPermission(user, PERMISSION_ADMIN_AUDIT)) {
    items.push({ key: '/admin/logs', icon: <FileSearchOutlined />, label: <Link to="/admin/logs">{t('admin.logs')}</Link> });
  }

  return (
    <Layout className="admin-shell">
      <Sider width={248} theme={themeMode} className={`admin-sider admin-sider-${themeMode}`}>
        <div className="sider-brand">
          <div>
            <div className="sider-brand-title">FluxFiles</div>
            <div className="sider-brand-subtitle">Console</div>
          </div>
        </div>
        <Menu theme={themeMode} selectedKeys={[location.pathname]} items={items} />
      </Sider>

      <Layout className="admin-main-shell">
        <Header className="admin-header">
          <div className="admin-header-meta">
            <Typography.Title level={4} className="admin-header-title">
              {t('admin.console')}
            </Typography.Title>
            <Typography.Text type="secondary">
              {t('admin.signedInAs')}: {user?.username ?? '-'}
            </Typography.Text>
          </div>

          <div className="admin-header-actions">
            <LocaleToggle />
            <ThemeToggle />
            <div className="admin-user-chip">
              <Avatar src={user?.avatarUrl} size={34}>
                {(user?.displayName || user?.username || 'A').slice(0, 1).toUpperCase()}
              </Avatar>
              <div className="admin-user-chip-copy">
                <span>{user?.displayName || user?.username || '-'}</span>
                <span>{user?.username || '-'}</span>
              </div>
            </div>
            <Button icon={<HomeOutlined />} onClick={() => navigate('/')}>
              {locale === 'zh-CN' ? '返回首页' : 'Back to home'}
            </Button>
            <Button
              icon={<LogoutOutlined />}
              onClick={() => {
                logout();
                navigate('/login', { replace: true });
              }}
            >
              {t('nav.logout')}
            </Button>
          </div>
        </Header>

        <Content className="admin-content">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
