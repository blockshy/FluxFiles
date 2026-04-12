import {
  AlignCenterOutlined,
  AlignLeftOutlined,
  AlignRightOutlined,
  BoldOutlined,
  ClearOutlined,
  FontSizeOutlined,
  ItalicOutlined,
  LinkOutlined,
  OrderedListOutlined,
  PictureOutlined,
  UnderlineOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import { Button, Select, Space } from 'antd';
import { useEffect, useRef, useState } from 'react';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

function applyEditorCommand(command: string, value?: string) {
  document.execCommand(command, false, value);
}

const fontFamilyOptions = [
  { label: '默认字体', value: '' },
  { label: '思源黑体', value: '"Noto Sans SC", "Microsoft YaHei", sans-serif' },
  { label: '思源宋体', value: '"Noto Serif SC", "Songti SC", serif' },
  { label: '霞鹜文楷', value: '"LXGW WenKai", "KaiTi", serif' },
  { label: 'IBM Plex Sans', value: '"IBM Plex Sans", "Segoe UI", sans-serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
];

const fontSizeOptions = [
  { label: '默认字号', value: '' },
  { label: '12px', value: '12px' },
  { label: '14px', value: '14px' },
  { label: '16px', value: '16px' },
  { label: '18px', value: '18px' },
  { label: '20px', value: '20px' },
  { label: '24px', value: '24px' },
  { label: '28px', value: '28px' },
  { label: '32px', value: '32px' },
];

export function RichTextEditor({ value, onChange, placeholder }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const selectionRef = useRef<Range | null>(null);
  const [fontFamily, setFontFamily] = useState('');
  const [fontSize, setFontSize] = useState('');

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

  function saveSelection() {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection || selection.rangeCount === 0) {
      return;
    }
    const range = selection.getRangeAt(0);
    if (!editor.contains(range.commonAncestorContainer)) {
      return;
    }
    selectionRef.current = range.cloneRange();
  }

  function restoreSelection() {
    const selection = window.getSelection();
    if (!selection || !selectionRef.current) {
      return;
    }
    selection.removeAllRanges();
    selection.addRange(selectionRef.current);
  }

  function focusEditor() {
    editorRef.current?.focus();
    restoreSelection();
  }

  function insertLink() {
    focusEditor();
    const url = window.prompt('请输入链接地址');
    if (!url) {
      return;
    }
    applyEditorCommand('createLink', url);
    syncValue();
  }

  function insertImage() {
    focusEditor();
    const url = window.prompt('请输入图片地址');
    if (!url) {
      return;
    }
    applyEditorCommand('insertImage', url);
    syncValue();
  }

  function applyInlineStyle(styleName: string, nextValue: string) {
    focusEditor();
    if (!nextValue) {
      applyEditorCommand('removeFormat');
      syncValue();
      return;
    }
    applyEditorCommand('styleWithCSS', 'true');
    applyEditorCommand('foreColor', 'inherit');
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      return;
    }
    const range = selection.getRangeAt(0);
    try {
      const span = document.createElement('span');
      span.style.setProperty(styleName, nextValue);
      range.surroundContents(span);
      selection.removeAllRanges();
      const nextRange = document.createRange();
      nextRange.selectNodeContents(span);
      selection.addRange(nextRange);
      selectionRef.current = nextRange.cloneRange();
      syncValue();
    } catch {
      return;
    }
  }

  function handleFontFamilyChange(nextValue: string) {
    setFontFamily(nextValue);
    applyInlineStyle('font-family', nextValue);
  }

  function handleFontSizeChange(nextValue: string) {
    setFontSize(nextValue);
    applyInlineStyle('font-size', nextValue);
  }

  return (
    <div className="rich-editor">
      <Space wrap className="rich-editor-toolbar">
        <Select
          className="rich-editor-select"
          value={fontFamily}
          options={fontFamilyOptions}
          suffixIcon={<FontSizeOutlined />}
          onChange={handleFontFamilyChange}
        />
        <Select
          className="rich-editor-select size"
          value={fontSize}
          options={fontSizeOptions}
          suffixIcon={<FontSizeOutlined />}
          onChange={handleFontSizeChange}
        />
        <Button className="table-action-button" icon={<BoldOutlined />} onClick={() => { focusEditor(); applyEditorCommand('bold'); syncValue(); }}>
          加粗
        </Button>
        <Button className="table-action-button" icon={<ItalicOutlined />} onClick={() => { focusEditor(); applyEditorCommand('italic'); syncValue(); }}>
          斜体
        </Button>
        <Button className="table-action-button" icon={<UnderlineOutlined />} onClick={() => { focusEditor(); applyEditorCommand('underline'); syncValue(); }}>
          下划线
        </Button>
        <Button className="table-action-button" icon={<AlignLeftOutlined />} onClick={() => { focusEditor(); applyEditorCommand('justifyLeft'); syncValue(); }}>
          左对齐
        </Button>
        <Button className="table-action-button" icon={<AlignCenterOutlined />} onClick={() => { focusEditor(); applyEditorCommand('justifyCenter'); syncValue(); }}>
          居中
        </Button>
        <Button className="table-action-button" icon={<AlignRightOutlined />} onClick={() => { focusEditor(); applyEditorCommand('justifyRight'); syncValue(); }}>
          右对齐
        </Button>
        <Button className="table-action-button" icon={<UnorderedListOutlined />} onClick={() => { focusEditor(); applyEditorCommand('insertUnorderedList'); syncValue(); }}>
          无序列表
        </Button>
        <Button className="table-action-button" icon={<OrderedListOutlined />} onClick={() => { focusEditor(); applyEditorCommand('insertOrderedList'); syncValue(); }}>
          有序列表
        </Button>
        <Button className="table-action-button" icon={<LinkOutlined />} onClick={insertLink}>
          链接
        </Button>
        <Button className="table-action-button" icon={<PictureOutlined />} onClick={insertImage}>
          图片
        </Button>
        <Button className="table-action-button" icon={<ClearOutlined />} onClick={() => { focusEditor(); applyEditorCommand('removeFormat'); setFontFamily(''); setFontSize(''); syncValue(); }}>
          清除格式
        </Button>
      </Space>
      <div
        ref={editorRef}
        className="rich-editor-surface"
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onInput={syncValue}
        onKeyUp={saveSelection}
        onMouseUp={saveSelection}
        onBlur={saveSelection}
      />
    </div>
  );
}
