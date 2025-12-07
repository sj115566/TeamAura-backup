import React, { useState, useRef, useEffect } from 'react';
import { useAppManager } from './hooks/useAppManager';
import { ToastProvider, useToast } from './context/ToastContext';
import { LoadingOverlay } from './components/LoadingOverlay';
import { ConfirmDialog } from './components/ConfirmDialog';
import { Button } from './components/ui/Button';
import { Badge } from './components/ui/Badge';
import { Modal } from './components/ui/Modal';
import { Icon } from './components/Icons';
import { RichTextEditor } from './components/RichTextEditor';

import { LoginView } from './views/LoginView';
import { TaskListView } from './views/TaskListView';
import { LeaderboardView } from './views/LeaderboardView';
import { ReportView } from './views/ReportView';
import { ProfileView } from './views/ProfileView';
import { GameView } from './views/GameView';
import { AnnouncementView } from './views/AnnouncementView';

const EMOJI_LIST = ['🐾', '📅', '⚔️', '✨', '🥚', '🎁', '🔥', '💧', '⚡', '🍃', '❄️', '🥊', '👻', '🟣', '🟤', '🧚', '🐉', '🏔️', '🦅', '🤝', '🚶', '📸', '📍', '🍬', '⭐', '🏆'];

const TASK_TYPES = {
    // PINNED 的預設 isPinned 改為 false，讓使用者自己決定是否要勾選置頂
    PINNED: { label: '常駐/公告', defaultCategoryLabel: '常駐', defaultIcon: '📌', defaultWeek: 'Pinned', isPinned: false },
    DAILY: { label: '每日挑戰', defaultCategoryLabel: '每日', defaultIcon: '📅', defaultWeek: '1', isPinned: false },
    SEASONAL: { label: '賽季進度', defaultCategoryLabel: '一般', defaultIcon: '🏆', defaultWeek: '1', isPinned: false }
};

// 可視化標籤選擇器元件
const CategorySelector = ({ options, selectedId, onSelect }) => {
    return (
        <div className="flex flex-wrap gap-2 p-2 bg-slate-50 border rounded-lg max-h-32 overflow-y-auto">
            {options.length > 0 ? options.map(cat => {
                const isSelected = selectedId === cat.firestoreId;
                return (
                    <button
                        key={cat.firestoreId}
                        type="button"
                        onClick={() => onSelect(cat)}
                        className={`flex items-center px-2 py-1 rounded text-xs transition-all border shadow-sm ${isSelected ? 'ring-2 ring-indigo-500 ring-offset-1 scale-105' : 'hover:opacity-90 border-transparent hover:scale-105'}`}
                        style={{ backgroundColor: cat.color, color: '#ffffff' }}
                    >
                        {cat.label}
                        {isSelected && <Icon name="Check" className="w-3 h-3 ml-1 text-white" />}
                    </button>
                );
            }) : <span className="text-xs text-gray-400">無可用分類，請至個人頁面設定</span>}
        </div>
    );
};

