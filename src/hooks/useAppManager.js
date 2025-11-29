import { useState, useMemo } from 'react';
import { useAuth } from './useAuth';
import { useData } from './useData';
import { useAdmin } from './useAdmin';
import { useToast } from '../context/ToastContext';

// 這個 Hook 用來組合所有的功能，讓 App.jsx 保持乾淨
export const useAppManager = () => {
  const [activeTab, setActiveTab] = useState('announcements');
  const [expandedWeeks, setExpandedWeeks] = useState({});
  const [dialog, setDialog] = useState({ isOpen: false, title: '', message: '', onConfirm: null });
  const { showToast } = useToast();

  // 1. Auth 模組
  const { currentUser, loading: authLoading, login, logout, updateCurrentUser } = useAuth();

  // 2. Data 模組
  const { tasks, submissions, users, announcements, games, seasonName } = useData(currentUser, updateCurrentUser);

  // 3. Admin 模組
  const { actions: adminActions, adminLoading } = useAdmin(currentUser, seasonName, users);

  // UI Helper Actions (這些是 "Wrapper" 函式，負責先用 ID 找到物件，再呼叫 Admin Action)
  const uiActions = {
    setTab: (tab) => setActiveTab(tab),
    toggleWeek: (week) => {
      setExpandedWeeks(prev => ({ ...prev, [week]: !prev[week] }));
    },
    refresh: () => showToast("資料已是最新狀態"),
    
    // --- 這裡的函式名稱與 adminActions 重疊，必須確保這些 Wrapper 優先執行 ---

    deleteTask: (id) => {
      const task = tasks.find(t => t.id === id);
      if (task) {
        setDialog({ isOpen: true, title: "刪除任務", message: "確定？", onConfirm: async () => { 
          await adminActions.deleteTask(task.firestoreId); 
          setDialog(prev => ({ ...prev, isOpen: false })); 
        }});
      }
    },
    deleteAnnouncement: (id) => {
      const item = announcements.find(x => x.id === id);
      if (item) {
        setDialog({ isOpen: true, title: "刪除公告", message: "確定？", onConfirm: async () => { 
          await adminActions.deleteAnnouncement(item.firestoreId); 
          setDialog(prev => ({ ...prev, isOpen: false })); 
        }});
      }
    },
    deleteGame: (id) => {
      const item = games.find(x => x.id === id);
      if (item) {
        setDialog({ isOpen: true, title: "刪除遊戲", message: "確定？", onConfirm: async () => { 
          await adminActions.deleteGame(item.firestoreId); 
          setDialog(prev => ({ ...prev, isOpen: false })); 
        }});
      }
    },
    withdraw: (subId) => {
      const sub = submissions.find(s => s.id === subId);
      if (sub) {
        setDialog({ isOpen: true, title: "撤回提交", message: "確定？", onConfirm: async () => { 
          await adminActions.withdraw(sub.firestoreId); 
          setDialog(prev => ({ ...prev, isOpen: false })); 
        }});
      }
    },
    review: (subId, action, points, statusOverride) => {
        const sub = submissions.find(s => s.id === subId);
        if(sub) {
            adminActions.review(sub, action, points, statusOverride);
        } else {
            console.error("Submission not found in local state:", subId);
            showToast("找不到該筆資料，請重新整理", "error");
        }
    },
    updateAnnouncement: (id, title, content, rawFiles) => {
        const item = announcements.find(x => x.id === id);
        if(item) return adminActions.updateAnnouncement(item, title, content, rawFiles);
    },
    updateGame: (data) => {
        const item = games.find(g => g.id === data.id);
        if(item) return adminActions.updateGame(item, data);
    }
  };

  // 自動展開第一週 (如果還沒展開過)
  useMemo(() => {
    if (tasks.length > 0 && Object.keys(expandedWeeks).length === 0) {
        const weeks = tasks.map(t => parseInt(t.week) || 0);
        if (weeks.length > 0) setExpandedWeeks({ [Math.max(...weeks)]: true });
    }
  }, [tasks]);

  const sortedUsers = useMemo(() => {
    return [...users].filter(u => !u.isAdmin).sort((a, b) => (Number(b.points) || 0) - (Number(a.points) || 0));
  }, [users]);

  // 組合所有 State 與 Actions 回傳給 App.jsx
  return {
    state: {
      tasks, submissions, users, announcements, games, currentUser,
      activeTab, loading: authLoading || adminLoading, expandedWeeks, seasonName, refreshing: false
    },
    actions: {
      login, 
      logout, 
      // ⚠️ 修正重點：把 ...adminActions 放在前面，...uiActions 放在後面
      // 這樣當函式名稱重複時 (如 review, deleteTask)，會優先使用 uiActions 的版本 (Wrapper)
      ...adminActions,
      ...uiActions 
    },
    sortedUsers,
    dialog,
    setDialog
  };
};