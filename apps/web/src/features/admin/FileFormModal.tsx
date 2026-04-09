import { InboxOutlined } from '@ant-design/icons';
import { Form, Input, Modal, Select, Switch, Upload } from 'antd';
import type { UploadFile } from 'antd/es/upload/interface';
import { useEffect, useState } from 'react';
import type { FileRecord, UpdateFilePayload } from '../../api/types';

interface SubmitPayload {
  file?: File;
  name: string;
  description: string;
  category: string;
  tags: string[];
  isPublic: boolean;
}

interface FileFormModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  initialValue?: FileRecord | null;
  loading: boolean;
  onCancel: () => void;
  onSubmit: (payload: SubmitPayload) => Promise<void>;
}

export function FileFormModal({
  open,
  mode,
  initialValue,
  loading,
  onCancel,
  onSubmit,
}: FileFormModalProps) {
  const [form] = Form.useForm<UpdateFilePayload>();
  const [fileList, setFileList] = useState<UploadFile[]>([]);

  useEffect(() => {
    if (!open) {
      form.resetFields();
      setFileList([]);
      return;
    }

    if (mode === 'edit' && initialValue) {
      form.setFieldsValue({
        name: initialValue.name,
        description: initialValue.description,
        category: initialValue.category,
        tags: initialValue.tags,
        isPublic: initialValue.isPublic,
      });
    } else {
      form.setFieldsValue({
        name: '',
        description: '',
        category: '',
        tags: [],
        isPublic: true,
      });
    }
  }, [form, initialValue, mode, open]);

  return (
    <Modal
      open={open}
      title={mode === 'create' ? '上传文件' : '编辑文件'}
      okText={mode === 'create' ? '上传' : '保存'}
      cancelText="取消"
      confirmLoading={loading}
      width={680}
      onCancel={onCancel}
      onOk={async () => {
        const values = await form.validateFields();
        await onSubmit({
          ...values,
          file: fileList[0]?.originFileObj as File | undefined,
        });
      }}
    >
      <Form form={form} layout="vertical">
        {mode === 'create' ? (
          <Form.Item
            label="上传文件"
            required
            tooltip="文件将直接上传到阿里云 OSS，不会落地到本地磁盘。"
          >
            <Upload.Dragger
              beforeUpload={() => false}
              maxCount={1}
              fileList={fileList}
              onChange={({ fileList: nextList }) => setFileList(nextList)}
            >
              <p className="ant-upload-drag-icon">
                <InboxOutlined />
              </p>
              <p className="ant-upload-text">点击或拖拽文件到此处上传</p>
              <p className="ant-upload-hint">支持白名单内的文档、压缩包、图片与媒体文件。</p>
            </Upload.Dragger>
          </Form.Item>
        ) : null}

        <Form.Item name="name" label="展示名称" rules={[{ required: true, message: '请输入展示名称' }]}>
          <Input placeholder="例如：产品手册 2026 版" />
        </Form.Item>

        <Form.Item name="description" label="文件描述">
          <Input.TextArea rows={4} placeholder="补充说明文件内容、使用方式或版本信息。" />
        </Form.Item>

        <Form.Item name="category" label="分类">
          <Input placeholder="例如：产品资料 / 客户端 / 设计资源" />
        </Form.Item>

        <Form.Item name="tags" label="标签">
          <Select mode="tags" tokenSeparators={[',']} placeholder="输入后回车，可添加多个标签" />
        </Form.Item>

        <Form.Item name="isPublic" label="是否公开展示" valuePropName="checked">
          <Switch checkedChildren="公开" unCheckedChildren="隐藏" />
        </Form.Item>
      </Form>
    </Modal>
  );
}