const AppContent = () => {
 const { state, actions, sortedUsers, dialog, setDialog } = useAppManager();
 const {
     tasks, submissions, users, currentUser, activeTab, loading, expandedWeeks,
     announcements, games, selectedSeason, availableSeasons, isHistoryMode,
     needRefresh, notifications, seasonGoal, seasonGoalTitle, roles, categories
 } = state;

 const { showToast } = useToast();

 const [taskModal, setTaskModal] = useState({ 
    isOpen: false, 
    id: null, 
    firestoreId: null,
    data: { 
        title: '', 
        points: 10, 
        icon: '🐾', 
        description: '', 
        week: '1', 
        type: 'fixed',
        category: '一般', 
        categoryId: null,
        isPinned: false
    } 
 });
 
 const [currentTaskType, setCurrentTaskType] = useState('SEASONAL');

 const findDefaultCategoryId = (label, type = 'task') => {
     if (!categories) return null;
     const found = categories.find(c => c.label === label && c.type === type);
     return found ? found.firestoreId : null;
 };
 
 useEffect(() => {
     if (taskModal.isOpen) {
         const { category, isPinned } = taskModal.data;
         if (category === '常駐' || (isPinned && category !== '每日' && category !== '一般')) setCurrentTaskType('PINNED'); 
         else if (category === '每日') setCurrentTaskType('DAILY');
         else setCurrentTaskType('SEASONAL');
     }
 }, [taskModal.isOpen, taskModal.id]);

 const handleTypeChange = (typeKey) => {
     setCurrentTaskType(typeKey);
     const config = TASK_TYPES[typeKey];
     const defCatId = findDefaultCategoryId(config.defaultCategoryLabel, 'task');

     setTaskModal(prev => ({
         ...prev,
         data: {
             ...prev.data,
             category: config.defaultCategoryLabel,
             categoryId: defCatId,
             icon: (!prev.id && prev.data.icon === '🐾') ? config.defaultIcon : prev.data.icon,
             week: typeKey === 'PINNED' ? config.defaultWeek : (prev.data.week === 'Pinned' ? '1' : prev.data.week),
             isPinned: config.isPinned
         }
     }));
 };
 
 const [showEmojiPicker, setShowEmojiPicker] = useState(false);
 const [submitModal, setSubmitModal] = useState({ isOpen: false, task: null, proof: '', images: [] });
 const [archiveModal, setArchiveModal] = useState({ isOpen: false, newSeasonName: '' });
 const [announceModal, setAnnounceModal] = useState({ isOpen: false, id: null, title: '', content: '', images: [], category: '一般', categoryId: null, isPinned: false });
 const [gameModal, setGameModal] = useState({ isOpen: false, id: null, title: '', url: '', icon: '' });
 const [userRoleModal, setUserRoleModal] = useState({ isOpen: false, uid: null, roles: [] });
 const fileInputRef = useRef(null);
 const announceFileRef = useRef(null);
 
 const handleImageUpload = (e) => { const files = Array.from(e.target.files); if (files.length > 0) setSubmitModal(prev => ({ ...prev, rawFiles: files, images: files.map(f => URL.createObjectURL(f)) })); };
 const handleAnnounceImageUpload = (e) => { const files = Array.from(e.target.files); if (files.length > 0) setAnnounceModal(prev => ({ ...prev, rawFiles: [...(prev.rawFiles || []), ...files], images: [...prev.images, ...files.map(f => URL.createObjectURL(f))] })); };
 const handleRemoveAnnounceImage = (index) => { setAnnounceModal(prev => { const newImages = [...prev.images]; newImages.splice(index, 1); return { ...prev, images: newImages }; }); };
 const handleEditorImageUpload = async (file) => { showToast('上傳中...', 'info'); return await actions.uploadSingleImage(file); };
 const handleSubmitTask = async () => { const success = await actions.submitTask({ task: submitModal.task, proof: submitModal.proof, rawFiles: submitModal.rawFiles }); if (success) setSubmitModal({ isOpen: false, task: null, proof: '', images: [], rawFiles: [] }); };
 
 const handleAddAnnouncement = async () => {
   const keepOldImages = announceModal.images.filter(url => !url.startsWith('blob:'));
   if (announceModal.id) await actions.updateAnnouncement(announceModal.id, announceModal.title, announceModal.content, announceModal.rawFiles, announceModal.category, announceModal.isPinned, keepOldImages, announceModal.categoryId);
   else await actions.addAnnouncement(announceModal.title, announceModal.content, announceModal.rawFiles, announceModal.category, announceModal.isPinned, announceModal.categoryId);
   setAnnounceModal({ isOpen: false, id: null, title: '', content: '', images: [], rawFiles: [], category: '一般', categoryId: null, isPinned: false });
 };

 const handleSaveGame = async () => { if (gameModal.id) await actions.updateGame({id:gameModal.id, title:gameModal.title, url:gameModal.url, icon:gameModal.icon}); else await actions.addGame({id:null, title:gameModal.title, url:gameModal.url, icon:gameModal.icon}); setGameModal({ isOpen: false, id: null, title: '', url: '', icon: '' }); };
 const handleUpdateUserRoles = async () => { if(userRoleModal.uid) await actions.updateUserRoles(userRoleModal.uid, userRoleModal.roles); setUserRoleModal({ isOpen: false, uid: null, roles: [] }); };

 const handleOpenEditTask = (task) => {
    setTaskModal({
        isOpen: true,
        id: task.id,
        firestoreId: task.firestoreId,
        data: {
            title: task.title,
            points: task.points,
            icon: task.icon,
            description: task.description,
            week: task.week,
            type: task.type,
            category: task.category,
            categoryId: task.categoryId || null,
            isPinned: task.isPinned || false
        }
    });
 };

 const handleSaveTask = async () => {
    if (taskModal.firestoreId) await actions.updateTask(taskModal.firestoreId, taskModal.data);
    else await actions.addTask(taskModal.data);
    setTaskModal({ isOpen: false, id: null, firestoreId: null, data: { title: '', points: 10, icon: '🐾', description: '', week: '1', type: 'fixed', category: '一般', categoryId: null, isPinned: false } });
    setShowEmojiPicker(false);
 };

 const handleDuplicateTask = (task) => {
    setTaskModal({
        isOpen: true,
        id: null,
        firestoreId: null,
        data: {
            title: task.title + " (複製)",
            points: task.points,
            icon: task.icon,
            description: task.description,
            week: task.week, 
            type: task.type,
            category: task.category,
            categoryId: task.categoryId || null,
            isPinned: task.isPinned || false
        }
    });
 };

 if (!currentUser) { return (<><LoadingOverlay isLoading={loading} /><LoginView onLogin={actions.login} loading={loading} onInitialize={actions.initializeSystem} /></>); }

 const availableTaskCats = categories ? categories.filter(c => c.type === 'task') : [];
 const availableAncCats = categories ? categories.filter(c => c.type === 'announcement') : [];

 return (
   <div className="min-h-screen bg-slate-50 text-slate-800 pb-24 font-sans">
     <LoadingOverlay isLoading={loading} />
     <div className={`sticky top-0 z-40 shadow-sm px-4 py-3 flex justify-between items-center border-b border-gray-100 safe-area-top transition-colors duration-300 ${isHistoryMode ? 'bg-yellow-50 border-yellow-200' : 'bg-white'}`}>
       <div className="flex items-center gap-2"><div className="font-black text-lg text-indigo-600">Team Aura</div>{currentUser.isAdmin && <Badge color="indigo">ADMIN</Badge>}<div className="relative flex items-center"><select value={selectedSeason || ''} onChange={(e) => actions.setSeason(e.target.value)} disabled={availableSeasons.length === 0} className={`text-xs font-bold border-l pl-2 ml-2 outline-none bg-transparent cursor-pointer appearance-none pr-4 ${isHistoryMode ? 'text-yellow-700 border-yellow-400' : 'text-gray-500 border-gray-300'}`}>{availableSeasons.length > 0 ? (availableSeasons.map(s => <option key={s} value={s}>{s}</option>)) : (<option>載入中...</option>)}</select><div className="pointer-events-none absolute right-0 flex items-center px-1 text-gray-500"><Icon name="ChevronDown" className="h-3 w-3" /></div></div>{isHistoryMode && <Badge color="yellow">歷史模式</Badge>}</div>
       <div className="flex items-center gap-2">{!currentUser.isAdmin && <Badge color={isHistoryMode ? "yellow" : "indigo"} className="text-sm">{Number(currentUser.points || 0)} pts</Badge>}<button onClick={actions.refresh} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors relative"><Icon name="RefreshCw" className={`w-4 h-4 ${state.refreshing ? 'animate-spin' : ''}`} />{needRefresh && (<span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>)}</button></div>
     </div>

     <div className={`w-full mx-auto px-3 sm:px-4 py-4 space-y-6 ${activeTab === 'report' ? 'max-w-[95vw]' : 'max-w-3xl'}`}>
       {isHistoryMode && (<div className="bg-yellow-100 text-yellow-800 p-2 text-xs text-center rounded-lg font-bold border border-yellow-200">⚠️ 您正在檢視歷史賽季資料，僅供查閱，無法進行編輯或提交。</div>)}
       {needRefresh && (<div onClick={actions.refresh} className="bg-indigo-600 text-white p-3 rounded-lg shadow-lg flex items-center justify-between cursor-pointer animate-fadeIn"><div className="text-xs font-bold flex items-center gap-2"><Icon name="ArrowUp" className="w-4 h-4" />發現新版本，點擊立即更新！</div><Icon name="ChevronRight" className="w-4 h-4" /></div>)}

       {activeTab === 'announcements' && <AnnouncementView announcements={announcements} isAdmin={currentUser.isAdmin} currentSeason={selectedSeason} isHistoryMode={isHistoryMode} onOpenAdd={() => setAnnounceModal({ isOpen: true, id: null, title: '', content: '', images: [], category: '一般', categoryId: null, isPinned: false })} onOpenEdit={(anc) => setAnnounceModal({ isOpen: true, id: anc.id, title: anc.title, content: anc.content, images: JSON.parse(anc.images || '[]'), category: anc.category || '一般', categoryId: anc.categoryId || null, isPinned: !!anc.isPinned })} onDelete={actions.deleteAnnouncement} categories={categories} />}
       {activeTab === 'tasks' && <TaskListView tasks={tasks} submissions={submissions} currentUser={currentUser} isAdmin={currentUser.isAdmin} expandedWeeks={expandedWeeks} onToggleWeek={actions.toggleWeek} onDeleteTask={actions.deleteTask} onOpenWithdraw={actions.withdraw} isHistoryMode={isHistoryMode} onOpenSubmit={(t) => setSubmitModal({ isOpen: true, task: t, proof: '', images: [], rawFiles: [] })} onOpenEditTask={() => setTaskModal({ isOpen: true, id: null, firestoreId: null, data: { title: '', points: 10, icon: '🐾', description: '', week: '1', type: 'fixed', category: '一般', categoryId: null, isPinned: false } })} onEditTask={handleOpenEditTask} onDuplicateTask={handleDuplicateTask} onBatchSetExpanded={actions.batchSetExpanded} categories={categories} />}
       {activeTab === 'leaderboard' && <LeaderboardView users={sortedUsers} currentUser={currentUser} seasonGoal={seasonGoal} seasonGoalTitle={seasonGoalTitle} onUpdateGoal={actions.updateSeasonGoal} roles={roles} onEditUserRole={(uid, currentRoles) => setUserRoleModal({ isOpen: true, uid, roles: currentRoles || [] })} />}
       {activeTab === 'report' && currentUser.isAdmin && <ReportView tasks={tasks} users={users} submissions={submissions} onArchiveSeason={() => setArchiveModal({ isOpen: true, newSeasonName: '' })} isHistoryMode={isHistoryMode} onExport={actions.exportReport} roles={roles} />}
       {activeTab === 'profile' && <ProfileView currentUser={currentUser} tasks={tasks} submissions={submissions} isAdmin={currentUser.isAdmin} isHistoryMode={isHistoryMode} onLogout={actions.logout} onReview={actions.review} onInitialize={actions.initializeSystem} onHardReset={actions.hardResetSystem} roles={roles} onAddRole={actions.addRole} onUpdateRole={actions.updateRole} onDeleteRole={actions.deleteRole} categories={categories} onAddCategory={actions.addCategory} onUpdateCategory={actions.updateCategory} onDeleteCategory={actions.deleteCategory} onRestoreDefaultCategories={actions.restoreDefaultCategories} onFixSubmissionLinks={actions.fixSubmissionLinks} users={users} />}
       {activeTab === 'game' && <GameView games={games} isAdmin={currentUser.isAdmin} onOpenAdd={() => setGameModal({ isOpen: true, id: null, title: '', url: '', icon: '' })} onOpenEdit={(g) => setGameModal({ isOpen: true, id: g.id, title: g.title, url: g.url, icon: g.icon })} onDelete={actions.deleteGame} />}
     </div>

     <div className="fixed bottom-0 w-full bg-white border-t border-gray-200 py-2 flex justify-around text-xs font-bold text-gray-400 safe-area-bottom z-30">
       {[{ id: 'announcements', icon: 'Bell', label: '公告', hasNotif: notifications?.announcements }, { id: 'tasks', icon: 'Map', label: '任務', hasNotif: notifications?.tasks }, { id: 'leaderboard', icon: 'Trophy', label: '排行' }, ...(currentUser.isAdmin ? [{ id: 'report', icon: 'Table', label: '報表' }] : []), { id: 'profile', icon: 'User', label: '個人' }, { id: 'game', icon: 'Gamepad', label: '遊戲' }].map(tab => (
         <button key={tab.id} onClick={() => actions.setTab(tab.id)} className={`flex flex-col items-center gap-1 p-2 relative ${activeTab === tab.id ? 'text-indigo-600' : ''}`}><div className="relative"><Icon name={tab.icon} className="w-6 h-6" />{tab.hasNotif && (<span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>)}</div>{tab.label}</button>
       ))}
     </div>

     {/* Task Modal - Visual Selector */}
     <Modal isOpen={taskModal.isOpen} onClose={() => setTaskModal({ ...taskModal, isOpen: false })} title={taskModal.id ? "編輯任務" : "新增任務"}>
       <div className="space-y-4 relative" onClick={() => setShowEmojiPicker(false)}> 
         <div className="bg-slate-100 p-1 rounded-lg flex text-xs font-bold text-slate-500">{Object.entries(TASK_TYPES).map(([key, config]) => (<button key={key} onClick={() => handleTypeChange(key)} className={`flex-1 py-2 rounded-md transition-all ${currentTaskType === key ? 'bg-white text-indigo-600 shadow-sm' : 'hover:text-slate-700'}`}>{config.label}</button>))}</div>
         <div className="space-y-4 pt-2">
            <div><label className="text-xs font-bold text-gray-500 mb-1 block">任務標題</label><input className="w-full p-2 border rounded-lg text-sm" placeholder="輸入任務名稱" value={taskModal.data.title} onChange={e => setTaskModal({ ...taskModal, data: { ...taskModal.data, title: e.target.value } })} /></div>
            <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-bold text-gray-500 mb-1 block">計分方式</label><div className="flex gap-2"><select className="w-full p-2 border rounded-lg text-sm" value={taskModal.data.type} onChange={e => setTaskModal({ ...taskModal, data: { ...taskModal.data, type: e.target.value } })}><option value="fixed">固定分數</option><option value="variable">管理員評分</option></select></div></div>
                {currentTaskType !== 'PINNED' && (<div><label className="text-xs font-bold text-gray-500 mb-1 block">所屬週次</label><input type="number" className="w-full p-2 border rounded-lg text-sm" placeholder="例如: 1" value={taskModal.data.week} onChange={e => setTaskModal({ ...taskModal, data: { ...taskModal.data, week: e.target.value } })} /></div>)}
                {taskModal.data.type === 'fixed' && (<div><label className="text-xs font-bold text-gray-500 mb-1 block">獲得積分</label><input type="number" className="w-full p-2 border rounded-lg text-sm" placeholder="例如: 10" value={taskModal.data.points} onChange={e => setTaskModal({ ...taskModal, data: { ...taskModal.data, points: e.target.value } })} /></div>)}
            </div>

            {currentTaskType === 'SEASONAL' && (
                <div>
                    <label className="text-xs font-bold text-gray-500 mb-1 block">分類標籤</label>
                    {/* 修改：在 SEASONAL 模式下，過濾掉 '每日' 和 '常駐' 的選項 */}
                    <CategorySelector 
                        options={availableTaskCats.filter(c => c.label !== '每日' && c.label !== '常駐')}
                        selectedId={taskModal.data.categoryId}
                        onSelect={(cat) => setTaskModal(prev => ({ 
                            ...prev, 
                            data: { ...prev.data, category: cat.label, categoryId: cat.firestoreId, categoryColor: cat.color } 
                        }))}
                    />
                </div>
            )}

            {/* 修改：移除條件限制，讓所有任務類型 (包括 PINNED) 都可以看到置頂選項 */}
             <div className="mt-2">
                <label className="flex items-center gap-2 p-2 border rounded-lg cursor-pointer bg-slate-50 hover:bg-slate-100 select-none w-full sm:w-auto">
                    <input type="checkbox" checked={taskModal.data.isPinned || false} onChange={e => setTaskModal({ ...taskModal, data: { ...taskModal.data, isPinned: e.target.checked } })} className="w-4 h-4 accent-indigo-600" />
                    <span className="text-sm font-bold text-slate-700">置頂 (顯示於該區塊最上方)</span>
                </label>
             </div>
            
            <div className="relative"><label className="text-xs font-bold text-gray-500 mb-1 block">圖示 (Emoji)</label><div className="flex gap-2"><input className="flex-1 p-2 border rounded-lg text-center text-xl" placeholder="🐾" value={taskModal.data.icon} onChange={e => setTaskModal({ ...taskModal, data: { ...taskModal.data, icon: e.target.value } })} /><button type="button" onClick={(e) => { e.stopPropagation(); setShowEmojiPicker(!showEmojiPicker); }} className="bg-gray-100 p-2 rounded-lg hover:bg-gray-200 transition-colors"><Icon name="Smile" className="w-5 h-5 text-gray-600" /></button></div>{showEmojiPicker && (<div className="absolute right-0 bottom-full mb-2 bg-white border border-gray-200 rounded-lg shadow-xl p-2 z-50 w-64 grid grid-cols-6 gap-1 max-h-48 overflow-y-auto" onClick={(e) => e.stopPropagation()}>{EMOJI_LIST.map(emoji => (<button key={emoji} type="button" onClick={() => { setTaskModal({ ...taskModal, data: { ...taskModal.data, icon: emoji } }); setShowEmojiPicker(false); }} className="text-xl p-1 hover:bg-indigo-50 rounded">{emoji}</button>))}</div>)}</div>
            <div><label className="text-xs font-bold text-gray-500 mb-1 block">任務描述</label><textarea className="w-full p-2 border rounded-lg h-24 resize-none text-sm" placeholder="請輸入詳細說明..." value={taskModal.data.description} onChange={e => setTaskModal({ ...taskModal, data: { ...taskModal.data, description: e.target.value } })} /></div>
            <Button onClick={handleSaveTask} className="w-full">{taskModal.id ? "更新任務" : "新增任務"}</Button>
         </div>
       </div>
     </Modal>
    
     {/* ▼▼▼ 補回遺失的 Submit Modal ▼▼▼ */}
     <Modal isOpen={submitModal.isOpen} onClose={() => setSubmitModal({ ...submitModal, isOpen: false })} title={`回報: ${submitModal.task?.title}`}>
       <div className="space-y-4">
         <div className="bg-slate-50 p-3 rounded-lg flex items-center gap-3">
            <div className="text-3xl">{submitModal.task?.icon}</div>
            <div>
                <div className="font-bold text-slate-700">{submitModal.task?.title}</div>
                <div className="text-xs text-slate-500">{submitModal.task?.description}</div>
                <div className="text-xs font-bold text-indigo-600 mt-1">{submitModal.task?.type === 'variable' ? '由管理員評分' : `完成可得 ${submitModal.task?.points} pts`}</div>
            </div>
         </div>
         
         <div>
            <label className="text-xs font-bold text-gray-500 mb-1 block">上傳證明截圖 (可選)</label>
            <div onClick={() => fileInputRef.current?.click()} className="w-full h-32 border-2 border-dashed border-gray-300 rounded-xl bg-gray-50 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100 transition-colors">
                {submitModal.images.length > 0 ? (
                    <div className="flex gap-2 overflow-x-auto w-full px-2 h-full items-center">
                        {submitModal.images.map((img, i) => (
                            <img key={i} src={img} className="h-24 w-auto rounded shadow-sm object-cover" />
                        ))}
                    </div>
                ) : (
                    <>
                        <Icon name="Camera" className="w-8 h-8 text-gray-400 mb-2" />
                        <span className="text-xs text-gray-400">點擊上傳圖片</span>
                    </>
                )}
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept="image/*" 
                    multiple 
                    onChange={handleImageUpload} 
                />
            </div>
         </div>

         <div>
            <label className="text-xs font-bold text-gray-500 mb-1 block">備註說明 (可選)</label>
            <textarea 
                className="w-full p-3 border rounded-xl text-sm h-20 resize-none focus:border-indigo-500 outline-none" 
                placeholder="有什麼想補充的嗎？"
                value={submitModal.proof}
                onChange={e => setSubmitModal({ ...submitModal, proof: e.target.value })}
            />
         </div>

         <Button onClick={handleSubmitTask} className="w-full py-3">提交回報</Button>
       </div>
     </Modal>
     {/* ▲▲▲ 結束補回 ▲▲▲ */}

     {/* Announcement Modal - Visual Selector */}
     <Modal isOpen={announceModal.isOpen} onClose={() => setAnnounceModal({ ...announceModal, isOpen: false })} title={announceModal.id ? "編輯公告" : "發佈公告"}>
       <div className="space-y-3">
         <input className="w-full p-2 border rounded-lg font-bold" placeholder="主旨標題" value={announceModal.title} onChange={e => setAnnounceModal({ ...announceModal, title: e.target.value })} />
         <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-gray-500">分類標籤</label>
            {/* ▼▼▼ 使用 CategorySelector ▼▼▼ */}
            <CategorySelector 
                options={availableAncCats}
                selectedId={announceModal.categoryId}
                onSelect={(cat) => setAnnounceModal(prev => ({ 
                    ...prev, 
                    category: cat.label, 
                    categoryId: cat.firestoreId,
                    categoryColor: cat.color
                }))}
            />
            <label className="flex items-center gap-2 p-2 border rounded-lg cursor-pointer bg-slate-50 hover:bg-slate-100 select-none w-full sm:w-auto mt-2"><input type="checkbox" checked={announceModal.isPinned} onChange={e => setAnnounceModal({ ...announceModal, isPinned: e.target.checked })} className="w-4 h-4 accent-indigo-600" /><span className="text-sm font-bold text-slate-700">置頂</span></label>
         </div>
         <RichTextEditor value={announceModal.content} onChange={(html) => setAnnounceModal(prev => ({ ...prev, content: html }))} onImageUpload={handleEditorImageUpload} />
         <div><div className="text-xs font-bold text-gray-500 mb-2 flex justify-between items-end"><span>附件圖片 (顯示於文章底部)</span><span className="text-[10px] text-gray-400 font-normal">點擊可刪除</span></div>{announceModal.images && announceModal.images.length > 0 && (<div className="grid grid-cols-4 gap-2 mb-2">{announceModal.images.map((url, idx) => (<div key={idx} className="relative group cursor-pointer" onClick={() => handleRemoveAnnounceImage(idx)}><img src={url} className="w-full h-16 object-cover rounded border border-gray-200" /><div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded text-white"><Icon name="Trash2" className="w-4 h-4" /></div></div>))}</div>)}<div onClick={() => announceFileRef.current?.click()} className="w-full min-h-[60px] rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 flex flex-wrap gap-2 p-2 cursor-pointer items-center justify-center hover:bg-gray-100 transition-colors"><div className="text-gray-400 flex flex-col items-center"><Icon name="Image" className="w-5 h-5 mb-1" /><span className="text-xs">點擊新增附件</span></div><input type="file" ref={announceFileRef} className="hidden" accept="image/*" multiple onChange={handleAnnounceImageUpload} /></div></div>
         <Button onClick={handleAddAnnouncement} className="w-full mt-2">{announceModal.id ? "更新" : "發佈"}</Button>
       </div>
     </Modal>

     {/* ... Other Modals ... */}
     <Modal isOpen={gameModal.isOpen} onClose={() => setGameModal({ ...gameModal, isOpen: false })} title={gameModal.id ? "編輯遊戲" : "新增遊戲"}>
       <div className="space-y-3">
         <input className="w-full p-2 border rounded-lg" placeholder="遊戲名稱" value={gameModal.title} onChange={e => setGameModal({ ...gameModal, title: e.target.value })} />
         <input className="w-full p-2 border rounded-lg" placeholder="https://..." value={gameModal.url} onChange={e => setGameModal({ ...gameModal, url: e.target.value })} />
         <input className="w-full p-2 border rounded-lg text-center" placeholder="Icon (Emoji)" value={gameModal.icon} onChange={e => setGameModal({ ...gameModal, icon: e.target.value })} />
         <Button onClick={handleSaveGame} className="w-full mt-2">儲存</Button>
       </div>
     </Modal>

     <Modal isOpen={archiveModal.isOpen} onClose={() => setArchiveModal({ ...archiveModal, isOpen: false })} title="重置賽季">
        <div className="space-y-4">
           <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-100 text-xs text-yellow-700">⚠️ 警告：此操作將重置所有積分並封存目前資料。</div>
           <input className="w-full p-2 border rounded-lg" placeholder="新賽季名稱" value={archiveModal.newSeasonName} onChange={e => setArchiveModal({ ...archiveModal, newSeasonName: e.target.value })} />
           <Button variant="danger" onClick={() => { if(archiveModal.newSeasonName) actions.archive(archiveModal.newSeasonName).then(() => setArchiveModal({...archiveModal, isOpen: false})); }} className="w-full">確認重置</Button>
        </div>
     </Modal>

     <Modal isOpen={userRoleModal.isOpen} onClose={() => setUserRoleModal({ ...userRoleModal, isOpen: false })} title={`設定身分: ${userRoleModal.uid}`}>
         <div className="space-y-4">
             <div className="bg-indigo-50 p-3 rounded-lg text-xs text-indigo-700 mb-2">勾選此使用者擁有的身分組 (可多選)</div>
             <div className="space-y-2 max-h-[300px] overflow-y-auto">
                 {(roles || []).map(role => (
                     <label key={role.code} className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-gray-50"><div className="flex items-center gap-2"><span style={{color: role.color}} className="font-bold">{role.label}</span><span className="text-xs text-gray-400">x{role.multiplier}</span></div><input type="checkbox" checked={(userRoleModal.roles || []).includes(role.code)} onChange={(e) => { const currentRoles = userRoleModal.roles || []; const newRoles = e.target.checked ? [...currentRoles, role.code] : currentRoles.filter(r => r !== role.code); setUserRoleModal({ ...userRoleModal, roles: newRoles }); }} className="w-5 h-5 accent-indigo-600" /></label>
                 ))}
                 {(!roles || roles.length === 0) && <div className="text-center text-gray-400 text-sm">請先至個人頁面建立身分組</div>}
             </div>
             <Button onClick={handleUpdateUserRoles} className="w-full">儲存設定</Button>
         </div>
     </Modal>

     <ConfirmDialog {...dialog} onCancel={() => setDialog({ ...dialog, isOpen: false })} />
   </div>
 );
};

export default function App() { return (<ToastProvider><AppContent /></ToastProvider>); }