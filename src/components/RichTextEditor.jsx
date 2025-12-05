import React from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css'; // 引入 Quill 樣式

export const RichTextEditor = ({ value, onChange, placeholder }) => {
  const modules = {
    toolbar: [
      [{ 'header': [1, 2, 3, false] }], // 標題層級
      ['bold', 'italic', 'underline', 'strike', 'blockquote'], // 粗體、斜體、底線、刪除線、引用
      [{ 'list': 'ordered'}, { 'list': 'bullet' }], // 列表
      [{ 'indent': '-1'}, { 'indent': '+1' }], // 縮排
      [{ 'color': [] }, { 'background': [] }], // 文字顏色與背景色
      [{ 'align': [] }], // 對齊
      ['link', 'clean'] // 連結、清除格式
    ]
  };

  const formats = [
    'header',
    'bold', 'italic', 'underline', 'strike', 'blockquote',
    'list', 'bullet', 'indent',
    'link', 'color', 'background', 'align'
  ];

  return (
    <div className="bg-white rounded-lg overflow-hidden border border-gray-200">
      <ReactQuill 
        theme="snow"
        value={value}
        onChange={onChange}
        placeholder={placeholder || '寫些什麼...'}
        modules={modules}
        formats={formats}
        className="custom-quill"
      />
    </div>
  );
};