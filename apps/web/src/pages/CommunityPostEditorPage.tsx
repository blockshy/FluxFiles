import { CloseOutlined, SaveOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Form, Input, Skeleton, Space, message } from 'antd';
import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { createCommunityPost, fetchCommunityPost, updateCommunityPost } from '../api/community';
import { RichTextEditor } from '../components/RichTextEditor';
import { useI18n } from '../features/i18n/LocaleProvider';
import { getApiErrorMessage } from '../lib/apiError';

interface EditorFormValues {
  title: string;
  contentHtml: string;
}

export function CommunityPostEditorPage() {
  const [form] = Form.useForm<EditorFormValues>();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { id } = useParams();
  const postId = Number(id);
  const isEdit = Number.isFinite(postId) && postId > 0;
  const [messageApi, contextHolder] = message.useMessage();
  const { locale } = useI18n();
  const contentHtmlValue = Form.useWatch('contentHtml', form) ?? '';

  const postQuery = useQuery({
    queryKey: ['community-post', postId, 'edit'],
    queryFn: () => fetchCommunityPost(postId),
    enabled: isEdit,
  });

  useEffect(() => {
    if (!postQuery.data) {
      return;
    }
    form.setFieldsValue({
      title: postQuery.data.title,
      contentHtml: postQuery.data.contentHtml,
    });
  }, [form, postQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async (values: EditorFormValues) => (
      isEdit ? updateCommunityPost(postId, values) : createCommunityPost(values)
    ),
    onSuccess: async (item) => {
      messageApi.success(locale === 'zh-CN' ? '帖子已保存。' : 'Post saved.');
      await queryClient.invalidateQueries({ queryKey: ['community-posts'] });
      await queryClient.invalidateQueries({ queryKey: ['community-post', item.id] });
      navigate(`/community/${item.id}`);
    },
    onError: (error) => messageApi.error(getApiErrorMessage(error, locale === 'zh-CN' ? '保存帖子失败，请检查标题和正文。' : 'Failed to save post. Please check the title and content.', locale)),
  });

  if (isEdit && postQuery.isLoading) {
    return (
      <>
        {contextHolder}
        <Card className="surface-card">
          <Skeleton active paragraph={{ rows: 10 }} />
        </Card>
      </>
    );
  }

  return (
    <>
      {contextHolder}
      <Card className="surface-card">
        <div className="toolbar-row">
          <div>
            <h2 className="section-title">{isEdit ? '编辑帖子' : '发布帖子'}</h2>
            <p className="section-subtitle">支持基础富文本排版，正文会在服务端再次进行安全清洗。</p>
          </div>
        </div>

        <Form
          form={form}
          layout="vertical"
          initialValues={{ title: '', contentHtml: '' }}
          onFinish={(values) => saveMutation.mutate(values)}
        >
          <Form.Item
            name="title"
            label={locale === 'zh-CN' ? '标题' : 'Title'}
            rules={[{ required: true, message: locale === 'zh-CN' ? '请输入标题' : 'Please enter a title.' }]}
          >
            <Input maxLength={255} placeholder={locale === 'zh-CN' ? '例如：某个文件的使用经验汇总' : 'Post title'} />
          </Form.Item>

          <Form.Item
            name="contentHtml"
            label={locale === 'zh-CN' ? '正文' : 'Content'}
            rules={[{
              validator: (_, value: string) => {
                const text = (value ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
                if (!text) {
                  return Promise.reject(new Error(locale === 'zh-CN' ? '请输入正文内容' : 'Please enter content.'));
                }
                return Promise.resolve();
              },
            }]}
          >
            <RichTextEditor
              placeholder={locale === 'zh-CN' ? '输入正文内容，支持基础排版…' : 'Write your post...'}
              value={contentHtmlValue}
              onChange={(value) => form.setFieldValue('contentHtml', value)}
            />
          </Form.Item>

          <Space>
            <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={saveMutation.isPending}>
              {isEdit ? '保存修改' : '发布帖子'}
            </Button>
            <Button
              icon={<CloseOutlined />}
              onClick={() => navigate(isEdit ? `/community/${postId}` : '/community')}
            >
              取消
            </Button>
          </Space>
        </Form>
      </Card>
    </>
  );
}
