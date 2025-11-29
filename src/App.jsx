import React, { useState, useRef } from 'react';
import { useAppManager } from './hooks/useAppManager';
import { ToastProvider } from './context/ToastContext';
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

const AppContent = () => {
  const { state, actions, sortedUsers, dialog, setDialog } = useAppManager();
  const { tasks, submissions, users, currentUser, activeTab, loading, expandedWeeks, seasonName, announcements, games } = state;

  const [taskModal, setTaskModal] = useState({ isOpen: false, data: { title: '', points: 10, icon: '🐾', description: '', week: '1', type: 'fixed' } });
  const [submitModal, setSubmitModal] = useState({ isOpen: false, task: null, proof: '', images: [] });
  const [archiveModal, setArchiveModal] = useState({ isOpen: false, newSeasonName: '' });
  const [announceModal, setAnnounceModal] = useState({ isOpen: false, id: null, title: '', content: '', images: [] });
  const [gameModal, setGameModal] = useState({ isOpen: false, id: null, title: '', url: '', icon: '' });

  const fileInputRef = useRef(null);
  const announceFileRef = useRef(null);

  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      setSubmitModal(prev => ({ ...prev, rawFiles: files, images: files.map(f => URL.createObjectURL(f)) }));
    }
  };

  const handleAnnounceImageUpload = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      setAnnounceModal(prev => ({ ...prev, rawFiles: files, images: files.map(f => URL.createObjectURL(f)) }));
    }
  };

  const handleSubmitTask = async () => {
    const success = await actions.submitTask({
        task: submitModal.task,
        proof: submitModal.proof,
        rawFiles: submitModal.rawFiles
    });
    if (success) setSubmitModal({ isOpen: false, task: null, proof: '', images: [], rawFiles: [] });
  };

  const handleAddAnnouncement = async () => {
    let success = false;
    if (announceModal.id) {
        success = await actions.updateAnnouncement(announceModal.id, announceModal.title, announceModal.content, announceModal.rawFiles);
    } else {
        success = await actions.addAnnouncement(announceModal.title, announceModal.content, announceModal.rawFiles);
    }
    if (success) setAnnounceModal({ isOpen: false, id: null, title: '', content: '', images: [], rawFiles: [] });
  };

  const handleSaveGame = async () => {
    const gameData = { id: gameModal.id, title: gameModal.title, url: gameModal.url, icon: gameModal.icon };
    if (!gameData.title || !gameData.url) return;
    
    let success = false;
    if (gameModal.id) {
        success = await actions.updateGame(gameData);
    } else {
        success = await actions.addGame(gameData);
    }
    if (success) setGameModal({ isOpen: false, id: null, title: '', url: '', icon: '' });
  };

  if (!currentUser) {
    return (
      <>
        <LoadingOverlay isLoading={loading} />
        <LoginView 
            onLogin={actions.login} 
            loading={loading} 
            onInitialize={actions.initializeSystem} 
        />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-24 font-sans">
      <LoadingOverlay isLoading={loading} />
      
      {/* Header */}
      <div className="bg-white sticky top-0 z-40 shadow-sm px-4 py-3 flex justify-between items-center border-b border-gray-100 safe-area-top">
        <div className="flex items-center gap-2">
          <div className="font-black text-lg text-indigo-600">Team Aura</div>
          {currentUser.isAdmin && <Badge color="indigo">ADMIN</Badge>}
          {seasonName && <span className="text-xs font-bold text-gray-500 border-l border-gray-300 pl-2">{seasonName}</span>}
        </div>
        <div className="flex items-center gap-2">
          {/* 修正 1: 加上 || 0 確保有點數顯示 */}
          {!currentUser.isAdmin && <Badge color="indigo" className="text-sm">{(currentUser.points || 0)} pts</Badge>}
          <button onClick={actions.refresh} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors">
            <Icon name="RefreshCw" className={`w-4 h-4 ${state.refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className={`w-full mx-auto px-3 sm:px-4 py-4 space-y-6 ${activeTab === 'report' ? 'max-w-[95vw]' : 'max-w-3xl'}`}>
        {activeTab === 'announcements' && (
          <AnnouncementView 
            announcements={announcements} 
            isAdmin={currentUser.isAdmin} 
            currentSeason={seasonName}
            onOpenAdd={() => setAnnounceModal({ isOpen: true, id: null, title: '', content: '', images: [] })} 
            onOpenEdit={(anc) => setAnnounceModal({ isOpen: true, id: anc.id, title: anc.title, content: anc.content, images: JSON.parse(anc.images || '[]') })}
            onDelete={actions.deleteAnnouncement}
          />
        )}
        {activeTab === 'tasks' && (
          <TaskListView 
            tasks={tasks} submissions={submissions} currentUser={currentUser} isAdmin={currentUser.isAdmin} 
            expandedWeeks={expandedWeeks} onToggleWeek={actions.toggleWeek} onDeleteTask={actions.deleteTask} onOpenWithdraw={actions.withdraw}
            onOpenSubmit={(t) => setSubmitModal({ isOpen: true, task: t, proof: '', images: [], rawFiles: [] })}
            onOpenEditTask={() => setTaskModal({ isOpen: true, data: { title: '', points: 10, icon: '🐾', description: '', week: '1', type: 'fixed' } })}
          />
        )}
        {activeTab === 'leaderboard' && <LeaderboardView users={sortedUsers} currentUser={currentUser} />}
        {activeTab === 'report' && currentUser.isAdmin && (
          <ReportView 
            tasks={tasks} users={users} submissions={submissions} 
            onArchiveSeason={() => setArchiveModal({ isOpen: true, newSeasonName: '' })} 
          />
        )}
        {activeTab === 'profile' && (
          <ProfileView 
            currentUser={currentUser} tasks={tasks} submissions={submissions} 
            isAdmin={currentUser.isAdmin} 
            onLogout={actions.logout} 
            onReview={actions.review} 
            // 修正 2: 傳遞初始化函式
            onInitialize={actions.initializeSystem}
          />
        )}
        {activeTab === 'game' && (
          <GameView 
            games={games} isAdmin={currentUser.isAdmin}
            onOpenAdd={() => setGameModal({ isOpen: true, id: null, title: '', url: '', icon: '' })}
            onOpenEdit={(g) => setGameModal({ isOpen: true, id: g.id, title: g.title, url: g.url, icon: g.icon })}
            onDelete={actions.deleteGame}
          />
        )}
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 w-full bg-white border-t border-gray-200 py-2 flex justify-around text-xs font-bold text-gray-400 safe-area-bottom z-30">
        {[
          { id: 'announcements', icon: 'Bell', label: '公告' },
          { id: 'tasks', icon: 'Map', label: '任務' }, 
          { id: 'leaderboard', icon: 'Trophy', label: '排行' }, 
          ...(currentUser.isAdmin ? [{ id: 'report', icon: 'Table', label: '報表' }] : []), 
          { id: 'profile', icon: 'User', label: '個人' },
          { id: 'game', icon: 'Gamepad', label: '遊戲' }
        ].map(tab => (
          <button 
            key={tab.id} 
            onClick={() => actions.setTab(tab.id)} 
            className={`flex flex-col items-center gap-1 p-2 ${activeTab === tab.id ? 'text-indigo-600' : ''}`}
          >
            <Icon name={tab.icon} className="w-6 h-6" /> {tab.label}
          </button>
        ))}
      </div>

      {/* Modals */}
      <Modal isOpen={taskModal.isOpen} onClose={() => setTaskModal({ ...taskModal, isOpen: false })} title="新增任務">
        <div className="space-y-3">
          <input className="w-full p-2 border rounded-lg" placeholder="標題" value={taskModal.data.title} onChange={e => setTaskModal({ ...taskModal, data: { ...taskModal.data, title: e.target.value } })} />
          <div className="flex gap-2">
            <select className="flex-1 p-2 border rounded-lg" value={taskModal.data.type} onChange={e => setTaskModal({ ...taskModal, data: { ...taskModal.data, type: e.target.value } })}><option value="fixed">固定分數</option><option value="variable">管理員評分</option></select>
            <input type="number" className="flex-1 p-2 border rounded-lg" placeholder="週次" value={taskModal.data.week} onChange={e => setTaskModal({ ...taskModal, data: { ...taskModal.data, week: e.target.value } })} />
          </div>
          {taskModal.data.type === 'fixed' && <input type="number" className="w-full p-2 border rounded-lg" placeholder="分數" value={taskModal.data.points} onChange={e => setTaskModal({ ...taskModal, data: { ...taskModal.data, points: e.target.value } })} />}
          <input className="w-full p-2 border rounded-lg text-center" placeholder="Icon (Emoji)" value={taskModal.data.icon} onChange={e => setTaskModal({ ...taskModal, data: { ...taskModal.data, icon: e.target.value } })} />
          <textarea className="w-full p-2 border rounded-lg h-20 resize-none" placeholder="描述" value={taskModal.data.description} onChange={e => setTaskModal({ ...taskModal, data: { ...taskModal.data, description: e.target.value } })} />
          <Button onClick={() => actions.addTask(taskModal.data).then(s => s && setTaskModal({...taskModal, isOpen: false}))} className="w-full">儲存</Button>
        </div>
      </Modal>

      <Modal isOpen={submitModal.isOpen} onClose={() => setSubmitModal({ ...submitModal, isOpen: false })} title={submitModal.task?.title}>
        <div className="space-y-4">
          <div onClick={() => fileInputRef.current?.click()} className="w-full min-h-[120px] rounded-xl border-2 border-dashed border-indigo-300 bg-indigo-50 flex flex-wrap gap-2 p-2 cursor-pointer relative items-center justify-center hover:bg-indigo-100 transition-colors">
            {submitModal.images.length > 0 ? submitModal.images.map((url, i) => <img key={i} src={url} className="w-20 h-20 object-cover rounded shadow-sm" />) : <div className="text-indigo-400 flex flex-col items-center"><Icon name="Camera" className="w-8 h-8 mb-1" /><span className="text-xs font-bold">上傳照片</span></div>}
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" multiple onChange={handleImageUpload} />
          </div>
          <textarea className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 h-24 resize-none" placeholder="備註..." value={submitModal.proof} onChange={e => setSubmitModal({ ...submitModal, proof: e.target.value })} />
          <Button onClick={handleSubmitTask} disabled={loading} className="w-full py-3">提交</Button>
        </div>
      </Modal>

      <Modal isOpen={announceModal.isOpen} onClose={() => setAnnounceModal({ ...announceModal, isOpen: false })} title={announceModal.id ? "編輯公告" : "發佈公告"}>
        <div className="space-y-3">
          <input className="w-full p-2 border rounded-lg font-bold" placeholder="主旨標題" value={announceModal.title} onChange={e => setAnnounceModal({ ...announceModal, title: e.target.value })} />
          <RichTextEditor value={announceModal.content} onChange={(html) => setAnnounceModal(prev => ({ ...prev, content: html }))} />
          <div onClick={() => announceFileRef.current?.click()} className="w-full min-h-[80px] rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 flex flex-wrap gap-2 p-2 cursor-pointer items-center justify-center hover:bg-gray-100">
             {announceModal.images.length > 0 ? announceModal.images.map((url, i) => <img key={i} src={url} className="w-16 h-16 object-cover rounded shadow-sm" />) : <div className="text-gray-400 flex flex-col items-center"><Icon name="Image" className="w-5 h-5 mb-1" /><span className="text-xs">選擇圖片</span></div>}
             <input type="file" ref={announceFileRef} className="hidden" accept="image/*" multiple onChange={handleAnnounceImageUpload} />
          </div>
          <Button onClick={handleAddAnnouncement} className="w-full mt-2">{announceModal.id ? "更新" : "發佈"}</Button>
        </div>
      </Modal>

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

      <ConfirmDialog {...dialog} onCancel={() => setDialog({ ...dialog, isOpen: false })} />
    </div>
  );
};

export default function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}