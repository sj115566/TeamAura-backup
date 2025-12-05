import React, { useMemo, useRef, useEffect, useState } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css'; // 引入 Quill 樣式
import { Icon } from './Icons';

// 取得 Quill 的 Delta 物件，用於處理剪貼簿邏輯
const Quill = ReactQuill.Quill;
const Delta = Quill.import('delta');

export const RichTextEditor = ({ value, onChange, placeholder, onImageUpload }) => {
  const quillRef = useRef(null);
  
  // 使用 ref 保存 onImageUpload，避免因為它的變化導致 modules 重新計算
  const onImageUploadRef = useRef(onImageUpload);
  onImageUploadRef.current = onImageUpload;

  // 為了防止重新渲染導致 focus 跑掉，必須使用 useMemo，且依賴項應為空
  const modules = useMemo(() => ({
    toolbar: {
      container: [
        [{ 'header': [1, 2, 3, false] }],
        ['bold', 'italic', 'underline', 'strike', 'blockquote'],
        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
        [{ 'indent': '-1'}, { 'indent': '+1' }],
        [{ 'color': [] }, { 'background': [] }],
        [{ 'align': [] }],
        ['link', 'image', 'clean'] // 加上 image 按鈕
      ],
      handlers: {
        // 自定義圖片上傳邏輯
        image: () => {
            const input = document.createElement('input');
            input.setAttribute('type', 'file');
            input.setAttribute('accept', 'image/*');
            input.setAttribute('multiple', 'true'); // 支援多張圖片上傳
            input.click();

            input.onchange = async () => {
                const files = Array.from(input.files);
                if (files.length > 0 && onImageUploadRef.current) {
                    // 遍歷所有選擇的檔案
                    for (const file of files) {
                        try {
                            // 1. 上傳圖片 (使用 ref 中的函數)
                            const url = await onImageUploadRef.current(file);
                            
                            // 2. 取得編輯器實例
                            const quill = quillRef.current.getEditor();
                            
                            // 3. 安全地取得插入位置
                            // 如果沒有焦點，則插入到最後
                            const currentSelection = quill.getSelection(true);
                            const index = currentSelection ? currentSelection.index : quill.getLength();
                            
                            // 4. 插入圖片
                            quill.insertEmbed(index, 'image', url);
                            
                            // 5. 移動游標到圖片後面
                            setTimeout(() => {
                                try {
                                    quill.focus(); // 強制取回焦點
                                    const newIndex = quill.getLength(); 
                                    quill.setSelection(newIndex); 
                                } catch (e) {
                                    console.warn("Selection restore failed:", e);
                                }
                            }, 0);

                        } catch (error) {
                            console.error("Image upload failed:", error);
                            alert(`圖片 ${file.name} 上傳失敗，請稍後再試`);
                        }
                    }
                }
            };
        }
      }
    },
    clipboard: {
        matchers: [
            ['img', (node, delta) => {
                // 修正：這裡不能無腦 return new Delta()，否則會把舊文章的圖片也過濾掉
                // 我們只過濾 "data:" 開頭的 Base64 圖片 (通常是剪貼簿直接貼上的)
                if (node.src && node.src.startsWith('data:')) {
                    console.warn("Blocked base64 image paste");
                    return new Delta(); // 忽略此圖片
                }
                // 如果是 http/https 開頭的正常連結 (如 Firebase Storage)，則放行
                return delta; 
            }]
        ]
    }
  }), []);

  const formats = [
    'header',
    'bold', 'italic', 'underline', 'strike', 'blockquote',
    'list', 'bullet', 'indent',
    'link', 'image', 'color', 'background', 'align'
  ];

  return (
    <div className="bg-white rounded-lg overflow-hidden border border-gray-200 flex flex-col">
      <ReactQuill 
        ref={quillRef}
        theme="snow"
        value={value || ''} // 確保 value 至少是空字串，避免 undefined
        onChange={onChange}
        placeholder={placeholder || '寫些什麼...'}
        modules={modules}
        formats={formats}
        className="custom-quill flex-1"
      />
      <div className="bg-gray-50 text-[10px] text-gray-400 p-1 text-center border-t border-gray-100">
         💡 提示：已停用直接貼上圖片功能，請使用上方圖片按鈕上傳 (支援多選)。
      </div>
    </div>
  );
};