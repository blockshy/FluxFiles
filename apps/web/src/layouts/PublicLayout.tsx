import type { ReactNode } from 'react';
import { Button, Space } from 'antd';
import { Link } from 'react-router-dom';
import { ThemeToggle } from '../features/theme/ThemeToggle';

export function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <header className="shell-header">
        <div>
          <h1 className="brand-title">FluxFiles</h1>
          <p className="brand-subtitle">文件分发平台</p>
        </div>

        <Space size={12} wrap>
          <ThemeToggle />
          <Button type="default">
            <Link to="/admin/login">管理员入口</Link>
          </Button>
        </Space>
      </header>
      <main className="shell-body">{children}</main>
    </div>
  );
}
