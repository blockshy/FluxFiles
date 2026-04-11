import type { ReactNode } from 'react';
import { Button, Result } from 'antd';
import { Link } from 'react-router-dom';
import { useUserAuth } from '../features/user/AuthProvider';
import { hasPermission } from '../features/user/permissions';

interface UserPermissionRouteProps {
  children: ReactNode;
  permission: string | string[];
}

export function UserPermissionRoute({ children, permission }: UserPermissionRouteProps) {
  const { user } = useUserAuth();
  const required = Array.isArray(permission) ? permission : [permission];
  const allowed = required.some((item) => hasPermission(user, item));

  if (!allowed) {
    return (
      <Result
        status="403"
        title="没有访问权限"
        subTitle="当前账号没有使用该前台功能的权限。"
        extra={<Link to="/"><Button type="primary">返回首页</Button></Link>}
      />
    );
  }

  return <>{children}</>;
}
