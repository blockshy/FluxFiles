import { BoldOutlined, ItalicOutlined, LinkOutlined, OrderedListOutlined, UnorderedListOutlined } from '@ant-design/icons';
import { Button, Space } from 'antd';
import { useEffect, useRef } from 'react';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

function applyEditorCommand(command: string, value?: string) {
  document.execCommand(command, false, value);
}

export function RichTextEditor({ value, onChange, placeholder }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!editorRef.current) {
      return;
    }
    if (editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || '';
    }
  }, [value]);

  function syncValue() {
    onChange(editorRef.current?.innerHTML ?? '');
  }

  function insertLink() {
    const url = window.prompt('请输入链接地址');
    if (!url) {
      return;
    }
    applyEditorCommand('createLink', url);
    syncValue();
  }

  return (
    <div className="rich-editor">
      <Space wrap className="rich-editor-toolbar">
        <Button className="table-action-button" icon={<BoldOutlined />} onClick={() => { applyEditorCommand('bold'); syncValue(); }}>
          加粗
        </Button>
        <Button className="table-action-button" icon={<ItalicOutlined />} onClick={() => { applyEditorCommand('italic'); syncValue(); }}>
          斜体
        </Button>
        <Button className="table-action-button" icon={<UnorderedListOutlined />} onClick={() => { applyEditorCommand('insertUnorderedList'); syncValue(); }}>
          无序列表
        </Button>
        <Button className="table-action-button" icon={<OrderedListOutlined />} onClick={() => { applyEditorCommand('insertOrderedList'); syncValue(); }}>
          有序列表
        </Button>
        <Button className="table-action-button" icon={<LinkOutlined />} onClick={insertLink}>
          链接
        </Button>
      </Space>
      <div
        ref={editorRef}
        className="rich-editor-surface"
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onInput={syncValue}
      />
    </div>
  );
}
