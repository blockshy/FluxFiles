import { useQuery } from '@tanstack/react-query';
import { Avatar, Card, Col, Empty, List, Row, Space, Tag, Typography } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import { useParams } from 'react-router-dom';
import { fetchPublicUserProfile } from '../api/user';
import type { FileRecord } from '../api/types';
import { useI18n } from '../features/i18n/LocaleProvider';
import { formatBytes, formatDate } from '../lib/format';

function FileSummaryList({ items }: { items: FileRecord[] }) {
  const { t } = useI18n();

  return (
    <List
      dataSource={items}
      renderItem={(item) => (
        <List.Item>
          <Space direction="vertical" size={4} style={{ width: '100%' }}>
            <Typography.Text strong>{item.name}</Typography.Text>
            <Typography.Text type="secondary">{item.originalName}</Typography.Text>
            <Typography.Text type="secondary">
              {formatBytes(item.size)} / {formatDate(item.createdAt)}
            </Typography.Text>
            <Space wrap>
              {item.category ? <Tag>{item.category}</Tag> : null}
              {(item.tagPaths?.length ? item.tagPaths : item.tags || []).map((tag) => <Tag key={tag}>{tag}</Tag>)}
            </Space>
          </Space>
        </List.Item>
      )}
      locale={{ emptyText: <Empty description={t('profile.emptySection')} /> }}
    />
  );
}

export function PublicUserProfilePage() {
  const { username = '' } = useParams();
  const { t, locale } = useI18n();
  const profileQuery = useQuery({
    queryKey: ['public-user-profile', username],
    queryFn: () => fetchPublicUserProfile(username),
    enabled: Boolean(username),
  });

  const profile = profileQuery.data;

  return (
    <Card className="surface-card" loading={profileQuery.isLoading}>
      {!profile ? (
        <Empty description={t('profile.notFound')} />
      ) : (
        <Space direction="vertical" size={24} style={{ width: '100%' }}>
          <div className="profile-hero">
            <Avatar src={profile.avatarUrl} size={88} icon={<UserOutlined />} />
            <div>
              <Typography.Title level={2} style={{ marginBottom: 4 }}>
                {profile.displayName || profile.username}
              </Typography.Title>
              <Typography.Text type="secondary">@{profile.username}</Typography.Text>
              <div style={{ marginTop: 8 }}>
                <Typography.Text type="secondary">
                  {locale === 'zh-CN' ? '加入时间' : 'Joined'}: {formatDate(profile.createdAt)}
                </Typography.Text>
              </div>
            </div>
          </div>

          {profile.profileVisibility.showBio ? (
            <Card size="small" title={t('profile.bio')}>
              <Typography.Paragraph style={{ marginBottom: 0 }}>
                {profile.bio || '-'}
              </Typography.Paragraph>
            </Card>
          ) : null}

          {profile.profileVisibility.showStats && profile.stats ? (
            <Row gutter={[16, 16]}>
              <Col xs={24} md={12}>
                <Card size="small" title={t('profile.publishedFiles')}>
                  <Typography.Title level={3} style={{ margin: 0 }}>{profile.stats.publishedFiles}</Typography.Title>
                </Card>
              </Col>
              <Col xs={24} md={12}>
                <Card size="small" title={t('profile.favoriteFiles')}>
                  <Typography.Title level={3} style={{ margin: 0 }}>{profile.stats.favorites}</Typography.Title>
                </Card>
              </Col>
            </Row>
          ) : null}

          {profile.profileVisibility.showPublishedFiles ? (
            <Card size="small" title={t('profile.publishedFiles')}>
              <FileSummaryList items={profile.publishedFiles ?? []} />
            </Card>
          ) : null}

          {profile.profileVisibility.showFavorites ? (
            <Card size="small" title={t('profile.favoriteFiles')}>
              <FileSummaryList items={profile.favorites ?? []} />
            </Card>
          ) : null}
        </Space>
      )}
    </Card>
  );
}
