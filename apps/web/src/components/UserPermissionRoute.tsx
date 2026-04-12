import type { ReactNode } from 'react';
import { Button, Result } from 'antd';
import { Link } from 'react-router-dom';
import { useI18n } from '../features/i18n/LocaleProvider';
import { useUserAuth } from '../features/user/AuthProvider';
import { hasPermission } from '../features/user/permissions';

interface UserPermissionRouteProps {
  children: ReactNode;
  permission: string | string[];
}

export function UserPermissionRoute({ children, permission }: UserPermissionRouteProps) {
  const { user } = useUserAuth();
  const { locale } = useI18n();
  const required = Array.isArray(permission) ? permission : [permission];
  const allowed = required.some((item) => hasPermission(user, item));

  if (!allowed) {
    return (
      <Result
        status="403"
        title={locale === 'zh-CN' ? '没有访问权限' : 'Access denied'}
        subTitle={locale === 'zh-CN' ? '当前账号没有使用该前台功能的权限。' : 'This account does not have permission to use this feature.'}
        extra={<Link to="/"><Button type="primary">{locale === 'zh-CN' ? '返回首页' : 'Back home'}</Button></Link>}
      />
    );
  }

  return <>{children}</>;
}
