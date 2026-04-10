import { Button, Card, Empty, Space, Tag, Typography } from 'antd';
import type { FileRecord } from '../../api/types';
import { formatBytes, formatDate } from '../../lib/format';

interface FileDetailCardProps {
  file: FileRecord | null;
  downloading: boolean;
  onDownload: (file: FileRecord) => void;
}

export function FileDetailCard({ file, downloading, onDownload }: FileDetailCardProps) {
  if (!file) {
    return (
      <Card className="surface-card">
        <Empty description="请选择一个文件查看详情" />
      </Card>
    );
  }

  return (
    <Card
      className="surface-card"
      title={
        <Space direction="vertical" size={2}>
          <Typography.Text strong>{file.name}</Typography.Text>
          <Typography.Text type="secondary">{file.originalName}</Typography.Text>
        </Space>
      }
      extra={
        <Button type="primary" loading={downloading} onClick={() => onDownload(file)}>
          下载文件
        </Button>
      }
    >
      <Typography.Paragraph style={{ color: '#4b5563', minHeight: 66 }}>
        {file.description || '暂无描述。'}
      </Typography.Paragraph>

      <div className="detail-metadata">
        <div className="detail-item">
          <span className="detail-label">文件大小</span>
          <span className="detail-value">{formatBytes(file.size)}</span>
        </div>
        <div className="detail-item">
          <span className="detail-label">下载次数</span>
          <span className="detail-value">{file.downloadCount}</span>
        </div>
        <div className="detail-item">
          <span className="detail-label">分类</span>
          <span className="detail-value">{file.categoryPath || file.category || '未分类'}</span>
        </div>
        <div className="detail-item">
          <span className="detail-label">上传时间</span>
          <span className="detail-value">{formatDate(file.createdAt)}</span>
        </div>
      </div>

      <Space wrap size={[8, 8]}>
        {(file.tagPaths || file.tags || []).length > 0 ? (file.tagPaths?.length ? file.tagPaths : file.tags).map((tag) => <Tag key={tag}>{tag}</Tag>) : <Tag>无标签</Tag>}
      </Space>
    </Card>
  );
}
