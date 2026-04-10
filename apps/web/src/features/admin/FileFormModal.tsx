import { InboxOutlined } from '@ant-design/icons';
import { Alert, Form, Input, Modal, Skeleton, Switch, TreeSelect, Upload } from 'antd';
import type { UploadFile } from 'antd/es/upload/interface';
import { useEffect, useMemo, useState } from 'react';
import type { FileRecord, UpdateFilePayload, UploadSettings } from '../../api/types';
import { useI18n } from '../i18n/LocaleProvider';

interface SubmitPayload {
  file?: File;
  name: string;
  description: string;
  category: string;
  tags: string[];
  isPublic: boolean;
}

interface TreeOptionNode {
  title: string;
  value: string;
  selectable?: boolean;
  disabled?: boolean;
  children?: TreeOptionNode[];
}

interface FileFormModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  initialValue?: FileRecord | null;
  loading: boolean;
  uploadSettings?: UploadSettings;
  taxonomyLoading: boolean;
  categoryTreeData: TreeOptionNode[];
  tagTreeData: TreeOptionNode[];
  onCancel: () => void;
  onSubmit: (payload: SubmitPayload) => Promise<void>;
}

function normalizeFileNameExtension(name: string) {
  const index = name.lastIndexOf('.');
  if (index < 0) {
    return '';
  }
  return name.slice(index).toLowerCase();
}

export function FileFormModal({ open, mode, initialValue, loading, uploadSettings, taxonomyLoading, categoryTreeData, tagTreeData, onCancel, onSubmit }: FileFormModalProps) {
  const [form] = Form.useForm<UpdateFilePayload>();
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const { locale, t } = useI18n();

  useEffect(() => {
    if (!open) {
      form.resetFields();
      setFileList([]);
      setFileError(null);
      return;
    }
    if (mode === 'edit' && initialValue) {
      form.setFieldsValue({ name: initialValue.name, description: initialValue.description, category: initialValue.category, tags: initialValue.tags, isPublic: initialValue.isPublic });
    } else {
      form.setFieldsValue({ name: '', description: '', category: '', tags: [], isPublic: true });
    }
  }, [form, initialValue, mode, open]);

  const acceptedTypes = useMemo(() => {
    if (!uploadSettings?.restrictFileTypes || uploadSettings.allowedExtensions.length === 0) {
      return undefined;
    }
    return uploadSettings.allowedExtensions.join(',');
  }, [uploadSettings]);

  const uploadHint = useMemo(() => {
    if (!uploadSettings) {
      return null;
    }
    const parts: string[] = [];
    if (uploadSettings.restrictFileSize && uploadSettings.maxSizeBytes > 0) {
      parts.push(locale === 'zh-CN' ? `最大大小：${Math.round(uploadSettings.maxSizeBytes / 1024 / 1024)} MB` : `Max size: ${Math.round(uploadSettings.maxSizeBytes / 1024 / 1024)} MB`);
    } else {
      parts.push(locale === 'zh-CN' ? '文件大小：不限' : 'File size: unlimited');
    }
    if (uploadSettings.restrictFileTypes && uploadSettings.allowedExtensions.length > 0) {
      parts.push(`${locale === 'zh-CN' ? '允许后缀' : 'Allowed extensions'}: ${uploadSettings.allowedExtensions.join(', ')}`);
    } else {
      parts.push(locale === 'zh-CN' ? '文件类型：不限' : 'File types: unrestricted');
    }
    return parts.join(' | ');
  }, [locale, uploadSettings]);

  function validateSelectedFile(file: File) {
    if (uploadSettings?.restrictFileSize && uploadSettings.maxSizeBytes > 0 && file.size > uploadSettings.maxSizeBytes) {
      return locale === 'zh-CN' ? '文件大小超出当前系统限制。' : 'The file exceeds the current size limit.';
    }
    if (uploadSettings?.restrictFileTypes && uploadSettings.allowedExtensions.length > 0) {
      const extension = normalizeFileNameExtension(file.name);
      if (!uploadSettings.allowedExtensions.includes(extension)) {
        return locale === 'zh-CN' ? '当前文件类型不在允许列表中。' : 'This file type is not allowed.';
      }
    }
    return null;
  }

  return (
    <Modal
      open={open}
      title={mode === 'create' ? t('files.upload') : t('files.edit')}
      okText={mode === 'create' ? t('files.upload') : t('common.save')}
      cancelText={t('common.cancel')}
      confirmLoading={loading}
      width={680}
      onCancel={onCancel}
      onOk={async () => {
        const values = await form.validateFields();
        await onSubmit({ ...values, file: fileList[0]?.originFileObj as File | undefined });
      }}
    >
      <Form form={form} layout="vertical">
        {mode === 'create' ? (
          <Form.Item
            label={locale === 'zh-CN' ? '上传文件' : 'Upload file'}
            required
            tooltip={locale === 'zh-CN' ? '文件将直接上传到 OSS，不会落到本地磁盘。' : 'The file is uploaded directly to OSS.'}
          >
            <Upload.Dragger
              beforeUpload={(file) => {
                const error = validateSelectedFile(file);
                setFileError(error);
                if (error) {
                  return Upload.LIST_IGNORE;
                }
                setFileList([file]);
                return false;
              }}
              accept={acceptedTypes}
              maxCount={1}
              fileList={fileList}
              onRemove={() => {
                setFileError(null);
                setFileList([]);
              }}
              onChange={({ fileList: nextList }) => setFileList(nextList)}
            >
              <p className="ant-upload-drag-icon"><InboxOutlined /></p>
              <p className="ant-upload-text">{locale === 'zh-CN' ? '点击或拖拽文件到此处上传' : 'Click or drag file to upload'}</p>
              {uploadHint ? <p className="ant-upload-hint">{uploadHint}</p> : null}
            </Upload.Dragger>
            {fileError ? <Alert style={{ marginTop: 12 }} type="error" showIcon message={fileError} /> : null}
          </Form.Item>
        ) : null}

        <Form.Item name="name" label={locale === 'zh-CN' ? '显示名称' : 'Display name'} rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item name="description" label={locale === 'zh-CN' ? '文件描述' : 'Description'}>
          <Input.TextArea rows={4} />
        </Form.Item>
        {taxonomyLoading ? (
          <div className="inline-loading-block">
            <Skeleton active paragraph={{ rows: 3 }} />
          </div>
        ) : (
          <>
            <Form.Item name="category" label={locale === 'zh-CN' ? '分类' : 'Category'}>
              <TreeSelect
                allowClear
                showSearch
                treeDefaultExpandAll
                treeNodeFilterProp="title"
                treeData={categoryTreeData}
                placeholder={locale === 'zh-CN' ? '请选择分类' : 'Select a category'}
              />
            </Form.Item>
            <Form.Item name="tags" label={locale === 'zh-CN' ? '标签' : 'Tags'}>
              <TreeSelect
                multiple
                treeCheckable
                showSearch
                treeDefaultExpandAll
                showCheckedStrategy={TreeSelect.SHOW_CHILD}
                treeNodeFilterProp="title"
                treeData={tagTreeData}
                placeholder={locale === 'zh-CN' ? '请选择标签' : 'Select tags'}
              />
            </Form.Item>
          </>
        )}
        <Form.Item name="isPublic" label={locale === 'zh-CN' ? '公开展示' : 'Public'} valuePropName="checked">
          <Switch checkedChildren={t('common.on')} unCheckedChildren={t('common.off')} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
