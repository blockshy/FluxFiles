import { CloudServerOutlined, LogoutOutlined } from '@ant-design/icons';
import { Button, Layout, Menu, Typography } from 'antd';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../features/admin/AuthProvider';
import { ThemeToggle } from '../features/theme/ThemeToggle';

const { Header, Sider, Content } = Layout;

export function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider width={232} theme="dark">
        <div className="sider-brand">FluxFiles Console</div>
        <Menu
          theme="dark"
          selectedKeys={[location.pathname]}
          items={[
            {
              key: '/admin/files',
              icon: <CloudServerOutlined />,
              label: <Link to="/admin/files">文件管理</Link>,
            },
          ]}
        />
      </Sider>

      <Layout>
        <Header className="admin-header">
          <div className="admin-header-meta">
            <Typography.Title level={4} style={{ margin: 0, lineHeight: 1.2 }}>
              管理后台
            </Typography.Title>
            <Typography.Text type="secondary">已登录管理员：{user?.username ?? '-'}</Typography.Text>
          </div>

          <div className="admin-header-actions">
            <ThemeToggle />
            <Button
              icon={<LogoutOutlined />}
              onClick={() => {
                logout();
                navigate('/admin/login', { replace: true });
              }}
            >
              退出登录
            </Button>
          </div>
        </Header>

        <Content style={{ padding: 24 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
