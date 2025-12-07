import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Icon } from '../components/Icons';

export const AnnouncementView = ({ announcements, isAdmin, onOpenAdd, onDelete, onOpenEdit, currentSeason, isHistoryMode, categories }) => {
  const [viewingImg, setViewingImg] = useState(null);
  const [expandedIds, setExpandedIds] = useState({});
  const [filterCategory, setFilterCategory] = useState('all'); // 新增篩選狀態
  
  // 使用 ref 避免重複初始化
  const hasInitialized = useRef(false);

  // ▼▼▼ 修正：初始化展開邏輯 ▼▼▼
  useEffect(() => {
    if (announcements && announcements.length > 0 && !hasInitialized.current) {
        const newExpanded = {};
        let firstUnpinnedFound = false;

        announcements.forEach(anc => {
            // 1. 展開所有置頂公告
            if (anc.isPinned) {
                newExpanded[anc.id] = true;
            } 
            // 2. 展開第一則非置頂公告
            else if (!firstUnpinnedFound) {
                newExpanded[anc.id] = true;
                firstUnpinnedFound = true;
            }
        });

        setExpandedIds(newExpanded);
        hasInitialized.current = true;
    }
  }, [announcements]);
  // ▲▲▲ 修正結束 ▲▲▲

  const toggleExpand = (id) => { 
    setExpandedIds(prev => ({...prev, [id]: !prev[id]})); 
  };

  const categoryMap = useMemo(() => {
      const map = {};
      if (categories) categories.forEach(c => map[c.firestoreId] = c);
      return map;
  }, [categories]);

  // 取得篩選選項 (公告類型)
  const filterOptions = useMemo(() => {
      if (!categories) return [];
      return categories.filter(c => c.type === 'announcement');
  }, [categories]);

  const getAncCategoryInfo = (anc) => {
      if (anc.categoryId && categoryMap[anc.categoryId]) {
          return { ...categoryMap[anc.categoryId], found: true };
      }
      if (anc.categoryId) {
          return { label: '未知分類', color: '#9ca3af', found: false };
      }
      return { label: anc.category || '一般', color: '#f3f4f6', textColor: '#4b5563', found: false };
  };

  // 過濾公告
  const filteredAnnouncements = useMemo(() => {
      if (filterCategory === 'all') return announcements;
      return announcements.filter(anc => {
          // 1. 優先比對 ID
          if (anc.categoryId === filterCategory) return true;
          // 2. 相容舊資料
          if (!anc.categoryId && categoryMap[filterCategory] && anc.category === categoryMap[filterCategory].label) return true;
          return false;
      });
  }, [announcements, filterCategory, categoryMap]);

  const extractImagesFromHtml = (html) => {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const imgs = doc.querySelectorAll('img');
      return Array.from(imgs).map(img => img.src);
  };

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* 頂部標題 */}
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-slate-700 text-lg">戰隊公告</h2>
        {isAdmin && !isHistoryMode && (
          <Button variant="primary" className="text-xs px-3 py-1.5" onClick={onOpenAdd} icon="Edit2">
            發佈貼文
          </Button>
        )}
      </div>

      {/* 新增：公告篩選 Tag Cloud */}
      <div className="flex flex-wrap gap-2 items-center pb-2 border-b border-gray-100">
          <button 
            onClick={() => setFilterCategory('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${filterCategory === 'all' ? 'bg-slate-700 text-white border-slate-700' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}
          >
            全部
          </button>
          {filterOptions.map(cat => {
              const isSelected = filterCategory === cat.firestoreId;
              return (
                <button 
                    key={cat.firestoreId}
                    onClick={() => setFilterCategory(cat.firestoreId)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border flex items-center gap-1 ${isSelected ? 'ring-2 ring-offset-1 ring-slate-200' : 'hover:opacity-80'}`}
                    style={{ 
                        backgroundColor: cat.color, 
                        color: '#ffffff',
                        borderColor: cat.color 
                    }}
                >
                    {isSelected && <Icon name="Check" className="w-3 h-3" />}
                    {cat.label}
                </button>
              );
          })}
      </div>

      {/* 列表內容 */}
      <div className="space-y-4">
        {filteredAnnouncements && filteredAnnouncements.length > 0 ? filteredAnnouncements.map(anc => {
          const attachmentImages = JSON.parse(anc.images || '[]');
          const contentImages = extractImagesFromHtml(anc.content);
          const allImages = Array.from(new Set([...attachmentImages, ...contentImages]));
          const isExpanded = !!expandedIds[anc.id];
          const plainText = anc.content.replace(/<[^>]+>/g, '');
          const previewText = plainText.length > 50 ? plainText.slice(0, 50) + '...' : plainText;
          const isHistorical = anc.season && anc.season !== currentSeason;
          
          const catInfo = getAncCategoryInfo(anc);
          const badgeStyle = { backgroundColor: catInfo.found ? catInfo.color : '#f3f4f6', color: catInfo.found ? '#ffffff' : '#4b5563' };

          return (
            <Card key={anc.id} className={`overflow-visible transition-all duration-200 relative ${isExpanded ? 'ring-2 ring-indigo-50 shadow-md' : 'hover:shadow-md cursor-pointer'} ${isHistorical ? 'bg-slate-100 border-slate-200' : 'bg-white'}`}>
              <div onClick={() => toggleExpand(anc.id)}>
                <div className="absolute top-0 right-0 flex">
                    {anc.isPinned && !isHistorical && (<div className="bg-indigo-600 text-white text-[10px] font-bold px-2 py-1 rounded-bl-lg z-20 flex items-center gap-1 shadow-sm"><Icon name="Map" className="w-3 h-3 text-white" /> 置頂</div>)}
                    {isHistorical && (<div className="bg-slate-600 text-white text-[10px] font-bold px-2 py-1 rounded-bl-lg rounded-tr-lg z-20 opacity-80">歷史公告：{anc.season}</div>)}
                </div>

                <div className="flex justify-between items-start mb-2 pt-1">
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-full ${isHistorical ? 'bg-slate-300 text-slate-500' : 'bg-indigo-100 text-indigo-600'} flex items-center justify-center font-bold text-sm`}>{(anc.author || 'A')[0].toUpperCase()}</div>
                    <div>
                      <div className={`font-bold text-sm ${isHistorical ? 'text-slate-500' : 'text-slate-800'}`}>{anc.author}</div>
                      <div className="flex items-center gap-2">
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-bold" style={badgeStyle}>{catInfo.label}</span>
                          <span className="text-[10px] text-gray-400">{new Date(anc.timestamp).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                  
                  {isAdmin && !isHistoryMode && (<div className="flex gap-1 z-10 mr-1 mt-8 sm:mt-0" onClick={(e) => e.stopPropagation()}><button onClick={() => onOpenEdit(anc)} className="text-gray-300 hover:text-blue-500 p-1 transition-colors"><Icon name="Edit2" className="w-4 h-4" /></button><button onClick={() => onDelete(anc.id)} className="text-gray-300 hover:text-red-400 p-1 transition-colors"><Icon name="Trash2" className="w-4 h-4" /></button></div>)}
                </div>

                <h3 className={`font-bold text-lg mb-2 leading-tight ${isHistorical ? 'text-slate-600' : 'text-slate-900'}`}>{anc.title}</h3>
                
                {isExpanded ? (
                  <div className="animate-fadeIn cursor-text" onClick={(e) => e.stopPropagation()}>
                    <div className="text-sm text-slate-700 leading-relaxed mb-3 ql-editor px-0 [&_img]:max-h-60 [&_img]:w-auto [&_img]:max-w-full [&_img]:rounded-lg [&_img]:my-2 [&_img]:cursor-pointer [&_img]:shadow-sm [&_img]:border [&_img]:border-gray-100 [&_img]:hover:opacity-90 transition-opacity" dangerouslySetInnerHTML={{ __html: anc.content }} onClick={(e) => { if (e.target.tagName === 'IMG') setViewingImg(e.target.src); }}></div>
                    {attachmentImages.length > 0 && (<div className="mt-2 border-t border-gray-100 pt-2"><div className="text-xs text-gray-400 font-bold mb-2">附件圖片</div><div className={`grid gap-1 rounded-lg overflow-hidden ${attachmentImages.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>{attachmentImages.map((url, idx) => (<div key={idx} onClick={() => setViewingImg(url)} className={`relative cursor-pointer group ${attachmentImages.length === 3 && idx === 0 ? 'col-span-2' : ''}`}><img src={url} className="w-full h-full object-cover max-h-[300px] hover:opacity-90 transition-opacity" alt="attachment" loading="lazy" /></div>))}</div></div>)}
                    <div className="text-center mt-4 pt-2 border-t border-gray-100 text-xs font-bold cursor-pointer text-indigo-400 hover:text-indigo-600 transition-colors" onClick={() => toggleExpand(anc.id)}>收起公告</div>
                  </div>
                ) : (
                  <div className="text-sm text-gray-500">
                    <div className="line-clamp-2">{previewText || <span className="italic text-gray-300">無文字內容...</span>}</div>
                    {allImages.length > 0 && (<div className="flex gap-2 mt-3 overflow-hidden">{allImages.slice(0, 3).map((url, idx) => (<img key={idx} src={url} className="w-16 h-16 object-cover rounded-lg border border-gray-100" alt="preview" />))}{allImages.length > 3 && (<div className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center text-xs text-gray-500 font-bold">+{allImages.length - 3}</div>)}</div>)}
                    <div className="flex items-center gap-3 mt-3 text-[10px] text-gray-400 font-bold"><span className="text-indigo-500">點擊查看詳情</span></div>
                  </div>
                )}
              </div>
            </Card>
          );
        }) : <div className="text-center py-10 text-gray-400"><Icon name="Bell" className="w-12 h-12 mx-auto mb-2 opacity-20" /><p className="text-sm">目前沒有公告</p></div>}
      </div>
      {viewingImg && (<div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/95 p-2" onClick={() => setViewingImg(null)}><img src={viewingImg} className="max-w-full max-h-full rounded" alt="full" /><button className="absolute top-4 right-4 text-white p-2"><Icon name="X" /></button></div>)}
    </div>
  );
};