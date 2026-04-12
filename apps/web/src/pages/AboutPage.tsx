import { useQuery } from '@tanstack/react-query';
import { Card, Empty, Skeleton, Typography } from 'antd';
import { fetchPublicSiteContent } from '../api/files';
import { useI18n } from '../features/i18n/LocaleProvider';

export function AboutPage() {
  const { locale } = useI18n();
  const siteContentQuery = useQuery({
    queryKey: ['public-site-content'],
    queryFn: fetchPublicSiteContent,
  });

  return (
    <Card className="surface-card about-page-card">
      <div className="toolbar-row">
        <div>
          <h2 className="section-title">{locale === 'zh-CN' ? '关于本站' : 'About this site'}</h2>
          <p className="section-subtitle">
            {locale === 'zh-CN' ? '这里展示站点介绍、使用说明或其他需要公开说明的内容。' : 'This page shows public information about the site.'}
          </p>
        </div>
      </div>

      {siteContentQuery.isLoading ? (
        <Skeleton active paragraph={{ rows: 10 }} />
      ) : siteContentQuery.data?.aboutHtml ? (
        <div className="about-page-content" dangerouslySetInnerHTML={{ __html: siteContentQuery.data.aboutHtml }} />
      ) : (
        <Empty description={locale === 'zh-CN' ? '站点介绍暂未设置' : 'No site information yet'} />
      )}
    </Card>
  );
}
