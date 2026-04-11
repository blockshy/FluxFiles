import { Button, Card, Space, Tag, Typography } from 'antd';
import type { FileRecord } from '../../api/types';
import { formatBytes, formatDate } from '../../lib/format';

interface FileDetailCardProps {
  file: FileRecord | null;
  downloading: boolean;
  onDownload: (file: FileRecord) => void;
}

export function FileDetailCard({ file, downloading, onDownload }: FileDetailCardProps) {
  if (!file) {
    return null;
  }

  return (
    <Card
      className="surface-card"
      title={
        <Space direction="vertical" size={2}>
          <Typography.Text strong>{file.name}</Typography.Text>
        </Space>
      }
      extra={
        <Button type="primary" loading={downloading} onClick={() => onDownload(file)}>
          下载文件
        </Button>
      }
    >
      <div className="detail-metadata">
        <div className="detail-item">
          <span className="detail-label">分类</span>
          <span className="detail-value">{file.categoryPath || file.category || '未分类'}</span>
        </div>
        <div className="detail-item">
          <span className="detail-label">标签</span>
          <div className="detail-tag-list">
            {(file.tagPaths || file.tags || []).length > 0 ? (file.tagPaths?.length ? file.tagPaths : file.tags).map((tag) => <Tag key={tag}>{tag}</Tag>) : <Tag>无标签</Tag>}
          </div>
        </div>
        <div className="detail-item">
          <span className="detail-label">上传者</span>
          <span className="detail-value">{file.createdByDisplayName || file.createdByUsername || '-'}</span>
        </div>
        <div className="detail-item">
          <span className="detail-label">上传时间</span>
          <span className="detail-value">{formatDate(file.createdAt)}</span>
        </div>
        <div className="detail-item">
          <span className="detail-label">文件大小</span>
          <span className="detail-value">{formatBytes(file.size)}</span>
        </div>
        <div className="detail-item">
          <span className="detail-label">类型</span>
          <span className="detail-value">{file.mimeType || '-'}</span>
        </div>
        <div className="detail-item detail-item-full">
          <span className="detail-label">原文件名</span>
          <span className="detail-value detail-value-rich">{file.originalName || '-'}</span>
        </div>
        <div className="detail-item detail-item-full">
          <span className="detail-label">描述</span>
          <span className="detail-value detail-value-rich">{file.description || '暂无描述。'}</span>
        </div>
      </div>
    </Card>
  );
}
