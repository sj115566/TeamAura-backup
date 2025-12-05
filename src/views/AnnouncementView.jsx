import React, { useState } from 'react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Icon } from '../components/Icons';

// 分類標籤顏色對應
const categoryColors = {
    '一般': 'bg-gray-100 text-gray-600',
    '活動': 'bg-green-100 text-green-700',
    '重要': 'bg-red-100 text-red-700',
    '更新': 'bg-blue-100 text-blue-700',
    '維護': 'bg-orange-100 text-orange-700'
};

export const AnnouncementView = ({ announcements, isAdmin, onOpenAdd, onDelete, onOpenEdit, currentSeason, isHistoryMode }) => {
  const [viewingImg, setViewingImg] = useState(null);
  const [expandedIds, setExpandedIds] = useState({});

  const toggleExpand = (id) => { 
    setExpandedIds(prev => ({...prev, [id]: !prev[id]})); 
  };

  return (
    <div className="space-y-4 animate-fadeIn">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-slate-700 text-lg">戰隊公告</h2>
        {isAdmin && !isHistoryMode && (
          <Button variant="primary" className="text-xs px-3 py-1.5" onClick={onOpenAdd} icon="Edit2">
            發佈貼文
          </Button>
        )}
      </div>
      <div className="space-y-4">
        {announcements && announcements.length > 0 ? announcements.map(anc => {
          const images = JSON.parse(anc.images || '[]');
          const isExpanded = !!expandedIds[anc.id];
          const plainText = anc.content.replace(/<[^>]+>/g, '');
          const previewText = plainText.length > 50 ? plainText.slice(0, 50) + '...' : plainText;
          const isHistorical = anc.season && anc.season !== currentSeason;
          
          const catColor = categoryColors[anc.category] || categoryColors['一般'];

          return (
            <Card 
              key={anc.id} 
              className={`overflow-visible transition-all duration-200 relative ${isExpanded ? 'ring-2 ring-indigo-50 shadow-md' : 'hover:shadow-md cursor-pointer'} ${isHistorical ? 'bg-slate-100 border-slate-200' : 'bg-white'}`}
            >
              <div onClick={() => toggleExpand(anc.id)}>
                
                {/* 右上角標籤區 (歷史標籤 > 置頂標籤) */}
                <div className="absolute top-0 right-0 flex">
                    {anc.isPinned && !isHistorical && (
                        <div className="bg-indigo-600 text-white text-[10px] font-bold px-2 py-1 rounded-bl-lg z-20 flex items-center gap-1 shadow-sm">
                            <Icon name="Map" className="w-3 h-3 text-white" /> {/* 使用 Map icon 暫代 Pin */}
                            置頂
                        </div>
                    )}
                    {isHistorical && (
                        <div className="bg-slate-600 text-white text-[10px] font-bold px-2 py-1 rounded-bl-lg rounded-tr-lg z-20 opacity-80">
                            歷史公告：{anc.season}
                        </div>
                    )}
                </div>

                <div className="flex justify-between items-start mb-2 pt-1">
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-full ${isHistorical ? 'bg-slate-300 text-slate-500' : 'bg-indigo-100 text-indigo-600'} flex items-center justify-center font-bold text-sm`}>
                      {(anc.author || 'A')[0].toUpperCase()}
                    </div>
                    <div>
                      <div className={`font-bold text-sm ${isHistorical ? 'text-slate-500' : 'text-slate-800'}`}>
                          {anc.author}
                      </div>
                      <div className="flex items-center gap-2">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${catColor}`}>
                              {anc.category || '一般'}
                          </span>
                          <span className="text-[10px] text-gray-400">
                              {new Date(anc.timestamp).toLocaleString()}
                          </span>
                      </div>
                    </div>
                  </div>
                  
                  {/* 管理按鈕 */}
                  {isAdmin && !isHistoryMode && (
                    <div className="flex gap-1 z-10 mr-1 mt-8 sm:mt-0" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => onOpenEdit(anc)} className="text-gray-300 hover:text-blue-500 p-1 transition-colors">
                        <Icon name="Edit2" className="w-4 h-4" />
                      </button>
                      <button onClick={() => onDelete(anc.id)} className="text-gray-300 hover:text-red-400 p-1 transition-colors">
                        <Icon name="Trash2" className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                <h3 className={`font-bold text-lg mb-2 leading-tight ${isHistorical ? 'text-slate-600' : 'text-slate-900'}`}>
                    {anc.title}
                </h3>
                
                {isExpanded ? (
                  <div className="animate-fadeIn cursor-text" onClick={(e) => e.stopPropagation()}>
                    <div className="text-sm text-slate-700 leading-relaxed mb-3 ql-editor px-0" dangerouslySetInnerHTML={{ __html: anc.content }}></div>
                    {images.length > 0 && (
                      <div className={`grid gap-1 mt-2 rounded-lg overflow-hidden ${images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                        {images.map((url, idx) => (
                          <div key={idx} onClick={() => setViewingImg(url)} className={`relative cursor-pointer group ${images.length === 3 && idx === 0 ? 'col-span-2' : ''}`}>
                            <img 
                              src={url} 
                              className="w-full h-full object-cover max-h-[300px] hover:opacity-90 transition-opacity" 
                              alt="announcement" 
                              loading="lazy" 
                            />
                          </div>
                        ))}
                      </div>
                    )}
                    <div 
                      className="text-center mt-4 pt-2 border-t border-gray-100 text-xs font-bold cursor-pointer text-indigo-400 hover:text-indigo-600 transition-colors" 
                      onClick={() => toggleExpand(anc.id)}
                    >
                      收起公告
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-gray-500">
                    <div className="line-clamp-2">{previewText || <span className="italic text-gray-300">無文字內容...</span>}</div>
                    <div className="flex items-center gap-3 mt-3 text-[10px] text-gray-400 font-bold">
                      <span className="text-indigo-500">點擊查看詳情</span>
                      {images.length > 0 && (
                        <span className="flex items-center gap-1 bg-gray-100 px-2 py-0.5 rounded-full">
                          <Icon name="Image" className="w-3 h-3"/> {images.length} 張圖片
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          );
        }) : (
          <div className="text-center py-10 text-gray-400">
            <Icon name="Bell" className="w-12 h-12 mx-auto mb-2 opacity-20" />
            <p className="text-sm">目前沒有公告</p>
          </div>
        )}
      </div>
      {viewingImg && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/95 p-2" onClick={() => setViewingImg(null)}>
          <img src={viewingImg} className="max-w-full max-h-full rounded" alt="full" />
          <button className="absolute top-4 right-4 text-white p-2"><Icon name="X" /></button>
        </div>
      )}
    </div>
  );
};